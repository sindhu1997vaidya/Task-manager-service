import { useCallback, useEffect, useState } from "react";
import { EventsIdempotencyView } from "./components/EventsIdempotencyView";
import { JavaSourceView } from "./components/JavaSourceView";
import { TaskFormModal, TaskFormSubmitPayload } from "./components/TaskFormModal";
import { TestRunnerView } from "./components/TestRunnerView";
import { ActiveTab, TopBar } from "./components/TopBar";
import { QueryFiltersState, WorkspaceView } from "./components/WorkspaceView";
import {
  ApiExchange,
  EngineState,
  PagedTasksResponse,
  StrategyMode,
  Task,
} from "./types";

const INITIAL_PAGED: PagedTasksResponse = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
};

const INITIAL_STATE: EngineState = {
  tasks: [],
  idempotencyRecords: [],
  listeners: { console: true, audit: true },
  auditCounts: {},
  eventLogs: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("workspace");
  const [pagedTasks, setPagedTasks] = useState<PagedTasksResponse>(INITIAL_PAGED);
  const [engineState, setEngineState] = useState<EngineState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [strategyMode, setStrategyMode] = useState<StrategyMode>("gemini");
  const [lastExchange, setLastExchange] = useState<ApiExchange | null>(null);

  const [filters, setFilters] = useState<QueryFiltersState>({
    search: "",
    completed: "all",
    priority: "ALL",
    sortBy: "id",
    sortOrder: "asc",
    page: 1,
    pageSize: 10,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "subtask">("create");
  const [modalTarget, setModalTarget] = useState<Task | null>(null);

  const refreshAll = useCallback(async (f: QueryFiltersState) => {
    const params = new URLSearchParams();
    if (f.completed !== "all") params.set("completed", f.completed);
    if (f.priority !== "ALL") params.set("priority", f.priority);
    if (f.search.trim()) params.set("search", f.search.trim());
    params.set("sortBy", f.sortBy);
    params.set("sortOrder", f.sortOrder);
    params.set("page", String(f.page));
    params.set("pageSize", String(f.pageSize));
    params.set("topLevelOnly", "true");

    const [tasksRes, stateRes] = await Promise.all([
      fetch(`/api/tasks?${params.toString()}`),
      fetch("/api/state"),
    ]);

    const tasksJson = await tasksRes.json();
    const stateJson = await stateRes.json();
    setPagedTasks(tasksJson);
    setEngineState(stateJson);
    return tasksJson;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refreshAll(filters)
      .then((initialData) => {
        if (!active) return;
        setLastExchange((prev) =>
          prev ?? {
            operation: "TaskApi.listTasks(TaskQuery)",
            endpoint: "GET /api/tasks?topLevelOnly=true",
            statusCode: 200,
            body: initialData,
            timestamp: new Date().toISOString(),
          }
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, refreshAll]);

  const handleFilterChange = (next: Partial<QueryFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const recordExchange = async (
    operation: string,
    endpoint: string,
    res: Response,
    replay?: () => Promise<void>
  ) => {
    const body = await res.json();
    setLastExchange({
      operation,
      endpoint,
      statusCode: res.status,
      body,
      timestamp: new Date().toISOString(),
      replay,
    });
    await refreshAll(filters);
    return { status: res.status, body };
  };

  const handleCreateFromText = async (
    text: string,
    idempotencyKey: string,
    mode: StrategyMode
  ) => {
    const exec = async () => {
      const res = await fetch("/api/tasks/from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          idempotencyKey: idempotencyKey.trim() || null,
          mode,
        }),
      });
      await recordExchange(
        `TaskApi.createTaskFromText("${text}", ${idempotencyKey.trim() ? `"${idempotencyKey.trim()}"` : "null"})`,
        "POST /api/tasks/from-text",
        res,
        exec
      );
    };
    await exec();
  };

  const handleModalSubmit = async (payload: TaskFormSubmitPayload) => {
    const reqBody = {
      title: payload.title,
      description: payload.description,
      completed: payload.completed,
      dueDate: payload.dueDate || null,
      priority: payload.priority,
      recurrence: payload.recurrence || null,
    };

    if (modalMode === "create") {
      const idem = payload.idempotencyKey.trim() || null;
      const exec = async () => {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: reqBody, idempotencyKey: idem }),
        });
        const result = await recordExchange(
          `TaskApi.createTask(request, ${idem ? `"${idem}"` : "null"})`,
          "POST /api/tasks",
          res,
          exec
        );
        if (result.status >= 200 && result.status < 300) {
          setModalOpen(false);
        }
      };
      await exec();
    } else if (modalMode === "edit" && modalTarget) {
      const res = await fetch(`/api/tasks/${modalTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: reqBody }),
      });
      const result = await recordExchange(
        `TaskApi.updateTask(${modalTarget.id}, request)`,
        `PUT /api/tasks/${modalTarget.id}`,
        res
      );
      if (result.status >= 200 && result.status < 300) {
        setModalOpen(false);
      }
    } else if (modalMode === "subtask" && modalTarget) {
      const res = await fetch(`/api/tasks/${modalTarget.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: reqBody }),
      });
      const result = await recordExchange(
        `TaskApi.createSubtask(${modalTarget.id}, request)`,
        `POST /api/tasks/${modalTarget.id}/subtasks`,
        res
      );
      if (result.status >= 200 && result.status < 300) {
        setModalOpen(false);
      }
    }
  };

  const handleCompleteTask = async (id: number) => {
    const res = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    await recordExchange(`TaskApi.completeTask(${id})`, `POST /api/tasks/${id}/complete`, res);
  };

  const handleBreakDownTask = async (
    id: number,
    idempotencyKey: string,
    mode: StrategyMode
  ) => {
    const idem = idempotencyKey.trim() || null;
    const exec = async () => {
      const res = await fetch(`/api/tasks/${id}/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idem, mode }),
      });
      await recordExchange(
        `TaskApi.breakDownTask(${id}, ${idem ? `"${idem}"` : "null"})`,
        `POST /api/tasks/${id}/breakdown`,
        res,
        exec
      );
    };
    await exec();
  };

  const handleDeleteTask = async (id: number) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await recordExchange(`TaskApi.deleteTask(${id})`, `DELETE /api/tasks/${id}`, res);
  };

  const handleInspectTask = async (id: number) => {
    const res = await fetch(`/api/tasks/${id}`);
    await recordExchange(`TaskApi.getTask(${id})`, `GET /api/tasks/${id}`, res);
  };

  const handleToggleListener = async (listener: "console" | "audit", enabled: boolean) => {
    await fetch("/api/listeners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listener, enabled }),
    });
    await refreshAll(filters);
  };

  const handleResetEngine = async (seed: boolean) => {
    await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed }),
    });
    await refreshAll(filters);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewTask={() => {
          setModalMode("create");
          setModalTarget(null);
          setModalOpen(true);
        }}
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 lg:px-8 py-6">
        {activeTab === "workspace" && (
          <WorkspaceView
            pagedTasks={pagedTasks}
            allTasks={engineState.tasks}
            loading={loading}
            filters={filters}
            onChangeFilters={handleFilterChange}
            strategyMode={strategyMode}
            onChangeStrategyMode={setStrategyMode}
            lastExchange={lastExchange}
            onCreateFromText={handleCreateFromText}
            onOpenCreate={() => {
              setModalMode("create");
              setModalTarget(null);
              setModalOpen(true);
            }}
            onOpenEdit={(task) => {
              setModalMode("edit");
              setModalTarget(task);
              setModalOpen(true);
            }}
            onOpenSubtask={(parent) => {
              setModalMode("subtask");
              setModalTarget(parent);
              setModalOpen(true);
            }}
            onCompleteTask={handleCompleteTask}
            onBreakDownTask={handleBreakDownTask}
            onDeleteTask={handleDeleteTask}
            onInspectTask={handleInspectTask}
          />
        )}

        {activeTab === "events" && (
          <EventsIdempotencyView
            state={engineState}
            onToggleListener={handleToggleListener}
            onResetEngine={handleResetEngine}
          />
        )}

        {activeTab === "tests" && <TestRunnerView />}

        {activeTab === "source" && <JavaSourceView />}
      </main>

      <TaskFormModal
        open={modalOpen}
        mode={modalMode}
        targetTask={modalTarget}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}
