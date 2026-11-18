package repository;

import model.Task;

import java.util.List;
import java.util.Optional;

public interface TaskRepository {
    Task save(Task task);

    Optional<Task> findById(int id);

    List<Task> findAll();

    boolean delete(int id);

    int nextId();

    void clear();
}
