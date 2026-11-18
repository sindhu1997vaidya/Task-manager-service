import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { TestCaseResult } from "../types";

export function TestRunnerView() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [summary, setSummary] = useState<{ passed: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSuite = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/tests/run", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSummary({ passed: data.passed ?? 0, failed: data.failed ?? 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run tests");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runSuite();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Hardened TestRunner Suite
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Executes offline unit and contract checks covering validation, leap years, fake/faulty LLM guards, idempotency, subtasks, and pagination.
          </p>
        </div>

        <button
          type="button"
          onClick={runSuite}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap shrink-0"
        >
          <Play className="w-4 h-4" />
          {running ? "Running Suite..." : "Run All Tests"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          Failed to execute test suite: {error}
        </div>
      )}

      {summary && (
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-slate-500">Total Cases:</span>{" "}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {summary.passed + summary.failed}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Passed:</span>{" "}
            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
              {summary.passed}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Failed:</span>{" "}
            <span className="font-mono font-semibold text-red-700 tabular-nums">
              {summary.failed}
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
              <th className="py-3 px-4 w-20">ID</th>
              <th className="py-3 px-4 w-32">Category</th>
              <th className="py-3 px-4">Assertion</th>
              <th className="py-3 px-4">Observed Detail</th>
              <th className="py-3 px-4 w-24 text-right">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {running && results.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Executing test cases...
                </td>
              </tr>
            ) : (
              results.map((tc) => (
                <tr key={tc.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                    {tc.id}
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-700">
                    {tc.category}
                  </td>
                  <td className="py-3 px-4 text-slate-900">{tc.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{tc.detail}</td>
                  <td
                    className={`py-3 px-4 font-mono text-xs font-semibold text-right ${
                      tc.passed ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {tc.passed ? "PASS" : "FAIL"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
