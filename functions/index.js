// Cloud Functions for CodeFit_AI.js — the chat HTTPS handler.
// Ported from server/server.js. Streams OpenAI completions as SSE,
// same wire format as before (`data: {"content": "..."}\n\n` then `data: [DONE]`).
//
// Phase 3 added Firebase Auth verification (Authorization: Bearer <token>).
// Phase 4 added Firestore persistence: the handler resolves/creates a
// conversation, stores the user + assistant messages, and feeds the full
// prior conversation back to OpenAI as context.

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import { systemMessages, buildSystemPrompt } from "./prompts.js";
import {
  db,
  FieldValue,
  openaiKey,
  CORS_ORIGINS,
  getOpenAI,
  requirePostAuth,
  checkRateLimit,
  sendRateLimited,
} from "./shared.js";

setGlobalOptions({ maxInstances: 10 });

// Voice endpoints live in voice.js; re-export so Firebase discovers them from
// this entry module alongside `chat`.
export { transcribe, speak } from "./voice.js";

const TITLE_MAX_LENGTH = 50;

// Roles whose help is about the student's own code — for these we attach the
// current sandbox (editor) contents as context. Plain curriculum Q&A doesn't.
const CODE_ROLES = new Set(["codeExplainer", "debugger", "optimizationExpert"]);

// Caps to keep the OpenAI request bounded in size and cost.
const MAX_CODE_CHARS = 4000; // per editor pane
const MAX_HISTORY_MESSAGES = 20; // most recent stored messages replayed as context

// Build a context block from the student's sandbox code. Only non-empty panes
// are included; each is capped at MAX_CODE_CHARS. Returns null when there's
// nothing to send.
function buildCodeContext(code) {
  if (!code || typeof code !== "object") return null;
  const cap = (value) => String(value).slice(0, MAX_CODE_CHARS);
  const panes = [
    ["HTML", "html", code.html],
    ["CSS", "css", code.css],
    ["JavaScript", "javascript", code.js],
  ];
  const parts = panes
    .filter(([, , value]) => typeof value === "string" && value.trim())
    .map(
      ([label, fence, value]) =>
        `${label}:\n\`\`\`${fence}\n${cap(value)}\n\`\`\``
    );
  if (!parts.length) return null;
  return (
    "The student's current sandbox code is below. Base your help on it.\n\n" +
    parts.join("\n\n")
  );
}

export const chat = onRequest(
  {
    secrets: [openaiKey],
    memory: "512MiB",
    timeoutSeconds: 300,
    // The client calls this function directly in prod (Firebase Hosting buffers
    // SSE from rewrites, which breaks streaming), so CORS must allow our own
    // origins. Restricted to the app's domains; the Firebase ID token is still
    // the real gate. Dev uses the Vite proxy (same-origin), so localhost is
    // only here for the occasional direct emulator call.
    cors: CORS_ORIGINS,
  },
  async (req, res) => {
    const uid = await requirePostAuth(req, res);
    if (!uid) return;

    const { message, role, conversationId, language, topic, code } =
      req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "`message` is required." });
      return;
    }

    const systemMessage = systemMessages[role];
    if (!systemMessage) {
      res.status(400).json({
        error: `Unknown role: ${role}. Known roles: ${Object.keys(systemMessages).join(", ")}`,
      });
      return;
    }

    // Every conversation is anchored to a curriculum topic — there's no
    // free-form chat outside the curriculum. A new conversation therefore
    // requires the language + topic it belongs to; continuing an existing one
    // (conversationId set) reuses that conversation's topic.
    const hasTopic =
      typeof language === "string" &&
      language.trim() &&
      typeof topic === "string" &&
      topic.trim();
    if (!conversationId && !hasTopic) {
      res.status(400).json({
        error:
          "A curriculum `language` and `topic` are required to start a conversation.",
      });
      return;
    }

    // Cost guard: bound how often a single account can hit the endpoint. Checked
    // after validation (so malformed requests don't consume quota) but before
    // any conversation writes or the OpenAI call.
    const rate = await checkRateLimit(uid);
    if (!rate.allowed) {
      sendRateLimited(res, rate.retryAfterSeconds);
      return;
    }

    // Resolve the conversation and load prior turns for context. A null/absent
    // conversationId starts a new conversation; an unknown one is a 404.
    const conversationsRef = db
      .collection("users")
      .doc(uid)
      .collection("conversations");

    let conversationRef;
    let priorMessages = [];
    // The lesson this conversation is anchored to. For a new conversation it's
    // the language/topic from the request; for an existing one we trust the
    // conversation doc (authoritative) so the lesson context can't drift.
    let lessonLanguage = language;
    let lessonTopic = topic;

    try {
      if (conversationId) {
        conversationRef = conversationsRef.doc(conversationId);
        const snapshot = await conversationRef.get();
        if (!snapshot.exists) {
          res.status(404).json({ error: "Conversation not found." });
          return;
        }
        const convData = snapshot.data();
        lessonLanguage = convData.language ?? language;
        lessonTopic = convData.topic ?? topic;

        const messagesSnapshot = await conversationRef
          .collection("messages")
          .orderBy("createdAt", "asc")
          .get();
        // Drop error placeholders and empty turns so they don't pollute the
        // context, then keep only the most recent MAX_HISTORY_MESSAGES.
        priorMessages = messagesSnapshot.docs
          .map((doc) => doc.data())
          .filter(
            (m) => !m.error && typeof m.content === "string" && m.content.trim()
          )
          .slice(-MAX_HISTORY_MESSAGES);
      } else {
        // New conversation: key it to its curriculum topic so the client can
        // resume it by re-selecting the topic (topicKey = "<language>::<topic>").
        conversationRef = conversationsRef.doc();
        await conversationRef.set({
          title: `${language} · ${topic}`.slice(0, TITLE_MAX_LENGTH),
          topicKey: `${language}::${topic}`,
          language,
          topic,
          role,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Persist the user message before streaming so it survives a dropped
      // connection mid-response.
      await conversationRef.collection("messages").add({
        role: "user",
        content: message,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Firestore read/write before stream failed:", error);
      res
        .status(500)
        .json({ error: "Failed to load or save the conversation." });
      return;
    }

    const openai = getOpenAI();

    // The active persona, scoped to the lesson (language + topic). For code
    // roles, attach the student's current sandbox as an extra context block.
    // Then the windowed prior conversation + the new user message.
    const openaiMessages = [
      {
        role: "system",
        content: buildSystemPrompt(role, {
          language: lessonLanguage,
          topic: lessonTopic,
        }),
      },
    ];

    const codeContext = CODE_ROLES.has(role) ? buildCodeContext(code) : null;
    if (codeContext) {
      openaiMessages.push({ role: "system", content: codeContext });
    }

    openaiMessages.push(
      ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    );

    let assistantBuffer = "";

    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: openaiMessages,
        stream: true,
        // gpt-5.4-mini is a reasoning model, so it differs from gpt-4o-mini:
        //  - It uses `max_completion_tokens` (not `max_tokens`).
        //  - It only accepts the default temperature, so `temperature` is omitted.
        //  - `reasoning_effort` ranges none|low|medium|high|xhigh. "none" makes
        //    it behave like the old non-reasoning gpt-4o-mini — fastest, cheapest,
        //    and it spends no reasoning tokens (which bill as output) — a good fit
        //    for a snappy teaching assistant. Raise to "low"+ for deeper coding
        //    help at higher latency/cost.
        // With reasoning off, the whole budget is visible output; 2048 leaves
        // room for code-heavy answers while bounding cost (output is $4.50/MTok).
        max_completion_tokens: 2048,
        reasoning_effort: "none",
      });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        // `no-transform` stops the Google Front End from gzip-compressing the
        // response — compression buffers the whole body and breaks SSE
        // streaming. This applies behind both Hosting rewrites and direct
        // Cloud Run, since both sit behind the GFE. `X-Accel-Buffering: no`
        // additionally signals proxies not to buffer the stream.
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        // In the emulator, the Vite dev proxy pools the upstream socket; a
        // keep-alive SSE response leaves it in a state that makes the proxy's
        // next request fail (every other chat 400s). Closing the connection
        // forces a fresh socket per request. In prod the platform manages
        // connections, so keep-alive is correct there.
        Connection:
          process.env.FUNCTIONS_EMULATOR === "true" ? "close" : "keep-alive",
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          assistantBuffer += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      const assistantRef = await conversationRef.collection("messages").add({
        role: "assistant",
        content: assistantBuffer,
        aiRole: role,
        createdAt: FieldValue.serverTimestamp(),
      });
      await conversationRef.update({ updatedAt: FieldValue.serverTimestamp() });

      // Tell the client which conversation/message this landed in — needed
      // when the client started with a null conversationId.
      res.write(
        `data: ${JSON.stringify({
          conversationId: conversationRef.id,
          messageId: assistantRef.id,
        })}\n\n`
      );
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error) {
      console.error("OpenAI request failed:", error);
      // The user message is already saved; record an assistant placeholder so
      // the conversation isn't left half-finished.
      try {
        await conversationRef.collection("messages").add({
          role: "assistant",
          content: "An error occurred while generating this response.",
          aiRole: role,
          error: true,
          createdAt: FieldValue.serverTimestamp(),
        });
        await conversationRef.update({
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (persistError) {
        console.error("Failed to persist error placeholder:", persistError);
      }

      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "An error occurred while processing your request." });
      } else {
        res.write(
          `data: ${JSON.stringify({ error: "generation_failed" })}\n\n`
        );
        res.end();
      }
    }
  }
);
