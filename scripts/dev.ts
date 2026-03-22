#!/usr/bin/env -S deno run --allow-all
/**
 * Local dev orchestrator.
 *
 * Spawns relay, blossom, gateway, and SPA as subprocesses, streams their output
 * with colored prefixes, and handles clean shutdown on Ctrl+C / SIGTERM.
 *
 * Usage: deno task dev
 */

interface Service {
  name: string;
  color: string;
  cmd: string[];
  cwd?: string;
  env?: Record<string, string>;
}

const RESET = "\x1b[0m";

const SERVICES: Service[] = [
  {
    name: "relay",
    color: "\x1b[36m", // cyan
    cmd: ["deno", "run", "--allow-all", "apps/relay/src/dev.ts"],
  },
  {
    name: "blossom",
    color: "\x1b[35m", // magenta
    cmd: ["deno", "run", "--allow-all", "apps/blossom/src/dev.ts"],
  },
  {
    name: "gateway",
    color: "\x1b[33m", // yellow
    cmd: ["deno", "run", "--allow-all", "apps/gateway/src/dev.ts"],
  },
  {
    name: "spa",
    color: "\x1b[32m", // green
    cmd: ["npm", "run", "dev"],
    cwd: "apps/spa",
  },
];

// Print startup banner
console.log(`
\x1b[1m--- nsite.run local dev ---\x1b[0m

  \x1b[36m[relay]  \x1b[0m http://localhost:8081
  \x1b[35m[blossom]\x1b[0m http://localhost:8082
  \x1b[33m[gateway]\x1b[0m http://localhost:8080
  \x1b[32m[spa]    \x1b[0m http://localhost:5173 (via gateway at :8080)

Press Ctrl+C to stop all services.
`);

const children: Deno.ChildProcess[] = [];

async function pipeOutput(
  stream: ReadableStream<Uint8Array>,
  prefix: string,
): Promise<void> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      console.log(`${prefix} ${line}`);
    }
  }
  if (buffer) {
    console.log(`${prefix} ${buffer}`);
  }
}

for (const svc of SERVICES) {
  const proc = new Deno.Command(svc.cmd[0], {
    args: svc.cmd.slice(1),
    cwd: svc.cwd,
    stdout: "piped",
    stderr: "piped",
    env: { ...Deno.env.toObject(), ...svc.env },
  }).spawn();
  children.push(proc);

  const prefix = `${svc.color}[${svc.name.padEnd(7)}]${RESET}`;
  pipeOutput(proc.stdout, prefix);
  pipeOutput(proc.stderr, prefix);
}

// Monitor for unexpected exits
for (let i = 0; i < children.length; i++) {
  children[i].status.then((status) => {
    if (!shuttingDown) {
      console.log(`\x1b[31m[${SERVICES[i].name}] exited with code ${status.code}\x1b[0m`);
    }
  });
}

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n\x1b[1mShutting down all services...\x1b[0m");

  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // already dead
    }
  }

  // Wait for all children with 5-second timeout before force-killing
  const timeout = setTimeout(() => {
    console.log("Force killing remaining processes...");
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch {
        // already dead
      }
    }
  }, 5000);

  await Promise.allSettled(children.map((c) => c.status));
  clearTimeout(timeout);
  console.log("All services stopped.");
  Deno.exit(0);
}

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Keep the orchestrator alive
await new Promise(() => {});
