export interface WorkoutSet {
  w: number
  r: number
  done?: boolean
  warmup?: boolean
  phase?: string
  rir?: number
  sec?: number
  dist?: number
}

export interface MuscleSnapshot {
  n?: string
  bp?: string
  muscleWeights?: Record<string, number>
  primaries?: string[]
  secondaries?: string[]
  muscleGroups?: string[]
}

export interface ExerciseCatalogItem {
  id: string
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  muscleGroups: string[]
}

export interface WorkoutEntry {
  id: string
  sets: WorkoutSet[]
  topW?: number
  target?: {
    id?: string
    sets?: number
    reps?: number
    weight?: number
  }
  muscleSnapshot?: MuscleSnapshot
}

export interface Workout {
  id: string
  d: string
  start: number
  end: number
  routineId?: string
  name: string
  bw?: number | null
  entries: WorkoutEntry[]
  prs?: string[]
  vol?: number
}

export interface RoutineExercise {
  id: string
  sets?: number
  reps?: number
  weight?: number
  mode?: string
}

export interface Routine {
  id: string
  name: string
  ex: RoutineExercise[]
}

export interface CustomExercise {
  id: string
  n: string
  bp?: string
  muscleGroups?: string[]
  primaries?: string[]
  secondaries?: string[]
  eq?: string
  custom?: boolean
}

export interface OpenGymBackup {
  unit: string
  routines: Routine[]
  workouts: Workout[]
  customEx: CustomExercise[]
  exWeights?: Record<string, { w: number; d: string }>
  [key: string]: unknown
}

export type ClassificationSource =
  | 'manual'
  | 'catalogue'
  | 'snapshot'
  | 'custom'
  | 'routine'
  | 'unclassified'

export interface NormalizedSet {
  workoutId: string
  workoutDate: string
  workoutName: string
  routineId?: string
  exerciseId: string
  exerciseName: string
  setIndex: number
  weight: number
  reps: number
  done: boolean
  warmup: boolean
  rir?: number
  muscleGroups: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  classificationSource: ClassificationSource
}

export interface MuscleAnalytics {
  muscleGroup: string
  sets: number
  reps: number
  volume: number
  averageWeight: number
  exercises: number
}

export interface ExerciseAnalytics {
  exerciseId: string
  exerciseName: string
  muscleGroups: string[]
  sets: number
  reps: number
  volume: number
  averageWeight: number
  maxWeight: number
}

export interface TimelinePoint {
  date: string
  volume: number
  sets: number
  reps: number
  workoutNames: string[]
}
