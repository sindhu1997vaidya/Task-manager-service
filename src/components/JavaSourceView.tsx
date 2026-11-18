import { Check, Copy, Download, FileCode2 } from "lucide-react";
import { useEffect, useState } from "react";
import { JavaSourceFile } from "../types";

export function JavaSourceView() {
  const [files, setFiles] = useState<JavaSourceFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/java-files")
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const list: JavaSourceFile[] = data.files ?? [];
        setFiles(list);
        if (list.length > 0) {
          const preferred = list.find((f) => f.path === "README.md") ?? list[0];
          setSelectedPath(preferred.path);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentFile = files.find((f) => f.path === selectedPath) ?? null;

  const grouped = files.reduce<Record<string, JavaSourceFile[]>>((acc, file) => {
    const key = file.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {});

  const orderedCategories = Object.keys(grouped).sort((a, b) => {
    if (a === "docs") return -1;
    if (b === "docs") return 1;
    return a.localeCompare(b);
  });

  const handleCopy = async () => {
    if (!currentFile) return;
    await navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadFile = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.path.split("/").pop() ?? "file.java";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Plain Java 17 Project Source
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Zero-dependency Java 17 implementation under <code className="font-mono text-xs">java-task-manager/</code> covering all 8 packages, TestRunner, README, and API Contract.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-2">
          javac -d out $(find src -name &quot;*.java&quot;) &amp;&amp; java -cp out app.Main
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500 text-center">
          Loading Java project tree...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-lg p-4 max-h-[680px] overflow-y-auto space-y-4">
            {orderedCategories.map((cat) => (
              <div key={cat}>
                <div className="text-xs font-semibold text-slate-500 px-2 mb-1">
                  {cat === "docs" ? "Project Root & Docs" : `package ${cat}`}
                </div>
                <ul className="space-y-0.5">
                  {grouped[cat].map((file) => {
                    const isSelected = file.path === selectedPath;
                    const label = file.path.split("/").pop() ?? file.path;
                    return (
                      <li key={file.path}>
                        <button
                          type="button"
                          onClick={() => setSelectedPath(file.path)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                          <span className="truncate">{label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </aside>

          <section className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-lg overflow-hidden">
            {currentFile ? (
              <>
                <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                  <span className="font-mono text-xs font-medium text-slate-800">
                    java-task-manager/{currentFile.path}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                </div>
                <pre className="p-4 text-xs font-mono leading-relaxed text-slate-800 overflow-x-auto max-h-[620px] overflow-y-auto bg-white">
                  <code>{currentFile.content}</code>
                </pre>
              </>
            ) : (
              <div className="p-8 text-sm text-slate-500 text-center">
                Select a file from the left tree to inspect its source code.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
