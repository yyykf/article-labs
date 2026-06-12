import type { ServerResponse } from "node:http";
import type { RunEvent } from "./events.ts";

type Subscriber = (event: RunEvent) => void;

type RunRecord = {
  id: string;
  history: RunEvent[];
  subscribers: Set<Subscriber>;
};

export class RunEventStore {
  private readonly runs = new Map<string, RunRecord>();

  createRun(): string {
    const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.runs.set(runId, {
      id: runId,
      history: [],
      subscribers: new Set()
    });
    return runId;
  }

  append(event: RunEvent): void {
    const run = this.runs.get(event.runId);
    if (!run) {
      return;
    }

    run.history.push(event);
    for (const subscriber of run.subscribers) {
      subscriber(event);
    }
  }

  stream(runId: string, response: ServerResponse): void {
    const run = this.runs.get(runId);
    if (!run) {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Unknown run id" }));
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const send = (event: RunEvent) => {
      response.write(`event: ${event.type}\n`);
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    for (const event of run.history) {
      send(event);
    }

    run.subscribers.add(send);
    const keepAlive = setInterval(() => {
      response.write(": keep-alive\n\n");
    }, 15_000);

    response.on("close", () => {
      clearInterval(keepAlive);
      run.subscribers.delete(send);
    });
  }
}
