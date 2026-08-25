import express from "express";
import cors from "cors";
import { streamAgentResponse } from "./agentService.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body ?? {};

  if (!message || !String(message).trim()) {
    res.status(400).json({ error: "Message is required." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    let fullResponse = "";

    for await (const chunk of streamAgentResponse({ userPrompt: String(message), history })) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "done", text: fullResponse })}\n\n`);
    res.end();
  } catch (error) {
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong.",
      })}\n\n`
    );
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
