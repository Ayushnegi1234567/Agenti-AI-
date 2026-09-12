import { streamAgentResponse } from "../lib/agentService.js";

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

  try {
    let fullResponse = "";

    for await (const chunk of streamAgentResponse({
      userPrompt: String(message),
      history,
    })) {
      fullResponse += chunk;
    }

    res.status(200).json({ type: "done", text: fullResponse });
  } catch (error) {
    res.status(500).json({
      type: "error",
      text: error instanceof Error ? error.message : "Something went wrong.",
    });
  }
}
