import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";
import { AgentRunner } from "../agent/agentRunner.ts";
import { getOpenAIConfig } from "../agent/openaiConfig.ts";
import { RunEventStore } from "../runtime/runEventStore.ts";

loadEnvFile(".env.local");
loadEnvFile(".env");

const events = new RunEventStore();
const runner = new AgentRunner(events);
const port = Number(process.env.PORT || 3000);
const publicDir = path.resolve(process.cwd(), "public");

const server = createServer((request, response) => {
  void route(request, response).catch((error: unknown) => {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  });
});

server.listen(port, () => {
  console.log(`codex-tool-call-loop lab is running at http://localhost:${port}`);
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/config") {
    const config = getOpenAIConfig();
    sendJson(response, 200, {
      model: config.model,
      baseURL: config.baseURL,
      apiKeyConfigured: config.apiKeyConfigured,
      demoOutputIntervalMs: numberFromEnv("DEMO_OUTPUT_INTERVAL_MS", 1_100),
      demoYieldMs: numberFromEnv("DEMO_YIELD_MS", 3_000)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/runs") {
    const body = await readJson(request);
    const runId = events.createRun();
    sendJson(response, 200, { runId });

    setImmediate(() => {
      runner.run(runId, typeof body.prompt === "string" ? body.prompt : "").catch((error: unknown) => {
        events.append({
          type: "error",
          runId,
          at: Date.now(),
          message: error instanceof Error ? error.message : String(error)
        });
      });
    });
    return;
  }

  const eventMatch = /^\/api\/runs\/([^/]+)\/events$/.exec(url.pathname);
  if (request.method === "GET" && eventMatch) {
    events.stream(eventMatch[1], response);
    return;
  }

  if (request.method === "GET") {
    serveStatic(url.pathname, response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function serveStatic(pathname: string, response: ServerResponse): void {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(publicDir, relative);

  if (!resolved.startsWith(publicDir) || !existsSync(resolved)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType(resolved)
  });
  createReadStream(resolved).pipe(response);
}

function contentType(filename: string): string {
  if (filename.endsWith(".html")) return "text/html; charset=utf-8";
  if (filename.endsWith(".css")) return "text/css; charset=utf-8";
  if (filename.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filename.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return {};
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function loadEnvFile(filename: string): void {
  const envPath = path.resolve(process.cwd(), filename);
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}
