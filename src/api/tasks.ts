import type { Task } from '../types';

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function saveTask(task: Task): Promise<{ completed_at: string | null }> {
  const res = await fetch('/api/tasks/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to save task');
  return res.json();
}

export async function saveTaskOwner(task: Task): Promise<{ success: boolean }> {
  const res = await fetch('/api/tasks/owner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to save owner');
  return res.json();
}

export async function createTask(data: Omit<Task, 'id' | 'completed' | 'completed_at'>): Promise<Task> {
  const res = await fetch('/api/tasks/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function updateTaskData(task: Task): Promise<void> {
  const res = await fetch('/api/tasks/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to update task');
}
