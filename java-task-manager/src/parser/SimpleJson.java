package parser;

import exception.FieldError;
import model.Task;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class SimpleJson {

    private SimpleJson() {
    }

    public static String escape(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }

    public static String jsonString(String value) {
        if (value == null) {
            return "null";
        }
        return "\"" + escape(value) + "\"";
    }

    public static String taskToJson(Task task) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"id\":").append(task.getId()).append(",");
        sb.append("\"parentId\":").append(task.getParentId() == null ? "null" : task.getParentId()).append(",");
        sb.append("\"title\":").append(jsonString(task.getTitle())).append(",");
        sb.append("\"description\":").append(jsonString(task.getDescription())).append(",");
        sb.append("\"completed\":").append(task.isCompleted()).append(",");
        sb.append("\"dueDate\":").append(jsonString(task.getDueDate())).append(",");
        sb.append("\"priority\":").append(jsonString(task.getPriority().name())).append(",");
        sb.append("\"recurrence\":").append(jsonString(task.getRecurrence())).append(",");
        sb.append("\"createdAt\":").append(jsonString(task.getCreatedAt()));
        sb.append("}");
        return sb.toString();
    }

    public static String taskListToJson(List<Task> tasks) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < tasks.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(taskToJson(tasks.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }

    public static String pagedTasksToJson(List<Task> items, int page, int pageSize, int totalItems, int totalPages) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"items\":").append(taskListToJson(items)).append(",");
        sb.append("\"page\":").append(page).append(",");
        sb.append("\"pageSize\":").append(pageSize).append(",");
        sb.append("\"totalItems\":").append(totalItems).append(",");
        sb.append("\"totalPages\":").append(totalPages);
        sb.append("}");
        return sb.toString();
    }

    public static String fieldErrorsToJson(List<FieldError> details) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < details.size(); i++) {
            FieldError fe = details.get(i);
            if (i > 0) {
                sb.append(",");
            }
            sb.append("{");
            sb.append("\"field\":").append(jsonString(fe.getField())).append(",");
            sb.append("\"issue\":").append(jsonString(fe.getIssue()));
            sb.append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * Parses a flat JSON object (such as the LLM reply) into a String->String map.
     * Supports markdown ```json fences around the payload and null values.
     */
    public static Map<String, String> parseObject(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Empty JSON payload");
        }
        String trimmed = stripMarkdownFences(raw.trim());
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start == -1 || end == -1 || end <= start) {
            throw new IllegalArgumentException("Expected JSON object");
        }
        String obj = trimmed.substring(start + 1, end).trim();
        Map<String, String> result = new LinkedHashMap<>();
        int i = 0;
        int len = obj.length();

        while (i < len) {
            while (i < len && (Character.isWhitespace(obj.charAt(i)) || obj.charAt(i) == ',')) {
                i++;
            }
            if (i >= len) {
                break;
            }
            if (obj.charAt(i) != '"') {
                throw new IllegalArgumentException("Expected quoted key at index " + i);
            }
            ParsedToken keyToken = readString(obj, i);
            String key = keyToken.value;
            i = keyToken.nextIndex;

            while (i < len && Character.isWhitespace(obj.charAt(i))) {
                i++;
            }
            if (i >= len || obj.charAt(i) != ':') {
                throw new IllegalArgumentException("Expected ':' after key '" + key + "'");
            }
            i++;
            while (i < len && Character.isWhitespace(obj.charAt(i))) {
                i++;
            }
            if (i >= len) {
                throw new IllegalArgumentException("Unexpected end of JSON after key '" + key + "'");
            }

            char c = obj.charAt(i);
            if (c == '"') {
                ParsedToken valToken = readString(obj, i);
                result.put(key, valToken.value);
                i = valToken.nextIndex;
            } else if (obj.startsWith("null", i)) {
                result.put(key, null);
                i += 4;
            } else {
                int valStart = i;
                while (i < len && obj.charAt(i) != ',') {
                    i++;
                }
                result.put(key, obj.substring(valStart, i).trim());
            }
        }
        return result;
    }

    private static String stripMarkdownFences(String text) {
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            if (firstNewline != -1) {
                text = text.substring(firstNewline + 1);
            }
            int lastFence = text.lastIndexOf("```");
            if (lastFence != -1) {
                text = text.substring(0, lastFence);
            }
        }
        return text.trim();
    }

    private static ParsedToken readString(String src, int quoteIndex) {
        StringBuilder sb = new StringBuilder();
        int i = quoteIndex + 1;
        while (i < src.length()) {
            char c = src.charAt(i);
            if (c == '\\') {
                i++;
                if (i >= src.length()) {
                    throw new IllegalArgumentException("Unterminated escape sequence");
                }
                char esc = src.charAt(i);
                switch (esc) {
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    case '/' -> sb.append('/');
                    case 'b' -> sb.append('\b');
                    case 'f' -> sb.append('\f');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case 'u' -> {
                        if (i + 4 >= src.length()) {
                            throw new IllegalArgumentException("Invalid unicode escape");
                        }
                        String hex = src.substring(i + 1, i + 5);
                        sb.append((char) Integer.parseInt(hex, 16));
                        i += 4;
                    }
                    default -> sb.append(esc);
                }
                i++;
            } else if (c == '"') {
                return new ParsedToken(sb.toString(), i + 1);
            } else {
                sb.append(c);
                i++;
            }
        }
        throw new IllegalArgumentException("Unterminated string literal");
    }

    private static class ParsedToken {
        final String value;
        final int nextIndex;

        ParsedToken(String value, int nextIndex) {
            this.value = value;
            this.nextIndex = nextIndex;
        }
    }
}
