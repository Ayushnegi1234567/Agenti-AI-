import { config } from "dotenv";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatMistralAI } from "@langchain/mistralai";
import { tavily } from "@tavily/core";
import * as z from "zod";
import { createAgent } from "langchain";

config();

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function getLatestinformation({ query }) {
  const response = await tvly.search(query);
  const results = response.results ?? [];
  return results.map((result) => result.content ?? "").join("\n");
}

const getLatestinformationTool = tool(getLatestinformation, {
  name: "getLatestinformation",
  description: "Get the latest information about any topic.",
  schema: z.object({
    query: z.string().describe("The topic you want to get information about."),
  }),
});

const model = new ChatMistralAI({
  model: "mistral-small-latest",
  apiKey: process.env.MISTRAL_AI_API_KEY,
});

const agent = createAgent({
  model,
  tools: [getLatestinformationTool],
});

function buildLangChainHistory(history = []) {
  return history.map((entry) => {
    const content = typeof entry?.content === "string" ? entry.content : "";
    if (entry?.role === "user") return new HumanMessage(content);
    if (entry?.role === "assistant") return new AIMessage(content);
    return new SystemMessage(content);
  });
}

export async function* streamAgentResponse({ userPrompt, history = [] }) {
  const messages = [
    new SystemMessage(`You are a helpful assistant. Today is ${new Date().toLocaleDateString()}.`),
    ...buildLangChainHistory(history),
    new HumanMessage(userPrompt),
  ];

  const stream = await agent.stream(
    { messages },
    {
      streamMode: "messages",
      recursionLimit: 30,
    }
  );

  let aiResponse = "";

  for await (const [chunk] of stream) {
    const text = chunk?.text ?? "";
    if (!text) continue;
    aiResponse += text;
    yield text;
  }

  return aiResponse;
}
