// Cloud Functions for CodeFit_AI.js — the chat HTTPS handler.
// Ported from server/server.js. Streams OpenAI completions as SSE,
// same wire format as before (`data: {"content": "..."}\n\n` then `data: [DONE]`).

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { OpenAI } from "openai";

import { systemMessages } from "./prompts.js";

setGlobalOptions({ maxInstances: 10 });

// OPENAI_API_KEY is held in Secret Manager (Phase 0:
// `firebase functions:secrets:set OPENAI_API_KEY`). In the emulator it
// reads from functions/.secret.local instead. Never put it in env vars.
const openaiKey = defineSecret("OPENAI_API_KEY");

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

    const { message, role } = req.body ?? {};

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

    const openai = new OpenAI({ apiKey: openaiKey.value() });

    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: message },
        ],
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
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error) {
      console.error("OpenAI request failed:", error);
      // Guard against the case where streaming headers were already sent.
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "An error occurred while processing your request." });
      } else {
        res.end();
      }
    }
  }
);
