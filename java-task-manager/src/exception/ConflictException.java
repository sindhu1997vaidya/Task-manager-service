package exception;

public class ConflictException extends ApiException {
    public ConflictException(String message) {
        super(422, "IDEMPOTENCY_CONFLICT", message);
    }
}
