import { streamAgentResponse } from "../lib/agentService.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const { message, history = [] } = req.body ?? {};

  if (!message || !String(message).trim()) {
    res.status(400).json({ error: "Message is required." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    let fullResponse = "";

    for await (const chunk of streamAgentResponse({
      userPrompt: String(message),
      history,
    })) {
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
}
