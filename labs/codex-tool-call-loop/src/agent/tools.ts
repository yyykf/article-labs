export const toolDefinitions = [
  {
    type: "function",
    name: "exec_command",
    description:
      "Start a whitelisted long-running command. It returns current output after yield_time_ms; if the process is still running, it also returns a session_id for later polling.",
    parameters: {
      type: "object",
      properties: {
        cmd: {
          type: "string",
          enum: ["demo-long-command"],
          description: "The only command allowed in this lab."
        },
        yield_time_ms: {
          type: "number",
          description: "How long to wait before yielding current output back to the model. This is not a hard timeout."
        }
      },
      required: ["cmd", "yield_time_ms"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "write_stdin",
    description:
      "Interact with an existing exec session. When chars is empty, this polls recent output without writing to stdin.",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "The running exec session id returned by exec_command."
        },
        chars: {
          type: "string",
          description: "Characters to write to stdin. Use an empty string to poll only."
        },
        yield_time_ms: {
          type: "number",
          description: "How long to wait before returning the latest incremental output."
        }
      },
      required: ["session_id", "chars", "yield_time_ms"],
      additionalProperties: false
    }
  }
] as const;

