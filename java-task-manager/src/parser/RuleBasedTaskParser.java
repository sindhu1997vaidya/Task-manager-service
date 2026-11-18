package parser;

import model.ParsedTask;

import java.time.LocalDate;

public class RuleBasedTaskParser implements TaskParser {

    @Override
    public ParsedTask parse(String text, String today) {
        String cleaned = text == null ? "" : text.trim();
        if (cleaned.isEmpty()) {
            return new ParsedTask("", "", null, null);
        }

        String lower = cleaned.toLowerCase();
        LocalDate baseDate = LocalDate.parse(today);
        String dueDate = null;
        String recurrence = null;

        if (lower.contains("tomorrow")) {
            dueDate = baseDate.plusDays(1).toString();
        } else if (lower.contains("today")) {
            dueDate = baseDate.toString();
        } else if (lower.contains("next week")) {
            dueDate = baseDate.plusWeeks(1).toString();
        } else if (lower.contains("1st of every month") || lower.contains("1st")) {
            LocalDate nextFirst = baseDate.getDayOfMonth() == 1
                    ? baseDate
                    : baseDate.plusMonths(1).withDayOfMonth(1);
            dueDate = nextFirst.toString();
        }

        if (lower.contains("every month") || lower.contains("monthly")) {
            recurrence = "MONTHLY";
        } else if (lower.contains("every week") || lower.contains("weekly")) {
            recurrence = "WEEKLY";
        } else if (lower.contains("every day") || lower.contains("daily")) {
            recurrence = "DAILY";
        }

        String title = cleaned
                .replaceAll("(?i)^remind me to\\s+", "")
                .replaceAll("(?i)^please\\s+", "")
                .trim();

        if (title.length() > 64) {
            title = title.substring(0, 61).trim() + "...";
        }
        if (!title.isEmpty()) {
            title = Character.toUpperCase(title.charAt(0)) + title.substring(1);
        }

        return new ParsedTask(title, cleaned, dueDate, recurrence);
    }
}
