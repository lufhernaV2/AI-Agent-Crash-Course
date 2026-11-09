
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

export const taskSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]),
  completed: z.boolean(),
});

export const tasksSchema = z.array(taskSchema);

export type Task = z.infer<typeof taskSchema>;
export type Priority = Task["priority"];

export const DEFAULT_TASK_FILE = join(
  process.cwd(),
  "data",
  "tasks.json"
);

export class TaskStore {
  constructor(
    private readonly filePath = DEFAULT_TASK_FILE
  ) {}

  async load(): Promise<Task[]> {
    try {
      const content = await readFile(
        this.filePath,
        "utf-8"
      );

      // Validate that the stored JSON has
      // the structure our application expects.
      return tasksSchema.parse(JSON.parse(content));
    } catch (error) {
      // Missing file is normal on the first run.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }

      // Corrupted JSON or other errors must
      // not silently erase existing tasks.
      throw error;
    }
  }

  async save(tasks: Task[]): Promise<void> {
    const validatedTasks = tasksSchema.parse(tasks);

    await mkdir(dirname(this.filePath), {
      recursive: true,
    });

    // Write to a temporary file before replacing
    // the existing task file.
    const tempPath = `${this.filePath}.${process.pid}.tmp`;

    await writeFile(
      tempPath,
      JSON.stringify(validatedTasks, null, 2),
      "utf-8"
    );

    await rename(tempPath, this.filePath);
  }
}
