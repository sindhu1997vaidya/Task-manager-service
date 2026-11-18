import { RotateCcw, Trash2 } from "lucide-react";
import { EngineState } from "../types";

interface EventsIdempotencyViewProps {
  state: EngineState;
  onToggleListener: (listener: "console" | "audit", enabled: boolean) => Promise<void>;
  onResetEngine: (seed: boolean) => Promise<void>;
}

export function EventsIdempotencyView({
  state,
  onToggleListener,
  onResetEngine,
}: EventsIdempotencyViewProps) {
  const auditEntries = Object.entries(state.auditCounts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Observer Listeners & Idempotency Store
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect live TaskEventListener notifications and cached IdempotencyStore fingerprints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onResetEngine(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Demo Data
          </button>
          <button
            type="button"
            onClick={() => onResetEngine(false)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                TaskService Listeners
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Attach or detach Observer implementations at runtime.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900 font-mono">
                  ConsoleLogListener
                </div>
                <div className="text-xs text-slate-500">
                  Streams each task lifecycle event to the log feed
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleListener("console", !state.listeners.console)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  state.listeners.console
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {state.listeners.console ? "Attached (Detach)" : "Detached (Attach)"}
              </button>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900 font-mono">
                  AuditTrailListener
                </div>
                <div className="text-xs text-slate-500">
                  Aggregates event counts by type across task mutations
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleListener("audit", !state.listeners.audit)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  state.listeners.audit
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {state.listeners.audit ? "Attached (Detach)" : "Detached (Attach)"}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-slate-700 mb-2">
              AuditTrailListener Event Counts
            </h3>
            {auditEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 border border-dashed border-slate-200 rounded-md text-center">
                No audit events recorded yet. Create, update, or delete a task.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {auditEntries.map(([eventType, count]) => (
                  <div
                    key={eventType}
                    className="border border-slate-200 rounded-md px-3 py-2 bg-slate-50"
                  >
                    <div className="text-xs font-mono text-slate-600 truncate">{eventType}</div>
                    <div className="text-lg font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-medium text-slate-700 mb-2">Recent Event Notifications</h3>
            <div className="border border-slate-200 rounded-md max-h-72 overflow-y-auto divide-y divide-slate-100">
              {state.eventLogs.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 text-center">
                  Event log is empty.
                </div>
              ) : (
                state.eventLogs.map((ev) => (
                  <div key={ev.id} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono font-medium text-slate-900">{ev.eventType}</span>
                      <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
                      <span className="text-slate-700 truncate">
                        Task #{ev.taskId} ({ev.taskTitle})
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 whitespace-nowrap shrink-0">
                      {ev.listener}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              IdempotencyStore Records
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Only 2xx responses are persisted. Matching key + fingerprint replays cached response; mismatched fingerprint triggers 422.
            </p>
          </div>

          {state.idempotencyRecords.length === 0 ? (
            <div className="py-10 border border-dashed border-slate-200 rounded-md text-center px-4">
              <p className="text-sm font-medium text-slate-700">No idempotency keys cached</p>
              <p className="text-xs text-slate-500 mt-1">
                Submit a create or breakdown operation with an idempotency key to observe deduplication.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-3">Key</th>
                    <th className="py-2.5 px-3">Fingerprint</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {state.idempotencyRecords.map((rec) => (
                    <tr key={rec.key} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 align-top whitespace-nowrap">
                        {rec.key}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 break-all align-top">
                        {rec.fingerprint}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-700 text-right tabular-nums align-top">
                        {rec.statusCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
