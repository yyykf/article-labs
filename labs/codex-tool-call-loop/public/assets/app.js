const startButton = mustGet("startButton");
const clearButton = mustGet("clearButton");
const liveOutput = mustGet("liveOutput");
const toolResults = mustGet("toolResults");
const agentTrace = mustGet("agentTrace");
const runState = mustGet("runState");
const modelName = mustGet("modelName");
const baseUrl = mustGet("baseUrl");
const keyStatus = mustGet("keyStatus");
const outputPace = mustGet("outputPace");
const yieldWindow = mustGet("yieldWindow");

let source = null;

void loadConfig();

startButton.addEventListener("click", () => {
  void startRun();
});

clearButton.addEventListener("click", () => {
  closeSource();
  clearUi();
  runState.textContent = "Idle";
  startButton.disabled = false;
});

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  modelName.textContent = config.model;
  baseUrl.textContent = config.baseURL;
  keyStatus.textContent = config.apiKeyConfigured ? "configured" : "missing";
  outputPace.textContent = `${config.demoOutputIntervalMs}ms / line`;
  yieldWindow.textContent = `${config.demoYieldMs}ms / result`;
}

async function startRun() {
  closeSource();
  clearUi();
  startButton.disabled = true;
  runState.textContent = "Starting run...";

  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Run the demo-long-command and keep polling it until it exits. Then explain what happened."
    })
  });

  const payload = await response.json();
  runState.textContent = `Run ${payload.runId}`;
  source = new EventSource(`/api/runs/${payload.runId}/events`);

  const eventTypes = [
    "run_started",
    "response_request",
    "tool_call",
    "tool_result",
    "process_output",
    "session_status",
    "agent_message",
    "run_finished",
    "error"
  ];

  for (const type of eventTypes) {
    source.addEventListener(type, (event) => {
      handleEvent(JSON.parse(event.data));
    });
  }

  source.onerror = () => {
    appendTrace("SSE", "Connection interrupted or closed.");
  };
}

function handleEvent(event) {
  if (event.type === "process_output") {
    liveOutput.textContent += `[${event.stream}] ${event.chunk}`;
    liveOutput.scrollTop = liveOutput.scrollHeight;
    return;
  }

  if (event.type === "tool_call") {
    appendResult("call", `${event.name} call`, JSON.stringify(event.arguments, null, 2));
    appendTrace("Tool call", `${event.name}\n${JSON.stringify(event.arguments, null, 2)}`);
    return;
  }

  if (event.type === "tool_result") {
    appendResult("tool", `${event.name} result`, JSON.stringify(event.result, null, 2));
    appendTrace("Tool result", event.result.output || "(no new output)");
    return;
  }

  if (event.type === "response_request") {
    appendTrace("Responses API", `request #${event.iteration}`);
    return;
  }

  if (event.type === "session_status") {
    appendTrace("Session", `${event.sessionId}: ${event.status}${event.exitCode === undefined ? "" : ` (${event.exitCode})`}`);
    return;
  }

  if (event.type === "agent_message") {
    appendTrace("Final model message", event.text);
    return;
  }

  if (event.type === "run_finished") {
    runState.textContent = "Finished";
    startButton.disabled = false;
    closeSource();
    return;
  }

  if (event.type === "error") {
    appendResult("error", "Error", event.message);
    runState.textContent = "Error";
    startButton.disabled = false;
    closeSource();
    return;
  }

  if (event.type === "run_started") {
    appendTrace("Run started", `model: ${event.model}`);
  }
}

function appendResult(kind, title, body) {
  const card = document.createElement("article");
  card.className = `result-card ${kind}`;
  card.innerHTML = `<h3>${escapeHtml(title)}</h3><pre>${escapeHtml(body)}</pre>`;
  toolResults.append(card);
  toolResults.scrollTop = toolResults.scrollHeight;
}

function appendTrace(title, body) {
  const item = document.createElement("article");
  item.className = "trace-item";
  item.innerHTML = `<h3>${escapeHtml(title)}</h3><pre>${escapeHtml(body)}</pre>`;
  agentTrace.append(item);
  agentTrace.scrollTop = agentTrace.scrollHeight;
}

function clearUi() {
  liveOutput.textContent = "";
  toolResults.innerHTML = "";
  agentTrace.innerHTML = "";
}

function closeSource() {
  if (source) {
    source.close();
    source = null;
  }
}

function mustGet(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
