package model;

public final class Task {
    private final int id;
    private final Integer parentId;
    private final String title;
    private final String description;
    private final boolean completed;
    private final String dueDate;
    private final Priority priority;
    private final String recurrence;
    private final String createdAt;

    private Task(Builder builder) {
        this.id = builder.id;
        this.parentId = builder.parentId;
        this.title = builder.title;
        this.description = builder.description;
        this.completed = builder.completed;
        this.dueDate = builder.dueDate;
        this.priority = builder.priority;
        this.recurrence = builder.recurrence;
        this.createdAt = builder.createdAt;
    }

    public int getId() {
        return id;
    }

    public Integer getParentId() {
        return parentId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public boolean isCompleted() {
        return completed;
    }

    public String getDueDate() {
        return dueDate;
    }

    public Priority getPriority() {
        return priority;
    }

    public String getRecurrence() {
        return recurrence;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public Builder toBuilder() {
        return new Builder(this.title, this.description, this.completed)
                .id(this.id)
                .parentId(this.parentId)
                .dueDate(this.dueDate)
                .priority(this.priority)
                .recurrence(this.recurrence)
                .createdAt(this.createdAt);
    }

    public static class Builder {
        private final String title;
        private final String description;
        private final boolean completed;

        private int id;
        private Integer parentId;
        private String dueDate;
        private Priority priority = Priority.MEDIUM;
        private String recurrence;
        private String createdAt;

        public Builder(String title, String description, boolean completed) {
            this.title = title;
            this.description = description;
            this.completed = completed;
        }

        public Builder id(int id) {
            this.id = id;
            return this;
        }

        public Builder parentId(Integer parentId) {
            this.parentId = parentId;
            return this;
        }

        public Builder dueDate(String dueDate) {
            this.dueDate = dueDate;
            return this;
        }

        public Builder priority(Priority priority) {
            this.priority = priority == null ? Priority.MEDIUM : priority;
            return this;
        }

        public Builder recurrence(String recurrence) {
            this.recurrence = recurrence;
            return this;
        }

        public Builder createdAt(String createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Task build() {
            return new Task(this);
        }
    }

    @Override
    public String toString() {
        return "Task{id=" + id
                + ", parentId=" + parentId
                + ", title='" + title + '\''
                + ", completed=" + completed
                + ", dueDate='" + dueDate + '\''
                + ", priority=" + priority
                + '}';
    }
}
