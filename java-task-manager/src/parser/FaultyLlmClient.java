package parser;

import exception.BadGatewayException;

public class FaultyLlmClient implements LlmClient {
    public enum FaultMode {
        EMPTY_TITLE,
        IMPOSSIBLE_DATE,
        MALFORMED_JSON,
        THROW_NETWORK_ERROR,
        BAD_BREAKDOWN_LINE
    }

    private final FaultMode mode;

    public FaultyLlmClient(FaultMode mode) {
        this.mode = mode;
    }

    @Override
    public String complete(String prompt) {
        return switch (mode) {
            case EMPTY_TITLE -> "{\"title\":\"   \",\"description\":\"Pay rent\",\"dueDate\":\"2026-12-01\",\"recurrence\":null}";
            case IMPOSSIBLE_DATE -> "{\"title\":\"Pay rent\",\"description\":\"Pay rent on Feb 30\",\"dueDate\":\"2026-02-30\",\"recurrence\":null}";
            case MALFORMED_JSON -> "Sorry, I cannot process that request as JSON.";
            case THROW_NETWORK_ERROR -> throw new BadGatewayException("Simulated upstream LLM timeout");
            case BAD_BREAKDOWN_LINE -> "Buy paint|Purchase primer and wall paint\nInvalid line without pipe delimiter";
        };
    }
}
