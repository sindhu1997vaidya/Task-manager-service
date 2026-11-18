package parser;

import exception.BadGatewayException;
import model.ParsedTask;

import java.util.Map;

public class LlmTaskParser implements TaskParser {
    private final LlmClient llmClient;

    public LlmTaskParser(LlmClient llmClient) {
        this.llmClient = llmClient;
    }

    public static String buildPrompt(String text, String today) {
        return "You are a strict task extraction engine.\n"
                + "Today's date is " + today + " (YYYY-MM-DD).\n"
                + "Convert the user request below into a JSON object with ONLY these keys:\n"
                + "  \"title\": concise task title (non-empty string),\n"
                + "  \"description\": clear task details (non-empty string),\n"
                + "  \"dueDate\": resolved YYYY-MM-DD date or null if none,\n"
                + "  \"recurrence\": recurrence pattern (e.g. \"MONTHLY\", \"WEEKLY\") or null if none.\n"
                + "Reply with ONLY raw JSON and no markdown or explanation.\n"
                + "User request: " + text;
    }

    @Override
    public ParsedTask parse(String text, String today) {
        String prompt = buildPrompt(text, today);
        String rawReply = llmClient.complete(prompt);

        try {
            Map<String, String> map = SimpleJson.parseObject(rawReply);
            String title = map.get("title");
            String description = map.get("description");
            String dueDate = map.get("dueDate");
            String recurrence = map.get("recurrence");
            return new ParsedTask(title, description, dueDate, recurrence);
        } catch (Exception e) {
            throw new BadGatewayException("Model returned unparseable task JSON: " + e.getMessage());
        }
    }
}
