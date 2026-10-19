# OpenGym Analytics

Standalone React + Vite + TypeScript dashboard for analyzing an OpenGym backup JSON file.

## Requirements

- Node.js 20+ recommended
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Using another OpenGym backup

Replace:

`src/data/opengym-backup.json`

with another compatible OpenGym backup, then restart the dev server.

## Muscle metadata

The backup does not contain complete muscle metadata for all historical entries. The app uses this priority order:

1. Manual metadata in `src/lib/analytics.ts`
2. Historical `muscleSnapshot`
3. Custom exercise metadata from the backup
4. Broad routine-name fallback such as Push, Pull, Legs, Chest, or Back
5. Unclassified

To classify a historical exercise precisely, add its OpenGym exercise ID to `MANUAL_EXERCISE_METADATA` in `src/lib/analytics.ts`.

Example:

```ts
'0620': {
  name: 'Back Squat',
  muscleGroups: ['quadriceps', 'gluteal'],
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: ['gluteal'],
},
```

## Important analytics behavior

- Performed sets only: sets with `done: false` are excluded.
- Warm-ups are excluded by default and can be enabled with the checkbox.
- Volume is calculated as `weight × reps`.
- Average weight is the arithmetic mean of performed-set weight.
- If an exercise has multiple muscle groups, its set volume contributes to each group. This is intentional for the first version and should be replaced by weighted muscle attribution if you want muscle-specific volume rather than exercise volume by group.
