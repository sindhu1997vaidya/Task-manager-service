package api;

public class ApiResponse {
    private final int statusCode;
    private final String body;

    public ApiResponse(int statusCode, String body) {
        this.statusCode = statusCode;
        this.body = body;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getBody() {
        return body;
    }

    public String toJson() {
        return "{\"statusCode\":" + statusCode + ",\"body\":" + body + "}";
    }

    @Override
    public String toString() {
        return "HTTP " + statusCode + " -> " + body;
    }
}
