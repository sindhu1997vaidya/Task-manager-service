import React, { useState } from "react";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import {
  ApiExchange,
  PagedTasksResponse,
  Priority,
  StrategyMode,
  Task,
} from "../types";

export interface QueryFiltersState {
  search: string;
  completed: "all" | "false" | "true";
  priority: "ALL" | Priority;
  sortBy: "id" | "dueDate" | "priority" | "title";
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}

interface WorkspaceViewProps {
  pagedTasks: PagedTasksResponse;
  allTasks: Task[];
  loading: boolean;
  filters: QueryFiltersState;
  onChangeFilters: (next: Partial<QueryFiltersState>) => void;
  strategyMode: StrategyMode;
  onChangeStrategyMode: (mode: StrategyMode) => void;
  lastExchange: ApiExchange | null;
  onCreateFromText: (text: string, idempotencyKey: string, mode: StrategyMode) => Promise<void>;
  onOpenCreate: () => void;
  onOpenEdit: (task: Task) => void;
  onOpenSubtask: (parentTask: Task) => void;
  onCompleteTask: (id: number) => Promise<void>;
  onBreakDownTask: (id: number, idempotencyKey: string, mode: StrategyMode) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
  onInspectTask: (id: number) => Promise<void>;
}

const SAMPLE_PROMPTS = [
  "Remind me to pay rent on the 1st of every month",
  "Submit Q4 tax filing tomorrow",
  "Book flight and reserve hotel and send itinerary to team",
];

function statusLabel(code: number): string {
  switch (code) {
    case 200:
      return "200 OK";
    case 201:
      return "201 Created";
    case 400:
      return "400 Validation Error";
    case 404:
      return "404 Not Found";
    case 422:
      return "422 Idempotency Conflict";
    case 502:
      return "502 Bad Gateway";
    case 503:
      return "503 Service Unavailable";
    default:
      return `${code}`;
  }
}

export function WorkspaceView({
  pagedTasks,
  allTasks,
  loading,
  filters,
  onChangeFilters,
  strategyMode,
  onChangeStrategyMode,
  lastExchange,
  onCreateFromText,
  onOpenCreate,
  onOpenEdit,
  onOpenSubtask,
  onCompleteTask,
  onBreakDownTask,
  onDeleteTask,
  onInspectTask,
}: WorkspaceViewProps) {
  const [nlText, setNlText] = useState("");
  const [nlIdemKey, setNlIdemKey] = useState("");
  const [nlSubmitting, setNlSubmitting] = useState(false);
  const [breakingId, setBreakingId] = useState<number | null>(null);

  const subtasksByParent = allTasks.reduce<Record<number, Task[]>>((acc, t) => {
    if (t.parentId !== null) {
      if (!acc[t.parentId]) acc[t.parentId] = [];
      acc[t.parentId].push(t);
    }
    return acc;
  }, {});

  const handleNlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNlSubmitting(true);
    try {
      await onCreateFromText(nlText, nlIdemKey, strategyMode);
    } finally {
      setNlSubmitting(false);
    }
  };

  const handleBreakdown = async (taskId: number) => {
    setBreakingId(taskId);
    try {
      await onBreakDownTask(taskId, nlIdemKey, strategyMode);
    } finally {
      setBreakingId(null);
    }
  };

  const isSuccess = lastExchange ? lastExchange.statusCode >= 200 && lastExchange.statusCode < 300 : true;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-8 space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-lg font-semibold text-slate-900">
                Natural Language Task Parser & Breakdown
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Calls <code className="font-mono">createTaskFromText(text, idempotencyKey)</code> via the selected strategy, then validates strictly before saving.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="strategy-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Strategy:
              </label>
              <select
                id="strategy-select"
                value={strategyMode}
                onChange={(e) => onChangeStrategyMode(e.target.value as StrategyMode)}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-600"
              >
                <option value="gemini">LlmTaskParser (Gemini)</option>
                <option value="rule">RuleBasedTaskParser (Offline)</option>
                <option value="faulty_empty_title">FaultyLlmClient: Empty Title (502)</option>
                <option value="faulty_bad_date">FaultyLlmClient: Bad Date 2026-02-30 (502)</option>
                <option value="faulty_malformed_json">FaultyLlmClient: Malformed Output (502)</option>
                <option value="faulty_network">FaultyLlmClient: Timeout (502)</option>
                <option value="missing_key">Missing LLM_API_KEY (503)</option>
              </select>
            </div>
          </div>

          <form onSubmit={handleNlSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <input
                type="text"
                aria-label="Plain English task instruction"
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                placeholder="e.g. Remind me to pay rent on the 1st of every month"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="md:col-span-3">
              <input
                type="text"
                aria-label="Optional idempotency key"
                value={nlIdemKey}
                onChange={(e) => setNlIdemKey(e.target.value)}
                placeholder="Idempotency key (optional)"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={nlSubmitting}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {nlSubmitting ? "Parsing..." : "Parse & Create"}
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Samples:</span>
            {SAMPLE_PROMPTS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setNlText(sample)}
                className="text-slate-700 hover:text-blue-600 underline underline-offset-2 cursor-pointer text-left"
              >
                {sample}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Search tasks"
                  value={filters.search}
                  onChange={(e) => onChangeFilters({ search: e.target.value, page: 1 })}
                  placeholder="Search title or description..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "false", label: "Open" },
                    { id: "true", label: "Done" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeFilters({ completed: opt.id, page: 1 })}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      filters.completed === opt.id
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter by priority"
                value={filters.priority}
                onChange={(e) =>
                  onChangeFilters({ priority: e.target.value as QueryFiltersState["priority"], page: 1 })
                }
                className="text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Sort field"
                value={filters.sortBy}
                onChange={(e) =>
                  onChangeFilters({ sortBy: e.target.value as QueryFiltersState["sortBy"] })
                }
                className="text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md px-2.5 py-1.5"
              >
                <option value="id">Sort: ID</option>
                <option value="dueDate">Sort: Due Date</option>
                <option value="priority">Sort: Priority</option>
                <option value="title">Sort: Title</option>
              </select>

              <select
                aria-label="Sort direction"
                value={filters.sortOrder}
                onChange={(e) =>
                  onChangeFilters({ sortOrder: e.target.value as "asc" | "desc" })
                }
                className="text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md px-2.5 py-1.5"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>

              <select
                aria-label="Page size"
                value={filters.pageSize}
                onChange={(e) => onChangeFilters({ pageSize: Number(e.target.value), page: 1 })}
                className="text-xs font-mono text-slate-700 bg-white border border-slate-300 rounded-md px-2 py-1.5"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading tasks...</div>
          ) : pagedTasks.items.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-800">
                No tasks match the current TaskQuery
              </p>
              <p className="text-xs text-slate-500">
                {pagedTasks.totalItems > 0
                  ? `Page ${pagedTasks.page} exceeds totalPages (${pagedTasks.totalPages}), returning an empty items array.`
                  : "Create a structured task or parse a plain-English reminder above."}
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                {pagedTasks.page > 1 && (
                  <button
                    type="button"
                    onClick={() => onChangeFilters({ page: 1 })}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    Return to Page 1
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {pagedTasks.items.map((task) => {
                const childSubtasks =
                  task.parentId === null ? subtasksByParent[task.id] ?? [] : [];
                const prioColor =
                  task.priority === "HIGH"
                    ? "text-red-700"
                    : task.priority === "MEDIUM"
                    ? "text-amber-700"
                    : "text-slate-600";

                return (
                  <div key={task.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => onCompleteTask(task.id)}
                          aria-label={task.completed ? "Task completed" : "Mark task complete"}
                          className="mt-0.5 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <button
                              type="button"
                              onClick={() => onInspectTask(task.id)}
                              className={`text-sm font-semibold text-left cursor-pointer hover:underline ${
                                task.completed ? "line-through text-slate-500" : "text-slate-900"
                              }`}
                            >
                              {task.title}
                            </button>
                          </div>

                          <p className="text-xs text-slate-600 mt-0.5">{task.description}</p>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                            <span>#{task.id}</span>
                            {task.parentId !== null && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Subtask of #{task.parentId}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className={`font-semibold ${prioColor}`}>{task.priority}</span>
                            <span aria-hidden="true">·</span>
                            <span>{task.completed ? "Completed" : "Open"}</span>
                            {task.dueDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Due {task.dueDate}</span>
                              </>
                            )}
                            {task.recurrence && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{task.recurrence}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenEdit(task)}
                          title="Edit task"
                          aria-label={`Edit task ${task.id}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenSubtask(task)}
                          title={
                            task.parentId === null
                              ? "Add subtask"
                              : "Test subtask nesting guard (400)"
                          }
                          aria-label={`Add subtask to ${task.id}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleBreakdown(task.id)}
                          disabled={breakingId === task.id}
                          title={
                            task.parentId === null
                              ? "Break down into subtasks"
                              : "Test breakdown nesting guard (400)"
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded cursor-pointer whitespace-nowrap"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          {breakingId === task.id ? "Splitting..." : "Break Down"}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          title="Delete task (cascades to subtasks)"
                          aria-label={`Delete task ${task.id}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {childSubtasks.length > 0 && (
                      <div className="mt-3 ml-7 pl-4 border-t border-slate-100 pt-2 space-y-2">
                        {childSubtasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between gap-3 text-xs py-1"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => onCompleteTask(sub.id)}
                                className="text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                              >
                                {sub.completed ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Square className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span
                                className={`font-medium truncate ${
                                  sub.completed ? "line-through text-slate-400" : "text-slate-800"
                                }`}
                              >
                                {sub.title}
                              </span>
                              <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                                #{sub.id}
                              </span>
                            </div>
                            <span className="text-slate-500 truncate max-w-[260px]">
                              {sub.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="font-mono tabular-nums">
              Page {pagedTasks.page} of {pagedTasks.totalPages} · {pagedTasks.totalItems} matching tasks
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => onChangeFilters({ page: Math.max(1, filters.page - 1) })}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => onChangeFilters({ page: filters.page + 1 })}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside className="xl:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              ApiResponse Inspector
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live statusCode & JSON envelope from TaskApi
            </p>
          </div>
          {lastExchange?.replay && (
            <button
              type="button"
              onClick={() => lastExchange.replay?.()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              Replay
            </button>
          )}
        </div>

        {lastExchange ? (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Operation</span>
                <span className="font-mono font-medium text-slate-900">
                  {lastExchange.operation}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Status</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    isSuccess ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {statusLabel(lastExchange.statusCode)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Endpoint</span>
                <span className="font-mono text-slate-700 truncate max-w-[220px]">
                  {lastExchange.endpoint}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1.5">JSON Body</div>
              <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-md text-xs font-mono leading-relaxed overflow-x-auto max-h-[440px] overflow-y-auto">
                <code>{JSON.stringify(lastExchange.body, null, 2)}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            Execute any task operation to inspect the exact ApiResponse JSON payload.
          </div>
        )}
      </aside>
    </div>
  );
}
