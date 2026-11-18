package event;

import model.Task;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public class AuditTrailListener implements TaskEventListener {
    private final Map<String, Integer> eventCounts = new LinkedHashMap<>();

    @Override
    public synchronized void onEvent(String eventType, Task task) {
        eventCounts.merge(eventType, 1, Integer::sum);
    }

    public synchronized int getCount(String eventType) {
        return eventCounts.getOrDefault(eventType, 0);
    }

    public synchronized Map<String, Integer> getAllCounts() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(eventCounts));
    }

    public synchronized void reset() {
        eventCounts.clear();
    }
}
