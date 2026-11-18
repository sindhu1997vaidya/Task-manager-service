package parser;

import exception.BadGatewayException;
import exception.ServiceUnavailableException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class HttpLlmClient implements LlmClient {
    private static final String DEFAULT_MODEL = "gemini-2.5-flash";
    private final String apiKey;
    private final String model;
    private final HttpClient httpClient;

    public HttpLlmClient() {
        this(System.getenv("LLM_API_KEY"), System.getenv("LLM_MODEL"));
    }

    public HttpLlmClient(String apiKey, String model) {
        this.apiKey = apiKey;
        this.model = (model == null || model.isBlank()) ? DEFAULT_MODEL : model;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public String complete(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ServiceUnavailableException("LLM_API_KEY environment variable is not set.");
        }

        String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
                + model + ":generateContent?key=" + apiKey;

        String payload = "{\"contents\":[{\"parts\":[{\"text\":"
                + SimpleJson.jsonString(prompt)
                + "}]}]}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BadGatewayException("LLM provider returned HTTP " + response.statusCode());
            }
            return extractCandidateText(response.body());
        } catch (BadGatewayException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadGatewayException("LLM request was interrupted.");
        } catch (IOException e) {
            throw new BadGatewayException("Failed to reach LLM provider: " + e.getMessage());
        } catch (Exception e) {
            throw new BadGatewayException("Unexpected LLM client error: " + e.getMessage());
        }
    }

    private String extractCandidateText(String body) {
        if (body == null || body.isBlank()) {
            throw new BadGatewayException("Empty response from LLM provider.");
        }
        String marker = "\"text\"";
        int idx = body.indexOf(marker);
        if (idx == -1) {
            throw new BadGatewayException("LLM response did not contain candidate text.");
        }
        int colon = body.indexOf(':', idx + marker.length());
        int firstQuote = body.indexOf('"', colon + 1);
        if (firstQuote == -1) {
            throw new BadGatewayException("Malformed text field in LLM response.");
        }
        StringBuilder sb = new StringBuilder();
        for (int i = firstQuote + 1; i < body.length(); i++) {
            char c = body.charAt(i);
            if (c == '\\' && i + 1 < body.length()) {
                char next = body.charAt(++i);
                switch (next) {
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case '/' -> sb.append('/');
                    default -> sb.append(next);
                }
            } else if (c == '"') {
                return sb.toString();
            } else {
                sb.append(c);
            }
        }
        throw new BadGatewayException("Unterminated text field in LLM response.");
    }
}
