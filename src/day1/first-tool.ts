
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = "gemini-3.6-flash";

// Step 1: Our local TypeScript function
function getTasks() {
  return [
    {
      id: 1,
      title: "Apply for Solutions Engineer position",
      priority: "high"
    },
    {
      id: 2,
      title: "Practice Mandarin",
      priority: "medium"
    },
    {
      id: 3,
      title: "Finish DeepEval lesson",
      priority: "high"
    },
    {
      id: 4,
      title: "Cook Dinner for Hungry Pregnant Wife",
      priority: "very high"
    }
  ];
}

// Step 2: Describe the tool to Gemini
const getTasksTool = {
  type: "function" as const,
  name: "get_tasks",
  description: "Retrieve the user's current task list.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};

async function main() {
  console.log("Asking Gemini about our tasks...\n");

  // Step 3: Send the request with available tools
  const interaction = await ai.interactions.create({
    model: MODEL,
    input: "Which tasks should I prioritize today and why?",
    tools: [getTasksTool]
  });

  // Step 4: Find the tool Gemini requested
  const toolCall = interaction.steps?.find(
    (step) => step.type === "function_call"
  );

  if (!toolCall) {
    console.log(
      "Gemini did not request a tool:",
      interaction.output_text
    );
    return;
  }

  console.log("Gemini requested a tool!");
  console.log("Tool name:", toolCall.name);
  console.log("Arguments:", toolCall.arguments);

  // Step 5: Execute the approved local function
  if (toolCall.name !== "get_tasks") {
    throw new Error(`Unknown tool: ${toolCall.name}`);
  }

  const tasks = getTasks();

  console.log("\nTool execution result:");
  console.log(tasks);

  // Step 6: Send the results back to Gemini
  const finalInteraction = await ai.interactions.create({
    model: MODEL,
    previous_interaction_id: interaction.id,
    tools: [getTasksTool],
    input: [
      {
        type: "function_result",
        name: toolCall.name,
        call_id: toolCall.id,
        result: [
          {
            type: "text",
            text: JSON.stringify(tasks)
          }
        ]
      }
    ]
  });

  // Step 7: Display the final AI response
  console.log("\nFinal AI response:");
  console.log(finalInteraction.output_text);
}

main().catch(console.error);
