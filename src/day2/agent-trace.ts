export type ToolTrace = {
  toolName: string;
  arguments: unknown;
  result: unknown;
};

export type AgentTrace = {
  userRequest: string;
  toolCalls: ToolTrace[];
  finalResponse: string;
  completed: boolean;
};