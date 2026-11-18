package service;

import exception.FieldError;
import exception.ValidationException;
import model.Priority;
import model.TaskRequest;

import java.util.ArrayList;
import java.util.List;

public final class TaskValidator {

    private TaskValidator() {
    }

    public static ValidatedTaskInput validate(TaskRequest request) {
        List<FieldError> errors = new ArrayList<>();

        if (request == null) {
            errors.add(new FieldError("request", "must not be null"));
            throw new ValidationException("Validation failed", errors);
        }

        String title = request.getTitle();
        if (title == null || title.isBlank()) {
            errors.add(new FieldError("title", "must not be empty or blank"));
        }

        String description = request.getDescription();
        if (description == null || description.isBlank()) {
            errors.add(new FieldError("description", "must not be empty or blank"));
        }

        String completedRaw = request.getCompleted();
        boolean completed = false;
        if (!"true".equals(completedRaw) && !"false".equals(completedRaw)) {
            errors.add(new FieldError("completed", "must be exactly \"true\" or \"false\""));
        } else {
            completed = Boolean.parseBoolean(completedRaw);
        }

        String dueDate = request.getDueDate();
        if (dueDate != null && !dueDate.isBlank()) {
            dueDate = dueDate.trim();
            if (!DateValidator.isValidIsoDate(dueDate)) {
                errors.add(new FieldError("dueDate", "must be a real YYYY-MM-DD date"));
            }
        } else {
            dueDate = null;
        }

        String priorityRaw = request.getPriority();
        Priority priority = Priority.MEDIUM;
        if (priorityRaw == null || priorityRaw.isBlank()) {
            errors.add(new FieldError("priority", "must be LOW, MEDIUM, or HIGH"));
        } else {
            try {
                priority = Priority.valueOf(priorityRaw.trim());
            } catch (IllegalArgumentException e) {
                errors.add(new FieldError("priority", "must be LOW, MEDIUM, or HIGH"));
            }
        }

        if (!errors.isEmpty()) {
            throw new ValidationException("Validation failed", errors);
        }

        String recurrence = (request.getRecurrence() == null || request.getRecurrence().isBlank())
                ? null
                : request.getRecurrence().trim();

        return new ValidatedTaskInput(
                title.trim(),
                description.trim(),
                completed,
                dueDate,
                priority,
                recurrence
        );
    }

    public record ValidatedTaskInput(
            String title,
            String description,
            boolean completed,
            String dueDate,
            Priority priority,
            String recurrence
    ) {
    }
}
