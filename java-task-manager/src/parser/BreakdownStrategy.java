package parser;

import model.Task;
import model.TaskRequest;

import java.util.List;

public interface BreakdownStrategy {
    List<TaskRequest> breakDown(Task parentTask);
}
