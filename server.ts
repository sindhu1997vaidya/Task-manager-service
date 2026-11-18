import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Priority,
  StrategyMode,
  TaskEngine,
  runHardenedTestSuite,
} from "./server/taskEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const engine = new TaskEngine(true);

function collectJavaFiles(dir: string, rootDir: string): Array<{ path: string; content: string; category: string }> {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: Array<{ path: string; content: string; category: string }> = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "out" || entry.name === ".idea") continue;
      results.push(...collectJavaFiles(full, rootDir));
    } else {
      const rel = path.relative(rootDir, full).replace(/\\/g, "/");
      const content = fs.readFileSync(full, "utf-8");
      const parts = rel.split("/");
      const category = parts.length >= 3 && parts[0] === "src" ? parts[1] : "docs";
      results.push({ path: rel, content, category });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get("/api/state", (_req, res) => {
    res.json({
      tasks: engine.repo.findAll(),
      idempotencyRecords: engine.idempotencyStore.snapshot(),
      listeners: {
        console: engine.consoleListenerActive,
        audit: engine.auditListenerActive,
      },
      auditCounts: engine.auditCounts,
      eventLogs: engine.eventLogs,
    });
  });

  app.post("/api/reset", (req, res) => {
    const seed = req.body?.seed !== false;
    if (seed) {
      engine.seed();
    } else {
      engine.repo.clear();
      engine.idempotencyStore.clear();
      engine.auditCounts = {};
      engine.eventLogs = [];
    }
    res.json({ ok: true });
  });

  app.post("/api/listeners", (req, res) => {
    const { listener, enabled } = req.body ?? {};
    if (listener === "console") {
      engine.consoleListenerActive = Boolean(enabled);
    } else if (listener === "audit") {
      engine.auditListenerActive = Boolean(enabled);
    }
    res.json({
      console: engine.consoleListenerActive,
      audit: engine.auditListenerActive,
    });
  });

  app.get("/api/tasks", (req, res) => {
    const q = req.query;
    const completed =
      q.completed === "true" ? true : q.completed === "false" ? false : null;
    const priority =
      q.priority === "LOW" || q.priority === "MEDIUM" || q.priority === "HIGH"
        ? (q.priority as Priority)
        : null;
    const sortBy =
      q.sortBy === "dueDate" || q.sortBy === "priority" || q.sortBy === "title"
        ? q.sortBy
        : "id";
    const sortOrder = q.sortOrder === "desc" ? "desc" : "asc";
    const page = q.page ? Number(q.page) : 1;
    const pageSize = q.pageSize ? Number(q.pageSize) : 20;
    const parentId = q.parentId ? Number(q.parentId) : null;
    const topLevelOnly = q.topLevelOnly === "true";

    const apiRes = engine.listTasks({
      completed,
      priority,
      search: typeof q.search === "string" ? q.search : null,
      dueBefore: typeof q.dueBefore === "string" ? q.dueBefore : null,
      dueAfter: typeof q.dueAfter === "string" ? q.dueAfter : null,
      parentId,
      topLevelOnly,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.get("/api/tasks/:id", (req, res) => {
    const apiRes = engine.getTask(Number(req.params.id));
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.post("/api/tasks", (req, res) => {
    const { request, idempotencyKey } = req.body ?? {};
    const apiRes = engine.createTask(request ?? req.body, idempotencyKey ?? null);
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.post("/api/tasks/from-text", async (req, res) => {
    const { text, idempotencyKey, mode } = req.body ?? {};
    const strategy: StrategyMode = mode ?? "gemini";
    const apiRes = await engine.createTaskFromText(text ?? "", idempotencyKey ?? null, strategy);
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.put("/api/tasks/:id", (req, res) => {
    const apiRes = engine.updateTask(Number(req.params.id), req.body?.request ?? req.body);
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.post("/api/tasks/:id/complete", (req, res) => {
    const apiRes = engine.completeTask(Number(req.params.id));
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const apiRes = engine.deleteTask(Number(req.params.id));
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.post("/api/tasks/:id/subtasks", (req, res) => {
    const apiRes = engine.createSubtask(Number(req.params.id), req.body?.request ?? req.body);
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.get("/api/tasks/:id/subtasks", (req, res) => {
    const apiRes = engine.listSubtasks(Number(req.params.id));
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.post("/api/tasks/:id/breakdown", async (req, res) => {
    const { idempotencyKey, mode } = req.body ?? {};
    const strategy: StrategyMode = mode ?? "gemini";
    const apiRes = await engine.breakDownTask(Number(req.params.id), idempotencyKey ?? null, strategy);
    res.status(apiRes.statusCode).json(apiRes.body);
  });

  app.get("/api/java-files", (_req, res) => {
    const javaRoot = path.join(__dirname, "java-task-manager");
    const files = collectJavaFiles(javaRoot, javaRoot);
    res.json({ root: "java-task-manager", files });
  });

  app.post("/api/tests/run", async (_req, res) => {
    const summary = await runHardenedTestSuite();
    res.json(summary);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TaskForge server running on http://localhost:${PORT}`);
  });
}

startServer();
