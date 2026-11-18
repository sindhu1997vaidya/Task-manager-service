package exception;

import java.util.List;

public class BadGatewayException extends ApiException {
    public BadGatewayException(String message) {
        super(502, "BAD_GATEWAY", message);
    }

    public BadGatewayException(String message, List<FieldError> details) {
        super(502, "BAD_GATEWAY", message, details);
    }
}
