
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { TaskTools } from "./task-tools.js";
import type { AgentTrace } from "./agent-trace.js";

// -----------------------------------
// 1. CONFIGURATION
// -----------------------------------

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3.6-flash";
const MAX_TURNS = 8;

const SYSTEM_INSTRUCTIONS = `
  You are TaskPilot, a helpful task-management agent.

  You can retrieve, create, and complete tasks.

  Rules:
  - Use tools when task information is needed.
  - Never invent task IDs.
  - Retrieve tasks before completing one if
    its ID is unknown.
  - Confirm tool results before claiming success.
  - Do not create duplicate tasks unnecessarily.
  - Explain failures honestly.
  - Keep responses concise.
  `;

// -----------------------------------
// 2. DECLARE TOOLS FOR GEMINI
// -----------------------------------

const toolDeclarations = [
  {
    type: "function" as const,
    name: "get_tasks",
    description:
      "Retrieve all tasks, including their IDs, priorities, and completion status. Use this to find a task before completing it.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    type: "function" as const,
    name: "create_task",
    description:
      "Create a new task with a title and priority.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The task title",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "The task priority",
        },
      },
      required: ["title", "priority"],
    },
  },
  {
    type: "function" as const,
    name: "complete_task",
    description:
      "Mark an existing task as completed using its numeric ID.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "The ID of the task to complete",
        },
      },
      required: ["id"],
    },
  },
];

// -----------------------------------
// 3. VALIDATE TOOL ARGUMENTS
// -----------------------------------

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  priority: z.enum(["low", "medium", "high"]),
});

const completeTaskSchema = z.object({
  id: z.number().int().positive(),
});

const getTasksSchema = z.object({});

// -----------------------------------
// 4. TOOL DISPATCHER
// -----------------------------------


async function executeTool(
  name: string,
  args: unknown,
  taskTools: TaskTools
) {
  console.log(`\n[TOOL] Executing: ${name}`);

  try {
    switch (name) {
      case "get_tasks": {
        getTasksSchema.parse(args);
        return await taskTools.getTasks();
      }

      case "create_task": {
        const input = createTaskSchema.parse(args);

        return await taskTools.createTask(
          input.title,
          input.priority
        );
      }

      case "complete_task": {
        const input = completeTaskSchema.parse(args);

        return await taskTools.completeTask(input.id);
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tool execution failed",
    };
  }
}


// -----------------------------------
// 5. THE AGENT LOOP
// -----------------------------------

export async function runAgent(
    userRequest: string,
    taskTools: TaskTools
    ): Promise<AgentTrace> {

  const trace: AgentTrace = {
    userRequest,
    toolCalls: [],
    finalResponse: "",
    completed: false,
  };

  console.log("\nUSER REQUEST:");
  console.log(userRequest);

  let interaction = await ai.interactions.create({
    model: MODEL,
    input: userRequest,
    tools: toolDeclarations,
    system_instruction: SYSTEM_INSTRUCTIONS
  });

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n--- Agent turn ${turn} ---`);

    const toolCalls = (interaction.steps ?? []).filter(
      (step) => step.type === "function_call"
    );

    // No tool calls means the model is finished.
    if (toolCalls.length === 0) {
        trace.finalResponse = interaction.output_text ?? "";
        trace.completed = true;

        console.log("\nFINAL RESPONSE:");
        console.log(trace.finalResponse);

        return trace;
    }

    // Execute requested tools and collect their results.
    
    const functionResults = [];

    for (const call of toolCalls) {
    console.log(
        `[AGENT] Requested: ${call.name}`,
        call.arguments
    );

    const result = await executeTool(
        call.name,
        call.arguments ?? {},
        taskTools
    );

    trace.toolCalls.push({
        toolName: call.name,
        arguments: call.arguments ?? {},
        result,
    });

    console.log("[RESULT]", result);

    functionResults.push({
        type: "function_result" as const,
        name: call.name,
        call_id: call.id,
        result: [
        {
            type: "text" as const,
            text: JSON.stringify(result),
        },
        ],
    });
    }


    // Give Gemini the results so it can decide
    // whether another tool call is required.
    interaction = await ai.interactions.create({
      model: MODEL,
      previous_interaction_id: interaction.id,
      tools: toolDeclarations,
      input: functionResults,
      system_instruction: SYSTEM_INSTRUCTIONS
    });
  }

    console.log(
    "\nAgent stopped: maximum number of turns reached."
    );

    return trace;
}