package exception;

public class ServiceUnavailableException extends ApiException {
    public ServiceUnavailableException(String message) {
        super(503, "SERVICE_UNAVAILABLE", message);
    }
}
