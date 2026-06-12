import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import process from "node:process";
import type { RunEvent, SessionStatus, StreamName, ToolResult } from "./events.ts";
import type { RunEventStore } from "./runEventStore.ts";

type Session = {
  id: string;
  runId: string;
  status: SessionStatus;
  exitCode?: number | null;
  child: ChildProcessWithoutNullStreams;
  modelBuffer: string[];
};

export type ExecCommandArgs = {
  cmd: string;
  yield_time_ms?: number;
};

export type WriteStdinArgs = {
  session_id: string;
  chars?: string;
  yield_time_ms?: number;
};

export class TerminalRuntime {
  private readonly sessions = new Map<string, Session>();
  private readonly events: RunEventStore;

  constructor(events: RunEventStore) {
    this.events = events;
  }

  async execCommand(runId: string, args: ExecCommandArgs): Promise<ToolResult> {
    const yieldMs = normalizeYield(args.yield_time_ms);
    if (args.cmd !== "demo-long-command") {
      throw new Error(`Only the whitelisted command "demo-long-command" is available in this lab. Received: ${args.cmd}`);
    }

    const session = this.startDemoProcess(runId);
    await sleep(yieldMs);
    return this.buildToolResult(session, `exec_command waited ${yieldMs}ms before yielding to the model.`);
  }

  async writeStdin(runId: string, args: WriteStdinArgs): Promise<ToolResult> {
    const session = this.sessions.get(args.session_id);
    if (!session) {
      throw new Error(`Unknown session_id: ${args.session_id}`);
    }
    if (session.runId !== runId) {
      throw new Error(`Session ${args.session_id} does not belong to run ${runId}`);
    }

    const chars = args.chars ?? "";
    if (chars && session.status === "running") {
      session.child.stdin.write(chars);
    }

    const yieldMs = normalizeYield(args.yield_time_ms);
    await sleep(yieldMs);
    return this.buildToolResult(session, chars ? `write_stdin wrote ${JSON.stringify(chars)} and waited ${yieldMs}ms.` : `write_stdin polled for ${yieldMs}ms without writing stdin.`);
  }

  private startDemoProcess(runId: string): Session {
    const sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const scriptPath = path.resolve(process.cwd(), "scripts/slow-output.mjs");
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    const session: Session = {
      id: sessionId,
      runId,
      status: "running",
      child,
      modelBuffer: []
    };
    this.sessions.set(sessionId, session);

    child.stdout.on("data", (data: Buffer) => {
      this.handleOutput(session, "stdout", data.toString("utf8"));
    });
    child.stderr.on("data", (data: Buffer) => {
      this.handleOutput(session, "stderr", data.toString("utf8"));
    });
    child.on("close", (code) => {
      session.status = "exited";
      session.exitCode = code;
      this.events.append({
        type: "session_status",
        runId,
        at: Date.now(),
        sessionId,
        status: "exited",
        exitCode: code
      });
    });

    this.events.append({
      type: "session_status",
      runId,
      at: Date.now(),
      sessionId,
      status: "running"
    });

    return session;
  }

  private handleOutput(session: Session, stream: StreamName, chunk: string): void {
    session.modelBuffer.push(chunk);
    const event: RunEvent = {
      type: "process_output",
      runId: session.runId,
      at: Date.now(),
      sessionId: session.id,
      stream,
      chunk
    };
    this.events.append(event);
  }

  private buildToolResult(session: Session, note: string): ToolResult {
    const output = session.modelBuffer.join("");
    session.modelBuffer.length = 0;

    return {
      output,
      session_id: session.status === "running" ? session.id : undefined,
      status: session.status,
      exit_code: session.status === "exited" ? session.exitCode ?? null : undefined,
      note
    };
  }
}

function normalizeYield(value: number | undefined): number {
  const defaultYield = Number.parseInt(process.env.DEMO_YIELD_MS || "3000", 10);
  if (!Number.isFinite(value)) {
    return Number.isFinite(defaultYield) ? defaultYield : 3_000;
  }
  return Math.min(Math.max(Math.trunc(value ?? defaultYield), 250), 8_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
