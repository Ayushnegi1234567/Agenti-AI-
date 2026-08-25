import { ChatMistralAI } from "@langchain/mistralai";
import {config} from "dotenv";
import { HumanMessage, AIMessage , SystemMessage,  } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import rl from "readline/promises"
import * as z from "zod";
import {tavily} from "@tavily/core"
config();

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
async function getLatestinformation({query}) {
const response=await tvly.search(query);
const results=response.results
const  content=results.map((result)=>result.content).join("\n")
return content;
}
const getLatestinformationTool = tool(
    getLatestinformation,
    {
    name: "getLatestinformation",
    description: "get latest information about any topic",
  schema: z.object({
  query: z.string().describe("the topic you want to get information about")
})
})


const readline=rl.createInterface({
    input: process.stdin,
    output: process.stdout
})


const model = new ChatMistralAI({
    model:"mistral-small-latest",
    apiKey: process.env.MISTRAL_AI_API_KEY
})
const agent=createAgent({
    model,
    tools:[getLatestinformationTool]
})

const messages = [ new SystemMessage(`You are a helpful assistant.
    today is ${new Date().toLocaleDateString()}`) 

];
while (true) {
    const userPrompt = await readline.question("User: ");
    messages.push(new HumanMessage(userPrompt));

    // const stream = await model.stream(messages);
    const stream = await agent.stream({
    messages,
    },
    {

    streamMode: "messages",
    recursionLimit: 30,

    }
    );

    
    let aiResponse = "";
    // for await(const chunk of stream) {
    //     process.stdout.write(chunk.text);
    //     aiResponse += chunk.text;
    // }
    for await(const [chunk ]of stream) {
        process.stdout.write(chunk.text);
        aiResponse += chunk.text;
    }
    messages.push(new AIMessage(aiResponse));
    console.log("\n");
   
   

  
}

