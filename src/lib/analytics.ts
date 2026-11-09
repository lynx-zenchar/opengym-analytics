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

export type MuscleHierarchyKey =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'glutes'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves'
  | 'adductors'
  | 'hip flexors'
  | 'neck'

export interface MuscleHierarchySubgroup {
  key: string
  label: string
}

export interface MuscleHierarchyGroup {
  key: MuscleHierarchyKey
  label: string
  aggregateKey: string
  subgroups: MuscleHierarchySubgroup[]
}

export const MUSCLE_HIERARCHY: MuscleHierarchyGroup[] = [
  {
    key: 'chest',
    label: 'Chest',
    aggregateKey: 'chest',
    subgroups: [
      { key: 'upper pecs', label: 'Upper Pecs' },
      { key: 'mid pecs', label: 'Mid pecs' },
      { key: 'lower pecs', label: 'Lower Pecs' },
    ],
  },
  {
    key: 'back',
    label: 'Back',
    aggregateKey: 'back',
    subgroups: [
      { key: 'trapezius', label: 'Trapezius' },
      { key: 'latissimus dorsi', label: 'Latissimus dorsi' },
      { key: 'levator scapulae', label: 'Levator scapulae' },
      { key: 'rhomboids', label: 'Rhomboids (major & minor)' },
      { key: 'erector spinae', label: 'Erector spinae' },
    ],
  },
  {
    key: 'shoulders',
    label: 'Shoulders',
    aggregateKey: 'shoulders',
    subgroups: [
      { key: 'anterior deltoids', label: 'Anterior deltoids' },
      { key: 'lateral deltoids', label: 'Lateral deltoids' },
      { key: 'posterior deltoids', label: 'Posterior deltoids' },
    ],
  },
  {
    key: 'biceps',
    label: 'Biceps',
    aggregateKey: 'biceps',
    subgroups: [
      { key: 'biceps brachii', label: 'Biceps brachii' },
    ],
  },
  {
    key: 'triceps',
    label: 'Triceps',
    aggregateKey: 'triceps',
    subgroups: [
      { key: 'long head', label: 'Long head' },
      { key: 'lateral head', label: 'Lateral head' },
      { key: 'medial head', label: 'Medial head' },
    ],
  },
  {
    key: 'forearms',
    label: 'Forearms',
    aggregateKey: 'forearms',
    subgroups: [
      { key: 'wrist flexors', label: 'Wrist flexors' },
      { key: 'wrist extensors', label: 'Wrist extensors' },
      { key: 'brachialis', label: 'Brachialis' },
      { key: 'brachioradialis', label: 'Brachioradialis' },
    ],
  },
  {
    key: 'core',
    label: 'Core',
    aggregateKey: 'core',
    subgroups: [
      { key: 'rectus abdominis', label: 'Rectus abdominis' },
      { key: 'obliques', label: 'Obliques' },
      { key: 'transverse abdominis', label: 'Transverse abdominis' },
    ],
  },
  {
    key: 'glutes',
    label: 'Glutes',
    aggregateKey: 'glutes',
    subgroups: [],
  },
  {
    key: 'quadriceps',
    label: 'Quadriceps',
    aggregateKey: 'quadriceps',
    subgroups: [],
  },
  {
    key: 'hamstrings',
    label: 'Hamstrings',
    aggregateKey: 'hamstrings',
    subgroups: [],
  },
  {
    key: 'calves',
    label: 'Calves',
    aggregateKey: 'calves',
    subgroups: [],
  },
  {
    key: 'adductors',
    label: 'Adductors',
    aggregateKey: 'adductors',
    subgroups: [
      { key: 'adductor magnus', label: 'Adductor magnus' },
      { key: 'adductor longus', label: 'Longus' },
      { key: 'adductor brevis', label: 'Brevis' },
      { key: 'gracilis', label: 'Gracilis' },
    ],
  },
  {
    key: 'hip flexors',
    label: 'Hip flexors',
    aggregateKey: 'hip flexors',
    subgroups: [
      { key: 'iliopsoas', label: 'Iliopsoas' },
      { key: 'rectus femoris', label: 'Rectus femoris' },
    ],
  },
  {
    key: 'neck',
    label: 'Neck',
    aggregateKey: 'neck',
    subgroups: [
      { key: 'neck flexors', label: 'Neck flexors' },
      { key: 'neck extensors', label: 'Neck extensors' },
    ],
  },
]

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

export interface HierarchicalExerciseEntry {
  exerciseId: string
  exerciseName: string
  sets: number
  reps: number
  volume: number
  averageWeight: number
  maxWeight: number
}

export interface HierarchicalMuscleAnalytics {
  muscleKey: MuscleHierarchyKey
  label: string
  aggregateAverageWeight: number | null
  volume: number
  sets: number
  reps: number
  totalExercises: number
  topExercises: HierarchicalExerciseEntry[]
}

interface ResolvedMuscleKey {
  parent: MuscleHierarchyKey
  subgroupKey: string | null
}

const EXDB_SUBGROUP_SYNONYMS: Record<
  string,
  { parent: MuscleHierarchyKey; subgroup: string }
> = {
  // Synonyms used by the EXDB catalogue (tg/mg/sm strings) that
  // correspond exactly to a named subgroup.
  'lats': { parent: 'back', subgroup: 'latissimus dorsi' },
  'traps': { parent: 'back', subgroup: 'trapezius' },
  'lower back': { parent: 'back', subgroup: 'erector spinae' },
}

/*
 * Catching logic: normalizeWorkouts never invents subgroup strings, but the
 * data sources use several spellings for the same muscle ("pectorals",
 * "pecs", "chest", "delts", "deltoids", ...). Substring probes below catch
 * those variants and route them to the correct parent/subgroup.
 */
function resolveMuscleKeyForGroup(
  normalizedGroup: string,
): ResolvedMuscleKey | null {
  const g = normalizedGroup

  // Chest: catches "pectorals", "pectoralis", "pecs", "chest", ...
  if (g.includes('pec') || g.includes('chest')) {
    if (g.includes('upper')) return { parent: 'chest', subgroupKey: 'upper pecs' }
    if (g.includes('lower')) return { parent: 'chest', subgroupKey: 'lower pecs' }
    if (g.includes('mid') || g.includes('middle')) {
      return { parent: 'chest', subgroupKey: 'mid pecs' }
    }
    return { parent: 'chest', subgroupKey: null }
  }

  // Shoulders: catches "delts", "deltoids", "deltoid", ...
  if (g.includes('delt')) {
    if (g.includes('anterior') || g.includes('front')) {
      return { parent: 'shoulders', subgroupKey: 'anterior deltoids' }
    }
    if (g.includes('lateral') || g.includes('side')) {
      return { parent: 'shoulders', subgroupKey: 'lateral deltoids' }
    }
    if (g.includes('posterior') || g.includes('rear')) {
      return { parent: 'shoulders', subgroupKey: 'posterior deltoids' }
    }
    return { parent: 'shoulders', subgroupKey: null }
  }
  if (g.includes('shoulder')) {
    return { parent: 'shoulders', subgroupKey: null }
  }

  // Synonyms explicitly requested
  if (g === 'glutes' || g === 'gluteal') {
    return { parent: 'glutes', subgroupKey: null }
  }
  if (g === 'quadriceps' || g === 'quads') {
    return { parent: 'quadriceps', subgroupKey: null }
  }
  if (g === 'hamstrings' || g === 'hamstring') {
    return { parent: 'hamstrings', subgroupKey: null }
  }
  // "biceps" (EXDB tg) treated as biceps brachii, the only biceps subgroup
  if (g === 'biceps') {
    return { parent: 'biceps', subgroupKey: 'biceps brachii' }
  }
  // "abs" (EXDB tg) feeds the core parent aggregate per request
  if (g === 'abs' || g === 'abdominals') {
    return { parent: 'core', subgroupKey: null }
  }

  const synonym = EXDB_SUBGROUP_SYNONYMS[g]
  if (synonym) {
    return { parent: synonym.parent, subgroupKey: synonym.subgroup }
  }

  for (const group of MUSCLE_HIERARCHY) {
    for (const subgroup of group.subgroups) {
      if (subgroup.key === g) {
        return { parent: group.key, subgroupKey: subgroup.key }
      }
    }
    if (group.aggregateKey === g || group.key === g) {
      return { parent: group.key, subgroupKey: null }
    }
  }
  return null
}

export function getHierarchicalMuscleAnalytics(
  sets: NormalizedSet[],
): HierarchicalMuscleAnalytics[] {
  /*
   * Per (parent, exercise): max weight plus the set of resolution marks
   * ("direct" or a subgroup key) it hit. The aggregate average counts an
   * exercise once per mark, so an exercise hitting multiple subgroups of
   * the same parent contributes multiple times.
   */
  const parentExerciseTrack = new Map<
    MuscleHierarchyKey,
    Map<string, {
      max: number
      name: string
      marks: Set<string>
      sets: number
      reps: number
      volume: number
      weightSum: number
    }>
  >()
  const parentVolume = new Map<MuscleHierarchyKey, number>()
  const parentSets = new Map<MuscleHierarchyKey, number>()
  const parentReps = new Map<MuscleHierarchyKey, number>()

  for (const set of sets) {
    if (!Number.isFinite(set.weight)) continue
    const volume = set.weight * set.reps

    // Guard so a set resolved to the same parent through several of its
    // group strings (e.g. 'chest' and 'upper pecs') only counts once.
    const resolvedParentsThisSet = new Set<MuscleHierarchyKey>()

    for (const group of set.muscleGroups) {
      const resolved = resolveMuscleKeyForGroup(normalizeGroup(group))
      if (!resolved) continue

      const parent = resolved.parent

      if (!parentExerciseTrack.has(parent)) {
        parentExerciseTrack.set(parent, new Map())
      }
      const exercises = parentExerciseTrack.get(parent)!

      const tracked = exercises.get(set.exerciseId) ?? {
        max: -Infinity,
        name: set.exerciseName,
        marks: new Set<string>(),
        sets: 0,
        reps: 0,
        volume: 0,
        weightSum: 0,
      }
      const mark = resolved.subgroupKey ?? '__direct__'
      tracked.marks.add(mark)
      tracked.name = set.exerciseName
      if (set.weight > tracked.max) tracked.max = set.weight
      exercises.set(set.exerciseId, tracked)

      if (!resolvedParentsThisSet.has(parent)) {
        resolvedParentsThisSet.add(parent)
        parentVolume.set(parent, (parentVolume.get(parent) ?? 0) + volume)
        parentSets.set(parent, (parentSets.get(parent) ?? 0) + 1)
        parentReps.set(parent, (parentReps.get(parent) ?? 0) + set.reps)

        // Per-exercise workload stats are counted once per set per parent.
        tracked.sets += 1
        tracked.reps += set.reps
        tracked.volume += volume
        tracked.weightSum += set.weight
        exercises.set(set.exerciseId, tracked)
      }
    }
  }

  return MUSCLE_HIERARCHY.map((hierarchy) => {
    const exercisesForParent = parentExerciseTrack.get(hierarchy.key) ?? new Map()

    const parentValues: number[] = []
    for (const tracked of exercisesForParent.values()) {
      if (!Number.isFinite(tracked.max)) continue
      for (let i = 0; i < tracked.marks.size; i++) {
        parentValues.push(tracked.max)
      }
    }

    let aggregateAverageWeight: number | null = null
    if (parentValues.length > 0) {
      aggregateAverageWeight =
        parentValues.reduce((sum, v) => sum + v, 0) / parentValues.length
    }

    const topExercises = [...exercisesForParent.entries()]
      .filter(([, tracked]) => Number.isFinite(tracked.max) && tracked.sets > 0)
      .sort(([, a], [, b]) => b.max - a.max || a.name.localeCompare(b.name))
      .slice(0, 7)
      .map(([exerciseId, tracked]) => ({
        exerciseId,
        exerciseName: tracked.name,
        sets: tracked.sets,
        reps: tracked.reps,
        volume: tracked.volume,
        averageWeight: tracked.sets
          ? tracked.weightSum / tracked.sets
          : 0,
        maxWeight: tracked.max,
      }))

    return {
      muscleKey: hierarchy.key,
      label: hierarchy.label,
      aggregateAverageWeight,
      volume: parentVolume.get(hierarchy.key) ?? 0,
      sets: parentSets.get(hierarchy.key) ?? 0,
      reps: parentReps.get(hierarchy.key) ?? 0,
      totalExercises: exercisesForParent.size,
      topExercises,
    }
  })
}

export interface WorkoutSession {
  workoutId: string
  workoutDate: string
  workoutName: string
  durationMinutes: number
}

export function getWorkoutSessions(
  data: OpenGymBackup,
): WorkoutSession[] {
  const sessions: WorkoutSession[] = []

  for (const workout of data.workouts ?? []) {
    const start = Number(workout.start)
    const end = Number(workout.end)

    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      continue
    }

    sessions.push({
      workoutId: workout.id,
      workoutDate: workout.d,
      workoutName: workout.name,
      durationMinutes: (end - start) / 60000,
    })
  }

  return sessions
}

export function filterSessionsByDate(
  sessions: WorkoutSession[],
  startDate?: string,
  endDate?: string,
) {
  return sessions.filter(
    (session) =>
      (!startDate || session.workoutDate >= startDate) &&
      (!endDate || session.workoutDate <= endDate),
  )
}

export interface SessionTimelinePoint {
  date: string
  totalMinutes: number
  sessionNames: string[]
}

export function getSessionTimeline(
  sessions: WorkoutSession[],
): SessionTimelinePoint[] {
  const days = new Map<
    string,
    { totalMinutes: number; sessionNames: string[] }
  >()

  for (const session of sessions) {
    if (!session.workoutDate) continue

    const day =
      days.get(session.workoutDate) ?? {
        totalMinutes: 0,
        sessionNames: [],
      }

    day.totalMinutes += session.durationMinutes

    if (!day.sessionNames.includes(session.workoutName)) {
      day.sessionNames.push(session.workoutName)
    }

    days.set(session.workoutDate, day)
  }

  return [...days.entries()]
    .map(([date, { totalMinutes, sessionNames }]) => ({
      date,
      totalMinutes,
      sessionNames,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
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
  const days = new Map<
    string,
    { volume: number; sets: number; reps: number; names: Set<string> }
  >()

  for (const set of sets) {
    const day =
      days.get(set.workoutDate) ?? {
        volume: 0,
        sets: 0,
        reps: 0,
        names: new Set<string>(),
      }

    day.volume += set.weight * set.reps
    day.sets += 1
    day.reps += set.reps

    if (set.workoutName) {
      day.names.add(set.workoutName)
    }

    days.set(set.workoutDate, day)
  }

  return [...days.entries()]
    .map(
      ([
        date,
        { volume, sets, reps, names },
      ]) => ({
        date,
        volume,
        sets,
        reps,
        workoutNames: [...names],
      }),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

/*
 * Routine-name grouping collapses the variations in which the same
 * routine family has been recorded over time ("Push Day 1
 * (chest-focused)", "Push Day 2 (Shoulder focused)", plain "Push",
 * "Day 1: Chest And Triceps", "Back and Biceps", ...) into one dynamic
 * key. It is applied at analytics time so newly created or renamed
 * routines are picked up without any configuration.
 *
 * Names are mapped by their muscle keywords rather than exact spelling:
 * a leading push/pull/upper-group keyword pins the family first, then
 * the first keyword family found in the name wins. Names without any
 * recognized family keyword (one-off labels such as "Midnight Workout",
 * "Evening Workout" or "Full Body Calisthenics" names) return '' and
 * are excluded from the per-routine charts.
 */
/*
 * Order matters: the first family whose keywords appear in a normalized
 * workout name claims it. Pull is checked before Legs so compound names
 * such as "Back and Biceps + Some Legs And Core" aggregate under Pull.
 */
const ROUTINE_FAMILIES: Array<[string, string[]]> = [
  ['push', ['push', 'chest', 'pec', 'triceps', 'shoulder', 'delt']],
  ['pull', ['pull', 'back', 'lats', 'biceps', 'rhomboid', 'trap']],
  ['legs', ['leg', 'quad', 'hamstring', 'glute', 'calf', 'calves', 'thigh']],
]

export function normalizeRoutineGroup(workoutName: string): string {
  let name = workoutName.toLowerCase()

  // Normalize the textual variations used between recorded sessions
  name = name.replace(/&/g, ' and ')
  name = name.replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, ' ')
  name = name.replace(/\+.*/, ' ')

  // "Day 1" / "Day 2" / ordinal numbering is not part of the group identity
  name = name.replace(/^day\s*\d*\s*:?\s*/, ' ')
  name = name.replace(/\bday\b/g, ' ')
  name = name.replace(/\bcopy\b/g, ' ')
  name = name.replace(/\d+/g, ' ')
  name = name.replace(/[^a-z ]/g, ' ')
  name = name.replace(/\s+/g, ' ').trim()

  if (!name) {
    return ''
  }

  // A leading routine keyword is the strongest signal
  const leading = name.match(/^(push|pull|legs?)\b/)

  if (leading) {
    return leading[1] === 'leg' ? 'legs' : leading[1]
  }

  for (const [family, keywords] of ROUTINE_FAMILIES) {
    if (keywords.some((keyword) => name.includes(keyword))) {
      return family
    }
  }

  return ''
}

export interface RoutineGroupStackPoint {
  date: string
  volume: number
  sessionMinutes: number
  workoutNames: string[]
}

/*
 * Merge a volume-per-date timeline with a session-length-per-date
 * timeline into one series so both can be drawn in the same chart,
 * independently of which routine group the data belongs to.
 */
export function buildStackedTimeline(
  volumeTimeline: TimelinePoint[],
  sessionTimeline: SessionTimelinePoint[],
): RoutineGroupStackPoint[] {
  const byDate = new Map<string, RoutineGroupStackPoint>()

  for (const point of volumeTimeline) {
    byDate.set(point.date, {
      date: point.date,
      volume: point.volume,
      sessionMinutes: 0,
      workoutNames: point.workoutNames,
    })
  }

  for (const point of sessionTimeline) {
    const existing = byDate.get(point.date)

    if (existing) {
      existing.sessionMinutes = point.totalMinutes
    } else {
      byDate.set(point.date, {
        date: point.date,
        volume: 0,
        sessionMinutes: point.totalMinutes,
        workoutNames: [],
      })
    }
  }

  return [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

export interface RoutineGroupTimeline {
  groupKey: string
  sessions: number
  totalVolume: number
  workoutNames: string[]
  stackedTimeline: RoutineGroupStackPoint[]
}

export function getRoutineGroupTimelines(
  baseSets: NormalizedSet[],
  filteredSets: NormalizedSet[],
  sessions: WorkoutSession[] = [],
  startDate?: string,
  endDate?: string,
): RoutineGroupTimeline[] {
  /*
   * Eligibility is determined on the full data set so a period filter
   * cannot temporarily hide an otherwise recurring routine. A group is
   * considered to be recurring when at least two distinct workout
   * sessions used it; one-off session names are excluded.
   */
  const baseSessions = new Map<string, Set<string>>()
  const baseNames = new Map<string, Map<string, number>>()

  for (const set of baseSets) {
    const key = normalizeRoutineGroup(set.workoutName)

    if (!key) continue

    const sessions = baseSessions.get(key) ?? new Set()

    sessions.add(set.workoutId)
    baseSessions.set(key, sessions)

    const names = baseNames.get(key) ?? new Map()

    names.set(set.workoutName, (names.get(set.workoutName) ?? 0) + 1)
    baseNames.set(key, names)
  }

  const recurringKeys = new Set(
    [...baseSessions.entries()]
      .filter(([, sessions]) => sessions.size >= 2)
      .map(([key]) => key),
  )

  const filteredGroups = new Map<string, NormalizedSet[]>()

  for (const set of filteredSets) {
    const key = normalizeRoutineGroup(set.workoutName)

    if (!key || !recurringKeys.has(key)) continue

    const sets = filteredGroups.get(key) ?? []

    sets.push(set)
    filteredGroups.set(key, sets)
  }

  return [...filteredGroups.entries()]
    .map(([groupKey, groupSets]) => {
      const sessionCount = new Set(
        groupSets.map((set) => set.workoutId),
      ).size

      /*
       * Session durations only exist per whole workout, so the session
       * length series aggregates every recorded session whose routine
       * name belongs to this group, with the same date filter applied.
       * Volume and session length are merged per date into one series so
       * they can be rendered in the same chart.
       */
      const groupSessions = sessions.filter(
        (session) =>
          Boolean(session.workoutName) &&
          normalizeRoutineGroup(session.workoutName) === groupKey,
      )

      return {
        groupKey,
        sessions: sessionCount,
        totalVolume: groupSets.reduce(
          (sum, set) => sum + set.weight * set.reps,
          0,
        ),
        workoutNames: [...(baseNames.get(groupKey) ?? new Map())]
          .sort(([, a], [, b]) => b - a)
          .map(([name]) => name),
        stackedTimeline: buildStackedTimeline(
          getTimeline(groupSets),
          getSessionTimeline(
            filterSessionsByDate(groupSessions, startDate, endDate),
          ),
        ),
      }
    })
    .sort((a, b) => b.totalVolume - a.totalVolume)
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
