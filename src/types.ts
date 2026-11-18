export type ExerciseType = 'reps' | 'time';

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  description?: string;
  kg?: number;
  photo?: Blob;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineItem {
  exerciseId: string;
  sets: number;
  target: number;
}

export interface Routine {
  id: string;
  name: string;
  items: RoutineItem[];
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = 'in_progress' | 'completed' | 'partial';

export interface TrainingSession {
  id: string;
  routineId?: string;
  routineName?: string;
  startedAt: number;
  finishedAt?: number;
  status: SessionStatus;
}

export interface SessionSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  kg?: number;
  order: number;
  target: number;
  actual?: number;
  done: boolean;
  doneAt?: number;
  startedAt?: number;
  addedAdHoc: boolean;
}
