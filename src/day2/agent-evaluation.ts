
import type { AgentTrace } from "./agent-trace.js";
import type { Task } from "./task-store.js";

export type EvaluationResult = {
  passed: boolean;
  expectedTool: string;
  actualTools: string[];
  reason: string;
};

export function evaluateToolSelection(
  trace: AgentTrace,
  expectedTool: string
): EvaluationResult {

  // Extract all tools the agent called.
  const actualTools = trace.toolCalls.map(
    (call) => call.toolName
  );

  // Check whether the expected tool was used.
  const toolWasCalled = actualTools.includes(
    expectedTool
  );

  // A passing result requires both:
  // 1. The agent finished.
  // 2. The expected tool was called.
  const passed = trace.completed && toolWasCalled;

  return {
    passed,
    expectedTool,
    actualTools,
    reason: passed
      ? `Agent completed and called ${expectedTool}.`
      : `Expected a completed run using ${expectedTool}.`,
  };

}

export type OutcomeEvaluation = {
  passed: boolean;
  reasons: string[];
};

export function evaluateTaskCompletion(
  trace: AgentTrace,
  tasksBefore: Task[],
  tasksAfter: Task[],
  expectedTaskId: number
): OutcomeEvaluation {
  const reasons: string[] = [];

  // Check whether the agent finished normally.
  if (!trace.completed) {
    reasons.push("Agent did not finish.");
  }

  // Did the agent call the correct tool with
  // the correct ID and receive success?
  const correctToolCall = trace.toolCalls.some((call) => {
    if (call.toolName !== "complete_task") {
      return false;
    }

    const args = call.arguments as { id?: number };
    const result = call.result as {
      success?: boolean;
    };

    return (
      args?.id === expectedTaskId &&
      result?.success === true
    );
  });

  if (!correctToolCall) {
    reasons.push(
      "Agent did not successfully complete the expected task ID."
    );
  }

  // Verify that the expected task existed
  // and was incomplete before execution.
  const originalTask = tasksBefore.find(
    (task) => task.id === expectedTaskId
  );

  if (!originalTask || originalTask.completed) {
    reasons.push(
      "Expected task was missing or already completed."
    );
  }

  // Verify the actual stored result.
  const completedTask = tasksAfter.find(
    (task) => task.id === expectedTaskId
  );

  if (!completedTask?.completed) {
    reasons.push(
      "Expected task was not completed in storage."
    );
  }

  // Ensure no other tasks were changed.
  for (const before of tasksBefore) {
    const after = tasksAfter.find(
      (task) => task.id === before.id
    );

    if (!after) {
      reasons.push(`Task ${before.id} disappeared.`);
      continue;
    }

    if (
      before.id !== expectedTaskId &&
      JSON.stringify(before) !== JSON.stringify(after)
    ) {
      reasons.push(
        `Unexpected modification to task ${before.id}.`
      );
    }
  }

  if (tasksBefore.length !== tasksAfter.length) {
    reasons.push("Unexpected change in task count.");
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}
