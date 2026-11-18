import Dexie, { type EntityTable } from 'dexie';
import type { Exercise, Routine, SessionSet, TrainingSession } from './types';

class TrainingDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  sessions!: EntityTable<TrainingSession, 'id'>;
  sessionSets!: EntityTable<SessionSet, 'id'>;

  constructor() {
    super('training-tracker');
    this.version(1).stores({
      exercises: 'id, name, archived',
      routines: 'id, name, archived',
      sessions: 'id, startedAt, status, routineId',
      sessionSets: 'id, sessionId, exerciseId, [sessionId+order]'
    });
  }
}

export const db = new TrainingDatabase();

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the exercise photo.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const result = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the exercise photo.'))),
      'image/jpeg',
      0.8
    );
  });
  return result;
}

export function newId(): string {
  return crypto.randomUUID();
}
