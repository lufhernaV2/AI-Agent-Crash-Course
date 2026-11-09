
import { z } from "zod";
import {
  TaskStore,
  type Task,
  type Priority,
} from "./task-store.js";

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  priority: z.enum(["low", "medium", "high"]),
});

const completeTaskSchema = z.object({
  id: z.number().int().positive(),
});

export class TaskTools {
  constructor(private readonly store: TaskStore) {}

  async getTasks() {
    const tasks = await this.store.load();

    return {
      success: true,
      tasks,
    };
  }

  async createTask(
    title: string,
    priority: Priority
  ) {
    const input = createTaskSchema.parse({
      title,
      priority,
    });

    const tasks = await this.store.load();

    const nextId =
      Math.max(0, ...tasks.map((task) => task.id)) + 1;

    const newTask: Task = {
      id: nextId,
      title: input.title,
      priority: input.priority,
      completed: false,
    };

    tasks.push(newTask);

    await this.store.save(tasks);

    return {
      success: true,
      task: newTask,
    };
  }

  async completeTask(id: number) {
    const input = completeTaskSchema.parse({ id });

    const tasks = await this.store.load();

    const task = tasks.find(
      (task) => task.id === input.id
    );

    if (!task) {
      return {
        success: false,
        error: `Task with ID ${id} was not found.`,
      };
    }

    task.completed = true;

    await this.store.save(tasks);

    return {
      success: true,
      task,
    };
  }
}
