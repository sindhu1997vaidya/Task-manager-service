# TaskForge — Plain Java 17 AI Task Manager

A dependency-free, REST-shaped Task Manager service written in plain Java 17. It parses plain-English reminders into structured tasks, breaks parent tasks into validated subtasks, enforces idempotency for safe retries, validates inputs into a single consistent JSON error envelope, and supports extensible filtering, sorting, pagination, and event listeners.

## Package Structure

```text
java-task-manager/
├── .gitignore
├── README.md
├── API_CONTRACT.md
└── src/
    ├── api/
    │   ├── ApiResponse.java
    │   ├── ErrorResponseFactory.java
    │   └── TaskApi.java
    ├── app/
    │   ├── Main.java
    │   └── TestRunner.java
    ├── event/
    │   ├── AuditTrailListener.java
    │   ├── ConsoleLogListener.java
    │   └── TaskEventListener.java
    ├── exception/
    │   ├── ApiException.java
    │   ├── BadGatewayException.java
    │   ├── ConflictException.java
    │   ├── FieldError.java
    │   ├── NotFoundException.java
    │   ├── ServiceUnavailableException.java
    │   └── ValidationException.java
    ├── model/
    │   ├── ParsedTask.java
    │   ├── Priority.java
    │   ├── Task.java
    │   ├── TaskQuery.java
    │   └── TaskRequest.java
    ├── parser/
    │   ├── BreakdownStrategy.java
    │   ├── FakeLlmClient.java
    │   ├── FaultyLlmClient.java
    │   ├── HttpLlmClient.java
    │   ├── LlmBreakdownStrategy.java
    │   ├── LlmClient.java
    │   ├── LlmTaskParser.java
    │   ├── ParserFactory.java
    │   ├── RuleBasedBreakdownStrategy.java
    │   ├── RuleBasedTaskParser.java
    │   ├── SimpleJson.java
    │   └── TaskParser.java
    ├── repository/
    │   ├── IdempotencyStore.java
    │   ├── InMemoryTaskRepository.java
    │   └── TaskRepository.java
    └── service/
        ├── DateValidator.java
        ├── SortStrategy.java
        ├── TaskFilter.java
        ├── TaskService.java
        └── TaskValidator.java
```

## Setup & Execution

- **JDK**: Java 17 or newer (`javac -version`). No external Maven/Gradle libraries are required.
- **Compile from a clean checkout**:
  ```bash
  mkdir -p out
  javac -d out $(find src -name "*.java")
  ```
- **Run `Main`** (uses `RuleBasedTaskParser` offline if `LLM_API_KEY` is unset, or `LlmTaskParser` when set):
  ```bash
  export LLM_API_KEY="your-api-key-here" # optional; never commit .env or keys
  java -cp out app.Main
  ```
- **Run `TestRunner`** (fully offline using `FakeLlmClient` and `FaultyLlmClient`, no key required):
  ```bash
  java -cp out app.TestRunner
  ```

## `TaskParser` Plugin Interface

To plug in any custom parser without editing `TaskService`, implement `parser.TaskParser`:

```java
public interface TaskParser {
    ParsedTask parse(String text, String today);
}
```

Pass your implementation into `TaskService` via its constructor or `setTaskParser(...)`, or register it inside `ParserFactory`.

## `TaskApi` Operations

| Operation | Parameters | Success Status | Error Statuses |
| :--- | :--- | :--- | :--- |
| `createTask` | `TaskRequest request, String idempotencyKey` | `201` | `400`, `422`, `500` |
| `createTaskFromText` | `String text, String idempotencyKey` | `201` | `400`, `422`, `502`, `503`, `500` |
| `getTask` | `int id` | `200` | `404`, `500` |
| `listTasks` | `TaskQuery query` | `200` | `500` |
| `updateTask` | `int id, TaskRequest request` | `200` | `400`, `404`, `500` |
| `completeTask` | `int id` | `200` | `404`, `500` |
| `deleteTask` | `int id` | `200` | `404`, `500` |
| `createSubtask` | `int parentId, TaskRequest request` | `201` | `400`, `404`, `500` |
| `listSubtasks` | `int parentId` | `200` | `404`, `500` |
| `breakDownTask` | `int id, String idempotencyKey` | `201` | `400`, `404`, `422`, `502`, `503`, `500` |

### Example Calls & Printed Responses

**`createTask` (201):**
```java
api.createTask(new TaskRequest("Prepare quarterly report", "Compile Q4 metrics", "false", "2026-12-10", "HIGH"), "req-crud-1");
```
```text
HTTP 201 -> {"id":1,"parentId":null,"title":"Prepare quarterly report","description":"Compile Q4 metrics","completed":false,"dueDate":"2026-12-10","priority":"HIGH","recurrence":null,"createdAt":"2026-11-17T20:18:00"}
```

**Validation Error (400):**
```java
api.createTask(new TaskRequest("   ", "", "yes", "2026-02-30", "URGENT"), "req-invalid-1");
```
```text
HTTP 400 -> {"error":{"code":"VALIDATION_ERROR","message":"Validation failed","details":[{"field":"title","issue":"must not be empty or blank"},{"field":"description","issue":"must not be empty or blank"},{"field":"completed","issue":"must be exactly \"true\" or \"false\""},{"field":"dueDate","issue":"must be a real YYYY-MM-DD date"},{"field":"priority","issue":"must be LOW, MEDIUM, or HIGH"}]}}
```

**`createTaskFromText` (201):**
```java
api.createTaskFromText("Remind me to pay rent on the 1st of every month", "req-nl-1");
```
```text
HTTP 201 -> {"id":2,"parentId":null,"title":"Pay rent","description":"Remind me to pay rent on the 1st of every month","completed":false,"dueDate":"2026-12-01","priority":"MEDIUM","recurrence":"MONTHLY","createdAt":"2026-11-17T20:18:01"}
```

**`breakDownTask` (201):**
```java
api.breakDownTask(3, "req-bd-1");
```
```text
HTTP 201 -> [{"id":5,"parentId":3,"title":"Finalize docs","description":"Subtask for 'Launch product release': Finalize docs","completed":false,"dueDate":"2026-12-20","priority":"HIGH","recurrence":null,"createdAt":"2026-11-17T20:18:02"}, ...]
```

## Design Patterns Used

- **Builder**: `model.Task.Builder` (enforces required `title`, `description`, `completed` on an immutable `Task`) and `model.TaskQuery.Builder` (constructs queries with all-optional filter/sort/page fields).
- **Singleton**: `repository.InMemoryTaskRepository` and `repository.IdempotencyStore` (thread-safe double-checked locking).
- **Factory**: `api.ErrorResponseFactory` (centralizes consistent JSON error formatting) and `parser.ParserFactory` (selects LLM vs. rule-based or test fake strategies).
- **Strategy**: `parser.TaskParser`, `parser.BreakdownStrategy`, `service.TaskFilter`, and `service.SortStrategy` (swappable algorithms and Open/Closed extensibility).
- **Observer**: `event.TaskEventListener` (`ConsoleLogListener`, `AuditTrailListener`) registered and removed dynamically on `service.TaskService`.

## LLM Prompts & Rationale

1. **Task Extraction (`LlmTaskParser.buildPrompt`)**:
   Injects `today` (`YYYY-MM-DD`) explicitly so relative dates like `"next Friday"` or `"tomorrow"` resolve deterministically, enumerates the exact 4 JSON keys (`title`, `description`, `dueDate`, `recurrence`), and forbids markdown/prose so `SimpleJson` can parse directly without brittle regex scraping.
2. **Task Breakdown (`LlmBreakdownStrategy.buildPrompt`)**:
   Requests 3–5 concrete subtasks using a strict `title|description` line-delimited format without numbering or bullets. Keeping the output line-delimited makes parsing resilient with simple `String` methods while letting `TaskService` validate every generated item atomically before saving any subtask.

## AI-Generated Tests Critique & Hardening Notes

Initial AI-generated tests covered only happy-path CRUD and basic empty-title rejection. During review and hardening, we identified and added missing edge cases in `app.TestRunner`:
- **Leap-year and impossible calendar dates**: verified `2026-02-30` and `2025-02-29` return `400` while `2024-02-29` returns `201`.
- **Subtask nesting guard**: verified creating a subtask under a subtask or breaking down a subtask returns `400`.
- **Idempotency failure & call-count guarantees**: proved `FakeLlmClient.getCallCount()` remains `1` on duplicate keys, `422` triggers on key reuse with altered payloads, and `400` errors are never cached in `IdempotencyStore`.
- **Never trust the model**: added `FaultyLlmClient` tests for empty titles, impossible dates, malformed JSON, broken pipe-delimited breakdown lines, and simulated timeouts, asserting `502` and `0` persisted tasks/subtasks.
- **Pagination bounds**: verified requesting a page beyond `totalPages` returns `200` with `items: []`.
