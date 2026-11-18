package app;

import api.ApiResponse;
import api.TaskApi;
import event.AuditTrailListener;
import model.TaskQuery;
import model.TaskRequest;
import parser.FakeLlmClient;
import parser.FaultyLlmClient;
import parser.HttpLlmClient;
import parser.ParserFactory;
import parser.RuleBasedBreakdownStrategy;
import parser.RuleBasedTaskParser;
import repository.IdempotencyStore;
import repository.InMemoryTaskRepository;
import service.TaskService;

import java.util.ArrayList;
import java.util.List;

public class TestRunner {
    private static int passed = 0;
    private static int failed = 0;

    public static void main(String[] args) {
        System.out.println("Running Task Manager TestRunner (offline, no API key required)...");

        testValidCrudLifecycle();
        testValidationCollectsMultipleErrors();
        testDateValidationLeapYearAndImpossibleDates();
        testUnknownIdReturns404();
        testFakeLlmTaskCreationAndIdempotencySkipsSecondCall();
        testIdempotencyConflictReturns422();
        testFailedRequestDoesNotStoreIdempotencyKey();
        testFaultyLlmEmptyTitleReturns502AndSavesNothing();
        testFaultyLlmImpossibleDateReturns502AndSavesNothing();
        testFaultyLlmMalformedJsonReturns502AndSavesNothing();
        testFaultyLlmNetworkFailureReturns502();
        testMissingApiKeyReturns503();
        testSubtasksAndSubtaskOfSubtaskRejected400();
        testBreakdownWithFaultyLineSavesZeroSubtasksReturns502();
        testCascadeDeleteRemovesParentAndSubtasks();
        testFilteringSearchSortingAndPaginationTogether();
        testPageBeyondLastPageReturnsEmptyItems();
        testObserverAddAndRemoveListeners();
        testRuleBasedOfflineParserAndBreakdown();

        System.out.println("\nSummary: " + passed + " PASSED, " + failed + " FAILED");
        if (failed > 0) {
            System.exit(1);
        }
    }

    private static TaskService freshService(FakeLlmClient fakeClient) {
        InMemoryTaskRepository repo = InMemoryTaskRepository.getInstance();
        IdempotencyStore store = IdempotencyStore.getInstance();
        repo.clear();
        store.clear();
        if (fakeClient != null) {
            return new TaskService(
                    repo,
                    store,
                    ParserFactory.createTaskParser(fakeClient),
                    ParserFactory.createBreakdownStrategy(fakeClient)
            );
        }
        return new TaskService(
                repo,
                store,
                new RuleBasedTaskParser(),
                new RuleBasedBreakdownStrategy()
        );
    }

    private static void check(String name, boolean condition, String detail) {
        if (condition) {
            passed++;
            System.out.println("PASS: " + name);
        } else {
            failed++;
            System.out.println("FAIL: " + name + " -> " + detail);
        }
    }

    private static void testValidCrudLifecycle() {
        TaskApi api = new TaskApi(freshService(null));
        ApiResponse create = api.createTask(
                new TaskRequest("Write docs", "Document API endpoints", "false", "2026-12-01", "HIGH"),
                null
        );
        check("CRUD create returns 201", create.getStatusCode() == 201, create.toString());
        ApiResponse get = api.getTask(1);
        check("CRUD get returns 200", get.getStatusCode() == 200 && get.getBody().contains("Write docs"), get.toString());
        ApiResponse complete = api.completeTask(1);
        check("CRUD complete returns 200 with completed:true",
                complete.getStatusCode() == 200 && complete.getBody().contains("\"completed\":true"),
                complete.toString());
    }

    private static void testValidationCollectsMultipleErrors() {
        TaskApi api = new TaskApi(freshService(null));
        ApiResponse res = api.createTask(
                new TaskRequest("  ", "", "maybe", "2026-13-01", "CRITICAL"),
                null
        );
        boolean hasAll = res.getStatusCode() == 400
                && res.getBody().contains("\"code\":\"VALIDATION_ERROR\"")
                && res.getBody().contains("\"field\":\"title\"")
                && res.getBody().contains("\"field\":\"description\"")
                && res.getBody().contains("\"field\":\"completed\"")
                && res.getBody().contains("\"field\":\"dueDate\"")
                && res.getBody().contains("\"field\":\"priority\"");
        check("Validation collects all 5 field issues in 400 shape", hasAll, res.toString());
    }

    private static void testDateValidationLeapYearAndImpossibleDates() {
        TaskApi api = new TaskApi(freshService(null));
        ApiResponse feb30 = api.createTask(
                new TaskRequest("Bad date", "Feb 30", "false", "2026-02-30", "LOW"),
                null
        );
        check("Rejects 2026-02-30 with 400", feb30.getStatusCode() == 400, feb30.toString());

        ApiResponse nonLeapFeb29 = api.createTask(
                new TaskRequest("Non leap", "Feb 29 2025", "false", "2025-02-29", "LOW"),
                null
        );
        check("Rejects 2025-02-29 with 400", nonLeapFeb29.getStatusCode() == 400, nonLeapFeb29.toString());

        ApiResponse leapFeb29 = api.createTask(
                new TaskRequest("Leap day", "Feb 29 2024", "false", "2024-02-29", "LOW"),
                null
        );
        check("Accepts 2024-02-29 with 201", leapFeb29.getStatusCode() == 201, leapFeb29.toString());
    }

    private static void testUnknownIdReturns404() {
        TaskApi api = new TaskApi(freshService(null));
        ApiResponse res = api.getTask(4040);
        check("Unknown ID returns 404 NOT_FOUND",
                res.getStatusCode() == 404 && res.getBody().contains("\"code\":\"NOT_FOUND\""),
                res.toString());
    }

    private static void testFakeLlmTaskCreationAndIdempotencySkipsSecondCall() {
        FakeLlmClient fake = new FakeLlmClient(
                "{\"title\":\"Pay rent\",\"description\":\"Pay monthly apartment rent\",\"dueDate\":\"2026-12-01\",\"recurrence\":\"MONTHLY\"}"
        );
        TaskApi api = new TaskApi(freshService(fake));

        ApiResponse first = api.createTaskFromText("Remind me to pay rent on the 1st of every month", "key-ai-1");
        ApiResponse second = api.createTaskFromText("Remind me to pay rent on the 1st of every month", "key-ai-1");

        check("FakeLlmClient creates task with 201", first.getStatusCode() == 201, first.toString());
        check("Repeated idempotency key returns identical response",
                second.getStatusCode() == 201 && first.getBody().equals(second.getBody()),
                second.toString());
        check("Repeated idempotency key never calls FakeLlmClient twice",
                fake.getCallCount() == 1 && InMemoryTaskRepository.getInstance().findAll().size() == 1,
                "callCount=" + fake.getCallCount() + ", repoSize=" + InMemoryTaskRepository.getInstance().findAll().size());
    }

    private static void testIdempotencyConflictReturns422() {
        TaskApi api = new TaskApi(freshService(null));
        api.createTask(new TaskRequest("Task A", "Desc A", "false", null, "LOW"), "same-key");
        ApiResponse conflict = api.createTask(new TaskRequest("Task B", "Desc B", "false", null, "HIGH"), "same-key");
        check("Same key with different request returns 422 IDEMPOTENCY_CONFLICT",
                conflict.getStatusCode() == 422 && conflict.getBody().contains("IDEMPOTENCY_CONFLICT"),
                conflict.toString());
    }

    private static void testFailedRequestDoesNotStoreIdempotencyKey() {
        TaskApi api = new TaskApi(freshService(null));
        ApiResponse bad = api.createTask(new TaskRequest("", "Desc", "false", null, "LOW"), "retry-after-fix");
        ApiResponse fixed = api.createTask(new TaskRequest("Fixed title", "Desc", "false", null, "LOW"), "retry-after-fix");
        check("Failed 400 is not cached so client can fix input and retry with same key",
                bad.getStatusCode() == 400 && fixed.getStatusCode() == 201,
                "bad=" + bad.getStatusCode() + ", fixed=" + fixed.getStatusCode());
    }

    private static void testFaultyLlmEmptyTitleReturns502AndSavesNothing() {
        TaskService svc = freshService(null);
        svc.setTaskParser(ParserFactory.createTaskParser(new FaultyLlmClient(FaultyLlmClient.FaultMode.EMPTY_TITLE)));
        TaskApi api = new TaskApi(svc);
        ApiResponse res = api.createTaskFromText("Do something", "fault-1");
        check("Faulty empty title returns 502 and saves 0 tasks",
                res.getStatusCode() == 502 && InMemoryTaskRepository.getInstance().findAll().isEmpty(),
                res.toString());
    }

    private static void testFaultyLlmImpossibleDateReturns502AndSavesNothing() {
        TaskService svc = freshService(null);
        svc.setTaskParser(ParserFactory.createTaskParser(new FaultyLlmClient(FaultyLlmClient.FaultMode.IMPOSSIBLE_DATE)));
        TaskApi api = new TaskApi(svc);
        ApiResponse res = api.createTaskFromText("Pay rent Feb 30", "fault-2");
        check("Faulty impossible date returns 502 and saves 0 tasks",
                res.getStatusCode() == 502 && InMemoryTaskRepository.getInstance().findAll().isEmpty(),
                res.toString());
    }

    private static void testFaultyLlmMalformedJsonReturns502AndSavesNothing() {
        TaskService svc = freshService(null);
        svc.setTaskParser(ParserFactory.createTaskParser(new FaultyLlmClient(FaultyLlmClient.FaultMode.MALFORMED_JSON)));
        TaskApi api = new TaskApi(svc);
        ApiResponse res = api.createTaskFromText("Schedule dentist", "fault-3");
        check("Faulty malformed JSON returns 502 and saves 0 tasks",
                res.getStatusCode() == 502 && InMemoryTaskRepository.getInstance().findAll().isEmpty(),
                res.toString());
    }

    private static void testFaultyLlmNetworkFailureReturns502() {
        TaskService svc = freshService(null);
        svc.setTaskParser(ParserFactory.createTaskParser(new FaultyLlmClient(FaultyLlmClient.FaultMode.THROW_NETWORK_ERROR)));
        TaskApi api = new TaskApi(svc);
        ApiResponse res = api.createTaskFromText("Call mom", "fault-4");
        check("LLM network/timeout error returns 502",
                res.getStatusCode() == 502 && res.getBody().contains("BAD_GATEWAY"),
                res.toString());
    }

    private static void testMissingApiKeyReturns503() {
        TaskService svc = freshService(null);
        svc.setTaskParser(ParserFactory.createTaskParser(new HttpLlmClient("", null)));
        TaskApi api = new TaskApi(svc);
        ApiResponse res = api.createTaskFromText("Buy groceries", null);
        check("Missing LLM_API_KEY returns 503 SERVICE_UNAVAILABLE",
                res.getStatusCode() == 503 && res.getBody().contains("SERVICE_UNAVAILABLE"),
                res.toString());
    }

    private static void testSubtasksAndSubtaskOfSubtaskRejected400() {
        TaskApi api = new TaskApi(freshService(null));
        api.createTask(new TaskRequest("Parent", "Top level task", "false", null, "MEDIUM"), null);
        ApiResponse sub = api.createSubtask(1, new TaskRequest("Child", "First level subtask", "false", null, "LOW"));
        ApiResponse grandChild = api.createSubtask(2, new TaskRequest("Grandchild", "Not allowed", "false", null, "LOW"));
        ApiResponse breakSub = api.breakDownTask(2, null);

        check("Subtask created with 201", sub.getStatusCode() == 201, sub.toString());
        check("Subtask of subtask rejected with 400", grandChild.getStatusCode() == 400, grandChild.toString());
        check("Breaking down a subtask rejected with 400", breakSub.getStatusCode() == 400, breakSub.toString());
    }

    private static void testBreakdownWithFaultyLineSavesZeroSubtasksReturns502() {
        TaskService svc = freshService(null);
        svc.setBreakdownStrategy(ParserFactory.createBreakdownStrategy(
                new FaultyLlmClient(FaultyLlmClient.FaultMode.BAD_BREAKDOWN_LINE)
        ));
        TaskApi api = new TaskApi(svc);
        api.createTask(new TaskRequest("Paint room", "Paint bedroom walls", "false", null, "MEDIUM"), null);
        ApiResponse bd = api.breakDownTask(1, "bd-fault");
        check("Faulty breakdown returns 502 and saves zero subtasks",
                bd.getStatusCode() == 502 && InMemoryTaskRepository.getInstance().findAll().size() == 1,
                bd.toString());
    }

    private static void testCascadeDeleteRemovesParentAndSubtasks() {
        TaskApi api = new TaskApi(freshService(null));
        api.createTask(new TaskRequest("Move apartment", "Pack boxes and hire movers", "false", null, "HIGH"), null);
        api.breakDownTask(1, null);
        int before = InMemoryTaskRepository.getInstance().findAll().size();
        ApiResponse del = api.deleteTask(1);
        int after = InMemoryTaskRepository.getInstance().findAll().size();
        check("Deleting parent deletes parent and all subtasks",
                before > 1 && del.getStatusCode() == 200 && after == 0,
                "before=" + before + ", after=" + after);
    }

    private static void testFilteringSearchSortingAndPaginationTogether() {
        TaskApi api = new TaskApi(freshService(null));
        api.createTask(new TaskRequest("Alpha report", "Finance summary", "false", "2026-12-10", "LOW"), null);
        api.createTask(new TaskRequest("Beta report", "Finance forecast", "false", "2026-12-03", "HIGH"), null);
        api.createTask(new TaskRequest("Gamma report", "Finance archive", "true", "2026-12-01", "HIGH"), null);
        api.createTask(new TaskRequest("Delta report", "Finance audit", "false", "2026-12-07", "MEDIUM"), null);

        TaskQuery query = new TaskQuery.Builder()
                .completed(false)
                .search("finance")
                .sortBy("dueDate")
                .sortOrder("asc")
                .page(1)
                .pageSize(2)
                .build();

        ApiResponse res = api.listTasks(query);
        boolean ok = res.getStatusCode() == 200
                && res.getBody().contains("\"totalItems\":3")
                && res.getBody().contains("\"totalPages\":2")
                && res.getBody().contains("Beta report")
                && res.getBody().contains("Delta report")
                && !res.getBody().contains("Gamma report");
        check("Combined filter, search, sort, and pagination works together", ok, res.toString());
    }

    private static void testPageBeyondLastPageReturnsEmptyItems() {
        TaskApi api = new TaskApi(freshService(null));
        api.createTask(new TaskRequest("Only task", "One item", "false", null, "LOW"), null);
        ApiResponse res = api.listTasks(new TaskQuery.Builder().page(5).pageSize(10).build());
        check("Page beyond last page returns 200 with empty items array",
                res.getStatusCode() == 200 && res.getBody().contains("\"items\":[]"),
                res.toString());
    }

    private static void testObserverAddAndRemoveListeners() {
        TaskService svc = freshService(null);
        AuditTrailListener audit = new AuditTrailListener();
        List<String> captured = new ArrayList<>();
        svc.addListener(audit);
        svc.addListener((eventType, task) -> captured.add(eventType + ":" + task.getId()));

        TaskApi api = new TaskApi(svc);
        api.createTask(new TaskRequest("One", "First", "false", null, "LOW"), null);
        svc.removeListener(audit);
        api.createTask(new TaskRequest("Two", "Second", "false", null, "LOW"), null);

        check("Removing listener stops its notifications",
                audit.getCount("TASK_CREATED") == 1 && captured.size() == 2,
                "auditCount=" + audit.getCount("TASK_CREATED") + ", captured=" + captured.size());
    }

    private static void testRuleBasedOfflineParserAndBreakdown() {
        TaskApi api = new TaskApi(freshService(null));
        ApiResponse nl = api.createTaskFromText("Remind me to pay rent on the 1st of every month", null);
        ApiResponse bd = api.breakDownTask(1, null);
        check("Offline RuleBasedTaskParser and RuleBasedBreakdownStrategy work without API key",
                nl.getStatusCode() == 201 && nl.getBody().contains("MONTHLY") && bd.getStatusCode() == 201,
                nl.toString());
    }
}
