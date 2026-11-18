package parser;

import exception.BadGatewayException;
import model.Task;
import model.TaskRequest;

import java.util.ArrayList;
import java.util.List;

public class LlmBreakdownStrategy implements BreakdownStrategy {
    private final LlmClient llmClient;

    public LlmBreakdownStrategy(LlmClient llmClient) {
        this.llmClient = llmClient;
    }

    public static String buildPrompt(Task parentTask) {
        return "Break the following parent task into 3 to 5 concrete subtasks.\n"
                + "Output ONLY one subtask per line using the exact format: title|description\n"
                + "Do not include numbering, bullets, markdown, or blank lines.\n"
                + "Parent Title: " + parentTask.getTitle() + "\n"
                + "Parent Description: " + parentTask.getDescription();
    }

    @Override
    public List<TaskRequest> breakDown(Task parentTask) {
        String prompt = buildPrompt(parentTask);
        String rawReply = llmClient.complete(prompt);
        if (rawReply == null || rawReply.isBlank()) {
            throw new BadGatewayException("LLM returned empty breakdown output.");
        }

        List<TaskRequest> items = new ArrayList<>();
        String[] lines = rawReply.split("\\r?\\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            int pipe = trimmed.indexOf('|');
            if (pipe == -1) {
                throw new BadGatewayException("Malformed breakdown line (expected 'title|description'): " + trimmed);
            }
            String title = trimmed.substring(0, pipe).trim();
            String description = trimmed.substring(pipe + 1).trim();
            items.add(new TaskRequest(
                    title,
                    description,
                    "false",
                    parentTask.getDueDate(),
                    parentTask.getPriority().name()
            ));
        }

        if (items.isEmpty()) {
            throw new BadGatewayException("LLM produced zero subtasks.");
        }
        return items;
    }
}
