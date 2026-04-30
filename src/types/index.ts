export type Owner = 'Abhijeet' | 'Prajakta' | 'Both' | null;

export interface NestedItem {
  text: string;
  done: boolean;
  owner?: Owner;
  due?: string;
}

export interface Subtask {
  text: string;
  done: boolean;
  items?: NestedItem[];
  owner?: Owner;
  due?: string;
}

export interface Task {
  id: number;
  category: string;
  section: string;
  task: string;
  description: string;
  subtasks: Subtask[];
  target_date: string;
  target_month: string;
  completed: number;
  completed_at: string | null;
  owner?: Owner;
}

export type ViewTab = 'Admin' | 'Garden' | 'Baby' | 'Hospital' | 'Shopping' | 'Timetable';
