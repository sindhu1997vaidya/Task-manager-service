package repository;

import model.Task;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

public class InMemoryTaskRepository implements TaskRepository {
    private static volatile InMemoryTaskRepository instance;

    private final Map<Integer, Task> storage = new LinkedHashMap<>();
    private final AtomicInteger idSequence = new AtomicInteger(1);

    private InMemoryTaskRepository() {
    }

    public static InMemoryTaskRepository getInstance() {
        if (instance == null) {
            synchronized (InMemoryTaskRepository.class) {
                if (instance == null) {
                    instance = new InMemoryTaskRepository();
                }
            }
        }
        return instance;
    }

    @Override
    public synchronized Task save(Task task) {
        storage.put(task.getId(), task);
        return task;
    }

    @Override
    public synchronized Optional<Task> findById(int id) {
        return Optional.ofNullable(storage.get(id));
    }

    @Override
    public synchronized List<Task> findAll() {
        return new ArrayList<>(storage.values());
    }

    @Override
    public synchronized boolean delete(int id) {
        return storage.remove(id) != null;
    }

    @Override
    public int nextId() {
        return idSequence.getAndIncrement();
    }

    @Override
    public synchronized void clear() {
        storage.clear();
        idSequence.set(1);
    }
}
