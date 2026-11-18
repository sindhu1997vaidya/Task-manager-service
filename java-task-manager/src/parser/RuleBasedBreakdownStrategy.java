package parser;

import model.Task;
import model.TaskRequest;

import java.util.ArrayList;
import java.util.List;

public class RuleBasedBreakdownStrategy implements BreakdownStrategy {

    @Override
    public List<TaskRequest> breakDown(Task parentTask) {
        String source = parentTask.getDescription();
        if (source == null || source.isBlank()) {
            source = parentTask.getTitle();
        }

        String[] parts = source.split("\\s*(?:,|\\band\\b|;)\\s*");
        List<TaskRequest> requests = new ArrayList<>();
        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            String title = Character.toUpperCase(trimmed.charAt(0)) + trimmed.substring(1);
            requests.add(new TaskRequest(
                    title,
                    "Subtask for '" + parentTask.getTitle() + "': " + title,
                    "false",
                    parentTask.getDueDate(),
                    parentTask.getPriority().name()
            ));
        }

        if (requests.size() <= 1) {
            requests.clear();
            requests.add(new TaskRequest(
                    "Plan " + parentTask.getTitle(),
                    "Outline scope and requirements for " + parentTask.getTitle(),
                    "false",
                    parentTask.getDueDate(),
                    parentTask.getPriority().name()
            ));
            requests.add(new TaskRequest(
                    "Execute " + parentTask.getTitle(),
                    "Complete core work for " + parentTask.getTitle(),
                    "false",
                    parentTask.getDueDate(),
                    parentTask.getPriority().name()
            ));
            requests.add(new TaskRequest(
                    "Review " + parentTask.getTitle(),
                    "Verify final output for " + parentTask.getTitle(),
                    "false",
                    parentTask.getDueDate(),
                    parentTask.getPriority().name()
            ));
        }
        return requests;
    }
}
