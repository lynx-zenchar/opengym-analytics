export interface BodyMeasurement {
  week: number
  date: string

  leftArm: number | null
  rightArm: number | null

  leftCalf: number | null
  rightCalf: number | null

  neck: number | null

  leftThigh: number | null
  rightThigh: number | null

  chest: number | null
  waist: number | null

  leftWrist: number | null
  rightWrist: number | null

  leftAnkle: number | null
  rightAnkle: number | null

  head: number | null
  pelvis: number | null
  knee: number | null
}

export interface BodyMeasurementStore {
  measurements: BodyMeasurement[]
}

export interface ReevesRow {
  bodyPart:
    | 'Arms'
    | 'Calves'
    | 'Neck'
    | 'Chest'
    | 'Waist'
    | 'Thighs'

  current: number | null
  ideal: number | null
  difference: number | null
  deviationPercent: number | null
}
