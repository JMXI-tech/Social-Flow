import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CLI = process.env.SOCIALCLAW_BIN || "socialclaw";
const DATA_DIR = resolve("data");
const SCHEDULE_FILE = resolve(DATA_DIR, "schedule.json");
const RUNS_FILE = resolve(DATA_DIR, "runs.json");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(resolve("public")));

const providers = new Set([
  "x", "linkedin", "linkedin_page", "instagram_business", "instagram",
  "facebook", "tiktok", "youtube", "reddit", "wordpress", "discord",
  "telegram", "pinterest"
]);

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return fallback; throw e; }
}
async function writeJson(path, data) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 });
}
function runCli(args, timeoutMs = 60000) {
  return new Promise((resolvePromise) => {
    if (!process.env.SC_API_KEY) {
      resolvePromise({ ok: false, code: 1, stdout: "", stderr: "SC_API_KEY is not configured. Copy .env.example to .env and add your SocialClaw workspace key." });
      return;
    }
    const child = spawn(CLI, args, { shell: false, env: process.env });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); stderr += "\nCommand timed out."; }, timeoutMs);
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("error", e => {
      clearTimeout(timer);
      resolvePromise({ ok: false, code: 127, stdout, stderr: `${stderr}\nUnable to start SocialClaw CLI: ${e.message}` });
    });
    child.on("close", code => {
      clearTimeout(timer);
      resolvePromise({ ok: code === 0, code: code ?? 1, stdout, stderr });
    });
  });
}
function validateSchedule(schedule) {
  const errors = [];
  if (!schedule || !Array.isArray(schedule.posts) || schedule.posts.length < 1) {
    return ["Add at least one post to the schedule."];
  }
  schedule.posts.forEach((p, i) => {
    const n = i + 1;
    if (!providers.has(p.provider)) errors.push(`Post ${n}: unsupported platform.`);
    if (!p.account_id || /REPLACE|YOUR_ACCOUNT/i.test(p.account_id)) errors.push(`Post ${n}: choose a connected account ID.`);
    if (typeof p.text !== "string" || !p.text.trim()) errors.push(`Post ${n}: post text is required.`);
    if (!p.scheduled_at || Number.isNaN(Date.parse(p.scheduled_at))) errors.push(`Post ${n}: enter a valid date and time.`);
    else if (Date.parse(p.scheduled_at) < Date.now() + 60_000) errors.push(`Post ${n}: schedule the post at least one minute in the future.`);
  });
  return errors;
}

await mkdir(DATA_DIR, { recursive: true });
if (!(await readJson(SCHEDULE_FILE, null))) await writeJson(SCHEDULE_FILE, { posts: [] });
if (!(await readJson(RUNS_FILE, null))) await writeJson(RUNS_FILE, []);

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  configured: Boolean(process.env.SC_API_KEY),
  cli: CLI
}));

app.get("/api/accounts", async (_req, res) => {
  const result = await runCli(["accounts", "list", "--json"]);
  res.status(result.ok ? 200 : 503).json(result);
});

app.get("/api/schedule", async (_req, res) => {
  res.json(await readJson(SCHEDULE_FILE, { posts: [] }));
});

app.put("/api/schedule", async (req, res) => {
  const schedule = req.body;
  const errors = validateSchedule(schedule);
  if (errors.length) return res.status(400).json({ ok: false, errors });
  await writeJson(SCHEDULE_FILE, schedule);
  res.json({ ok: true, schedule });
});

app.post("/api/validate", async (_req, res) => {
  const schedule = await readJson(SCHEDULE_FILE, { posts: [] });
  const errors = validateSchedule(schedule);
  if (errors.length) return res.status(400).json({ ok: false, errors });
  const result = await runCli(["validate", "-f", SCHEDULE_FILE, "--json"]);
  res.status(result.ok ? 200 : 503).json(result);
});

app.post("/api/publish", async (_req, res) => {
  // Explicit action only: validate locally and with SocialClaw before applying.
  const schedule = await readJson(SCHEDULE_FILE, { posts: [] });
  const errors = validateSchedule(schedule);
  if (errors.length) return res.status(400).json({ ok: false, errors });
  const validation = await runCli(["validate", "-f", SCHEDULE_FILE, "--json"]);
  if (!validation.ok) return res.status(422).json({
    ok: false, stage: "validation", message: "Validation failed; nothing was published.",
    stdout: validation.stdout, stderr: validation.stderr
  });
  const result = await runCli(["apply", "-f", SCHEDULE_FILE, "--json"]);
  const run = { id: randomUUID(), createdAt: new Date().toISOString(), ok: result.ok,
    stdout: result.stdout, stderr: result.stderr };
  const runs = await readJson(RUNS_FILE, []);
  runs.unshift(run);
  await writeJson(RUNS_FILE, runs.slice(0, 100));
  res.status(result.ok ? 200 : 503).json({ ...result, run });
});

app.get("/api/runs", async (_req, res) => res.json(await readJson(RUNS_FILE, [])));

app.get("/api/runs/:id/status", async (req, res) => {
  // SocialClaw's run id is distinct from this dashboard's local history ID.
  const id = req.params.id;
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) return res.status(400).json({ ok: false, stderr: "Invalid run ID." });
  const result = await runCli(["status", "--run-id", id, "--json"]);
  res.status(result.ok ? 200 : 503).json(result);
});

app.get("/api/posts", async (_req, res) => {
  const result = await runCli(["posts", "list", "--json"]);
  res.status(result.ok ? 200 : 503).json(result);
});

app.get("*", (_req, res) => res.sendFile(resolve("public/index.html")));
app.listen(PORT, () => console.log(`Social Publishing Platform running at http://localhost:${PORT}`));
