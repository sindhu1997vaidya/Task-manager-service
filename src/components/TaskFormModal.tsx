import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Task } from "../types";

export interface TaskFormSubmitPayload {
  title: string;
  description: string;
  completed: string;
  dueDate: string;
  priority: string;
  recurrence: string;
  idempotencyKey: string;
}

interface TaskFormModalProps {
  open: boolean;
  mode: "create" | "edit" | "subtask";
  targetTask?: Task | null;
  onClose: () => void;
  onSubmit: (payload: TaskFormSubmitPayload) => Promise<void>;
}

export function TaskFormModal({
  open,
  mode,
  targetTask,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [completed, setCompleted] = useState("false");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [recurrence, setRecurrence] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && targetTask) {
      setTitle(targetTask.title);
      setDescription(targetTask.description);
      setCompleted(targetTask.completed ? "true" : "false");
      setDueDate(targetTask.dueDate ?? "");
      setPriority(targetTask.priority);
      setRecurrence(targetTask.recurrence ?? "");
      setIdempotencyKey("");
    } else {
      setTitle("");
      setDescription("");
      setCompleted("false");
      setDueDate("");
      setPriority("MEDIUM");
      setRecurrence("");
      setIdempotencyKey("");
    }
  }, [open, mode, targetTask]);

  if (!open) return null;

  const heading =
    mode === "edit"
      ? `Update Task #${targetTask?.id}`
      : mode === "subtask"
      ? `Create Subtask under #${targetTask?.id}`
      : "Create Structured Task";

  const fillInvalidSample = () => {
    setTitle("   ");
    setDescription("");
    setCompleted("yes");
    setDueDate("2026-02-30");
    setPriority("URGENT");
    setIdempotencyKey("invalid-sample-key");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        completed,
        dueDate,
        priority,
        recurrence,
        idempotencyKey,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="task-modal-title" className="font-display text-base font-semibold text-slate-900">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
            <span>Raw TaskRequest string fields are validated by TaskService.</span>
            <button
              type="button"
              onClick={fillInvalidSample}
              className="text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              Fill Invalid Sample (400)
            </button>
          </div>

          <div>
            <label htmlFor="task-title" className="block text-xs font-medium text-slate-700 mb-1">
              Title
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Prepare quarterly report"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label htmlFor="task-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              id="task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Compile metrics and review slides"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="task-due" className="block text-xs font-medium text-slate-700 mb-1">
                Due Date (YYYY-MM-DD)
              </label>
              <input
                id="task-due"
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="2026-12-10"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="task-prio" className="block text-xs font-medium text-slate-700 mb-1">
                Priority
              </label>
              <input
                id="task-prio"
                type="text"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="LOW | MEDIUM | HIGH"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="task-comp" className="block text-xs font-medium text-slate-700 mb-1">
                Completed
              </label>
              <input
                id="task-comp"
                type="text"
                value={completed}
                onChange={(e) => setCompleted(e.target.value)}
                placeholder="true | false"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-rec" className="block text-xs font-medium text-slate-700 mb-1">
                Recurrence (Optional)
              </label>
              <input
                id="task-rec"
                type="text"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                placeholder="MONTHLY"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            {mode === "create" && (
              <div>
                <label htmlFor="task-idem" className="block text-xs font-medium text-slate-700 mb-1">
                  Idempotency Key (Optional)
                </label>
                <input
                  id="task-idem"
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  placeholder="req-create-101"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md cursor-pointer"
            >
              {submitting ? "Submitting..." : mode === "edit" ? "Save Changes" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
