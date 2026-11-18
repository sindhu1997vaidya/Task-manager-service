package service;

import api.ApiResponse;
import event.TaskEventListener;
import exception.ApiException;
import exception.BadGatewayException;
import exception.NotFoundException;
import exception.ValidationException;
import model.ParsedTask;
import model.Task;
import model.TaskQuery;
import model.TaskRequest;
import parser.BreakdownStrategy;
import parser.SimpleJson;
import parser.TaskParser;
import repository.IdempotencyStore;
import repository.TaskRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class TaskService {
    private final TaskRepository repository;
    private final IdempotencyStore idempotencyStore;
    private TaskParser taskParser;
    private BreakdownStrategy breakdownStrategy;
    private final List<TaskEventListener> listeners = new CopyOnWriteArrayList<>();

    public TaskService(
            TaskRepository repository,
            IdempotencyStore idempotencyStore,
            TaskParser taskParser,
            BreakdownStrategy breakdownStrategy
    ) {
        this.repository = repository;
        this.idempotencyStore = idempotencyStore;
        this.taskParser = taskParser;
        this.breakdownStrategy = breakdownStrategy;
    }

    public void setTaskParser(TaskParser taskParser) {
        this.taskParser = taskParser;
    }

    public void setBreakdownStrategy(BreakdownStrategy breakdownStrategy) {
        this.breakdownStrategy = breakdownStrategy;
    }

    public void addListener(TaskEventListener listener) {
        if (listener != null && !listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removeListener(TaskEventListener listener) {
        listeners.remove(listener);
    }

    private void notifyListeners(String eventType, Task task) {
        for (TaskEventListener listener : listeners) {
            listener.onEvent(eventType, task);
        }
    }

    public ApiResponse createTask(TaskRequest request, String idempotencyKey) {
        String fingerprint = buildRequestFingerprint("CREATE_TASK", request);
        ApiResponse cached = idempotencyStore.getExistingOrValidate(idempotencyKey, fingerprint);
        if (cached != null) {
            return cached;
        }

        TaskValidator.ValidatedTaskInput valid = TaskValidator.validate(request);
        Task task = new Task.Builder(valid.title(), valid.description(), valid.completed())
                .id(repository.nextId())
                .dueDate(valid.dueDate())
                .priority(valid.priority())
                .recurrence(valid.recurrence())
                .createdAt(LocalDateTime.now().toString())
                .build();

        repository.save(task);
        notifyListeners("TASK_CREATED", task);

        ApiResponse response = new ApiResponse(201, SimpleJson.taskToJson(task));
        idempotencyStore.putSuccess(idempotencyKey, fingerprint, response);
        return response;
    }

    public ApiResponse createTaskFromText(String text, String idempotencyKey) {
        if (text == null || text.isBlank()) {
            throw new ValidationException("text", "must not be empty or blank");
        }
        String fingerprint = "CREATE_FROM_TEXT|" + text.trim();
        ApiResponse cached = idempotencyStore.getExistingOrValidate(idempotencyKey, fingerprint);
        if (cached != null) {
            return cached;
        }

        String today = LocalDate.now().toString();
        ParsedTask parsed;
        try {
            parsed = taskParser.parse(text.trim(), today);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new BadGatewayException("Task parser failed: " + e.getMessage());
        }

        if (parsed == null) {
            throw new BadGatewayException("Task parser returned null.");
        }

        TaskRequest derived = new TaskRequest(
                parsed.getTitle(),
                parsed.getDescription(),
                "false",
                parsed.getDueDate(),
                "MEDIUM",
                parsed.getRecurrence()
        );

        TaskValidator.ValidatedTaskInput valid;
        try {
            valid = TaskValidator.validate(derived);
        } catch (ValidationException e) {
            throw new BadGatewayException("Model output failed validation", e.getDetails());
        }

        Task task = new Task.Builder(valid.title(), valid.description(), valid.completed())
                .id(repository.nextId())
                .dueDate(valid.dueDate())
                .priority(valid.priority())
                .recurrence(valid.recurrence())
                .createdAt(LocalDateTime.now().toString())
                .build();

        repository.save(task);
        notifyListeners("TASK_CREATED", task);

        ApiResponse response = new ApiResponse(201, SimpleJson.taskToJson(task));
        idempotencyStore.putSuccess(idempotencyKey, fingerprint, response);
        return response;
    }

    public Task getTaskEntity(int id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found with id: " + id));
    }

    public ApiResponse getTask(int id) {
        return new ApiResponse(200, SimpleJson.taskToJson(getTaskEntity(id)));
    }

    public ApiResponse listTasks(TaskQuery query) {
        TaskQuery effective = query == null ? new TaskQuery.Builder().build() : query;
        List<TaskFilter> filters = TaskFilter.fromQuery(effective);

        List<Task> filtered = new ArrayList<>();
        for (Task task : repository.findAll()) {
            boolean matchesAll = true;
            for (TaskFilter filter : filters) {
                if (!filter.matches(task)) {
                    matchesAll = false;
                    break;
                }
            }
            if (matchesAll) {
                filtered.add(task);
            }
        }

        SortStrategy sortStrategy = SortStrategy.resolve(effective.getSortBy(), effective.getSortOrder());
        filtered.sort(sortStrategy.comparator());

        int page = Math.max(1, effective.getPage());
        int pageSize = Math.max(1, effective.getPageSize());
        int totalItems = filtered.size();
        int totalPages = totalItems == 0 ? 1 : (int) Math.ceil((double) totalItems / pageSize);
        int fromIndex = (page - 1) * pageSize;

        List<Task> pageItems;
        if (fromIndex >= totalItems) {
            pageItems = List.of();
        } else {
            int toIndex = Math.min(fromIndex + pageSize, totalItems);
            pageItems = filtered.subList(fromIndex, toIndex);
        }

        return new ApiResponse(
                200,
                SimpleJson.pagedTasksToJson(pageItems, page, pageSize, totalItems, totalPages)
        );
    }

    public ApiResponse updateTask(int id, TaskRequest request) {
        Task existing = getTaskEntity(id);
        TaskValidator.ValidatedTaskInput valid = TaskValidator.validate(request);

        Task updated = new Task.Builder(valid.title(), valid.description(), valid.completed())
                .id(existing.getId())
                .parentId(existing.getParentId())
                .dueDate(valid.dueDate())
                .priority(valid.priority())
                .recurrence(valid.recurrence())
                .createdAt(existing.getCreatedAt())
                .build();

        repository.save(updated);
        notifyListeners("TASK_UPDATED", updated);
        if (!existing.isCompleted() && updated.isCompleted()) {
            notifyListeners("TASK_COMPLETED", updated);
        }
        return new ApiResponse(200, SimpleJson.taskToJson(updated));
    }

    public ApiResponse completeTask(int id) {
        Task existing = getTaskEntity(id);
        Task completed = new Task.Builder(existing.getTitle(), existing.getDescription(), true)
                .id(existing.getId())
                .parentId(existing.getParentId())
                .dueDate(existing.getDueDate())
                .priority(existing.getPriority())
                .recurrence(existing.getRecurrence())
                .createdAt(existing.getCreatedAt())
                .build();

        repository.save(completed);
        notifyListeners("TASK_COMPLETED", completed);
        return new ApiResponse(200, SimpleJson.taskToJson(completed));
    }

    public ApiResponse deleteTask(int id) {
        Task existing = getTaskEntity(id);

        // Cascade delete subtasks if this is a parent task
        List<Task> subtasks = findSubtaskEntities(id);
        for (Task sub : subtasks) {
            repository.delete(sub.getId());
            notifyListeners("TASK_DELETED", sub);
        }

        repository.delete(id);
        notifyListeners("TASK_DELETED", existing);
        return new ApiResponse(
                200,
                "{\"deletedId\":" + id + ",\"deletedSubtasksCount\":" + subtasks.size() + "}"
        );
    }

    public ApiResponse createSubtask(int parentId, TaskRequest request) {
        Task parent = getTaskEntity(parentId);
        if (parent.getParentId() != null) {
            throw new ValidationException("parentId", "cannot create a subtask under another subtask");
        }

        TaskValidator.ValidatedTaskInput valid = TaskValidator.validate(request);
        Task subtask = new Task.Builder(valid.title(), valid.description(), valid.completed())
                .id(repository.nextId())
                .parentId(parentId)
                .dueDate(valid.dueDate())
                .priority(valid.priority())
                .recurrence(valid.recurrence())
                .createdAt(LocalDateTime.now().toString())
                .build();

        repository.save(subtask);
        notifyListeners("SUBTASK_CREATED", subtask);
        return new ApiResponse(201, SimpleJson.taskToJson(subtask));
    }

    public ApiResponse listSubtasks(int parentId) {
        getTaskEntity(parentId);
        List<Task> subtasks = findSubtaskEntities(parentId);
        return new ApiResponse(200, SimpleJson.taskListToJson(subtasks));
    }

    public ApiResponse breakDownTask(int id, String idempotencyKey) {
        Task parent = getTaskEntity(id);
        if (parent.getParentId() != null) {
            throw new ValidationException("id", "cannot break down a task that is already a subtask");
        }

        String fingerprint = "BREAKDOWN|" + id + "|" + parent.getTitle() + "|" + parent.getDescription();
        ApiResponse cached = idempotencyStore.getExistingOrValidate(idempotencyKey, fingerprint);
        if (cached != null) {
            return cached;
        }

        List<TaskRequest> candidateRequests;
        try {
            candidateRequests = breakdownStrategy.breakDown(parent);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new BadGatewayException("Breakdown strategy failed: " + e.getMessage());
        }

        if (candidateRequests == null || candidateRequests.isEmpty()) {
            throw new BadGatewayException("Breakdown strategy returned no subtasks.");
        }

        // Validate ALL items before saving ANY of them
        List<TaskValidator.ValidatedTaskInput> validatedItems = new ArrayList<>();
        for (TaskRequest req : candidateRequests) {
            try {
                validatedItems.add(TaskValidator.validate(req));
            } catch (ValidationException e) {
                throw new BadGatewayException("Model breakdown item failed validation", e.getDetails());
            }
        }

        List<Task> createdSubtasks = new ArrayList<>();
        for (TaskValidator.ValidatedTaskInput valid : validatedItems) {
            Task subtask = new Task.Builder(valid.title(), valid.description(), valid.completed())
                    .id(repository.nextId())
                    .parentId(parent.getId())
                    .dueDate(valid.dueDate())
                    .priority(valid.priority())
                    .recurrence(valid.recurrence())
                    .createdAt(LocalDateTime.now().toString())
                    .build();
            repository.save(subtask);
            createdSubtasks.add(subtask);
            notifyListeners("SUBTASK_CREATED", subtask);
        }

        ApiResponse response = new ApiResponse(201, SimpleJson.taskListToJson(createdSubtasks));
        idempotencyStore.putSuccess(idempotencyKey, fingerprint, response);
        return response;
    }

    private List<Task> findSubtaskEntities(int parentId) {
        List<Task> result = new ArrayList<>();
        for (Task task : repository.findAll()) {
            if (task.getParentId() != null && task.getParentId() == parentId) {
                result.add(task);
            }
        }
        return result;
    }

    private String buildRequestFingerprint(String operation, TaskRequest req) {
        if (req == null) {
            return operation + "|null";
        }
        return operation + "|"
                + safeStr(req.getTitle()) + "|"
                + safeStr(req.getDescription()) + "|"
                + safeStr(req.getCompleted()) + "|"
                + safeStr(req.getDueDate()) + "|"
                + safeStr(req.getPriority()) + "|"
                + safeStr(req.getRecurrence());
    }

    private String safeStr(String s) {
        return s == null ? "<null>" : s.trim();
    }
}
