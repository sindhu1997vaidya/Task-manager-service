package service;

import model.Priority;
import model.Task;
import model.TaskQuery;

import java.util.ArrayList;
import java.util.List;

public interface TaskFilter {
    boolean matches(Task task);

    static List<TaskFilter> fromQuery(TaskQuery query) {
        List<TaskFilter> filters = new ArrayList<>();
        if (query == null) {
            return filters;
        }
        if (query.getCompleted() != null) {
            filters.add(new CompletedFilter(query.getCompleted()));
        }
        if (query.getPriority() != null) {
            filters.add(new PriorityFilter(query.getPriority()));
        }
        if (query.getSearch() != null && !query.getSearch().isBlank()) {
            filters.add(new SearchFilter(query.getSearch()));
        }
        if (query.getDueBefore() != null && !query.getDueBefore().isBlank()) {
            filters.add(new DueBeforeFilter(query.getDueBefore()));
        }
        if (query.getDueAfter() != null && !query.getDueAfter().isBlank()) {
            filters.add(new DueAfterFilter(query.getDueAfter()));
        }
        if (query.getParentId() != null) {
            filters.add(new ParentIdFilter(query.getParentId()));
        } else if (query.isTopLevelOnly()) {
            filters.add(task -> task.getParentId() == null);
        }
        return filters;
    }

    class CompletedFilter implements TaskFilter {
        private final boolean completed;

        public CompletedFilter(boolean completed) {
            this.completed = completed;
        }

        @Override
        public boolean matches(Task task) {
            return task.isCompleted() == completed;
        }
    }

    class PriorityFilter implements TaskFilter {
        private final Priority priority;

        public PriorityFilter(Priority priority) {
            this.priority = priority;
        }

        @Override
        public boolean matches(Task task) {
            return task.getPriority() == priority;
        }
    }

    class SearchFilter implements TaskFilter {
        private final String keyword;

        public SearchFilter(String keyword) {
            this.keyword = keyword.toLowerCase().trim();
        }

        @Override
        public boolean matches(Task task) {
            String title = task.getTitle() == null ? "" : task.getTitle().toLowerCase();
            String desc = task.getDescription() == null ? "" : task.getDescription().toLowerCase();
            return title.contains(keyword) || desc.contains(keyword);
        }
    }

    class DueBeforeFilter implements TaskFilter {
        private final String dueBefore;

        public DueBeforeFilter(String dueBefore) {
            this.dueBefore = dueBefore;
        }

        @Override
        public boolean matches(Task task) {
            return task.getDueDate() != null && task.getDueDate().compareTo(dueBefore) <= 0;
        }
    }

    class DueAfterFilter implements TaskFilter {
        private final String dueAfter;

        public DueAfterFilter(String dueAfter) {
            this.dueAfter = dueAfter;
        }

        @Override
        public boolean matches(Task task) {
            return task.getDueDate() != null && task.getDueDate().compareTo(dueAfter) >= 0;
        }
    }

    class ParentIdFilter implements TaskFilter {
        private final int parentId;

        public ParentIdFilter(int parentId) {
            this.parentId = parentId;
        }

        @Override
        public boolean matches(Task task) {
            return task.getParentId() != null && task.getParentId() == parentId;
        }
    }
}
