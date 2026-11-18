package app;

import api.ApiResponse;
import api.TaskApi;
import event.AuditTrailListener;
import event.ConsoleLogListener;
import model.Task;
import model.TaskQuery;
import model.TaskRequest;
import parser.BreakdownStrategy;
import parser.ParserFactory;
import parser.TaskParser;
import repository.IdempotencyStore;
import repository.InMemoryTaskRepository;
import repository.TaskRepository;
import service.TaskService;

public class Main {
    public static void main(String[] args) {
        System.out.println("Task Manager started");

        TaskRepository repository = InMemoryTaskRepository.getInstance();
        IdempotencyStore idempotencyStore = IdempotencyStore.getInstance();
        repository.clear();
        idempotencyStore.clear();

        boolean hasApiKey = System.getenv("LLM_API_KEY") != null && !System.getenv("LLM_API_KEY").isBlank();
        TaskParser parser = ParserFactory.createTaskParser(hasApiKey);
        BreakdownStrategy breakdown = ParserFactory.createBreakdownStrategy(hasApiKey);

        TaskService service = new TaskService(repository, idempotencyStore, parser, breakdown);
        ConsoleLogListener consoleListener = new ConsoleLogListener();
        AuditTrailListener auditListener = new AuditTrailListener();
        service.addListener(consoleListener);
        service.addListener(auditListener);

        TaskApi api = new TaskApi(service);

        System.out.println("\n--- Step 2: CRUD Operations ---");
        ApiResponse created = api.createTask(
                new TaskRequest("Prepare quarterly report", "Compile Q4 metrics and slides", "false", "2026-12-10", "HIGH"),
                "req-crud-1"
        );
        System.out.println("createTask -> " + created);
        System.out.println("getTask(1) -> " + api.getTask(1));
        System.out.println("updateTask(1) -> " + api.updateTask(1, new TaskRequest(
                "Prepare Q4 report", "Compile Q4 metrics, charts, and executive deck", "false", "2026-12-12", "HIGH"
        )));
        System.out.println("completeTask(1) -> " + api.completeTask(1));

        System.out.println("\n--- Step 3: Validation Error Shape ---");
        ApiResponse invalid = api.createTask(
                new TaskRequest("   ", "", "yes", "2026-02-30", "URGENT"),
                "req-invalid-1"
        );
        System.out.println("createTask(invalid) -> " + invalid);
        System.out.println("getTask(999) -> " + api.getTask(999));

        System.out.println("\n--- Step 4: Natural Language Task Creation ---");
        ApiResponse nlTask = api.createTaskFromText(
                "Remind me to pay rent on the 1st of every month",
                "req-nl-1"
        );
        System.out.println("createTaskFromText -> " + nlTask);

        System.out.println("\n--- Step 5: Subtasks, Breakdown, and Cascade Delete ---");
        ApiResponse parentForBreakdown = api.createTask(
                new TaskRequest("Launch product release", "Finalize docs and publish release notes and notify customers", "false", "2026-12-20", "HIGH"),
                "req-parent-1"
        );
        System.out.println("Parent created -> " + parentForBreakdown);
        System.out.println("createSubtask(3) -> " + api.createSubtask(3, new TaskRequest(
                "Verify staging build", "Run smoke suite on staging", "false", "2026-12-18", "HIGH"
        )));
        System.out.println("breakDownTask(3) -> " + api.breakDownTask(3, "req-bd-1"));
        System.out.println("listSubtasks(3) -> " + api.listSubtasks(3));

        System.out.println("Repository BEFORE deleteTask(3): " + repository.findAll().size() + " tasks");
        for (Task t : repository.findAll()) {
            System.out.println("  " + t);
        }
        System.out.println("deleteTask(3) -> " + api.deleteTask(3));
        System.out.println("Repository AFTER deleteTask(3): " + repository.findAll().size() + " tasks");
        for (Task t : repository.findAll()) {
            System.out.println("  " + t);
        }

        System.out.println("\n--- Step 6: Idempotency Proof ---");
        int countBeforeRetry = repository.findAll().size();
        ApiResponse firstCall = api.createTask(
                new TaskRequest("Renew domain", "Renew annual DNS domain registration", "false", "2026-12-28", "MEDIUM"),
                "idem-key-100"
        );
        ApiResponse retryCall = api.createTask(
                new TaskRequest("Renew domain", "Renew annual DNS domain registration", "false", "2026-12-28", "MEDIUM"),
                "idem-key-100"
        );
        ApiResponse conflictCall = api.createTask(
                new TaskRequest("Different title", "Different payload", "false", "2026-12-28", "LOW"),
                "idem-key-100"
        );
        System.out.println("First call -> " + firstCall);
        System.out.println("Retry same key -> " + retryCall);
        System.out.println("Same key different payload (422) -> " + conflictCall);
        System.out.println("Tasks created (expected " + (countBeforeRetry + 1) + "): " + repository.findAll().size());

        System.out.println("\n--- Step 7: Filtering, Search, Sorting, and Pagination ---");
        api.createTask(new TaskRequest("Audit security logs", "Review SSH and API access logs", "false", "2026-12-05", "HIGH"), null);
        api.createTask(new TaskRequest("Audit backups", "Check nightly snapshots", "false", "2026-12-02", "LOW"), null);
        TaskQuery query = new TaskQuery.Builder()
                .completed(false)
                .search("audit")
                .sortBy("dueDate")
                .sortOrder("asc")
                .page(1)
                .pageSize(2)
                .build();
        System.out.println("listTasks(query) -> " + api.listTasks(query));

        System.out.println("\n--- Step 8: Observer Removal Proof ---");
        System.out.println("Audit counts so far: " + auditListener.getAllCounts());
        service.removeListener(consoleListener);
        System.out.println("Removed ConsoleLogListener; creating one more task (console log should NOT print):");
        api.createTask(new TaskRequest("Silent task", "Created after removing console listener", "false", null, "LOW"), null);
        System.out.println("Final Audit counts: " + auditListener.getAllCounts());
    }
}
