import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, addWeeks, addYears, format, getISOWeek, startOfISOWeek, startOfMonth, startOfYear } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { db, newId, requestPersistentStorage, resizePhoto } from './db';
import type { Exercise, ExerciseType, Routine, RoutineItem, SessionSet } from './types';

const tabs = [
  { to: '/exercises', label: 'Exercises', icon: '＋' },
  { to: '/routines', label: 'Routines', icon: '▤' },
  { to: '/workout', label: 'Workout', icon: '◉' },
  { to: '/history', label: 'History', icon: '▤' }
];

export default function App() {
  const [storageNotice, setStorageNotice] = useState('');
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const activeSession = useLiveQuery(
    () => db.sessions.where('status').equals('in_progress').first(),
    []
  );
  const navigate = useNavigate();

  useEffect(() => {
    requestPersistentStorage()
      .then((granted) => setStorageNotice(granted ? 'Browser storage persistence granted' : 'Browser storage persistence not granted'))
      .catch(() => setStorageNotice('Could not request storage protection'));
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Training Tracker</h1>
        </div>
        <span className="privacy-badge">On this phone</span>
      </header>
      {storageNotice && <p className="storage-note">{storageNotice}</p>}
      {activeSession && (
        <button className="resume-banner" onClick={() => navigate('/workout')}>
          Workout in progress <span>Resume →</span>
        </button>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/exercises" replace />} />
          <Route path="/exercises" element={<ExercisesPage exercises={exercises} />} />
          <Route path="/routines" element={<RoutinesPage exercises={exercises} />} />
          <Route path="/workout" element={<WorkoutPage exercises={exercises} />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/exercises" replace />} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ExercisesPage({ exercises }: { exercises: Exercise[] }) {
  const [editing, setEditing] = useState<Exercise>();
  const [saving, setSaving] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType>('reps');
  const [description, setDescription] = useState('');
  const [kg, setKg] = useState('');
  const [photo, setPhoto] = useState<Blob>();
  const [error, setError] = useState('');
  const visibleExercises = exercises.filter((exercise) => !exercise.archived).sort((a, b) => a.name.localeCompare(b.name));

  function resetForm() {
    setEditing(undefined);
    setName('');
    setType('reps');
    setDescription('');
    setKg('');
    setPhoto(undefined);
    setError('');
    setFileInputKey((key) => key + 1);
  }

  function editExercise(exercise: Exercise) {
    setEditing(exercise);
    setName(exercise.name);
    setType(exercise.type);
    setDescription(exercise.description ?? '');
    setKg(exercise.kg === undefined ? '' : String(exercise.kg));
    setPhoto(exercise.photo);
    setError('');
    setFileInputKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveExercise(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter an exercise name.');
      return;
    }
    const parsedKg = kg.trim() === '' ? undefined : Number(kg.replace(',', '.'));
    if (parsedKg !== undefined && (!Number.isFinite(parsedKg) || parsedKg < 0)) {
      setError('Enter a valid weight in kg, or leave it empty.');
      return;
    }
    if (saving || loadingPhoto) return;
    setSaving(true);
    const now = Date.now();
    try {
      const exercise: Exercise = {
        id: editing?.id ?? newId(),
        name: trimmedName,
        type,
        description: description.trim() || undefined,
        kg: parsedKg,
        photo,
        archived: editing?.archived ?? false,
        createdAt: editing?.createdAt ?? now,
        updatedAt: now
      };
      if (editing) {
        if (!await db.exercises.update(editing.id, exercise)) throw new Error('This exercise no longer exists.');
      } else {
        await db.exercises.add(exercise);
      }
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this exercise.');
    } finally {
      setSaving(false);
    }
  }

  async function selectPhoto(file?: File) {
    if (!file) return;
    setLoadingPhoto(true);
    try {
      setPhoto(await resizePhoto(file));
      setError('');
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not load this photo.');
    } finally {
      setLoadingPhoto(false);
    }
  }

  return (
    <section>
      <SectionHeading title="Exercices library" />
      <form className="card form-stack" onSubmit={saveExercise}>
        {editing && <h3>Editing {editing.name}</h3>}
        <label>
          Exercise name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Goblet squat" required maxLength={80} />
        </label>
        <label>
          Track by
          <select value={type} onChange={(event) => setType(event.target.value as ExerciseType)}>
            <option value="reps">Repetitions</option>
            <option value="time">Time</option>
          </select>
        </label>
        <label>
          Weight (kg) <span className="optional">Optional</span>
          <input type="text" inputMode="decimal" value={kg} onChange={(event) => setKg(event.target.value)} placeholder="e.g. 12.5" maxLength={7} />
        </label>
        <label>
          Notes <span className="optional">Optional</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Form cues or equipment" maxLength={500} />
        </label>
        <label className="file-control">
          Exercise photo <span className="optional">Optional</span>
          <input key={`photo-${fileInputKey}`} type="file" accept="image/*" disabled={loadingPhoto || saving} onChange={(event) => void selectPhoto(event.target.files?.[0])} />
          {photo && <span className="small-note">Photo ready ({Math.round(photo.size / 1024)} KB)</span>}
        </label>
        {photo && <div className="editor-actions"><ExercisePhoto photo={photo} /><button type="button" className="text-button" disabled={loadingPhoto || saving} onClick={() => setPhoto(undefined)}>Remove photo</button></div>}
        {loadingPhoto && <p className="small-note" role="status">Preparing photo...</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={loadingPhoto || saving}>{editing ? 'Save exercise' : 'Add exercise'}</button>
        {editing && <button className="button secondary" type="button" disabled={loadingPhoto || saving} onClick={resetForm}>Cancel editing</button>}
      </form>

      <div className="section-row">
        <h2>Your exercises</h2><span className="count-pill">{visibleExercises.length}</span>
      </div>
      {visibleExercises.length === 0 ? (
        <EmptyState title="Your library starts here" detail="Add an exercise above, then group it into a routine." />
      ) : (
        <div className="list-stack">
          {visibleExercises.map((exercise) => (
            <article className="list-card" key={exercise.id}>
              <ExercisePhoto photo={exercise.photo} />
              <div className="list-copy">
                <h3>{exercise.name}</h3>
                <p>{exercise.type === 'reps' ? 'Repetitions' : 'Timed'}{exercise.kg !== undefined ? ` · ${exercise.kg} kg` : ''}{exercise.description ? ` · ${exercise.description}` : ''}</p>
              </div>
              <button className="text-button" disabled={loadingPhoto || saving} onClick={() => editExercise(exercise)} aria-label={`Edit ${exercise.name}`}>Edit</button>
              <button className="icon-button" disabled={loadingPhoto || saving} aria-label={`Archive ${exercise.name}`} onClick={() => {
                void db.exercises.update(exercise.id, { archived: true, updatedAt: Date.now() })
                  .then(() => { if (editing?.id === exercise.id) resetForm(); })
                  .catch((archiveError: unknown) => setError(archiveError instanceof Error ? archiveError.message : 'Could not archive this exercise.'));
              }}>×</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RoutinesPage({ exercises }: { exercises: Exercise[] }) {
  const routines = useLiveQuery(() => db.routines.toArray(), []) ?? [];
  const availableExercises = exercises.filter((exercise) => !exercise.archived);
  const [name, setName] = useState('');
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [sets, setSets] = useState(3);
  const [target, setTarget] = useState(10);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Routine>();
  const [saving, setSaving] = useState(false);
  const sortedRoutines = routines.filter((routine) => !routine.archived).sort((a, b) => a.name.localeCompare(b.name));

  function addItem() {
    if (!selectedExercise || !Number.isInteger(sets) || sets < 1 || sets > 30 || !Number.isFinite(target) || target <= 0) {
      setError('Choose an exercise, 1-30 whole sets, and a positive target.');
      return;
    }
    setItems((current) => [...current, { exerciseId: selectedExercise, sets, target }]);
    setError('');
  }

  function resetForm() {
    setEditing(undefined);
    setName('');
    setItems([]);
    setSelectedExercise('');
    setError('');
  }

  function editRoutine(routine: Routine) {
    setEditing(routine);
    setName(routine.name);
    setItems(routine.items.map((item) => ({ ...item })));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateItem(index: number, patch: Partial<RoutineItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const reordered = [...current];
      [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
      return reordered;
    });
  }

  async function saveRoutine(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || items.length === 0 || items.some((item) =>
      !exercises.some((exercise) => exercise.id === item.exerciseId) ||
      !Number.isInteger(item.sets) || item.sets < 1 || item.sets > 30 ||
      !Number.isFinite(item.target) || item.target <= 0
    )) {
      setError('Enter a routine name and at least one valid exercise with 1-30 whole sets and a positive target.');
      return;
    }
    if (saving) return;
    setSaving(true);
    const now = Date.now();
    try {
      const routine: Routine = {
        id: editing?.id ?? newId(),
        name: name.trim(),
        items,
        archived: editing?.archived ?? false,
        createdAt: editing?.createdAt ?? now,
        updatedAt: now
      };
      if (editing) {
        if (!await db.routines.update(editing.id, { name: routine.name, items: routine.items, updatedAt: now })) {
          throw new Error('This routine no longer exists.');
        }
      } else {
        await db.routines.add(routine);
      }
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this routine.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionHeading title="Routines libraries" />
      {availableExercises.length === 0 && !editing ? (
        <EmptyState title="Add an exercise first" detail="Your routine needs at least one exercise from your library." />
      ) : (
        <form className="card form-stack" onSubmit={saveRoutine}>
          {editing && <h3>Editing {editing.name}</h3>}
          <label>
            Routine name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Full body A" maxLength={80} required />
          </label>
          <div className="inline-fields">
            <label className="grow">
              Exercise
              <select value={selectedExercise} onChange={(event) => setSelectedExercise(event.target.value)}>
                <option value="">Choose exercise</option>
                {availableExercises.map((exercise) => <option value={exercise.id} key={exercise.id}>{exercise.name}</option>)}
              </select>
            </label>
            <label className="number-field">Sets<input type="number" min="1" max="30" value={sets} onChange={(event) => setSets(Number(event.target.value))} /></label>
            <label className="number-field">{selectedExercise && availableExercises.find((e) => e.id === selectedExercise)?.type === 'time' ? 'Seconds' : 'Reps'}<input type="number" min="1" value={target} onChange={(event) => setTarget(Number(event.target.value))} /></label>
          </div>
          <button type="button" className="button secondary" onClick={addItem} disabled={!selectedExercise}>Add to routine</button>
          {items.length > 0 && (
            <ol className="routine-items">
              {items.map((item, index) => {
                const exercise = exercises.find((candidate) => candidate.id === item.exerciseId);
                return (
                  <li key={`${item.exerciseId}-${index}`}>
                    <div className="routine-item-editor">
                      <strong>{index + 1}. {exercise?.name ?? 'Missing exercise'}{exercise?.archived ? ' (archived)' : ''}</strong>
                      <div className="inline-fields">
                        <label className="number-field">Sets<input aria-label={`Sets for item ${index + 1}`} type="number" min="1" max="30" step="1" value={item.sets} onChange={(event) => updateItem(index, { sets: Number(event.target.value) })} required /></label>
                        <label className="number-field">{exercise?.type === 'time' ? 'Seconds' : 'Reps'}<input aria-label={`Target for item ${index + 1}`} type="number" min="1" step="any" value={item.target} onChange={(event) => updateItem(index, { target: Number(event.target.value) })} required /></label>
                      </div>
                      <div className="editor-actions">
                        <button className="text-button" type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`Move item ${index + 1} up`}>Up</button>
                        <button className="text-button" type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Move item ${index + 1} down`}>Down</button>
                        <button className="text-button" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove item ${index + 1}`}>Remove</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="button primary" disabled={saving || !name.trim() || items.length === 0}>Save routine</button>
          {editing && <button className="button secondary" type="button" disabled={saving} onClick={resetForm}>Cancel editing</button>}
        </form>
      )}
      <div className="section-row">
        <h2>Saved routines</h2><span className="count-pill">{sortedRoutines.length}</span>
      </div>
      {sortedRoutines.length === 0 ? (
        <EmptyState title="No routines yet" detail="Build your first routine above." />
      ) : (
        <div className="list-stack">
          {sortedRoutines.map((routine) => (
            <article className="routine-card" key={routine.id}>
              <div className="routine-card-top">
                <div><h3>{routine.name}</h3><p>{routine.items.length} exercise{routine.items.length === 1 ? '' : 's'}</p></div>
                <div className="editor-actions">
                  <button className="text-button" disabled={saving} aria-label={`Edit ${routine.name}`} onClick={() => editRoutine(routine)}>Edit</button>
                  <button className="icon-button" disabled={saving} aria-label={`Archive ${routine.name}`} onClick={() => {
                    void db.routines.update(routine.id, { archived: true, updatedAt: Date.now() })
                      .then(() => { if (editing?.id === routine.id) resetForm(); })
                      .catch((archiveError: unknown) => setError(archiveError instanceof Error ? archiveError.message : 'Could not archive this routine.'));
                  }}>×</button>
                </div>
              </div>
              <p className="routine-summary">{routine.items.map((item) => {
                const exercise = exercises.find((candidate) => candidate.id === item.exerciseId);
                return `${exercise?.name ?? 'Archived'} · ${item.sets}×${item.target}${exercise?.kg !== undefined ? ` @ ${exercise.kg} kg` : ''}`;
              }).join(' / ')}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function WorkoutPage({ exercises }: { exercises: Exercise[] }) {
  const routines = useLiveQuery(() => db.routines.toArray(), []) ?? [];
  const session = useLiveQuery(() => db.sessions.where('status').equals('in_progress').first(), []);
  const sessionSets = useLiveQuery(
    () => session ? db.sessionSets.where('sessionId').equals(session.id).sortBy('order') : Promise.resolve([] as SessionSet[]),
    [session?.id]
  ) ?? [];
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const availableRoutines = routines.filter((routine) => !routine.archived);
  const totalDone = sessionSets.filter((item) => item.done).length;
  const hasRunningTimer = sessionSets.some((item) => item.startedAt !== undefined);

  useEffect(() => {
    if (!hasRunningTimer) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [hasRunningTimer]);

  async function startWorkout(routine?: Routine) {
    const startedAt = Date.now();
    const sessionId = newId();
    const snapshots = routine ? await buildRoutineSnapshot(routine, sessionId, exercises) : [];
    try {
      await db.transaction('rw', db.sessions, db.sessionSets, async () => {
        await db.sessions.add({
          id: sessionId,
          routineId: routine?.id,
          routineName: routine?.name,
          startedAt,
          status: 'in_progress'
        });
        if (snapshots.length) await db.sessionSets.bulkAdd(snapshots);
      });
      setError('');
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Could not start this workout.');
    }
  }

  async function toggleSet(item: SessionSet) {
    const done = !item.done;
    await db.sessionSets.update(item.id, {
      done,
      actual: done ? item.actual ?? item.target : item.actual,
      doneAt: done ? Date.now() : undefined,
      startedAt: undefined
    });
  }

  async function updateActual(item: SessionSet, actual: number) {
    await db.sessionSets.update(item.id, { actual: Math.max(0, actual) });
  }

  async function toggleTimer(item: SessionSet) {
    if (item.startedAt !== undefined) {
      const actual = Math.max(0, Math.round((Date.now() - item.startedAt) / 1000));
      await db.sessionSets.update(item.id, {
        startedAt: undefined,
        actual,
        done: true,
        doneAt: Date.now()
      });
      return;
    }
    await db.sessionSets.update(item.id, { startedAt: Date.now(), done: false, doneAt: undefined });
  }

  async function addSet(exerciseId: string) {
    if (!session) return;
    const exercise = exercises.find((candidate) => candidate.id === exerciseId);
    if (!exercise) return;
    const previous = sessionSets.filter((item) => item.exerciseId === exerciseId);
    const last = previous[previous.length - 1];
    await db.sessionSets.add({
      id: newId(),
      sessionId: session.id,
      exerciseId,
      exerciseName: exercise.name,
      exerciseType: exercise.type,
      kg: last?.kg ?? exercise.kg,
      order: sessionSets.length,
      target: last?.target ?? 1,
      done: false,
      addedAdHoc: true
    });
  }

  async function finishWorkout() {
    if (!session) return;
    if (hasRunningTimer) throw new Error('Stop or tick any running timers before finishing the workout.');
    const status = sessionSets.length > 0 && sessionSets.every((item) => item.done) ? 'completed' : 'partial';
    await db.sessions.update(session.id, { status, finishedAt: Date.now() });
  }

  async function saveWorkoutChange(change: () => Promise<unknown>) {
    try {
      await change();
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this workout change.');
    }
  }

  if (!session) {
    return (
      <section>
        <SectionHeading title="Workouts" caption="Choose a routine or start a free session." />
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="list-stack">
          {availableRoutines.length === 0 && <EmptyState title="No routines to start" detail="Create a routine first, or start a free workout." />}
          {availableRoutines.map((routine) => (
            <button className="start-card" key={routine.id} onClick={() => void startWorkout(routine)}>
              <span className="start-card-icon">↗</span>
              <span><strong>{routine.name}</strong><small>{routine.items.length} exercises</small></span>
              <span className="arrow">Start →</span>
            </button>
          ))}
          <button className="button secondary" onClick={() => void startWorkout()}>Start free workout</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading kicker="SESSION IN PROGRESS" title={session.routineName ?? 'Free workout'} caption={`${totalDone} of ${sessionSets.length} sets completed`} />
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="progress-track"><span style={{ width: `${sessionSets.length ? totalDone / sessionSets.length * 100 : 0}%` }} /></div>
      {sessionSets.length === 0 && (
        <div className="card form-stack">
          <p className="muted-copy">Add an exercise to start tracking this session.</p>
          <div className="exercise-picker">
            {exercises.filter((exercise) => !exercise.archived).map((exercise) => (
              <button className="button secondary" key={exercise.id} onClick={() => void saveWorkoutChange(() => addSet(exercise.id))}>+ {exercise.name}</button>
            ))}
          </div>
        </div>
      )}
      <div className="list-stack workout-list">
        {groupSets(sessionSets).map(({ exerciseName, exerciseType, kg: groupKg, sets: grouped }) => (
          <article className="workout-card" key={grouped[0].exerciseId}>
            <div className="workout-card-heading">
              <div><h3>{exerciseName}</h3><p>{exerciseType === 'time' ? 'Timed sets · seconds' : 'Repetition sets'}{groupKg !== undefined ? ` · ${groupKg} kg` : ''}</p></div>
              <button className="text-button" onClick={() => void saveWorkoutChange(() => addSet(grouped[0].exerciseId))}>+ Set</button>
            </div>
            <div className="set-list">
              {grouped.map((item, index) => (
                <div className={`set-row ${item.done ? 'is-done' : ''}`} key={item.id}>
                  <SetCheckbox done={item.done} label={`Complete ${exerciseName} set ${index + 1}`} onToggle={() => toggleSet(item)} onError={setError} />
                  <span className="set-label">Set {index + 1} <small>Target {item.target}</small></span>
                  {item.exerciseType === 'time' && (
                    <button className={`timer-button ${item.startedAt !== undefined ? 'timer-running' : ''}`} onClick={() => void saveWorkoutChange(() => toggleTimer(item))} aria-label={`${item.startedAt !== undefined ? 'Stop' : 'Start'} timer for ${exerciseName} set ${index + 1}`}>
                      {item.startedAt !== undefined ? 'Stop' : 'Time'}
                    </button>
                  )}
                  {item.exerciseType === 'time' && item.startedAt !== undefined && (
                    <span className="timer-display">{formatDuration(Math.max(0, Math.floor((now - item.startedAt) / 1000)))}</span>
                  )}
                  <label className="actual-input">
                    <span className="sr-only">Actual {item.exerciseType === 'time' ? 'seconds' : 'reps'} for set {index + 1}</span>
                    <input type="number" min="0" value={item.actual ?? item.target} onChange={(event) => void saveWorkoutChange(() => updateActual(item, Number(event.target.value)))} />
                  </label>
                  <button className="remove-set" aria-label={`Remove set ${index + 1}`} onClick={() => void saveWorkoutChange(() => db.sessionSets.delete(item.id))}>×</button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      {sessionSets.length > 0 && exercises.some((exercise) => !exercise.archived && !sessionSets.some((item) => item.exerciseId === exercise.id)) && (
        <details className="add-exercise-details">
          <summary>+ Add an exercise to this workout</summary>
          <div className="exercise-picker">
            {exercises.filter((exercise) => !exercise.archived && !sessionSets.some((item) => item.exerciseId === exercise.id)).map((exercise) => (
              <button className="button secondary" key={exercise.id} onClick={() => void saveWorkoutChange(() => addSet(exercise.id))}>{exercise.name}</button>
            ))}
          </div>
        </details>
      )}
      <button className="button primary finish-button" onClick={() => void saveWorkoutChange(finishWorkout)}>Finish workout</button>
    </section>
  );
}

function SetCheckbox({ done, label, onToggle, onError }: {
  done: boolean;
  label: string;
  onToggle: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [checked, setChecked] = useState(done);
  const [saving, setSaving] = useState(false);
  useEffect(() => setChecked(done), [done]);

  async function toggle() {
    setChecked(!done);
    setSaving(true);
    onError('');
    try {
      await onToggle();
    } catch (error) {
      setChecked(done);
      onError(error instanceof Error ? error.message : 'Could not save this set.');
    } finally {
      setSaving(false);
    }
  }

  return <input className="set-checkbox" type="checkbox" checked={checked} disabled={saving} onChange={() => void toggle()} aria-label={label} />;
}

type HistoryScale = 'week' | 'month' | 'year';

const ROUTINE_COLORS = ['#2f7d5b', '#e07a3f', '#4a6fd1', '#c94f7c', '#8a62c9', '#d1a92b', '#2aa6b8', '#7a8f2e', '#b5523b', '#5d6b8a'];
const FREE_WORKOUT_COLOR = '#9aa39d';
const FREE_WORKOUT_KEY = '__free__';
const HISTORY_FILTER_KEY = 'history-hidden-routines';
const HISTORY_WINDOW: Record<HistoryScale, number> = { week: 26, month: 24, year: 0 };

function periodStart(date: Date, scale: HistoryScale): Date {
  return scale === 'week' ? startOfISOWeek(date) : scale === 'month' ? startOfMonth(date) : startOfYear(date);
}

function nextPeriod(date: Date, scale: HistoryScale): Date {
  return scale === 'week' ? addWeeks(date, 1) : scale === 'month' ? addMonths(date, 1) : addYears(date, 1);
}

function periodLabel(date: Date, scale: HistoryScale): { short: string; long: string } {
  if (scale === 'week') return { short: `W${getISOWeek(date)}`, long: `Week ${getISOWeek(date)} · ${format(date, 'd MMM yyyy')}` };
  if (scale === 'month') return { short: format(date, date.getMonth() === 0 ? "MMM ''yy" : 'MMM'), long: format(date, 'MMMM yyyy') };
  return { short: format(date, 'yyyy'), long: format(date, 'yyyy') };
}

function HistoryPage() {
  const [queryError, setQueryError] = useState('');
  const [scale, setScale] = useState<HistoryScale>('week');
  const [selected, setSelected] = useState<number>();
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(HISTORY_FILTER_KEY) ?? '[]') as string[]); } catch { return new Set(); }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessions = useLiveQuery(async () => {
    try {
      const result = await db.sessions.orderBy('startedAt').toArray();
      setQueryError('');
      return result.filter((session) => session.status !== 'in_progress');
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'Could not load workout history.');
      return undefined;
    }
  }, []);

  const routines = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string }>();
    let colorIndex = 0;
    for (const session of sessions ?? []) {
      const key = session.routineName ? session.routineId ?? session.routineName : FREE_WORKOUT_KEY;
      const name = session.routineName ?? 'Free workout';
      const existing = map.get(key);
      if (existing) {
        existing.name = name;
      } else {
        map.set(key, { key, name, color: key === FREE_WORKOUT_KEY ? FREE_WORKOUT_COLOR : ROUTINE_COLORS[colorIndex++ % ROUTINE_COLORS.length] });
      }
    }
    return map;
  }, [sessions]);

  const chart = useMemo(() => {
    if (!sessions || sessions.length === 0) return undefined;
    const now = new Date();
    const last = periodStart(now, scale);
    let first = periodStart(new Date(sessions[0].startedAt), scale);
    const windowSize = HISTORY_WINDOW[scale];
    if (windowSize > 0) {
      let minimum = last;
      for (let index = 1; index < windowSize; index += 1) minimum = scale === 'week' ? addWeeks(minimum, -1) : addMonths(minimum, -1);
      first = minimum;
    }
    const buckets: { start: Date; counts: Map<string, number>; total: number }[] = [];
    for (let cursor = first; cursor <= last; cursor = nextPeriod(cursor, scale)) buckets.push({ start: cursor, counts: new Map(), total: 0 });
    const index = new Map(buckets.map((bucket, position) => [bucket.start.getTime(), position]));
    const totals = new Map<string, number>();
    for (const session of sessions) {
      const position = index.get(periodStart(new Date(session.startedAt), scale).getTime());
      if (position === undefined) continue;
      const key = session.routineName ? session.routineId ?? session.routineName : FREE_WORKOUT_KEY;
      totals.set(key, (totals.get(key) ?? 0) + 1);
      if (hidden.has(key)) continue;
      const bucket = buckets[position];
      bucket.counts.set(key, (bucket.counts.get(key) ?? 0) + 1);
      bucket.total += 1;
    }
    const max = Math.max(1, ...buckets.map((bucket) => bucket.total));
    return { buckets, max, totals, total: buckets.reduce((sum, bucket) => sum + bucket.total, 0) };
  }, [sessions, scale, hidden]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [chart]);

  function updateHidden(next: Set<string>) {
    setHidden(next);
    setSelected(undefined);
    localStorage.setItem(HISTORY_FILTER_KEY, JSON.stringify([...next]));
  }

  function toggleRoutine(key: string) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key); else next.add(key);
    updateHidden(next);
  }

  const visibleCount = [...routines.keys()].filter((key) => !hidden.has(key)).length;
  const scaleCaption = scale === 'week' ? 'last 26 weeks' : scale === 'month' ? 'last 24 months' : 'all years';

  return (
    <section>
      <SectionHeading title="History" />
      <div className="segmented" role="tablist" aria-label="Period">
        {(['week', 'month', 'year'] as HistoryScale[]).map((option) => (
          <button key={option} type="button" role="tab" aria-selected={scale === option} className={scale === option ? 'active' : ''} onClick={() => { setScale(option); setSelected(undefined); }}>
            {option === 'week' ? 'Week' : option === 'month' ? 'Month' : 'Year'}
          </button>
        ))}
      </div>
      {queryError ? <p className="error-message" role="alert">{queryError}</p> : !sessions ? <p role="status">Loading history...</p> : !chart ? (
        <EmptyState title="No workouts yet" detail="Finish a workout from the Workout tab. It will appear here as a bar." />
      ) : (
        <div className="card chart-card">
          <div className="chart-filter" role="group" aria-label="Filter by routine">
            <button type="button" className="filter-chip all" onClick={() => updateHidden(hidden.size === 0 ? new Set(routines.keys()) : new Set())}>{hidden.size === 0 ? 'Hide all' : 'Show all'}</button>
            {[...routines.values()].map((routine) => (
              <button key={routine.key} type="button" className="filter-chip" aria-pressed={!hidden.has(routine.key)} onClick={() => toggleRoutine(routine.key)}>
                <span className="legend-swatch" style={{ background: routine.color }} />{routine.name}<strong>{chart.totals.get(routine.key) ?? 0}</strong>
              </button>
            ))}
          </div>
          <p className="small-note">{chart.total} workout{chart.total === 1 ? '' : 's'} · {scaleCaption}{hidden.size > 0 ? ` · ${visibleCount} of ${routines.size} routines` : ''}</p>
          {visibleCount === 0 && <p className="small-note chart-hint">All routines are hidden. Tap a routine above to show it.</p>}
          <div className="chart-scroll" ref={scrollRef}>
            <div className="chart-bars" role="img" aria-label={`Workouts per ${scale}, stacked by routine`}>
              {chart.buckets.map((bucket) => {
                const label = periodLabel(bucket.start, scale);
                const tooltip = [label.long, ...[...bucket.counts].map(([key, count]) => `${routines.get(key)?.name ?? key}: ${count}`)].join('\n');
                return (
                  <button type="button" className={`chart-column${selected === bucket.start.getTime() ? ' selected' : ''}`} key={bucket.start.getTime()} title={tooltip} aria-label={tooltip.replace(/\n/g, ', ')} onClick={() => setSelected(selected === bucket.start.getTime() ? undefined : bucket.start.getTime())}>
                    <span className="chart-total">{bucket.total || ''}</span>
                    <div className="chart-stack">
                      {[...routines.values()].filter((routine) => bucket.counts.has(routine.key)).map((routine) => (
                        <div key={routine.key} className="chart-segment" style={{ height: `${(bucket.counts.get(routine.key)! / chart.max) * 100}%`, background: routine.color }} />
                      ))}
                    </div>
                    <span className="chart-label">{label.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {(() => {
            const bucket = chart.buckets.find((item) => item.start.getTime() === selected);
            if (!bucket) return <p className="small-note chart-hint">Tap a bar for details.</p>;
            return (
              <p className="chart-detail"><strong>{periodLabel(bucket.start, scale).long}</strong>{' · '}
                {bucket.total === 0 ? 'No workouts' : [...routines.values()].filter((routine) => bucket.counts.has(routine.key)).map((routine) => `${routine.name} ${bucket.counts.get(routine.key)}`).join(' · ')}
              </p>
            );
          })()}
        </div>
      )}
    </section>
  );
}
async function buildRoutineSnapshot(routine: Routine, sessionId: string, exercises: Exercise[]): Promise<SessionSet[]> {
  const result: SessionSet[] = [];
  for (const item of routine.items) {
    const exercise = exercises.find((candidate) => candidate.id === item.exerciseId);
    if (!exercise) continue;
    for (let index = 0; index < item.sets; index += 1) {
      result.push({
        id: newId(),
        sessionId,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseType: exercise.type,
        kg: exercise.kg,
        order: result.length,
        target: item.target,
        done: false,
        addedAdHoc: false
      });
    }
  }
  return result;
}

function groupSets(sessionSets: SessionSet[]) {
  const groups = new Map<string, { exerciseName: string; exerciseType: ExerciseType; kg?: number; sets: SessionSet[] }>();
  for (const item of sessionSets) {
    const group = groups.get(item.exerciseId) ?? { exerciseName: item.exerciseName, exerciseType: item.exerciseType, kg: item.kg, sets: [] };
    group.sets.push(item);
    groups.set(item.exerciseId, group);
  }
  return [...groups.values()];
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function SectionHeading({ kicker, title, caption }: { kicker?: string; title: string; caption?: string }) {
  return <div className="section-heading">{kicker && <p className="eyebrow">{kicker}</p>}<h2>{title}</h2>{caption && <p>{caption}</p>}</div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span aria-hidden="true">✦</span><h3>{title}</h3><p>{detail}</p></div>;
}

function ExercisePhoto({ photo }: { photo?: Blob }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!photo) {
      setUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(photo);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);
  return url
    ? <img className="exercise-thumb" src={url} alt="" />
    : <div className="exercise-thumb placeholder-thumb" aria-hidden="true">✦</div>;
}
