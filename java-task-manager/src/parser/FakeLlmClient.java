package parser;

import java.util.concurrent.atomic.AtomicInteger;

public class FakeLlmClient implements LlmClient {
    private final String fixedReply;
    private final AtomicInteger callCount = new AtomicInteger(0);

    public FakeLlmClient(String fixedReply) {
        this.fixedReply = fixedReply;
    }

    @Override
    public String complete(String prompt) {
        callCount.incrementAndGet();
        return fixedReply;
    }

    public int getCallCount() {
        return callCount.get();
    }

    public void resetCallCount() {
        callCount.set(0);
    }
}
