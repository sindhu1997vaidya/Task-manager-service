import { GoogleGenAI, Type } from "@google/genai";

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface Task {
  readonly id: number;
  readonly parentId: number | null;
  readonly title: string;
  readonly description: string;
  readonly completed: boolean;
  readonly dueDate: string | null;
  readonly priority: Priority;
  readonly recurrence: string | null;
  readonly createdAt: string;
}

export interface TaskRequest {
  title?: string | null;
  description?: string | null;
  completed?: string | null;
  dueDate?: string | null;
  priority?: string | null;
  recurrence?: string | null;
}

export interface TaskQuery {
  completed?: boolean | null;
  priority?: Priority | null;
  search?: string | null;
  dueBefore?: string | null;
  dueAfter?: string | null;
  parentId?: number | null;
  topLevelOnly?: boolean;
  sortBy?: "id" | "dueDate" | "priority" | "title";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface FieldError {
  field: string;
  issue: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: FieldError[];
  };
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: T;
}

export class ApiException extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details: FieldError[];

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    details: FieldError[] = []
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class ValidationException extends ApiException {
  constructor(message: string, details: FieldError[]) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class NotFoundException extends ApiException {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictException extends ApiException {
  constructor(message: string) {
    super(422, "IDEMPOTENCY_CONFLICT", message);
  }
}

export class BadGatewayException extends ApiException {
  constructor(message: string, details: FieldError[] = []) {
    super(502, "BAD_GATEWAY", message, details);
  }
}

export class ServiceUnavailableException extends ApiException {
  constructor(message: string) {
    super(503, "SERVICE_UNAVAILABLE", message);
  }
}

export function errorResponseFrom(e: unknown): ApiResponse<ApiErrorBody> {
  if (e instanceof ApiException) {
    return {
      statusCode: e.statusCode,
      body: {
        error: {
          code: e.errorCode,
          message: e.message || "Request failed",
          details: e.details,
        },
      },
    };
  }
  const msg = e instanceof Error && e.message ? e.message : "Internal server error";
  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: msg,
        details: [],
      },
    },
  };
}

export function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12) return false;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth: Record<number, number> = {
    1: 31,
    2: isLeap ? 29 : 28,
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31,
  };
  return day >= 1 && day <= (daysInMonth[month] ?? 0);
}

export function validateTaskRequest(req: TaskRequest | null | undefined) {
  const errors: FieldError[] = [];
  if (!req) {
    errors.push({ field: "request", issue: "must not be null" });
    throw new ValidationException("Validation failed", errors);
  }

  const title = req.title ?? "";
  if (typeof title !== "string" || title.trim().length === 0) {
    errors.push({ field: "title", issue: "must not be empty or blank" });
  }

  const description = req.description ?? "";
  if (typeof description !== "string" || description.trim().length === 0) {
    errors.push({ field: "description", issue: "must not be empty or blank" });
  }

  if (req.completed !== "true" && req.completed !== "false") {
    errors.push({ field: "completed", issue: 'must be exactly "true" or "false"' });
  }

  let dueDate: string | null = null;
  if (req.dueDate !== null && req.dueDate !== undefined && String(req.dueDate).trim().length > 0) {
    const trimmed = String(req.dueDate).trim();
    if (!isValidIsoDate(trimmed)) {
      errors.push({ field: "dueDate", issue: "must be a real YYYY-MM-DD date" });
    } else {
      dueDate = trimmed;
    }
  }

  const priorityRaw = typeof req.priority === "string" ? req.priority.trim() : "";
  if (priorityRaw !== "LOW" && priorityRaw !== "MEDIUM" && priorityRaw !== "HIGH") {
    errors.push({ field: "priority", issue: "must be LOW, MEDIUM, or HIGH" });
  }

  if (errors.length > 0) {
    throw new ValidationException("Validation failed", errors);
  }

  return {
    title: title.trim(),
    description: description.trim(),
    completed: req.completed === "true",
    dueDate,
    priority: priorityRaw as Priority,
    recurrence:
      req.recurrence && String(req.recurrence).trim().length > 0
        ? String(req.recurrence).trim()
        : null,
  };
}

export interface ParsedTask {
  title: string;
  description: string;
  dueDate: string | null;
  recurrence: string | null;
}

export type StrategyMode =
  | "gemini"
  | "rule"
  | "faulty_empty_title"
  | "faulty_bad_date"
  | "faulty_malformed_json"
  | "faulty_breakdown_line"
  | "faulty_network"
  | "missing_key";

export interface EventRecord {
  id: number;
  timestamp: string;
  eventType: string;
  taskId: number;
  taskTitle: string;
  listener: string;
}

export interface IdempotencyRecordView {
  key: string;
  fingerprint: string;
  statusCode: number;
  response: ApiResponse;
  createdAt: string;
}

export class InMemoryTaskRepository {
  private storage = new Map<number, Task>();
  private seq = 1;

  nextId(): number {
    return this.seq++;
  }

  save(task: Task): Task {
    this.storage.set(task.id, task);
    return task;
  }

  findById(id: number): Task | undefined {
    return this.storage.get(id);
  }

  findAll(): Task[] {
    return Array.from(this.storage.values());
  }

  delete(id: number): boolean {
    return this.storage.delete(id);
  }

  clear(): void {
    this.storage.clear();
    this.seq = 1;
  }
}

export class IdempotencyStore {
  private records = new Map<string, IdempotencyRecordView>();

  getExistingOrValidate(key: string | null | undefined, fingerprint: string): ApiResponse | null {
    if (!key || key.trim().length === 0) return null;
    const existing = this.records.get(key.trim());
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint) {
      throw new ConflictException(
        `Idempotency key '${key.trim()}' was already used with a different request payload.`
      );
    }
    return existing.response;
  }

  putSuccess(key: string | null | undefined, fingerprint: string, response: ApiResponse): void {
    if (!key || key.trim().length === 0) return;
    if (response.statusCode >= 200 && response.statusCode < 300) {
      this.records.set(key.trim(), {
        key: key.trim(),
        fingerprint,
        statusCode: response.statusCode,
        response,
        createdAt: new Date().toISOString(),
      });
    }
  }

  snapshot(): IdempotencyRecordView[] {
    return Array.from(this.records.values());
  }

  clear(): void {
    this.records.clear();
  }
}

export function ruleBasedParse(text: string, today: string): ParsedTask {
  const cleaned = text.trim();
  const lower = cleaned.toLowerCase();
  const base = new Date(today + "T00:00:00Z");

  let dueDate: string | null = null;
  let recurrence: string | null = null;

  if (lower.includes("tomorrow")) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + 1);
    dueDate = d.toISOString().slice(0, 10);
  } else if (lower.includes("today")) {
    dueDate = today;
  } else if (lower.includes("next week")) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + 7);
    dueDate = d.toISOString().slice(0, 10);
  } else if (lower.includes("1st of every month") || lower.includes("1st")) {
    const d = new Date(base);
    if (d.getUTCDate() !== 1) {
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
    }
    dueDate = d.toISOString().slice(0, 10);
  }

  if (lower.includes("every month") || lower.includes("monthly")) {
    recurrence = "MONTHLY";
  } else if (lower.includes("every week") || lower.includes("weekly")) {
    recurrence = "WEEKLY";
  } else if (lower.includes("every day") || lower.includes("daily")) {
    recurrence = "DAILY";
  }

  let title = cleaned
    .replace(/^remind me to\s+/i, "")
    .replace(/^please\s+/i, "")
    .trim();
  if (title.length > 64) title = title.slice(0, 61).trim() + "...";
  if (title.length > 0) title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, description: cleaned, dueDate, recurrence };
}

export function ruleBasedBreakdown(parent: Task): TaskRequest[] {
  const source = parent.description.trim() || parent.title.trim();
  const parts = source
    .split(/\s*(?:,|\band\b|;)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return parts.map((p) => {
      const title = p.charAt(0).toUpperCase() + p.slice(1);
      return {
        title,
        description: `Subtask for '${parent.title}': ${title}`,
        completed: "false",
        dueDate: parent.dueDate,
        priority: parent.priority,
      };
    });
  }

  return [
    {
      title: `Plan ${parent.title}`,
      description: `Outline scope and requirements for ${parent.title}`,
      completed: "false",
      dueDate: parent.dueDate,
      priority: parent.priority,
    },
    {
      title: `Execute ${parent.title}`,
      description: `Complete core deliverables for ${parent.title}`,
      completed: "false",
      dueDate: parent.dueDate,
      priority: parent.priority,
    },
    {
      title: `Review ${parent.title}`,
      description: `Verify final quality for ${parent.title}`,
      completed: "false",
      dueDate: parent.dueDate,
      priority: parent.priority,
    },
  ];
}

function getGeminiClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim().length === 0) {
    throw new ServiceUnavailableException("LLM_API_KEY / GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function geminiParseTask(text: string, today: string): Promise<ParsedTask> {
  const ai = getGeminiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `Today's date is ${today} (YYYY-MM-DD).\nConvert the user request into a structured task:\n"${text}"`,
      config: {
        systemInstruction:
          "You are a strict task extraction engine. Return concise title, clear description, resolved YYYY-MM-DD dueDate (or null if none), and optional recurrence (DAILY, WEEKLY, MONTHLY, or null).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            dueDate: { type: Type.STRING, nullable: true },
            recurrence: { type: Type.STRING, nullable: true },
          },
          required: ["title", "description"],
        },
      },
    });
    const raw = (response.text ?? "").trim();
    const parsed = JSON.parse(raw) as Partial<ParsedTask>;
    return {
      title: parsed.title ?? "",
      description: parsed.description ?? "",
      dueDate: parsed.dueDate ?? null,
      recurrence: parsed.recurrence ?? null,
    };
  } catch (e) {
    if (e instanceof ApiException) throw e;
    throw new BadGatewayException(
      "Failed to parse task from Gemini LLM: " + (e instanceof Error ? e.message : "unknown error")
    );
  }
}

async function geminiBreakDownTask(parent: Task): Promise<TaskRequest[]> {
  const ai = getGeminiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents:
        `Break the following parent task into 3 to 5 concrete subtasks.\n` +
        `Output ONLY one subtask per line in the format: title|description\n` +
        `Parent Title: ${parent.title}\nParent Description: ${parent.description}`,
      config: {
        systemInstruction:
          "Output only plain text lines formatted strictly as title|description with 3 to 5 lines and no bullets or numbering.",
      },
    });
    const raw = (response.text ?? "").trim();
    if (!raw) throw new BadGatewayException("LLM returned empty breakdown output.");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const items: TaskRequest[] = [];
    for (const line of lines) {
      const pipe = line.indexOf("|");
      if (pipe === -1) {
        throw new BadGatewayException(`Malformed breakdown line (expected 'title|description'): ${line}`);
      }
      items.push({
        title: line.slice(0, pipe).trim(),
        description: line.slice(pipe + 1).trim(),
        completed: "false",
        dueDate: parent.dueDate,
        priority: parent.priority,
      });
    }
    if (items.length === 0) throw new BadGatewayException("LLM produced zero subtasks.");
    return items;
  } catch (e) {
    if (e instanceof ApiException) throw e;
    throw new BadGatewayException(
      "Failed to break down task via Gemini LLM: " + (e instanceof Error ? e.message : "unknown error")
    );
  }
}

export class TaskEngine {
  public readonly repo = new InMemoryTaskRepository();
  public readonly idempotencyStore = new IdempotencyStore();
  public consoleListenerActive = true;
  public auditListenerActive = true;
  public auditCounts: Record<string, number> = {};
  public eventLogs: EventRecord[] = [];
  private eventSeq = 1;

  constructor(seedDemoData = true) {
    if (seedDemoData) {
      this.seed();
    }
  }

  public seed(): void {
    this.repo.clear();
    this.idempotencyStore.clear();
    this.auditCounts = {};
    this.eventLogs = [];
    this.eventSeq = 1;

    this.createTask(
      {
        title: "Prepare quarterly architecture deck",
        description: "Review service boundaries, compile metrics, and finalize Q4 slides",
        completed: "false",
        dueDate: "2026-12-10",
        priority: "HIGH",
      },
      "seed-task-1"
    );
    this.createTask(
      {
        title: "Audit nightly database backups",
        description: "Verify snapshot checksums and restore drill timing",
        completed: "false",
        dueDate: "2026-12-02",
        priority: "MEDIUM",
      },
      "seed-task-2"
    );
    this.createTask(
      {
        title: "Archive legacy API contract notes",
        description: "Move deprecated v1 endpoints into historical appendix",
        completed: "true",
        dueDate: "2026-11-28",
        priority: "LOW",
      },
      "seed-task-3"
    );
  }

  private emit(eventType: string, task: Task): void {
    const ts = new Date().toISOString();
    if (this.consoleListenerActive) {
      this.eventLogs.unshift({
        id: this.eventSeq++,
        timestamp: ts,
        eventType,
        taskId: task.id,
        taskTitle: task.title,
        listener: "ConsoleLogListener",
      });
    }
    if (this.auditListenerActive) {
      this.auditCounts[eventType] = (this.auditCounts[eventType] ?? 0) + 1;
      this.eventLogs.unshift({
        id: this.eventSeq++,
        timestamp: ts,
        eventType,
        taskId: task.id,
        taskTitle: task.title,
        listener: "AuditTrailListener",
      });
    }
    if (this.eventLogs.length > 80) {
      this.eventLogs = this.eventLogs.slice(0, 80);
    }
  }

  private fingerprintRequest(op: string, req: TaskRequest | null | undefined): string {
    if (!req) return `${op}|null`;
    const s = (v: unknown) => (v === null || v === undefined ? "<null>" : String(v).trim());
    return `${op}|${s(req.title)}|${s(req.description)}|${s(req.completed)}|${s(req.dueDate)}|${s(req.priority)}|${s(req.recurrence)}`;
  }

  createTask(request: TaskRequest, idempotencyKey?: string | null): ApiResponse {
    try {
      const fp = this.fingerprintRequest("CREATE_TASK", request);
      const cached = this.idempotencyStore.getExistingOrValidate(idempotencyKey, fp);
      if (cached) return cached;

      const valid = validateTaskRequest(request);
      const task: Task = {
        id: this.repo.nextId(),
        parentId: null,
        title: valid.title,
        description: valid.description,
        completed: valid.completed,
        dueDate: valid.dueDate,
        priority: valid.priority,
        recurrence: valid.recurrence,
        createdAt: new Date().toISOString(),
      };
      this.repo.save(task);
      this.emit("TASK_CREATED", task);

      const res: ApiResponse<Task> = { statusCode: 201, body: task };
      this.idempotencyStore.putSuccess(idempotencyKey, fp, res);
      return res;
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  async createTaskFromText(
    text: string,
    idempotencyKey?: string | null,
    mode: StrategyMode = "gemini"
  ): Promise<ApiResponse> {
    try {
      if (!text || text.trim().length === 0) {
        throw new ValidationException("Validation failed", [
          { field: "text", issue: "must not be empty or blank" },
        ]);
      }

      const fp = `CREATE_FROM_TEXT|${text.trim()}`;
      const cached = this.idempotencyStore.getExistingOrValidate(idempotencyKey, fp);
      if (cached) return cached;

      const today = new Date().toISOString().slice(0, 10);
      let parsed: ParsedTask;

      if (mode === "missing_key") {
        throw new ServiceUnavailableException("LLM_API_KEY environment variable is not set.");
      } else if (mode === "faulty_network") {
        throw new BadGatewayException("Simulated upstream LLM request timeout.");
      } else if (mode === "faulty_empty_title") {
        parsed = { title: "   ", description: text.trim(), dueDate: "2026-12-01", recurrence: null };
      } else if (mode === "faulty_bad_date") {
        parsed = { title: "Pay rent", description: text.trim(), dueDate: "2026-02-30", recurrence: null };
      } else if (mode === "faulty_malformed_json") {
        throw new BadGatewayException("Model returned unparseable task JSON: Expected JSON object");
      } else if (mode === "rule") {
        parsed = ruleBasedParse(text, today);
      } else {
        parsed = await geminiParseTask(text, today);
      }

      let valid;
      try {
        valid = validateTaskRequest({
          title: parsed.title,
          description: parsed.description,
          completed: "false",
          dueDate: parsed.dueDate,
          priority: "MEDIUM",
          recurrence: parsed.recurrence,
        });
      } catch (err) {
        if (err instanceof ValidationException) {
          throw new BadGatewayException("Model output failed validation", err.details);
        }
        throw err;
      }

      const task: Task = {
        id: this.repo.nextId(),
        parentId: null,
        title: valid.title,
        description: valid.description,
        completed: valid.completed,
        dueDate: valid.dueDate,
        priority: valid.priority,
        recurrence: valid.recurrence,
        createdAt: new Date().toISOString(),
      };
      this.repo.save(task);
      this.emit("TASK_CREATED", task);

      const res: ApiResponse<Task> = { statusCode: 201, body: task };
      this.idempotencyStore.putSuccess(idempotencyKey, fp, res);
      return res;
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  getTask(id: number): ApiResponse {
    try {
      const task = this.repo.findById(id);
      if (!task) throw new NotFoundException(`Task not found with id: ${id}`);
      return { statusCode: 200, body: task };
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  listTasks(query: TaskQuery = {}): ApiResponse {
    try {
      let items = this.repo.findAll();

      if (query.completed !== null && query.completed !== undefined) {
        items = items.filter((t) => t.completed === query.completed);
      }
      if (query.priority) {
        items = items.filter((t) => t.priority === query.priority);
      }
      if (query.search && query.search.trim().length > 0) {
        const kw = query.search.toLowerCase().trim();
        items = items.filter(
          (t) => t.title.toLowerCase().includes(kw) || t.description.toLowerCase().includes(kw)
        );
      }
      if (query.dueBefore && query.dueBefore.trim().length > 0) {
        const b = query.dueBefore.trim();
        items = items.filter((t) => t.dueDate !== null && t.dueDate <= b);
      }
      if (query.dueAfter && query.dueAfter.trim().length > 0) {
        const a = query.dueAfter.trim();
        items = items.filter((t) => t.dueDate !== null && t.dueDate >= a);
      }
      if (query.parentId !== null && query.parentId !== undefined) {
        items = items.filter((t) => t.parentId === query.parentId);
      } else if (query.topLevelOnly) {
        items = items.filter((t) => t.parentId === null);
      }

      const sortBy = query.sortBy ?? "id";
      const desc = query.sortOrder === "desc";
      const prioWeight: Record<Priority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "dueDate") {
          if (a.dueDate === b.dueDate) cmp = a.id - b.id;
          else if (a.dueDate === null) cmp = 1;
          else if (b.dueDate === null) cmp = -1;
          else cmp = a.dueDate.localeCompare(b.dueDate) || a.id - b.id;
        } else if (sortBy === "priority") {
          cmp = prioWeight[a.priority] - prioWeight[b.priority] || a.id - b.id;
        } else if (sortBy === "title") {
          cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.id - b.id;
        } else {
          cmp = a.id - b.id;
        }
        return desc ? -cmp : cmp;
      });

      const page = Math.max(1, Number(query.page ?? 1));
      const pageSize = Math.max(1, Number(query.pageSize ?? 20));
      const totalItems = items.length;
      const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / pageSize);
      const start = (page - 1) * pageSize;
      const paged = start >= totalItems ? [] : items.slice(start, start + pageSize);

      return {
        statusCode: 200,
        body: { items: paged, page, pageSize, totalItems, totalPages },
      };
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  updateTask(id: number, request: TaskRequest): ApiResponse {
    try {
      const existing = this.repo.findById(id);
      if (!existing) throw new NotFoundException(`Task not found with id: ${id}`);

      const valid = validateTaskRequest(request);
      const updated: Task = {
        id: existing.id,
        parentId: existing.parentId,
        title: valid.title,
        description: valid.description,
        completed: valid.completed,
        dueDate: valid.dueDate,
        priority: valid.priority,
        recurrence: valid.recurrence,
        createdAt: existing.createdAt,
      };
      this.repo.save(updated);
      this.emit("TASK_UPDATED", updated);
      if (!existing.completed && updated.completed) {
        this.emit("TASK_COMPLETED", updated);
      }
      return { statusCode: 200, body: updated };
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  completeTask(id: number): ApiResponse {
    try {
      const existing = this.repo.findById(id);
      if (!existing) throw new NotFoundException(`Task not found with id: ${id}`);
      const updated: Task = { ...existing, completed: true };
      this.repo.save(updated);
      this.emit("TASK_COMPLETED", updated);
      return { statusCode: 200, body: updated };
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  deleteTask(id: number): ApiResponse {
    try {
      const existing = this.repo.findById(id);
      if (!existing) throw new NotFoundException(`Task not found with id: ${id}`);
      const subtasks = this.repo.findAll().filter((t) => t.parentId === id);
      for (const sub of subtasks) {
        this.repo.delete(sub.id);
        this.emit("TASK_DELETED", sub);
      }
      this.repo.delete(id);
      this.emit("TASK_DELETED", existing);
      return { statusCode: 200, body: { deletedId: id, deletedSubtasksCount: subtasks.length } };
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  createSubtask(parentId: number, request: TaskRequest): ApiResponse {
    try {
      const parent = this.repo.findById(parentId);
      if (!parent) throw new NotFoundException(`Task not found with id: ${parentId}`);
      if (parent.parentId !== null) {
        throw new ValidationException("Validation failed", [
          { field: "parentId", issue: "cannot create a subtask under another subtask" },
        ]);
      }
      const valid = validateTaskRequest(request);
      const subtask: Task = {
        id: this.repo.nextId(),
        parentId,
        title: valid.title,
        description: valid.description,
        completed: valid.completed,
        dueDate: valid.dueDate,
        priority: valid.priority,
        recurrence: valid.recurrence,
        createdAt: new Date().toISOString(),
      };
      this.repo.save(subtask);
      this.emit("SUBTASK_CREATED", subtask);
      return { statusCode: 201, body: subtask };
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  listSubtasks(parentId: number): ApiResponse {
    try {
      const parent = this.repo.findById(parentId);
      if (!parent) throw new NotFoundException(`Task not found with id: ${parentId}`);
      const subtasks = this.repo.findAll().filter((t) => t.parentId === parentId);
      return { statusCode: 200, body: subtasks };
    } catch (e) {
      return errorResponseFrom(e);
    }
  }

  async breakDownTask(
    id: number,
    idempotencyKey?: string | null,
    mode: StrategyMode = "gemini"
  ): Promise<ApiResponse> {
    try {
      const parent = this.repo.findById(id);
      if (!parent) throw new NotFoundException(`Task not found with id: ${id}`);
      if (parent.parentId !== null) {
        throw new ValidationException("Validation failed", [
          { field: "id", issue: "cannot break down a task that is already a subtask" },
        ]);
      }

      const fp = `BREAKDOWN|${id}|${parent.title}|${parent.description}`;
      const cached = this.idempotencyStore.getExistingOrValidate(idempotencyKey, fp);
      if (cached) return cached;

      let candidates: TaskRequest[];
      if (mode === "missing_key") {
        throw new ServiceUnavailableException("LLM_API_KEY environment variable is not set.");
      } else if (mode === "faulty_network") {
        throw new BadGatewayException("Simulated upstream LLM breakdown timeout.");
      } else if (mode === "faulty_breakdown_line" || mode === "faulty_malformed_json") {
        throw new BadGatewayException(
          "Malformed breakdown line (expected 'title|description'): Invalid line without pipe delimiter"
        );
      } else if (mode === "faulty_empty_title") {
        candidates = [
          { title: "Valid first step", description: "Good step", completed: "false", priority: "MEDIUM" },
          { title: "  ", description: "Missing title", completed: "false", priority: "MEDIUM" },
        ];
      } else if (mode === "faulty_bad_date") {
        candidates = [
          {
            title: "Subtask with bad date",
            description: "Impossible date",
            completed: "false",
            dueDate: "2026-02-30",
            priority: "MEDIUM",
          },
        ];
      } else if (mode === "rule") {
        candidates = ruleBasedBreakdown(parent);
      } else {
        candidates = await geminiBreakDownTask(parent);
      }

      const validated = [];
      for (const req of candidates) {
        try {
          validated.push(validateTaskRequest(req));
        } catch (err) {
          if (err instanceof ValidationException) {
            throw new BadGatewayException("Model breakdown item failed validation", err.details);
          }
          throw err;
        }
      }

      const created: Task[] = [];
      for (const valid of validated) {
        const subtask: Task = {
          id: this.repo.nextId(),
          parentId: parent.id,
          title: valid.title,
          description: valid.description,
          completed: valid.completed,
          dueDate: valid.dueDate,
          priority: valid.priority,
          recurrence: valid.recurrence,
          createdAt: new Date().toISOString(),
        };
        this.repo.save(subtask);
        created.push(subtask);
        this.emit("SUBTASK_CREATED", subtask);
      }

      const res: ApiResponse<Task[]> = { statusCode: 201, body: created };
      this.idempotencyStore.putSuccess(idempotencyKey, fp, res);
      return res;
    } catch (e) {
      return errorResponseFrom(e);
    }
  }
}

export interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  detail: string;
}

export async function runHardenedTestSuite(): Promise<{
  passed: number;
  failed: number;
  results: TestCaseResult[];
}> {
  const results: TestCaseResult[] = [];
  const check = (id: string, category: string, name: string, cond: boolean, detail: string) => {
    results.push({ id, category, name, passed: cond, detail });
  };

  // 1. CRUD lifecycle
  {
    const eng = new TaskEngine(false);
    const c = eng.createTask({
      title: "Write docs",
      description: "Document API endpoints",
      completed: "false",
      dueDate: "2026-12-01",
      priority: "HIGH",
    });
    const g = eng.getTask(1);
    const comp = eng.completeTask(1);
    check(
      "T01",
      "CRUD",
      "createTask -> 201, getTask -> 200, completeTask -> 200",
      c.statusCode === 201 && g.statusCode === 200 && comp.statusCode === 200 && (comp.body as Task).completed === true,
      `statuses=${c.statusCode}/${g.statusCode}/${comp.statusCode}`
    );
  }

  // 2. Collect multiple field errors
  {
    const eng = new TaskEngine(false);
    const r = eng.createTask({
      title: "  ",
      description: "",
      completed: "maybe",
      dueDate: "2026-13-01",
      priority: "CRITICAL",
    });
    const err = r.body as ApiErrorBody;
    const fields = err.error?.details?.map((d) => d.field) ?? [];
    check(
      "T02",
      "Validation",
      "Collects all 5 field issues in single 400 VALIDATION_ERROR response",
      r.statusCode === 400 &&
        err.error?.code === "VALIDATION_ERROR" &&
        ["title", "description", "completed", "dueDate", "priority"].every((f) => fields.includes(f)),
      `fields=[${fields.join(", ")}]`
    );
  }

  // 3. Impossible & leap year dates
  {
    const eng = new TaskEngine(false);
    const feb30 = eng.createTask({
      title: "Bad date",
      description: "Feb 30",
      completed: "false",
      dueDate: "2026-02-30",
      priority: "LOW",
    });
    const nonLeap = eng.createTask({
      title: "Non leap",
      description: "2025-02-29",
      completed: "false",
      dueDate: "2025-02-29",
      priority: "LOW",
    });
    const leap = eng.createTask({
      title: "Leap day",
      description: "2024-02-29",
      completed: "false",
      dueDate: "2024-02-29",
      priority: "LOW",
    });
    check(
      "T03",
      "Date Validation",
      "Rejects 2026-02-30 & 2025-02-29 (400), accepts leap 2024-02-29 (201)",
      feb30.statusCode === 400 && nonLeap.statusCode === 400 && leap.statusCode === 201,
      `feb30=${feb30.statusCode}, 2025-02-29=${nonLeap.statusCode}, 2024-02-29=${leap.statusCode}`
    );
  }

  // 4. Unknown ID
  {
    const eng = new TaskEngine(false);
    const r = eng.getTask(4040);
    check(
      "T04",
      "CRUD",
      "Unknown ID returns 404 NOT_FOUND",
      r.statusCode === 404 && (r.body as ApiErrorBody).error?.code === "NOT_FOUND",
      `status=${r.statusCode}`
    );
  }

  // 5. Idempotent creation + FakeLlmClient call-count simulation
  {
    const eng = new TaskEngine(false);
    let fakeCalls = 0;
    const key = "key-ai-1";
    const text = "Remind me to pay rent on the 1st of every month";
    const runWithFake = async () => {
      const fp = `CREATE_FROM_TEXT|${text}`;
      const cached = eng.idempotencyStore.getExistingOrValidate(key, fp);
      if (cached) return cached;
      fakeCalls++;
      return eng.createTaskFromText(text, key, "rule");
    };
    const r1 = await runWithFake();
    const r2 = await runWithFake();
    check(
      "T05",
      "Idempotency",
      "Repeated idempotencyKey returns cached 201 and never invokes parser twice",
      r1.statusCode === 201 &&
        r2.statusCode === 201 &&
        JSON.stringify(r1.body) === JSON.stringify(r2.body) &&
        fakeCalls === 1 &&
        eng.repo.findAll().length === 1,
      `fakeCalls=${fakeCalls}, repoSize=${eng.repo.findAll().length}`
    );
  }

  // 6. Idempotency conflict 422
  {
    const eng = new TaskEngine(false);
    eng.createTask({ title: "Task A", description: "Desc A", completed: "false", priority: "LOW" }, "same-key");
    const conflict = eng.createTask(
      { title: "Task B", description: "Desc B", completed: "false", priority: "HIGH" },
      "same-key"
    );
    check(
      "T06",
      "Idempotency",
      "Same key with different request returns 422 IDEMPOTENCY_CONFLICT",
      conflict.statusCode === 422 && (conflict.body as ApiErrorBody).error?.code === "IDEMPOTENCY_CONFLICT",
      `status=${conflict.statusCode}`
    );
  }

  // 7. Failed 400 is not stored in IdempotencyStore
  {
    const eng = new TaskEngine(false);
    const bad = eng.createTask({ title: "", description: "Desc", completed: "false", priority: "LOW" }, "retry-fix");
    const fixed = eng.createTask(
      { title: "Fixed title", description: "Desc", completed: "false", priority: "LOW" },
      "retry-fix"
    );
    check(
      "T07",
      "Idempotency",
      "Failed 400 is not cached so client can fix input and retry with same key",
      bad.statusCode === 400 && fixed.statusCode === 201,
      `bad=${bad.statusCode}, fixed=${fixed.statusCode}`
    );
  }

  // 8-11. Faulty LLM outputs return 502 and save nothing
  {
    const eng = new TaskEngine(false);
    const rEmpty = await eng.createTaskFromText("Do something", "f1", "faulty_empty_title");
    const rDate = await eng.createTaskFromText("Pay rent Feb 30", "f2", "faulty_bad_date");
    const rJson = await eng.createTaskFromText("Schedule dentist", "f3", "faulty_malformed_json");
    const rNet = await eng.createTaskFromText("Call mom", "f4", "faulty_network");
    check(
      "T08",
      "AI Guardrails",
      "Faulty LLM outputs (empty title, bad date, malformed JSON, timeout) return 502 and save 0 tasks",
      rEmpty.statusCode === 502 &&
        rDate.statusCode === 502 &&
        rJson.statusCode === 502 &&
        rNet.statusCode === 502 &&
        eng.repo.findAll().length === 0,
      `statuses=${rEmpty.statusCode}/${rDate.statusCode}/${rJson.statusCode}/${rNet.statusCode}, saved=${eng.repo.findAll().length}`
    );
  }

  // 12. Missing API key returns 503
  {
    const eng = new TaskEngine(false);
    const r503 = await eng.createTaskFromText("Buy groceries", null, "missing_key");
    check(
      "T09",
      "AI Guardrails",
      "Missing LLM_API_KEY returns 503 SERVICE_UNAVAILABLE",
      r503.statusCode === 503 && (r503.body as ApiErrorBody).error?.code === "SERVICE_UNAVAILABLE",
      `status=${r503.statusCode}`
    );
  }

  // 13. Subtask nesting guard (400) & atomic breakdown failure (502) & cascade delete
  {
    const eng = new TaskEngine(false);
    eng.createTask({ title: "Parent", description: "Pack boxes and hire movers", completed: "false", priority: "HIGH" });
    const sub = eng.createSubtask(1, {
      title: "Child",
      description: "First-level subtask",
      completed: "false",
      priority: "LOW",
    });
    const grand = eng.createSubtask(2, {
      title: "Grandchild",
      description: "Disallowed",
      completed: "false",
      priority: "LOW",
    });
    const breakSub = await eng.breakDownTask(2, null, "rule");
    const faultyBd = await eng.breakDownTask(1, "bd-fault", "faulty_empty_title");
    const countAfterFaulty = eng.repo.findAll().length;
    const del = eng.deleteTask(1);
    check(
      "T10",
      "Subtasks",
      "Subtask-of-subtask -> 400, faulty breakdown saves 0 -> 502, cascade delete removes all",
      sub.statusCode === 201 &&
        grand.statusCode === 400 &&
        breakSub.statusCode === 400 &&
        faultyBd.statusCode === 502 &&
        countAfterFaulty === 2 &&
        del.statusCode === 200 &&
        eng.repo.findAll().length === 0,
      `sub=${sub.statusCode}, grand=${grand.statusCode}, faultyBd=${faultyBd.statusCode}, afterDel=${eng.repo.findAll().length}`
    );
  }

  // 14. Combined Filter, Search, Sort & Pagination + out-of-bounds page
  {
    const eng = new TaskEngine(false);
    eng.createTask({ title: "Alpha", description: "Finance summary", completed: "false", dueDate: "2026-12-10", priority: "LOW" });
    eng.createTask({ title: "Beta", description: "Finance forecast", completed: "false", dueDate: "2026-12-03", priority: "HIGH" });
    eng.createTask({ title: "Gamma", description: "Finance archive", completed: "true", dueDate: "2026-12-01", priority: "HIGH" });
    eng.createTask({ title: "Delta", description: "Finance audit", completed: "false", dueDate: "2026-12-07", priority: "MEDIUM" });

    const page1 = eng.listTasks({
      completed: false,
      search: "finance",
      sortBy: "dueDate",
      sortOrder: "asc",
      page: 1,
      pageSize: 2,
    }).body as { items: Task[]; totalItems: number; totalPages: number };

    const pageBeyond = eng.listTasks({ page: 9, pageSize: 10 }).body as { items: Task[] };

    check(
      "T11",
      "Querying",
      "Combined filter + search + sort + pagination works; page beyond last returns []",
      page1.totalItems === 3 &&
        page1.totalPages === 2 &&
        page1.items.map((t) => t.title).join(",") === "Beta,Delta" &&
        pageBeyond.items.length === 0,
      `page1=[${page1.items.map((t) => t.title).join(",")}], beyondLen=${pageBeyond.items.length}`
    );
  }

  // 15. Observer add / remove listener
  {
    const eng = new TaskEngine(false);
    eng.createTask({ title: "One", description: "First", completed: "false", priority: "LOW" });
    const countWhileAttached = eng.auditCounts["TASK_CREATED"] ?? 0;
    eng.auditListenerActive = false;
    eng.createTask({ title: "Two", description: "Second", completed: "false", priority: "LOW" });
    const countAfterRemoval = eng.auditCounts["TASK_CREATED"] ?? 0;
    check(
      "T12",
      "Observer",
      "Removing AuditTrailListener stops event notifications",
      countWhileAttached === 1 && countAfterRemoval === 1,
      `beforeRemove=${countWhileAttached}, afterRemove=${countAfterRemoval}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  return { passed, failed, results };
}
