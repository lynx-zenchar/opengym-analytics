import type {
  CustomExercise,
  ExerciseCatalogItem,
  MuscleAnalytics,
  NormalizedSet,
  OpenGymBackup,
  TimelinePoint,
  ExerciseAnalytics,
} from '../types/opengym'

// Add entries here when you want to override OpenGym's metadata or classify an
// otherwise-unclassified historical exercise. Keys are the OpenGym exercise IDs.
export const MANUAL_EXERCISE_METADATA: Record<string, {
  name?: string
  muscleGroups: string[]
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
}> = {
  // Example:
  // '0620': {
  //   name: 'Back Squat',
  //   muscleGroups: ['quadriceps', 'gluteal'],
  //   primaryMuscles: ['quadriceps'],
  //   secondaryMuscles: ['gluteal'],
  // },
}

const normalizeGroup = (value: string) => value.trim().toLowerCase()

function normalizeGroups(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map(normalizeGroup)
        .filter(Boolean),
    ),
  ]
}

function firstNonEmptyGroups(
  ...candidates: Array<string[] | undefined>
): string[] {
  for (const candidate of candidates) {
    const groups = normalizeGroups(candidate)

    if (groups.length > 0) {
      return groups
    }
  }

  return []
}

function firstNonEmptyString(
  ...candidates: Array<string | undefined>
): string | undefined {
  return candidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )?.trim()
}

function customMap(customExercises: CustomExercise[]) {
  return new Map(
    customExercises.map((exercise) => [
      String(exercise.id),
      exercise,
    ]),
  )
}

function routineFallback(workoutName: string): string[] {
  const n = workoutName.toLowerCase()

  if (n.includes('chest')) return ['chest']
  if (n.includes('shoulder')) return ['shoulders']
  if (n.includes('push')) return ['chest', 'triceps', 'shoulders']
  if (n.includes('back')) return ['back']
  if (n.includes('pull')) return ['back', 'biceps']
  if (n.includes('quad')) return ['quadriceps']
  if (n.includes('glute')) return ['gluteal']
  if (n.includes('leg')) return ['legs']
  if (n.includes('full body')) return ['full body']

  return []
}

function getClassificationSource(args: {
  manualGroups: string[]
  catalogGroups: string[]
  snapshotGroups: string[]
  customGroups: string[]
  fallbackGroups: string[]
}): NormalizedSet['classificationSource'] {
  if (args.manualGroups.length > 0) return 'manual'
  if (args.catalogGroups.length > 0) return 'catalogue'
  if (args.snapshotGroups.length > 0) return 'snapshot'
  if (args.customGroups.length > 0) return 'custom'
  if (args.fallbackGroups.length > 0) return 'routine'

  return 'unclassified'
}

export function normalizeWorkouts(
  data: OpenGymBackup,
  includeWarmups: boolean,
  catalogById: ReadonlyMap<string, ExerciseCatalogItem> = new Map(),
): NormalizedSet[] {
  const customs = customMap(data.customEx ?? [])
  const output: NormalizedSet[] = []

  for (const workout of data.workouts ?? []) {
    for (const entry of workout.entries ?? []) {
      const exerciseId = String(entry.id)
      const manual = MANUAL_EXERCISE_METADATA[exerciseId]
      const catalog = catalogById.get(exerciseId)
      const custom = customs.get(exerciseId)
      const snapshot = entry.muscleSnapshot

      const exerciseName =
        firstNonEmptyString(
          manual?.name,
          catalog?.name,
          snapshot?.n,
          custom?.n,
        ) ?? `Exercise ${exerciseId}`

      const manualGroups = normalizeGroups(manual?.muscleGroups)
      const catalogGroups = normalizeGroups(catalog?.muscleGroups)
      const snapshotGroups = normalizeGroups(snapshot?.muscleGroups)
      const customGroups = normalizeGroups(custom?.muscleGroups)

      const manualPrimary = normalizeGroups(manual?.primaryMuscles)
      const catalogPrimary = normalizeGroups(catalog?.primaryMuscles)
      const snapshotPrimary = normalizeGroups(snapshot?.primaries)
      const customPrimary = normalizeGroups(custom?.primaries)

      const manualSecondary = normalizeGroups(manual?.secondaryMuscles)
      const catalogSecondary = normalizeGroups(catalog?.secondaryMuscles)
      const snapshotSecondary = normalizeGroups(snapshot?.secondaries)
      const customSecondary = normalizeGroups(custom?.secondaries)

      let muscleGroups = firstNonEmptyGroups(
        manualGroups,
        catalogGroups,
        snapshotGroups,
        customGroups,
      )

      let primaryMuscles = firstNonEmptyGroups(
        manualPrimary,
        catalogPrimary,
        snapshotPrimary,
        customPrimary,
      )

      let secondaryMuscles = firstNonEmptyGroups(
        manualSecondary,
        catalogSecondary,
        snapshotSecondary,
        customSecondary,
      )

      let fallbackGroups: string[] = []

      if (muscleGroups.length === 0) {
        fallbackGroups = routineFallback(workout.name)

        if (fallbackGroups.length > 0) {
          muscleGroups = [...fallbackGroups]

          // Use the routine fallback as primary classification only if
          // no more specific primary-muscle metadata was available.
          if (primaryMuscles.length === 0) {
            primaryMuscles = [...fallbackGroups]
          }
        }
      }

      const classificationSource = getClassificationSource({
        manualGroups,
        catalogGroups,
        snapshotGroups,
        customGroups,
        fallbackGroups,
      })

      entry.sets.forEach((set, index) => {
        const warmup = Boolean(
          set.warmup || set.phase === 'warmup',
        )

        if (!includeWarmups && warmup) return
        if (set.done === false) return

        output.push({
          workoutId: workout.id,
          workoutDate: workout.d,
          workoutName: workout.name,
          routineId: workout.routineId,
          exerciseId,
          exerciseName,
          setIndex: index,
          weight: Number(set.w ?? 0),
          reps: Number(set.r ?? 0),
          done: true,
          warmup,
          rir: set.rir,
          muscleGroups,
          primaryMuscles,
          secondaryMuscles,
          classificationSource,
        })
      })
    }
  }

  return output
}

export function filterByDate(
  sets: NormalizedSet[],
  startDate?: string,
  endDate?: string,
) {
  return sets.filter(
    (set) =>
      (!startDate || set.workoutDate >= startDate) &&
      (!endDate || set.workoutDate <= endDate),
  )
}

export function getMuscleAnalytics(
  sets: NormalizedSet[],
): MuscleAnalytics[] {
  const groups = new Map<string, NormalizedSet[]>()

  for (const set of sets) {
    for (const group of set.muscleGroups) {
      const list = groups.get(group) ?? []
      list.push(set)
      groups.set(group, list)
    }
  }

  return [...groups.entries()]
    .map(([muscleGroup, groupSets]) => ({
      muscleGroup,
      sets: groupSets.length,
      reps: groupSets.reduce((sum, set) => sum + set.reps, 0),
      volume: groupSets.reduce(
        (sum, set) => sum + set.weight * set.reps,
        0,
      ),
      averageWeight: groupSets.length
        ? groupSets.reduce((sum, set) => sum + set.weight, 0) /
          groupSets.length
        : 0,
      exercises: new Set(
        groupSets.map((set) => set.exerciseId),
      ).size,
    }))
    .sort((a, b) => b.volume - a.volume)
}

export function getExerciseAnalytics(
  sets: NormalizedSet[],
  selectedMuscle?: string,
): ExerciseAnalytics[] {
  const filtered = selectedMuscle
    ? sets.filter((set) => set.muscleGroups.includes(selectedMuscle))
    : sets

  const groups = new Map<string, NormalizedSet[]>()

  for (const set of filtered) {
    const list = groups.get(set.exerciseId) ?? []
    list.push(set)
    groups.set(set.exerciseId, list)
  }

  return [...groups.entries()]
    .map(([exerciseId, exerciseSets]) => ({
      exerciseId,
      exerciseName: exerciseSets[0].exerciseName,
      muscleGroups: [
        ...new Set(
          exerciseSets.flatMap((set) => set.muscleGroups),
        ),
      ],
      sets: exerciseSets.length,
      reps: exerciseSets.reduce((sum, set) => sum + set.reps, 0),
      volume: exerciseSets.reduce(
        (sum, set) => sum + set.weight * set.reps,
        0,
      ),
      averageWeight: exerciseSets.length
        ? exerciseSets.reduce((sum, set) => sum + set.weight, 0) /
          exerciseSets.length
        : 0,
      maxWeight: Math.max(
        ...exerciseSets.map((set) => set.weight),
        0,
      ),
    }))
    .sort((a, b) => b.volume - a.volume)
}

export function getTimeline(
  sets: NormalizedSet[],
): TimelinePoint[] {
  const days = new Map<string, NormalizedSet[]>()

  for (const set of sets) {
    const list = days.get(set.workoutDate) ?? []
    list.push(set)
    days.set(set.workoutDate, list)
  }

  return [...days.entries()]
    .map(([date, daySets]) => ({
      date,
      volume: daySets.reduce(
        (sum, set) => sum + set.weight * set.reps,
        0,
      ),
      sets: daySets.length,
      reps: daySets.reduce((sum, set) => sum + set.reps, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getClassificationStats(sets: NormalizedSet[]) {
  const counts = new Map<string, number>()

  for (const set of sets) {
    counts.set(
      set.classificationSource,
      (counts.get(set.classificationSource) ?? 0) + 1,
    )
  }

  return Object.fromEntries(counts)
}
