import express, { json } from "express";
import { config } from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";

config();
const app = express();
app.use(cors());
app.use(json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful coding assistant. Your name is 'Code Fit AI JS'. You will be provided with a piece of JavaScript code, and your task is to explain it in a concise way. Do not answer queries unrelated to code. Never break character.",
        },
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
    // res.json({ reply: response.choices[0].message.content });
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
