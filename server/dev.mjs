import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--host", "0.0.0.0"], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [resolve(root, "server/astrometry.mjs")], { cwd: root, stdio: "inherit" }),
];

function stop() {
  for (const child of children) child.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", (code) => {
  if (code && code !== 0) process.exitCode = code;
  stop();
});
