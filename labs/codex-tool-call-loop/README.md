# Codex Tool Call Loop

This lab is a runnable companion for the article:

<https://mp.weixin.qq.com/s/fkg0x-A-2IU_NdlC8619hg>

It reproduces the core idea from the article:

> UI can receive live process output immediately, while the model only receives bounded tool results at tool-call decision points.

## What Runs

The app starts a real Responses API agent loop. The model receives two function tools:

- `exec_command`: starts a long-running command and waits for a `yield_time_ms` window before returning a tool result.
- `write_stdin`: writes to an existing session, or polls it when `chars` is empty.

The runtime starts a real Node child process that emits output over time. Each stdout/stderr chunk is sent to two places:

- UI path: broadcast immediately over Server-Sent Events, so the browser scrolls in real time.
- Model path: append to a model buffer, then drain it only when a tool call returns.

## Run

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4
PORT=3000
DEMO_OUTPUT_INTERVAL_MS=1100
DEMO_YIELD_MS=3000
```

Start the lab:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Pacing

The lab is intentionally paced so readers can see the difference between the two paths:

- `DEMO_OUTPUT_INTERVAL_MS`: how often the child process emits one stdout/stderr line.
- `DEMO_YIELD_MS`: the default wait window before a tool call returns model-visible output.

Use a larger value if the UI still moves too quickly:

```bash
DEMO_OUTPUT_INTERVAL_MS=1500
DEMO_YIELD_MS=4000
npm run dev
```

## Why This Is Not a Fake Demo

The UI is not hard-coded to pretend that output is streaming. The browser receives actual runtime events from a real child process through SSE.

The model is not given fake tool results. It calls function tools through the Responses API. The server executes those tools, returns function-call outputs, and continues the model loop until the model stops calling tools.

## Runtime Requirements

- Node.js 20 or newer.
- npm for installing the local TypeScript runner.

## Safety Boundary

This lab intentionally whitelists a single command name, `demo-long-command`. The model can decide when to call tools and when to poll, but it cannot execute arbitrary shell commands.
