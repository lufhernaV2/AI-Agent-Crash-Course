
import "dotenv/config";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  TaskStore,
  type Task,
} from "./task-store.js";

import { TaskTools } from "./task-tools.js";
import { runAgent } from "./taskpilot.js";

import { evaluateTaskCompletion } from
  "./agent-evaluation.js";

import type { AgentTrace } from "./agent-trace.js";

// -----------------------------------
// 1. GOLDEN TEST DATA
// -----------------------------------

const initialTasks: Task[] = [
  {
    id: 1,
    title: "Practice Mandarin",
    priority: "medium",
    completed: false,
  },
  {
    id: 2,
    title: "Finish DeepEval lesson",
    priority: "high",
    completed: false,
  },
];

type Scenario = {
  id: string;
  name: string;
  request: string;
  evaluate: (
    trace: AgentTrace,
    before: Task[],
    after: Task[]
  ) => boolean;
};

// -----------------------------------
// 2. DEFINE EVALUATION SCENARIOS
// -----------------------------------

const scenarios: Scenario[] = [
  {
    id: "EVAL-01",
    name: "Retrieve tasks",
    request: "Show me all my tasks.",

    evaluate: (trace, before, after) => {
      const calledGetTasks = trace.toolCalls.some(
        (call) =>
          call.toolName === "get_tasks" &&
          (call.result as { success?: boolean })
            ?.success === true
      );

      const noChanges =
        JSON.stringify(before) === JSON.stringify(after);

      return (
        trace.completed &&
        calledGetTasks &&
        noChanges
      );
    },
  },
  {
    id: "EVAL-02",
    name: "Create task",
    request:
      "Create a high-priority task to prepare for my QA interview.",

    evaluate: (trace, before, after) => {
      const newTasks = after.filter(
        (task) =>
          !before.some(
            (original) => original.id === task.id
          )
      );

      const createdCorrectTask =
        newTasks.length === 1 &&
        newTasks[0]?.priority === "high" &&
        newTasks[0]?.completed === false &&
        newTasks[0]?.title
          .toLowerCase()
          .includes("interview") === true;

      const originalTasksUnchanged = before.every(
        (task) =>
          JSON.stringify(task) ===
          JSON.stringify(
            after.find((item) => item.id === task.id)
          )
      );

      const successfulCreateCall = trace.toolCalls.some(
        (call) =>
          call.toolName === "create_task" &&
          (call.result as { success?: boolean })
            ?.success === true
      );

      return (
        trace.completed &&
        successfulCreateCall &&
        createdCorrectTask &&
        originalTasksUnchanged
      );
    },
  },
  {
    id: "EVAL-03",
    name: "Complete task",
    request: "Complete my Mandarin practice task.",

    evaluate: (trace, before, after) => {
      const result = evaluateTaskCompletion(
        trace,
        before,
        after,
        1
      );

      return result.passed;
    },
  },
];

// -----------------------------------
// 3. RUN ONE SCENARIO
// -----------------------------------

async function runScenario(scenario: Scenario) {
  const tempDir = await mkdtemp(
    join(tmpdir(), "taskpilot-eval-")
  );

  const startTime = performance.now();

  try {
    const store = new TaskStore(
      join(tempDir, "tasks.json")
    );

    const tools = new TaskTools(store);

    // Each scenario starts with fresh data.
    await store.save(initialTasks);

    const before = await store.load();

    // Real Gemini execution.
    const trace = await runAgent(
      scenario.request,
      tools
    );

    const after = await store.load();

    const passed = scenario.evaluate(
      trace,
      before,
      after
    );

    return {
      id: scenario.id,
      name: scenario.name,
      passed,
      toolCalls: trace.toolCalls.map(
        (call) => call.toolName
      ),
      durationMs: Math.round(
        performance.now() - startTime
      ),
      response: trace.finalResponse,
    };
  } catch (error) {
    return {
      id: scenario.id,
      name: scenario.name,
      passed: false,
      toolCalls: [] as string[],
      durationMs: Math.round(
        performance.now() - startTime
      ),
      response: error instanceof Error
        ? `Execution error: ${error.message}`
        : "Unknown execution error",
    };
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

// -----------------------------------
// 4. RUN THE EVALUATION SUITE
// -----------------------------------

async function main() {
  const results = [];

  for (const scenario of scenarios) {
    console.log(
      `\nRunning ${scenario.id}: ${scenario.name}`
    );

    const result = await runScenario(scenario);

    results.push(result);

    console.log(
      result.passed ? "PASSED" : "FAILED"
    );
  }

  // -----------------------------------
  // 5. CALCULATE QUALITY METRICS
  // -----------------------------------

  const passedCount = results.filter(
    (result) => result.passed
  ).length;

  const successRate =
    (passedCount / results.length) * 100;

  console.log("\n=== TASKPILOT QUALITY REPORT ===");

  console.table(
    results.map((result) => ({
      scenario: result.name,
      passed: result.passed,
      toolCalls: result.toolCalls.join(", "),
      durationMs: result.durationMs,
    }))
  );

  console.log(
    `\nSuccessful scenarios: ${passedCount}/${results.length}`
  );

  console.log(
    `Goal Success Rate: ${successRate.toFixed(1)}%`
  );

  for (const result of results) {
    if (!result.passed) {
      console.log(
        `\n${result.id} failed: ${result.response}`
      );
    }
  }

  if (passedCount !== results.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Evaluation suite failed:", error);
  process.exitCode = 1;
});
