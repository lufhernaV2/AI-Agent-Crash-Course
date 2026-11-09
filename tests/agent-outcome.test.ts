
import { describe, it, expect } from "vitest";
import { evaluateTaskCompletion } from
  "../src/day2/agent-evaluation.js";

import type { Task } from
  "../src/day2/task-store.js";

describe("TaskPilot Outcome Evaluation", () => {
  const before: Task[] = [
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

  function makeTrace(
    id: number,
    success = true
  ) {
    return {
      userRequest: "Complete my Mandarin task",
      toolCalls: [
        {
          toolName: "complete_task",
          arguments: { id },
          result: { success },
        },
      ],
      finalResponse: "Task completed.",
      completed: true,
    };
  }

  it("passes when the correct task is completed", () => {
    const after: Task[] = [
      { ...before[0]!, completed: true },
      { ...before[1]! },
    ];

    const result = evaluateTaskCompletion(
      makeTrace(1),
      before,
      after,
      1
    );

    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("fails when the wrong task is completed", () => {
    const after: Task[] = [
      { ...before[0]! },
      { ...before[1]!, completed: true },
    ];

    const result = evaluateTaskCompletion(
      makeTrace(2),
      before,
      after,
      1
    );

    expect(result.passed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("fails when the operation was unsuccessful", () => {
    const result = evaluateTaskCompletion(
      makeTrace(1, false),
      before,
      before,
      1
    );

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      "Expected task was not completed in storage."
    );
  });
});
