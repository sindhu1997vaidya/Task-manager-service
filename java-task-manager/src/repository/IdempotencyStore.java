package repository;

import api.ApiResponse;
import exception.ConflictException;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public class IdempotencyStore {
    private static volatile IdempotencyStore instance;

    private final Map<String, IdempotencyRecord> records = new LinkedHashMap<>();

    private IdempotencyStore() {
    }

    public static IdempotencyStore getInstance() {
        if (instance == null) {
            synchronized (IdempotencyStore.class) {
                if (instance == null) {
                    instance = new IdempotencyStore();
                }
            }
        }
        return instance;
    }

    public synchronized ApiResponse getExistingOrValidate(String key, String fingerprint) {
        if (key == null || key.isBlank()) {
            return null;
        }
        IdempotencyRecord existing = records.get(key);
        if (existing == null) {
            return null;
        }
        if (!existing.getFingerprint().equals(fingerprint)) {
            throw new ConflictException(
                    "Idempotency key '" + key + "' was already used with a different request payload."
            );
        }
        return existing.getResponse();
    }

    public synchronized void putSuccess(String key, String fingerprint, ApiResponse response) {
        if (key == null || key.isBlank() || response == null) {
            return;
        }
        int status = response.getStatusCode();
        if (status >= 200 && status < 300) {
            records.put(key, new IdempotencyRecord(fingerprint, response));
        }
    }

    public synchronized Map<String, IdempotencyRecord> snapshot() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(records));
    }

    public synchronized void clear() {
        records.clear();
    }

    public static class IdempotencyRecord {
        private final String fingerprint;
        private final ApiResponse response;

        public IdempotencyRecord(String fingerprint, ApiResponse response) {
            this.fingerprint = fingerprint;
            this.response = response;
        }

        public String getFingerprint() {
            return fingerprint;
        }

        public ApiResponse getResponse() {
            return response;
        }
    }
}
