export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type StrategyMode =
  | "gemini"
  | "rule"
  | "faulty_empty_title"
  | "faulty_bad_date"
  | "faulty_malformed_json"
  | "faulty_breakdown_line"
  | "faulty_network"
  | "missing_key";

export interface Task {
  id: number;
  parentId: number | null;
  title: string;
  description: string;
  completed: boolean;
  dueDate: string | null;
  priority: Priority;
  recurrence: string | null;
  createdAt: string;
}

export interface PagedTasksResponse {
  items: Task[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiExchange {
  operation: string;
  endpoint: string;
  statusCode: number;
  body: unknown;
  timestamp: string;
  replay?: () => Promise<void>;
}

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
  response: {
    statusCode: number;
    body: unknown;
  };
  createdAt: string;
}

export interface EngineState {
  tasks: Task[];
  idempotencyRecords: IdempotencyRecordView[];
  listeners: {
    console: boolean;
    audit: boolean;
  };
  auditCounts: Record<string, number>;
  eventLogs: EventRecord[];
}

export interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  detail: string;
}

export interface JavaSourceFile {
  path: string;
  content: string;
  category: string;
}
