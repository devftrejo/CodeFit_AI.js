// Cloud Functions for CodeFit_AI.js — the chat HTTPS handler.
// Ported from server/server.js. Streams OpenAI completions as SSE,
// same wire format as before (`data: {"content": "..."}\n\n` then `data: [DONE]`).
// Phase 3 added Firebase Auth verification — every request must carry a
// valid Firebase ID token in `Authorization: Bearer <token>`.

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { OpenAI } from "openai";

import { systemMessages } from "./prompts.js";

setGlobalOptions({ maxInstances: 10 });

// Admin SDK init runs once at module load. In the emulator it auto-connects
// to the Auth emulator via the FIREBASE_AUTH_EMULATOR_HOST env var that the
// Firebase emulators set automatically; in prod it uses the Functions service
// account credentials.
initializeApp();
const adminAuth = getAuth();

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

    // decodedToken.uid is captured here; Phase 4–5 use it to persist messages
    // under users/{uid}/conversations/...
    void decodedToken;

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
