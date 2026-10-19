import type {
  BodyMeasurement,
  ReevesRow,
} from '../types/bodyMeasurements'

function average(
  values: Array<number | null>,
) {
  const valid = values.filter(
    (value): value is number =>
      typeof value === 'number' &&
      Number.isFinite(value),
  )

  return valid.length
    ? valid.reduce(
        (sum, value) => sum + value,
        0,
      ) / valid.length
    : null
}

function round(
  value: number | null,
  decimals = 2,
) {
  if (value == null) {
    return null
  }

  const factor = 10 ** decimals

  return (
    Math.round(value * factor) /
    factor
  )
}

export function calculateReevesRows(
  measurement: BodyMeasurement | null,
): ReevesRow[] {
  if (!measurement) {
    return [
      'Arms',
      'Calves',
      'Neck',
      'Chest',
      'Waist',
      'Thighs',
    ].map((bodyPart) => ({
      bodyPart:
        bodyPart as ReevesRow['bodyPart'],
      current: null,
      ideal: null,
      difference: null,
      deviationPercent: null,
    }))
  }

  const armCurrent = average([
    measurement.leftArm,
    measurement.rightArm,
  ])

  const calfCurrent = average([
    measurement.leftCalf,
    measurement.rightCalf,
  ])

  const thighCurrent = average([
    measurement.leftThigh,
    measurement.rightThigh,
  ])

  /*
   * These formulas are taken directly
   * from the supplied workbook.
   */

  const wristAverage = average([
    measurement.leftWrist,
    measurement.rightWrist,
  ])

  const ankleAverage = average([
    measurement.leftAnkle,
    measurement.rightAnkle,
  ])

  const idealArm =
    wristAverage == null
      ? null
      : wristAverage * 2.52

  const idealCalf =
    ankleAverage == null
      ? null
      : ankleAverage * 1.92

  const idealNeck =
    measurement.head == null
      ? null
      : measurement.head * 0.79

  const idealChest =
    measurement.pelvis == null
      ? null
      : measurement.pelvis * 1.48

  const idealWaist =
    measurement.pelvis == null
      ? null
      : measurement.pelvis * 0.86

  const idealThigh =
    measurement.knee == null
      ? null
      : measurement.knee * 1.75

  const rows: Array<
    [
      ReevesRow['bodyPart'],
      number | null,
      number | null,
    ]
  > = [
    [
      'Arms',
      armCurrent,
      idealArm,
    ],
    [
      'Calves',
      calfCurrent,
      idealCalf,
    ],
    [
      'Neck',
      measurement.neck,
      idealNeck,
    ],
    [
      'Chest',
      measurement.chest,
      idealChest,
    ],
    [
      'Waist',
      measurement.waist,
      idealWaist,
    ],
    [
      'Thighs',
      thighCurrent,
      idealThigh,
    ],
  ]

  return rows.map(
    ([bodyPart, current, ideal]) => ({
      bodyPart,

      current: round(current),

      ideal: round(ideal),

      difference:
        current == null ||
        ideal == null
          ? null
          : round(ideal - current),

      deviationPercent:
        current == null ||
        ideal == null ||
        ideal === 0
          ? null
          : round(
              ((current - ideal) /
                ideal) *
                100,
              1,
            ),
    }),
  )
}

export function getLatestMeasurement(
  measurements: BodyMeasurement[],
) {
  return [...measurements]
    .sort((a, b) =>
      `${b.date}-${b.week}`.localeCompare(
        `${a.date}-${a.week}`,
      ),
    )[0] ?? null
}

export function emptyMeasurement(
  week = 1,
  date = new Date()
    .toISOString()
    .slice(0, 10),
): BodyMeasurement {
  return {
    week,
    date,

    leftArm: null,
    rightArm: null,

    leftCalf: null,
    rightCalf: null,

    neck: null,

    leftThigh: null,
    rightThigh: null,

    chest: null,
    waist: null,

    leftWrist: null,
    rightWrist: null,

    leftAnkle: null,
    rightAnkle: null,

    head: null,
    pelvis: null,
    knee: null,
  }
}
