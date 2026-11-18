# Training Tracker

An offline-first, iPhone-oriented training tracker. Training data is stored in this browser on this device; there is no account or cloud sync.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## GitHub Pages and iPhone installation

- Personal repository: [baierbrunnconsulting-max/training-tracker](https://github.com/baierbrunnconsulting-max/training-tracker).
- Site address: [Training Tracker](https://baierbrunnconsulting-max.github.io/training-tracker/).
- The GitHub Actions workflow builds with Node.js 24 and publishes on pushes to `main`. In the repository's **Settings > Pages**, the publishing source must be **GitHub Actions**. Deployment uses GitHub's built-in workflow token; do not add a personal token to the repository.
- On the iPhone, open the site in Safari, then choose **Share > Add to Home Screen**. Open the new icon online once before testing in airplane mode.
- The source and website are public. Exercises, photos, and workout records stay in the browser's local storage; publishing the app does not upload those records.
- The iPhone starts with an empty database. Localhost/PC data is separate and does not transfer automatically. Keep the site address stable to retain access to its local data.

## Current functionality

- Create and edit exercises tracked by repetitions or time, with an optional weight (kg), notes and an optional photo. A single photo picker offers Take Photo or Photo Library on iPhone; camera behavior still needs a real-device check. The kg value is shown in the library, routine summaries and workouts, and is snapshotted into each workout.
- Create and edit ordered routines, including adding/removing/reordering exercises and changing planned sets and reps/seconds. Edits preserve IDs and do not change existing workout snapshots.
- Start routine-based or free workouts, tick sets in any order, edit actual values, add/remove sets, add exercises, and resume an in-progress session.
- Deleting an exercise, routine, routine item, workout set or photo asks "Are you sure?" first.
- Time-based sets use a persisted start timestamp so elapsed time remains accurate after the app is backgrounded.
- Every set has a completion checkbox, including timed exercises: tick it without running the timer to record the displayed actual value (the target by default). Ticking a running set stops its timer without replacing the displayed actual value. The separate Time/Stop control remains available for measured durations.
- The History tab shows a stacked bar chart of finished workouts per week, month, or year, with one colour per routine (free workouts in grey) and a legend with totals. Tap a bar to see its breakdown. Tap routine chips above the chart to hide/show routines (Show all / Hide all); the filter is remembered on this device. Routine names are snapshots, so editing library entries does not rewrite history.
- Installable PWA shell with offline app assets.

Data export/import, history editing/manual entry, statistics, the monthly backup reminder, and release/recovery packaging are not implemented yet. Until backup is added, clearing this site's browser data can remove saved exercises and workouts.
