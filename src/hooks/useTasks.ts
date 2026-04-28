import { useState, useEffect, useCallback } from 'react';
import type { Task, Subtask, Owner } from '../types';
import { fetchTasks, saveTask, saveTaskOwner, createTask as apiCreateTask, updateTaskData } from '../api/tasks';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const updateAndSave = useCallback(async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    try {
      const result = await saveTask(updated);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === updated.id ? { ...t, completed_at: result.completed_at } : t
        )
      );
    } catch {
      // Revert on error
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  }, []);

  const updateOwnerAndSave = useCallback(async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    try {
      await saveTaskOwner(updated);
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  }, []);

  const toggleTask = useCallback(
    (task: Task) => {
      const newCompleted = task.completed ? 0 : 1;
      const updatedSubtasks = task.subtasks.map((s) => ({
        ...s,
        done: newCompleted === 1,
        items: s.items?.map((item) => ({ ...item, done: newCompleted === 1 })),
      }));
      updateAndSave({ ...task, completed: newCompleted, subtasks: updatedSubtasks });
    },
    [updateAndSave]
  );

  const toggleSubtask = useCallback(
    (task: Task, subtaskIndex: number) => {
      const subtask = task.subtasks[subtaskIndex];
      const newDone = !subtask.done;
      const updatedSubtask: Subtask = {
        ...subtask,
        done: newDone,
        items: subtask.items?.map((item) => ({ ...item, done: newDone })),
      };
      const updatedSubtasks = task.subtasks.map((s, i) =>
        i === subtaskIndex ? updatedSubtask : s
      );
      const allDone = updatedSubtasks.every((s) => s.done);
      updateAndSave({ ...task, subtasks: updatedSubtasks, completed: allDone ? 1 : 0 });
    },
    [updateAndSave]
  );

  const toggleNestedItem = useCallback(
    (task: Task, subtaskIndex: number, itemIndex: number) => {
      const subtask = task.subtasks[subtaskIndex];
      const updatedItems = subtask.items!.map((item, i) =>
        i === itemIndex ? { ...item, done: !item.done } : item
      );
      const allItemsDone = updatedItems.every((item) => item.done);
      const updatedSubtask: Subtask = {
        ...subtask,
        done: allItemsDone,
        items: updatedItems,
      };
      const updatedSubtasks = task.subtasks.map((s, i) =>
        i === subtaskIndex ? updatedSubtask : s
      );
      const allDone = updatedSubtasks.every((s) => s.done);
      updateAndSave({ ...task, subtasks: updatedSubtasks, completed: allDone ? 1 : 0 });
    },
    [updateAndSave]
  );

  const setTaskOwner = useCallback(
    (task: Task, owner: Owner) => {
      updateOwnerAndSave({ ...task, owner });
    },
    [updateOwnerAndSave]
  );

  const setSubtaskOwner = useCallback(
    (task: Task, subtaskIndex: number, owner: Owner) => {
      const updatedSubtasks = task.subtasks.map((s, i) =>
        i === subtaskIndex ? { ...s, owner } : s
      );
      updateOwnerAndSave({ ...task, subtasks: updatedSubtasks });
    },
    [updateOwnerAndSave]
  );

  const setNestedItemOwner = useCallback(
    (task: Task, subtaskIndex: number, itemIndex: number, owner: Owner) => {
      const subtask = task.subtasks[subtaskIndex];
      const updatedItems = subtask.items!.map((item, i) =>
        i === itemIndex ? { ...item, owner } : item
      );
      const updatedSubtasks = task.subtasks.map((s, i) =>
        i === subtaskIndex ? { ...s, items: updatedItems } : s
      );
      updateOwnerAndSave({ ...task, subtasks: updatedSubtasks });
    },
    [updateOwnerAndSave]
  );

  const addTask = useCallback(async (data: Omit<Task, 'id' | 'completed' | 'completed_at'>) => {
    const newTask = await apiCreateTask(data);
    setTasks((prev) => [...prev, newTask]);
  }, []);

  const editTask = useCallback(async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await updateTaskData(updated);
  }, []);

  return { tasks, loading, error, toggleTask, toggleSubtask, toggleNestedItem, setTaskOwner, setSubtaskOwner, setNestedItemOwner, addTask, editTask };
}
