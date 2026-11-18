# TaskForge API Contract

This document defines the operation signatures, payloads, status codes, and consistent error envelope for `api.TaskApi`. Every method returns `api.ApiResponse(int statusCode, String body)`.

## Consistent Error Envelope

All non-2xx responses (`400`, `404`, `422`, `500`, `502`, `503`) return the exact JSON structure below:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "title", "issue": "must not be empty or blank" }
    ]
  }
}
```

### Error Codes & Status Mapping

| HTTP Status | Error Code | Trigger Condition |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Blank `title`/`description`, `completed` not `"true"`/`"false"`, invalid `YYYY-MM-DD` `dueDate`, invalid `priority`, or nesting subtasks under a subtask. |
| `404` | `NOT_FOUND` | Task or parent task ID does not exist in `TaskRepository`. |
| `422` | `IDEMPOTENCY_CONFLICT` | Same `idempotencyKey` reused with a different request fingerprint. |
| `500` | `INTERNAL_ERROR` | Unexpected runtime exception caught at the `TaskApi` boundary. |
| `502` | `BAD_GATEWAY` | Upstream LLM call timed out/failed, returned malformed output, or returned data failing service validation. |
| `503` | `SERVICE_UNAVAILABLE` | `LLM_API_KEY` environment variable is missing or blank when invoking the live LLM client. |

## Operations

### 1. `createTask(TaskRequest request, String idempotencyKey)`
- **Success (`201`)**: Returns the created `Task` JSON object. Caches successful response under `idempotencyKey` if provided.
- **Errors**: `400`, `422`, `500`.

### 2. `createTaskFromText(String text, String idempotencyKey)`
- **Success (`201`)**: Uses `TaskParser` to extract `ParsedTask`, validates via `TaskValidator`, persists `Task`, and returns `201`.
- **Errors**: `400` (blank `text`), `422`, `502` (invalid model output or network error), `503` (missing `LLM_API_KEY`), `500`.

### 3. `getTask(int id)`
- **Success (`200`)**: Returns single `Task` JSON object.
- **Errors**: `404`, `500`.

### 4. `listTasks(TaskQuery query)`
- **Success (`200`)**: Applies `TaskFilter` predicates, `SortStrategy` ordering, and pagination:
  ```json
  {
    "items": [ ... ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
  ```
- **Errors**: `500`.

### 5. `updateTask(int id, TaskRequest request)`
- **Success (`200`)**: Validates full `TaskRequest`, replaces immutable `Task` in repository, emits `TASK_UPDATED` (and `TASK_COMPLETED` if transitioned to `true`).
- **Errors**: `400`, `404`, `500`.

### 6. `completeTask(int id)`
- **Success (`200`)**: Marks task `completed = true`, emits `TASK_COMPLETED`.
- **Errors**: `404`, `500`.

### 7. `deleteTask(int id)`
- **Success (`200`)**: Deletes task and cascades deletion to all subtasks (`{"deletedId":1,"deletedSubtasksCount":3}`).
- **Errors**: `404`, `500`.

### 8. `createSubtask(int parentId, TaskRequest request)`
- **Success (`201`)**: Creates a child `Task` with `parentId` set. Rejects with `400` if `parentId` itself is already a subtask.
- **Errors**: `400`, `404`, `500`.

### 9. `listSubtasks(int parentId)`
- **Success (`200`)**: Returns JSON array of subtasks belonging to `parentId`.
- **Errors**: `404`, `500`.

### 10. `breakDownTask(int id, String idempotencyKey)`
- **Success (`201`)**: Uses `BreakdownStrategy` to produce candidate subtasks, validates all items atomically before saving, persists subtasks, and returns JSON array.
- **Errors**: `400` (target task is already a subtask), `404`, `422`, `502` (invalid breakdown item or LLM failure), `503`, `500`.
