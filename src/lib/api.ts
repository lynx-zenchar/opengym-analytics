import type { BodyMeasurementStore } from '../types/bodyMeasurements'
import type { OpenGymBackup } from '../types/opengym'

export async function fetchOpenGymState(
  file?: string,
): Promise<{
  file: string
  data: OpenGymBackup
}> {
  const query = file
    ? `?file=${encodeURIComponent(file)}`
    : ''

  const response =
    await fetch(
      `/api/opengym/state${query}`,
    )

  if (!response.ok) {
    throw new Error(
      await response.text(),
    )
  }

  return response.json()
}

export async function fetchOpenGymStateFiles(): Promise<{
  directory: string
  files: string[]
  latest: string | null
}> {
  const response =
    await fetch(
      '/api/opengym/state-files',
    )

  if (!response.ok) {
    throw new Error(
      await response.text(),
    )
  }

  return response.json()
}

export async function fetchBodyMeasurements(): Promise<BodyMeasurementStore> {
  const response =
    await fetch(
      '/api/body-measurements',
    )

  if (!response.ok) {
    throw new Error(
      await response.text(),
    )
  }

  return response.json()
}

export async function saveBodyMeasurements(
  store: BodyMeasurementStore,
): Promise<BodyMeasurementStore> {
  const response =
    await fetch(
      '/api/body-measurements',
      {
        method: 'PUT',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(store),
      },
    )

  if (!response.ok) {
    throw new Error(
      await response.text(),
    )
  }

  return response.json()
}
