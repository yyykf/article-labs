import { getOpenAIAuthHeaders, getOpenAIConfig, responsesUrl } from "./openaiConfig.ts";
import { toolDefinitions } from "./tools.ts";
import type { RunEventStore } from "../runtime/runEventStore.ts";
import { TerminalRuntime, type ExecCommandArgs, type WriteStdinArgs } from "../runtime/terminalRuntime.ts";

type FunctionCallItem = {
  type: "function_call";
  name: string;
  call_id: string;
  arguments: string;
};

export class AgentRunner {
  private readonly runtime: TerminalRuntime;
  private readonly events: RunEventStore;

  constructor(events: RunEventStore) {
    this.events = events;
    this.runtime = new TerminalRuntime(events);
  }

  async run(runId: string, userPrompt: string): Promise<void> {
    const config = getOpenAIConfig();
    this.events.append({
      type: "run_started",
      runId,
      at: Date.now(),
      model: config.model
    });

    const headers = getOpenAIAuthHeaders();
    const input: unknown[] = [
      {
        role: "user",
        content:
          userPrompt ||
          "Run the demo-long-command, inspect the output incrementally, keep polling while it is running, then explain the difference between the UI stream and model-visible tool results."
      }
    ];

    for (let iteration = 1; iteration <= 8; iteration += 1) {
      this.events.append({
        type: "response_request",
        runId,
        at: Date.now(),
        iteration
      });

      const response = await createResponse({
        headers,
        model: config.model,
        instructions: agentInstructions,
        tools: toolDefinitions,
        input,
        store: false
      });

      const outputItems = response.output ?? [];
      input.push(...outputItems);

      const calls = outputItems.filter(isFunctionCall);
      if (calls.length === 0) {
        const finalText = extractOutputText(response) || "The model returned no function call and no text output.";
        this.events.append({
          type: "agent_message",
          runId,
          at: Date.now(),
          text: finalText
        });
        this.events.append({
          type: "run_finished",
          runId,
          at: Date.now(),
          finalText
        });
        return;
      }

      for (const call of calls) {
        const args = parseArguments(call.arguments);
        this.events.append({
          type: "tool_call",
          runId,
          at: Date.now(),
          name: call.name,
          arguments: args
        });

        const result = await this.executeTool(runId, call.name, args);
        this.events.append({
          type: "tool_result",
          runId,
          at: Date.now(),
          name: call.name,
          result
        });

        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result, null, 2)
        });
      }
    }

    throw new Error("Agent loop reached the iteration limit before finishing.");
  }

  private async executeTool(runId: string, name: string, args: unknown) {
    if (name === "exec_command") {
      return this.runtime.execCommand(runId, args as ExecCommandArgs);
    }
    if (name === "write_stdin") {
      return this.runtime.writeStdin(runId, args as WriteStdinArgs);
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}

const agentInstructions = `
You are running a minimal reproduction of Codex-style long-running tool calls.

Rules:
- You must call exec_command first with cmd "demo-long-command" and yield_time_ms around 3000.
- If the tool result status is "running", call write_stdin with the same session_id, chars "", and yield_time_ms around 3000.
- Keep polling until the tool result status is "exited".
- After the process exits, explain briefly what the browser UI saw in real time versus what you saw as tool results.
- Do not claim that every stdout chunk was directly visible to the model when it was emitted.
`.trim();

function isFunctionCall(item: unknown): item is FunctionCallItem {
  return Boolean(
    item &&
      typeof item === "object" &&
      (item as { type?: unknown }).type === "function_call" &&
      typeof (item as { name?: unknown }).name === "string" &&
      typeof (item as { call_id?: unknown }).call_id === "string"
  );
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function extractOutputText(response: unknown): string {
  const maybe = response as {
    output_text?: unknown;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof maybe.output_text === "string") {
    return maybe.output_text;
  }

  return (maybe.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n");
}

async function createResponse(params: {
  headers: Record<string, string>;
  model: string;
  instructions: string;
  tools: unknown;
  input: unknown[];
  store: boolean;
}): Promise<{ output?: unknown[]; output_text?: string }> {
  const { headers, ...body } = params;
  const response = await fetch(responsesUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Responses API request failed: HTTP ${response.status} ${text.slice(0, 800)}`);
  }

  return JSON.parse(text) as { output?: unknown[]; output_text?: string };
}
