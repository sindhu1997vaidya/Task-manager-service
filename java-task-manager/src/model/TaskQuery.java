package model;

public final class TaskQuery {
    private final Boolean completed;
    private final Priority priority;
    private final String search;
    private final String dueBefore;
    private final String dueAfter;
    private final Integer parentId;
    private final boolean topLevelOnly;
    private final String sortBy;
    private final String sortOrder;
    private final int page;
    private final int pageSize;

    private TaskQuery(Builder builder) {
        this.completed = builder.completed;
        this.priority = builder.priority;
        this.search = builder.search;
        this.dueBefore = builder.dueBefore;
        this.dueAfter = builder.dueAfter;
        this.parentId = builder.parentId;
        this.topLevelOnly = builder.topLevelOnly;
        this.sortBy = builder.sortBy;
        this.sortOrder = builder.sortOrder;
        this.page = builder.page;
        this.pageSize = builder.pageSize;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public Priority getPriority() {
        return priority;
    }

    public String getSearch() {
        return search;
    }

    public String getDueBefore() {
        return dueBefore;
    }

    public String getDueAfter() {
        return dueAfter;
    }

    public Integer getParentId() {
        return parentId;
    }

    public boolean isTopLevelOnly() {
        return topLevelOnly;
    }

    public String getSortBy() {
        return sortBy;
    }

    public String getSortOrder() {
        return sortOrder;
    }

    public int getPage() {
        return page;
    }

    public int getPageSize() {
        return pageSize;
    }

    public static class Builder {
        private Boolean completed;
        private Priority priority;
        private String search;
        private String dueBefore;
        private String dueAfter;
        private Integer parentId;
        private boolean topLevelOnly = false;
        private String sortBy = "id";
        private String sortOrder = "asc";
        private int page = 1;
        private int pageSize = 20;

        public Builder completed(Boolean completed) {
            this.completed = completed;
            return this;
        }

        public Builder priority(Priority priority) {
            this.priority = priority;
            return this;
        }

        public Builder search(String search) {
            this.search = search;
            return this;
        }

        public Builder dueBefore(String dueBefore) {
            this.dueBefore = dueBefore;
            return this;
        }

        public Builder dueAfter(String dueAfter) {
            this.dueAfter = dueAfter;
            return this;
        }

        public Builder parentId(Integer parentId) {
            this.parentId = parentId;
            return this;
        }

        public Builder topLevelOnly(boolean topLevelOnly) {
            this.topLevelOnly = topLevelOnly;
            return this;
        }

        public Builder sortBy(String sortBy) {
            if (sortBy != null && !sortBy.isBlank()) {
                this.sortBy = sortBy;
            }
            return this;
        }

        public Builder sortOrder(String sortOrder) {
            if (sortOrder != null && !sortOrder.isBlank()) {
                this.sortOrder = sortOrder;
            }
            return this;
        }

        public Builder page(int page) {
            this.page = page;
            return this;
        }

        public Builder pageSize(int pageSize) {
            this.pageSize = pageSize;
            return this;
        }

        public TaskQuery build() {
            return new TaskQuery(this);
        }
    }
}
