package parser;

public final class ParserFactory {

    private ParserFactory() {
    }

    public static TaskParser createTaskParser(boolean preferLlm) {
        String apiKey = System.getenv("LLM_API_KEY");
        if (preferLlm && apiKey != null && !apiKey.isBlank()) {
            return new LlmTaskParser(new HttpLlmClient());
        }
        return new RuleBasedTaskParser();
    }

    public static TaskParser createTaskParser(LlmClient client) {
        return new LlmTaskParser(client);
    }

    public static BreakdownStrategy createBreakdownStrategy(boolean preferLlm) {
        String apiKey = System.getenv("LLM_API_KEY");
        if (preferLlm && apiKey != null && !apiKey.isBlank()) {
            return new LlmBreakdownStrategy(new HttpLlmClient());
        }
        return new RuleBasedBreakdownStrategy();
    }

    public static BreakdownStrategy createBreakdownStrategy(LlmClient client) {
        return new LlmBreakdownStrategy(client);
    }
}
