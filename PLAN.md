# Training Tracker – Project Plan

Personal iPhone app to define exercises and routines, run workouts set by set in any order, and track history.

## Decisions

| Topic | Decision |
|---|---|
| Target device | iPhone only (Safari, iOS 16.4+) |
| Delivery | PWA – installed via Safari → Share → "Add to Home Screen". No App Store, no Mac, no fees. |
| Storage | Local only (IndexedDB on the phone). No cloud, no Google Drive sync. |
| Backup | Local-only: one ZIP containing data, photos, and the matching app release; manually save/share via iOS Files or Mail. Monthly in-app reminder; no automatic email or backend. |
| Rest timer | No |
| Charts | History = stacked bar chart of finished workouts per week / month / year, one colour per routine (no exercise detail) |

### PWA vs React Native (Expo)

| | PWA (chosen) | React Native / Expo |
|---|---|---|
| What it is | A website that installs as a full-screen home-screen icon | A real native iOS app built from JavaScript |
| Install on iPhone | Safari → Share → "Add to Home Screen" | App Store/TestFlight with an Apple Developer account ($99/yr), or a free account where the app expires every 7 days and must be reinstalled from a Mac. Expo Go is fine for testing only |
| Cost | Free (GitHub Pages) | $99/yr for a lasting install |
| Updates | Automatic on next launch | New build + reinstall/TestFlight (or Expo OTA updates) |
| Offline + local data | Yes (IndexedDB) | Yes (SQLite / file system) |
| Camera / photo library | Yes (`<input type="file" accept="image/*">`) | Yes, with more control (expo-image-picker / expo-camera) |
| Timers with screen locked | JS pauses; elapsed time is recalculated from a stored start time | Can run in the background and trigger local notifications |
| Apple Health, widgets, Live Activities, haptics | No or limited | Yes |
| Data safety | iOS may clear the data if storage runs low → mitigated by requesting persistent storage where supported + external backups | Data stays until the app is deleted |
| Effort to build | Lowest; test in any browser | Higher: native toolchain and device builds |

**Verdict:** this app needs no background timers, notifications, Apple Health or widgets, so a PWA covers everything at no cost. The data model and screens carry over if you later move to Expo; the UI code would need rewriting (React Native components instead of HTML/CSS) and the storage layer swapped for SQLite.

## Tech stack
- **Vite + React + TypeScript**
- **vite-plugin-pwa** – service worker (offline), web manifest, home-screen icon
- **Dexie.js** – IndexedDB wrapper (local database, stores image Blobs)
- **React Router** – navigation
- **date-fns** – week/month grouping (weeks start Monday, ISO)
- Hosting: **GitHub Pages** (free, HTTPS required for PWA), using the public personal repository [baierbrunnconsulting-max/training-tracker](https://github.com/baierbrunnconsulting-max/training-tracker). GitHub Actions publishes pushes to `main` at https://baierbrunnconsulting-max.github.io/training-tracker/. Only app code/assets are published; device data is not uploaded.
- On first launch call `navigator.storage.persist()` to reduce the risk of iOS evicting data.

## Data model

```ts
type ExerciseType = 'reps' | 'time';

interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;         // reps = quantity, time = seconds
  description?: string;
  kg?: number;                // optional weight, snapshotted into SessionSet
  photo?: Blob;               // resized JPEG, see "Pictures"
  archived: boolean;          // hidden from pickers, kept for history
  createdAt: number;
  updatedAt: number;
}

interface RoutineItem {
  exerciseId: string;
  sets: number;               // planned number of sets
  target: number;             // reps or seconds per set
}

interface Routine {
  id: string;
  name: string;
  items: RoutineItem[];       // ordered
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

type SessionStatus = 'in_progress' | 'completed' | 'partial';

interface Session {
  id: string;
  routineId?: string;         // undefined for free/manual sessions
  routineName?: string;       // snapshot, survives routine rename/delete
  startedAt: number;
  finishedAt?: number;
  status: SessionStatus;
  note?: string;
}

interface SessionSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;              // display order within the exercise card
  target: number;             // copied from routine at session start
  actual?: number;            // defaults to target when ticked, editable
  done: boolean;              // the key metric
  doneAt?: number;            // timestamp when ticked
  addedAdHoc: boolean;        // added during the workout, not in the routine
}
```

Rules:
- Starting a session **snapshots** the routine into `SessionSet` rows. Later edits to the routine never change history.
- Adding or deleting sets during a workout affects only that session, never the routine template.
- Exercises/routines used in history are archived rather than deleted.
- Status on finish: `completed` if all sets are done, otherwise `partial`.

## Pictures (exercise photo)
- Input: `<input type="file" accept="image/*">` – iOS offers Camera, Photo Library or Files.
- Before saving, resize on the device with a canvas (longest side 1024 px, JPEG quality 0.8, ~100–200 KB). Stored as a `Blob` in IndexedDB.
- Displayed as a thumbnail in lists and on the workout card; tap to view full-screen.
- Actions: add, replace, remove.

## Screens

1. **Home / Today** – "Start routine" (pick a routine), "Resume" if a session is in progress, last sessions.
2. **Exercises** – list with thumbnail + type; create/edit form (name, type, optional kg, description, photo).
3. **Routines** – list; editor with ordered items (pick exercise, sets, target; reorder; remove).
4. **Workout (core screen)**
   - One card per exercise (photo, name, target), with its sets shown as tappable chips.
   - Tick **any set of any exercise in any order** (A → B → A → C …).
   - Every set has a completion checkbox, including timed exercises. Ticking sets `done = true`, `doneAt = now`, and keeps the displayed actual value (target by default), without requiring a timer; untick to undo. A separate Time/Stop control measures timed sets. Ticking a running set clears its timer without overwriting the displayed actual value.
   - "+ set" per card (copies the last target); swipe/× to delete a set.
   - "+ exercise" to add an exercise not in the routine.
   - Time-type sets: start/stop timer based on a stored start timestamp; stop fills `actual`.
   - Progress header: sets done / planned.
   - "Finish" → saves status; "Discard" with confirmation.
   - State is saved to IndexedDB on every tap, so closing the app never loses progress.
5. **History** – stacked bar chart: Week (last 26 ISO weeks) / Month (last 24) / Year (all) toggle; each bar = finished workouts, stacked by routine with a stable colour per routine and a legend; free workouts in grey; in-progress sessions excluded; routine filter chips (multi-select, remembered locally) hide/show routines and rescale the bars. Session editing/manual entry to come later.
   - Manual entry: log a past session or single sets with a chosen date.
6. **Stats**
   - Per week and per month: number of sessions, sets done vs planned (%), total reps/time per exercise.
   - Averages: sessions per week, sets per week, per-exercise total per week/month.
   - Filter by exercise or routine.
7. **Settings** – export full backup, share backup, import backup, last export date, last user-confirmed external backup date, storage usage info. Sharing does not prove that the file was saved or emailed.

## Backup (export / import)
- Export one dated ZIP containing:
  - `data.json`: every database table, including in-progress workouts and saved settings; photos referenced by archive path.
  - `photos/`: original stored image files, without base64 expansion.
  - `app/`: the matching deployable production build, including offline assets.
  - `source/`: the matching source release, dependency lockfile, and build instructions. No credentials, private configuration, or dependencies directory.
  - `manifest.json`: backup format version, data schema version, app release version, and export timestamp.
  - `RESTORE.txt`: instructions for restoring data or redeploying the app.
- The release process produces the app/source archive for each version. The app combines the archive matching its running version with a consistent database snapshot. Cache the release archive for offline export; if unavailable, report the error explicitly rather than label a data-only export a full backup.
- Save via the iOS share sheet to Files (preferably iCloud Drive or another location outside the phone), or choose Mail and send manually. Check file-sharing support and offer a download fallback.
- A ZIP is an archive, not an installable iPhone app. For ordinary recovery, open/reinstall the hosted PWA and import the ZIP. If hosting disappears, redeploy the saved app build to an HTTPS host, then install from Safari and import the data. Opening the ZIP in Files does not run or install the app.
- Import reads data and photos only; never execute or install code from a backup. Validate format/schema compatibility, records, relationships, and photo references before showing a summary and asking permission to replace existing data. Apply the replacement atomically; failures must leave existing data intact.
- Backups are snapshots, not sync. Keep dated copies; changes after export need another backup. ZIP compression does not encrypt personal data or photos.

### Email and automation
- Decision: keep backups local-only, with manual Files/Mail sharing and a monthly in-app reminder. No automatic email service or backend.
- Without a backend: tap "Share backup", choose Mail, and send the attached ZIP. The app cannot silently send mail through the user's email account. Attachment limits depend on the mail provider; use Files/cloud storage when the full archive is too large.
- Automatic email is possible with a backend and email provider: with explicit opt-in, the open app uploads a backup and the backend sends it. Email credentials must stay on the backend, never in the PWA.
- Do not promise scheduled fresh backups while the iPhone PWA is closed. A server can schedule delivery of an already uploaded backup, but cannot read newer data still only on the phone.
- Adding a backend changes the local-only privacy model and requires agreement on authentication, recipient verification, encryption, retention, delivery failures, and provider limits/costs. This is not included until approved.

### Monthly backup reminder
- Show a non-blocking "Time to back up" banner on Home when there is no user-confirmed external backup, or one calendar month has elapsed since the last confirmation. Clamp month-end dates to the last valid day of the following month.
- Check when the app opens or returns to the foreground. An overdue reminder remains visible until a backup is confirmed; it does not interrupt a workout.
- Provide "Export full backup" and, after export/share, "I saved or sent this backup". Only explicit confirmation advances the monthly reminder date; cancelling a share or merely generating a file does not.
- The reminder is in-app only, not a notification while the app is closed. No push service, scheduled email, or server is required.

## Phases

| # | Phase | Deliverable |
|---|---|---|
| 1 | Setup | Vite/React/TS project, PWA manifest + icons, service worker, Dexie DB, router, bottom tab navigation, mobile-first styling (safe-area insets, large touch targets) |
| 2 | Library | Exercise CRUD with photo capture/resize; Routine CRUD with ordered items |
| 3 | Workout | Start routine → snapshot → any-order set ticking, add/delete sets, add exercise, timers, finish/resume |
| 4 | History & stats | Session list/detail/edit, manual entry, weekly/monthly aggregates and averages |
| 5 | Backup | Versioned full ZIP export (data, photos, app build, source, restore instructions); validated atomic data import; Files/Mail sharing; monthly in-app reminder based on confirmed external backup |
| 6 | Deploy | GitHub Pages build via GitHub Actions; publish/cache matching app/source release archive for full backups; install on iPhone; offline test |

## Testing
- Unit tests (Vitest) for: routine → session snapshot, status calculation, weekly/monthly aggregation, full ZIP export/import round-trip including photos; rejection of invalid/incompatible backups without changing existing data; explicit failure when the matching app release archive is unavailable.
- Backup reminder tests: no confirmed backup, before/at the monthly due date, month-end/leap-year boundaries, and cancelled/unconfirmed export not resetting the reminder.
- Manual checks on the iPhone: install to home screen, airplane-mode use, camera/photo picker, timer across screen lock, data persistence after closing the app, full backup sharing to Files/Mail, and offline full export after release caching.
- Recovery check: redeploy the archived app build to a fresh HTTPS location and import its backup; verify exercises, routines, photos, history, and in-progress workouts.

## Out of scope (for now)
Cloud/Google Drive sync, rest timer, per-exercise progress charts, notifications, Android/desktop support, multiple users.
