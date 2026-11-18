package model;

public class TaskRequest {
    private String title;
    private String description;
    private String completed;
    private String dueDate;
    private String priority;
    private String recurrence;

    public TaskRequest() {
    }

    public TaskRequest(String title, String description, String completed, String dueDate, String priority) {
        this(title, description, completed, dueDate, priority, null);
    }

    public TaskRequest(String title, String description, String completed, String dueDate, String priority, String recurrence) {
        this.title = title;
        this.description = description;
        this.completed = completed;
        this.dueDate = dueDate;
        this.priority = priority;
        this.recurrence = recurrence;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCompleted() {
        return completed;
    }

    public void setCompleted(String completed) {
        this.completed = completed;
    }

    public String getDueDate() {
        return dueDate;
    }

    public void setDueDate(String dueDate) {
        this.dueDate = dueDate;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getRecurrence() {
        return recurrence;
    }

    public void setRecurrence(String recurrence) {
        this.recurrence = recurrence;
    }
}
