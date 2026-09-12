import { config } from "dotenv";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { tavily } from "@tavily/core";
import * as z from "zod";
import { createAgent } from "langchain";

config({ override: true });

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

const model = new ChatGroq({
  model: "qwen/qwen3.6-27b",
  apiKey: process.env.GROQ_API_KEY,
  maxTokens: 256,
  reasoningFormat: "hidden",
  reasoningEffort: "none",
});

const agent = createAgent({
  model,
  tools: [getLatestinformationTool],
});

function buildLangChainHistory(history = []) {
  const recentHistory = history
    .filter((entry) => entry?.role === "user" || entry?.role === "assistant")
    .slice(-2);

  return recentHistory.map((entry) => {
    const content = typeof entry?.content === "string" ? entry.content : "";
    if (entry?.role === "user") return new HumanMessage(content);
    if (entry?.role === "assistant") return new AIMessage(content);
  });
}

export async function* streamAgentResponse({ userPrompt, history = [] }) {
  const messages = [
    new SystemMessage(`You are a helpful assistant. Today is ${new Date().toLocaleDateString()}.`),
    new HumanMessage(userPrompt),
  ];

  const result = await agent.invoke(
    { messages },
    { recursionLimit: 30 }
  );
  const lastMessage = result.messages?.at(-1);
  const text = typeof lastMessage?.content === "string"
    ? lastMessage.content
    : Array.isArray(lastMessage?.content)
      ? lastMessage.content
          .filter((part) => typeof part?.text === "string")
          .map((part) => part.text)
          .join("")
      : "";

  if (text) yield text;
}
