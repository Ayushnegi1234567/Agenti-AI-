import express from "express";
import cors from "cors";
import { streamAgentResponse } from "./lib/agentService.js";

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

  try {
    let fullResponse = "";

    for await (const chunk of streamAgentResponse({ userPrompt: String(message), history })) {
      fullResponse += chunk;
    }

    res.json({ type: "done", text: fullResponse });
  } catch (error) {
    res.status(500).json({
      type: "error",
      text: error instanceof Error ? error.message : "Something went wrong.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
