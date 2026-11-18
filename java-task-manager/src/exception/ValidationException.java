package exception;

import java.util.List;

public class ValidationException extends ApiException {
    public ValidationException(String message, List<FieldError> details) {
        super(400, "VALIDATION_ERROR", message, details);
    }

    public ValidationException(String field, String issue) {
        super(400, "VALIDATION_ERROR", "Validation failed", List.of(new FieldError(field, issue)));
    }
}
