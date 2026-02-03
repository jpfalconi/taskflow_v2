
export enum TaskStatus {
  TODO = 'TODO',
  DOING = 'DOING',
  DONE = 'DONE'
}

export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  category: string;
  url?: string;
  dueDate?: string;
  createdAt: string;
  tags: string[];
  subtasks: Subtask[];
  recurrence?: RecurrenceType;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface AiSuggestion {
  optimizedTitle: string;
  estimatedDuration: string;
  suggestedSubtasks: string[];
}

export type ViewType = 'QUADRO' | 'LISTA' | 'DASHBOARD';
