const steps = [
  "probe adb devices",
  "device list is empty, retrying",
  "fastboot devices still empty",
  "waiting for usb reconnect",
  "adb server responded",
  "device e8ad09b7 is visible",
  "checking boot state",
  "boot state is device",
  "running one final health check",
  "collecting last stdout chunk",
  "done"
];

const intervalMs = Number.parseInt(process.env.DEMO_OUTPUT_INTERVAL_MS || "1100", 10);

let index = 0;

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  const trimmed = chunk.trim();
  if (trimmed) {
    process.stdout.write(`stdin received: ${trimmed}\n`);
  }
});

const timer = setInterval(() => {
  const line = steps[index];
  if (!line) {
    clearInterval(timer);
    process.exit(0);
    return;
  }

  if (index === 3) {
    process.stderr.write(`stderr: ${line}\n`);
  } else {
    process.stdout.write(`stdout: ${line}\n`);
  }
  index += 1;
}, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1100);
