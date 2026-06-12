export type StreamName = "stdout" | "stderr";

export type RunEvent =
  | {
      type: "run_started";
      runId: string;
      at: number;
      model: string;
    }
  | {
      type: "response_request";
      runId: string;
      at: number;
      iteration: number;
    }
  | {
      type: "tool_call";
      runId: string;
      at: number;
      name: string;
      arguments: unknown;
    }
  | {
      type: "tool_result";
      runId: string;
      at: number;
      name: string;
      result: ToolResult;
    }
  | {
      type: "process_output";
      runId: string;
      at: number;
      sessionId: string;
      stream: StreamName;
      chunk: string;
    }
  | {
      type: "session_status";
      runId: string;
      at: number;
      sessionId: string;
      status: SessionStatus;
      exitCode?: number | null;
    }
  | {
      type: "agent_message";
      runId: string;
      at: number;
      text: string;
    }
  | {
      type: "run_finished";
      runId: string;
      at: number;
      finalText: string;
    }
  | {
      type: "error";
      runId: string;
      at: number;
      message: string;
    };

export type SessionStatus = "running" | "exited";

export type ToolResult = {
  output: string;
  session_id?: string;
  status: SessionStatus;
  exit_code?: number | null;
  note: string;
};

