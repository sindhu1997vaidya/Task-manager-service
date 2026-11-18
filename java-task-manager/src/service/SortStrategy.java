package service;

import model.Priority;
import model.Task;

import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

public interface SortStrategy {
    Comparator<Task> comparator();

    static SortStrategy resolve(String sortBy, String sortOrder) {
        Map<String, SortStrategy> registry = new HashMap<>();
        registry.put("id", new IdSortStrategy());
        registry.put("dueDate", new DueDateSortStrategy());
        registry.put("priority", new PrioritySortStrategy());
        registry.put("title", new TitleSortStrategy());

        SortStrategy strategy = registry.getOrDefault(sortBy == null ? "id" : sortBy, new IdSortStrategy());
        boolean desc = "desc".equalsIgnoreCase(sortOrder);
        return desc ? () -> strategy.comparator().reversed() : strategy;
    }

    class IdSortStrategy implements SortStrategy {
        @Override
        public Comparator<Task> comparator() {
            return Comparator.comparingInt(Task::getId);
        }
    }

    class DueDateSortStrategy implements SortStrategy {
        @Override
        public Comparator<Task> comparator() {
            return Comparator.comparing(
                    Task::getDueDate,
                    Comparator.nullsLast(String::compareTo)
            ).thenComparingInt(Task::getId);
        }
    }

    class PrioritySortStrategy implements SortStrategy {
        @Override
        public Comparator<Task> comparator() {
            return Comparator.comparingInt((Task t) -> weight(t.getPriority()))
                    .thenComparingInt(Task::getId);
        }

        private int weight(Priority p) {
            return switch (p) {
                case LOW -> 1;
                case MEDIUM -> 2;
                case HIGH -> 3;
            };
        }
    }

    class TitleSortStrategy implements SortStrategy {
        @Override
        public Comparator<Task> comparator() {
            return Comparator.comparing(Task::getTitle, String.CASE_INSENSITIVE_ORDER)
                    .thenComparingInt(Task::getId);
        }
    }
}
