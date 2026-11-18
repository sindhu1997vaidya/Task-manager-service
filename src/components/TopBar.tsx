export type ActiveTab = "workspace" | "events" | "tests" | "source";

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewTask: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: "workspace", label: "Tasks" },
  { id: "events", label: "Events & Store" },
  { id: "tests", label: "Test Runner" },
  { id: "source", label: "Java Source" },
];

export function TopBar({ activeTab, onSelectTab, onNewTask }: TopBarProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
      <button
        type="button"
        onClick={() => onSelectTab("workspace")}
        className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 cursor-pointer"
      >
        TaskForge
      </button>

      <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onNewTask}
          className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          New Task
        </button>
      </div>
    </header>
  );
}
