package api;

import exception.ApiException;
import exception.FieldError;
import parser.SimpleJson;

import java.util.Collections;
import java.util.List;

public final class ErrorResponseFactory {

    private ErrorResponseFactory() {
    }

    public static ApiResponse from(ApiException e) {
        return buildErrorResponse(e.getStatusCode(), e.getErrorCode(), e.getMessage(), e.getDetails());
    }

    public static ApiResponse fromUnexpected(Exception e) {
        String msg = (e.getMessage() == null || e.getMessage().isBlank())
                ? "Internal server error"
                : e.getMessage();
        return buildErrorResponse(500, "INTERNAL_ERROR", msg, Collections.emptyList());
    }

    private static ApiResponse buildErrorResponse(
            int statusCode,
            String code,
            String message,
            List<FieldError> details
    ) {
        String safeMessage = (message == null || message.isBlank()) ? "Request failed" : message;
        StringBuilder sb = new StringBuilder();
        sb.append("{\"error\":{");
        sb.append("\"code\":").append(SimpleJson.jsonString(code)).append(",");
        sb.append("\"message\":").append(SimpleJson.jsonString(safeMessage)).append(",");
        sb.append("\"details\":").append(SimpleJson.fieldErrorsToJson(details));
        sb.append("}}");
        return new ApiResponse(statusCode, sb.toString());
    }
}
