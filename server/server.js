import express, { json } from "express";
import { config } from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";

import { systemMessages } from "./prompts.js";

config();
const app = express();
app.use(cors());
app.use(json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/", async (req, res) => {
  const { message, role } = req.body;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "`message` is required." });
  }

  const systemMessage = systemMessages[role];
  if (!systemMessage) {
    return res.status(400).json({
      error: `Unknown role: ${role}. Known roles: ${Object.keys(systemMessages).join(", ")}`,
    });
  }

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
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
