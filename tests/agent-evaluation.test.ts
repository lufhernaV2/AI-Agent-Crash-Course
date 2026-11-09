
import { describe, it, expect } from "vitest";
import { evaluateToolSelection } from
  "../src/day2/agent-evaluation.js";

describe("TaskPilot Agent Tool Selection", () => {

  // TEST 1
  it("passes when the expected tool is called", () => {
    const trace = {
      userRequest: "Show me my tasks",
      toolCalls: [
        {
          toolName: "get_tasks",
          arguments: {},
          result: {
            success: true,
            tasks: [],
          },
        },
      ],
      finalResponse: "You have no tasks.",
      completed: true,
    };

    const result = evaluateToolSelection(
      trace,
      "get_tasks"
    );

    expect(result.passed).toBe(true);
  });

  // TEST 2
  it("fails when the expected tool is missing", () => {
    const trace = {
      userRequest: "Show me my tasks",
      toolCalls: [
        {
          toolName: "create_task",
          arguments: {
            title: "Unexpected task",
            priority: "high",
          },
          result: { success: true },
        },
      ],
      finalResponse: "I created a task.",
      completed: true,
    };

    const result = evaluateToolSelection(
      trace,
      "get_tasks"
    );

    expect(result.passed).toBe(false);
  });

  // TEST 3
  it("fails when the agent does not complete", () => {
    const trace = {
      userRequest: "Show me my tasks",
      toolCalls: [
        {
          toolName: "get_tasks",
          arguments: {},
          result: {
            success: true,
            tasks: [],
          },
        },
      ],
      finalResponse: "",
      completed: false,
    };

    const result = evaluateToolSelection(
      trace,
      "get_tasks"
    );

    expect(result.passed).toBe(false);
  });
});




