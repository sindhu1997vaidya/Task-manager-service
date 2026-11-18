package exception;

import java.util.Collections;
import java.util.List;

public class ApiException extends RuntimeException {
    private final int statusCode;
    private final String errorCode;
    private final List<FieldError> details;

    public ApiException(int statusCode, String errorCode, String message) {
        this(statusCode, errorCode, message, Collections.emptyList());
    }

    public ApiException(int statusCode, String errorCode, String message, List<FieldError> details) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details == null ? Collections.emptyList() : Collections.unmodifiableList(details);
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public List<FieldError> getDetails() {
        return details;
    }
}
