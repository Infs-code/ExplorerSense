import { createServer } from "node:http";

const api = "https://nova.astrometry.net/api";
const port = Number(process.env.ASTROMETRY_PROXY_PORT ?? 8787);
const apiKey = process.env.ASTROMETRY_API_KEY;
const maxBodyBytes = 5 * 1024 * 1024;
let busy = false;
let currentProgress = "Idle.";

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("IMAGE_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function apiJson(path, init) {
  const response = await fetch(`${api}/${path}`, init);
  if (!response.ok) throw new Error(`Astrometry.net returned HTTP ${response.status}.`);
  const raw = await response.text();
  const start = raw.indexOf("{");
  if (start < 0) throw new Error("Astrometry.net returned an unreadable response.");
  return JSON.parse(raw.slice(start));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function solve(imageBase64, signal, progress) {
  if (!apiKey) throw new Error("The server has no ASTROMETRY_API_KEY configured.");
  const loginBody = new URLSearchParams({ "request-json": JSON.stringify({ apikey: apiKey }) });
  const login = await apiJson("login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody,
    signal,
  });
  if (login.status !== "success" || typeof login.session !== "string") throw new Error("Astrometry.net rejected the server API key.");

  const bytes = Buffer.from(imageBase64.replace(/^data:image\/jpeg;base64,/, ""), "base64");
  if (!bytes.length || bytes.length > 3_500_000) throw new Error("The still image is empty or exceeds the 3.5 MB limit.");
  const form = new FormData();
  form.append("request-json", JSON.stringify({
    session: login.session,
    publicly_visible: "n",
    allow_commercial_use: "n",
    allow_modifications: "n",
    crpix_center: true,
    scale_units: "degwidth",
    scale_lower: 8,
    scale_upper: 110,
  }));
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), "explorer-sense-scan.jpg");
  const upload = await apiJson("upload", { method: "POST", body: form, signal });
  if (upload.status !== "success" || typeof upload.subid !== "number") throw new Error(upload.errormessage ?? "Astrometry.net did not accept the still image.");
  progress("Image submitted privately. Waiting for the solver…");

  const deadline = Date.now() + 5 * 60_000;
  let jobId;
  while (!jobId && Date.now() < deadline) {
    if (signal.aborted) throw new Error("Solve cancelled.");
    const submission = await apiJson(`submissions/${upload.subid}`, { signal });
    jobId = submission.jobs?.[0];
    if (!jobId) {
      progress("Queued at Astrometry.net…");
      await sleep(2500);
    }
  }
  if (!jobId) throw new Error("The solver queue did not start within five minutes.");
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("Solve cancelled.");
    const job = await apiJson(`jobs/${jobId}`, { signal });
    if (job.status === "success") break;
    if (job.status === "failure") throw new Error("Astrometry.net could not solve this image.");
    progress("Solving image…");
    await sleep(2500);
  }
  if (Date.now() >= deadline) throw new Error("The solver exceeded the five-minute time limit.");
  const calibration = await apiJson(`jobs/${jobId}/calibration/`, { signal });
  const values = [calibration.ra, calibration.dec, calibration.pixscale, calibration.orientation, calibration.parity];
  if (!values.every(Number.isFinite)) throw new Error("Astrometry.net returned incomplete calibration data.");
  return {
    raDeg: calibration.ra,
    decDeg: calibration.dec,
    pixelScaleArcsec: calibration.pixscale,
    orientationDeg: calibration.orientation,
    parity: calibration.parity >= 0 ? 1 : -1,
    jobId,
    solvedAt: new Date().toISOString(),
  };
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/solve/status") {
    json(response, 200, { busy, progress: currentProgress });
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/solve") {
    json(response, 404, { error: "Not found." });
    return;
  }
  if (busy) {
    json(response, 429, { error: "A plate solve is already running. Try again when it finishes." });
    return;
  }
  const controller = new AbortController();
  response.on("close", () => {
    if (!response.writableEnded) controller.abort();
  });
  busy = true;
  currentProgress = "Checking solver configuration…";
  try {
    const payload = await readJson(request);
    if (typeof payload.imageBase64 !== "string" || !Number.isInteger(payload.width) || !Number.isInteger(payload.height)) {
      json(response, 400, { error: "A JPEG still image and pixel dimensions are required." });
      return;
    }
    const result = await solve(payload.imageBase64, controller.signal, (message) => { currentProgress = message; });
    currentProgress = "Plate solution ready.";
    json(response, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plate solve failed.";
    const status = message === "IMAGE_TOO_LARGE" ? 413 : message.includes("no ASTROMETRY_API_KEY") ? 503 : message === "Solve cancelled." ? 499 : 502;
    currentProgress = message;
    json(response, status, { error: message });
  } finally {
    busy = false;
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Explorer Sense solve proxy listening on http://127.0.0.1:${port}`);
  console.log("Set ASTROMETRY_API_KEY in this server process before requesting an online solve.");
});
