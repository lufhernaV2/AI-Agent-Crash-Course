import "dotenv/config";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TaskStore, type Task } from "./task-store.js";
import { TaskTools } from "./task-tools.js";
import { runAgent } from "./taskpilot.js";

import { evaluateTaskCompletion } from
  "./agent-evaluation.js";

async function main() {
  // 1. Create an isolated evaluation directory.
  const tempDir = await mkdtemp(
    join(tmpdir(), "taskpilot-live-eval-")
  );

  try {
    const store = new TaskStore(
      join(tempDir, "tasks.json")
    );

    const tools = new TaskTools(store);

    // 2. Define our golden test data.
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

    // 3. Save the initial state.
    await store.save(initialTasks);

    // Capture the state before execution.
    const tasksBefore = await store.load();

    console.log("\n=== BEFORE ===");
    console.log(tasksBefore);

    // 4. Execute a real Gemini request.
    const userRequest =
      "Complete my Mandarin practice task.";

    console.log("\n=== RUNNING GEMINI ===");

    const trace = await runAgent(
      userRequest,
      tools
    );

    // 5. Retrieve the actual stored result.
    const tasksAfter = await store.load();

    console.log("\n=== AFTER ===");
    console.log(tasksAfter);

    // 6. Evaluate whether the goal was achieved.
    const evaluation = evaluateTaskCompletion(
      trace,
      tasksBefore,
      tasksAfter,
      1
    );

    // 7. Display our evaluation report.
    console.log("\n=== LIVE EVALUATION REPORT ===");

    console.log({
      scenario: "Complete Mandarin practice task",
      passed: evaluation.passed,
      toolCalls: trace.toolCalls.map(
        (call) => call.toolName
      ),
      reasons: evaluation.reasons,
      finalResponse: trace.finalResponse,
    });

    if (!evaluation.passed) {
      process.exitCode = 1;
    }

  } finally {
    // 8. Clean up only our temporary test directory.
    await rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

main().catch((error) => {
  console.error("Live evaluation failed:", error);
  process.exitCode = 1;
});
