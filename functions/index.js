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
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { OpenAI } from "openai";

import { systemMessages } from "./prompts.js";

setGlobalOptions({ maxInstances: 10 });

// Admin SDK init runs once at module load. In the emulator it auto-connects to
// the Auth + Firestore emulators via the FIREBASE_AUTH_EMULATOR_HOST and
// FIRESTORE_EMULATOR_HOST env vars the suite injects; in prod it uses the
// Functions service-account credentials.
initializeApp();
const adminAuth = getAuth();
const db = getFirestore();

// OPENAI_API_KEY is held in Secret Manager (Phase 0:
// `firebase functions:secrets:set OPENAI_API_KEY`). In the emulator it
// reads from functions/.secret.local instead. Never put it in env vars.
const openaiKey = defineSecret("OPENAI_API_KEY");

const TITLE_MAX_LENGTH = 50;

export const chat = onRequest(
  {
    secrets: [openaiKey],
    memory: "512MiB",
    timeoutSeconds: 300,
    // CORS is handled by the Hosting rewrite in prod and Vite proxy in dev,
    // so the function itself stays same-origin.
    cors: false,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res
        .set("Allow", "POST")
        .status(405)
        .json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.get("Authorization") || "";
    const tokenMatch = authHeader.match(/^Bearer (.+)$/);
    if (!tokenMatch) {
      res
        .status(401)
        .json({ error: "Missing or malformed Authorization header" });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(tokenMatch[1]);
    } catch (error) {
      console.warn(
        "ID token verification failed:",
        error.code || error.message
      );
      res.status(401).json({ error: "Invalid or expired auth token" });
      return;
    }

    const uid = decodedToken.uid;
    const { message, role, conversationId } = req.body ?? {};

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

    // Resolve the conversation and load prior turns for context. A null/absent
    // conversationId starts a new conversation; an unknown one is a 404.
    const conversationsRef = db
      .collection("users")
      .doc(uid)
      .collection("conversations");

    let conversationRef;
    let priorMessages = [];

    try {
      if (conversationId) {
        conversationRef = conversationsRef.doc(conversationId);
        const snapshot = await conversationRef.get();
        if (!snapshot.exists) {
          res.status(404).json({ error: "Conversation not found." });
          return;
        }
        const messagesSnapshot = await conversationRef
          .collection("messages")
          .orderBy("createdAt", "asc")
          .get();
        priorMessages = messagesSnapshot.docs.map((doc) => doc.data());
      } else {
        conversationRef = conversationsRef.doc();
        await conversationRef.set({
          title: message.slice(0, TITLE_MAX_LENGTH),
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

    const openai = new OpenAI({ apiKey: openaiKey.value() });

    // Full prior conversation + the new user message, behind the active
    // persona's system prompt.
    const openaiMessages = [
      { role: "system", content: systemMessage },
      ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    let assistantBuffer = "";

    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        stream: true,
      });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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
