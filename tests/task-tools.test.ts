
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TaskStore } from "../src/day2/task-store.js";
import { TaskTools } from "../src/day2/task-tools.js";

describe("TaskPilot Tool Tests", () => {
  let tempDir: string;
  let tools: TaskTools;

// code below makes sure that every test receives its own 
// temporary directory and task storage
  beforeEach(async () => {
    tempDir = await mkdtemp(
      join(tmpdir(), "taskpilot-test-")
    );

    const store = new TaskStore(
      join(tempDir, "tasks.json")
    );

    tools = new TaskTools(store);
  });

  afterEach(async () => {
    await rm(tempDir, {
      recursive: true,
      force: true,
    });
  });
  // -------------------------------------------------------------
  // First test verifies that a new task can be created
  it("creates a new task", async () => {
    const result = await tools.createTask(
      "Prepare for QA interview",
      "high"
    );

    expect(result.success).toBe(true);
    expect(result.task.title).toBe(
      "Prepare for QA interview"
    );
    expect(result.task.completed).toBe(false);
  });
  //-----------------------------------------------------------
  // Second test verifies that saved tasks exist
  it("retrieves saved tasks", async () => {
    await tools.createTask(
      "Practice Mandarin",
      "medium"
    );

    const result = await tools.getTasks();

    expect(result.success).toBe(true);
    expect(result.tasks).toHaveLength(1);

    const task = result.tasks[0];

    if (!task) {
    throw new Error("Expected a task, but none was found");
    }

    expect(task.title).toBe("Practice Mandarin");
  });
  // -----------------------------------------------------------
  // Third test verifies that a created task can completed
  it("completes an existing task", async () => {
    const created = await tools.createTask(
      "Finish DeepEval lesson",
      "high"
    );

    const result = await tools.completeTask(
      created.task.id
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.task?.completed).toBe(true);
      expect(result.task?.id).toBe(1);
    }
  });
  // ------------------------------------------------------------
  // Fourth test verifies that a nonexistent task id is rejected
  it("rejects a nonexistent task ID", async () => {
    const result = await tools.completeTask(999);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toContain(
        "Task with ID 999 was not found"
      );
    }
  });
  // -------------------------------------------------------------
  // Fifth test makes sure that storing happens through different instances
  it("preserves tasks across store instances", async () => {
    await tools.createTask(
      "Apply for Solutions Engineer position",
      "high"
    );

    const secondStore = new TaskStore(
      join(tempDir, "tasks.json")
    );

    const secondTools = new TaskTools(secondStore);

    const result = await secondTools.getTasks();

    expect(result.tasks).toHaveLength(1);

    const task = result.tasks[0];

    if (!task) {
    throw new Error("Expected a persisted task");
    }

    expect(task.priority).toBe("high");
  });
  // -------------------------------------------------------------
  // Sixth test rejects an empty task title
  it("rejects an empty task title", async () => {
    await expect(
      tools.createTask("", "high")
    ).rejects.toThrow();
  });
});
