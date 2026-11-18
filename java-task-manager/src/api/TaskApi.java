package api;

import exception.ApiException;
import model.TaskQuery;
import model.TaskRequest;
import service.TaskService;

public class TaskApi {
    private final TaskService taskService;

    public TaskApi(TaskService taskService) {
        this.taskService = taskService;
    }

    public ApiResponse createTask(TaskRequest request, String idempotencyKey) {
        try {
            return taskService.createTask(request, idempotencyKey);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse createTaskFromText(String text, String idempotencyKey) {
        try {
            return taskService.createTaskFromText(text, idempotencyKey);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse getTask(int id) {
        try {
            return taskService.getTask(id);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse listTasks(TaskQuery query) {
        try {
            return taskService.listTasks(query);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse updateTask(int id, TaskRequest request) {
        try {
            return taskService.updateTask(id, request);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse completeTask(int id) {
        try {
            return taskService.completeTask(id);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse deleteTask(int id) {
        try {
            return taskService.deleteTask(id);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse createSubtask(int parentId, TaskRequest request) {
        try {
            return taskService.createSubtask(parentId, request);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse listSubtasks(int parentId) {
        try {
            return taskService.listSubtasks(parentId);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }

    public ApiResponse breakDownTask(int id, String idempotencyKey) {
        try {
            return taskService.breakDownTask(id, idempotencyKey);
        } catch (ApiException e) {
            return ErrorResponseFactory.from(e);
        } catch (Exception e) {
            return ErrorResponseFactory.fromUnexpected(e);
        }
    }
}
