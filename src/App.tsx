
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Field,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  SimpleGrid,
  Stat,
  Text,
} from '@chakra-ui/react'

import backup from './data/opengym-backup.json'

import {
  buildStackedTimeline,
  filterByDate,
  filterSessionsByDate,
  getClassificationStats,
  getHierarchicalMuscleAnalytics,
  getMuscleAnalytics,
  getRoutineGroupTimelines,
  getSessionTimeline,
  getTimeline,
  getWorkoutSessions,
  normalizeWorkouts,
} from './lib/analytics'

import {
  emptyMeasurement,
  calculateReevesRows,
  getLatestMeasurement,
} from './lib/bodyMeasurements'

import {
  fetchBodyMeasurements,
  fetchOpenGymState,
  fetchOpenGymStateFiles,
  saveBodyMeasurements,
} from './lib/api'

import {
  formatDuration,
  formatNumber,
  formatVolume,
  formatWeight,
  titleCase,
} from './lib/format'

import type {
  BodyMeasurement,
  BodyMeasurementStore,
} from './types/bodyMeasurements'

import type {
  ExerciseCatalogItem,
  OpenGymBackup,
} from './types/opengym'

import type {
  SessionTimelinePoint,
  RoutineGroupTimeline,
  RoutineGroupStackPoint,
} from './lib/analytics'

const FALLBACK_DATA = backup as OpenGymBackup

const PERIODS = [
  { label: 'All time', days: null },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last year', days: 365 },
]

const SESSION_PERIODS = [
  { label: 'Last Week', days: 7 },
  { label: 'Last Month', days: 30 },
  { label: 'Last Three Months', days: 90 },
  { label: 'All time', days: null },
]

const CHART_GREEN = '#30d158'
const CHART_GREEN_LIGHT = '#7ee79a'
const CHART_BLUE = '#0a84ff'
const CHART_TEXT = '#f5f5f7'
const CHART_GRID = '#3a3a3c'
const CHART_AXIS = '#8e8e93'

// One color per pie slice. Wraps around if there are more slices than colors.
const PIE_COLORS = [
  '#30d158',
  '#0a84ff',
  '#ff9f0a',
  '#bf5af2',
  '#ff453a',
  '#64d2ff',
  '#ffd60a',
  '#ff375f',
  '#ac8e68',
  '#5e5ce6',
]

const TOOLTIP_STYLE = {
  background: '#1c1c1e',
  border: '1px solid #3a3a3c',
  color: CHART_TEXT,
}

const AXIS_PROPS = {
  tick: { fill: CHART_TEXT },
  axisLine: { stroke: CHART_AXIS },
  tickLine: { stroke: CHART_AXIS },
}

/*
 * The OpenGym API normally runs on port 3001, alongside Vite on port 5173.
 * Using the current hostname also supports accessing the dashboard through
 * another device on the same network, rather than hard-coding localhost.
 */
const API_BASE_URL =
  `${window.location.protocol}//${window.location.hostname}:3001`

interface ExerciseCatalogResponse {
  count: number
  exercises: ExerciseCatalogItem[]
}

function isValidOpenGymData(value: unknown): value is OpenGymBackup {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<OpenGymBackup>

  return (
    Array.isArray(candidate.workouts) &&
    Array.isArray(candidate.routines) &&
    Array.isArray(candidate.customEx)
  )
}

function isExerciseCatalogResponse(
  value: unknown,
): value is ExerciseCatalogResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ExerciseCatalogResponse>

  return (
    Array.isArray(candidate.exercises) &&
    candidate.exercises.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        (typeof item.id === 'string' ||
          typeof item.id === 'number') &&
        typeof item.name === 'string' &&
        Array.isArray(item.primaryMuscles) &&
        Array.isArray(item.secondaryMuscles) &&
        Array.isArray(item.muscleGroups),
    )
  )
}

function App() {
  const [tab, setTab] = useState<'analytics' | 'body'>('analytics')

  const [data, setData] = useState<OpenGymBackup>(FALLBACK_DATA)
  const [dataSource, setDataSource] = useState('Bundled backup')

  const [stateFiles, setStateFiles] = useState<string[]>([])
  const [selectedStateFile, setSelectedStateFile] = useState('')

  const [dataError, setDataError] = useState('')

  // Exercise catalogue loaded from the OpenGym application.
  const [exerciseCatalog, setExerciseCatalog] = useState<
    ExerciseCatalogItem[]
  >([])
  const [catalogError, setCatalogError] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)

  const [period, setPeriod] = useState('All time')
  const [sessionPeriod, setSessionPeriod] = useState('Last Month')
  const [muscle, setMuscle] = useState('all')
  const [exercise, setExercise] = useState('all')
  const [includeWarmups, setIncludeWarmups] = useState(false)

  /*
   * Whether the blue session-length overlay (and its secondary axis) is
   * visible per chart. Keys are chart identifiers: 'master' for the main
   * Volume over time chart and the routine-group key for the PPL charts.
   */
  const [sessionOverlays, setSessionOverlays] = useState<
    Record<string, boolean>
  >({})

  function toggleSessionOverlay(chartKey: string) {
    setSessionOverlays((current) => ({
      ...current,
      [chartKey]: !current[chartKey],
    }))
  }

  const [bodyStore, setBodyStore] = useState<BodyMeasurementStore>({
    measurements: [],
  })

  const [bodyDraft, setBodyDraft] = useState<BodyMeasurement | null>(null)

  const [bodyStatus, setBodyStatus] = useState('')
  const [bodyLoading, setBodyLoading] = useState(true)

  /*
   * Convert the catalogue array into a map keyed by exercise ID.
   *
   * String conversion ensures the lookup still works if an ID is represented
   * as a number in one source and a string in another.
   */
  const catalogById = useMemo(() => {
    return new Map<string, ExerciseCatalogItem>(
      exerciseCatalog.map((item) => [String(item.id), item]),
    )
  }, [exerciseCatalog])

  /*
   * Load server data and the exercise catalogue after the initial bundled
   * backup has rendered. Failures leave usable fallback data in place.
   */
  useEffect(() => {
    let cancelled = false

    async function initialize() {
      await Promise.all([
        loadStateFiles(cancelled),
        loadLatestState(cancelled),
        loadBodyMeasurements(cancelled),
        loadExerciseCatalog(cancelled),
      ])
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [])

  async function loadExerciseCatalog(cancelled = false) {
    setCatalogLoading(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/exercise-catalog`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

      if (!response.ok) {
        throw new Error(
          `Exercise catalogue request failed: HTTP ${response.status}.`,
        )
      }

      const result: unknown = await response.json()

      if (!isExerciseCatalogResponse(result)) {
        throw new Error(
          'The server returned an invalid exercise catalogue.',
        )
      }

      if (cancelled) {
        return
      }

      setExerciseCatalog(result.exercises)
      setCatalogError('')

      console.info(
        `Loaded ${result.exercises.length} exercises from the OpenGym catalogue.`,
      )
    } catch (error) {
      if (cancelled) {
        return
      }

      console.error('Unable to load the OpenGym exercise catalogue:', error)

      setCatalogError(
        error instanceof Error
          ? `${error.message} Using workout snapshots and other available metadata.`
          : 'Unable to load the exercise catalogue. Using available workout metadata.',
      )
    } finally {
      if (!cancelled) {
        setCatalogLoading(false)
      }
    }
  }

  async function loadStateFiles(cancelled = false) {
    try {
      const result = await fetchOpenGymStateFiles()

      if (cancelled) {
        return
      }

      if (!result || !Array.isArray(result.files)) {
        throw new Error('The server returned an invalid state-file list.')
      }

      setStateFiles(result.files)
      setSelectedStateFile(result.latest ?? '')
    } catch (error) {
      if (cancelled) {
        return
      }

      console.error('Unable to load OpenGym state files:', error)

      setStateFiles([])
    }
  }

  async function loadLatestState(cancelled = false) {
    try {
      const result = await fetchOpenGymState()

      if (cancelled) {
        return
      }

      if (!result || !isValidOpenGymData(result.data)) {
        throw new Error(
          'The server returned an invalid OpenGym backup. Using the bundled backup instead.',
        )
      }

      setData(result.data)
      setDataSource(
        result.file
          ? `/opt/opengym/data/${result.file}`
          : 'Server OpenGym state',
      )

      setSelectedStateFile(result.file ?? '')
      setDataError('')
    } catch (error) {
      if (cancelled) {
        return
      }

      console.error('Unable to load server OpenGym state:', error)

      setData(FALLBACK_DATA)
      setDataSource('Bundled backup')

      setDataError(
        error instanceof Error
          ? `Using bundled backup. ${error.message}`
          : 'Using bundled backup because the server state could not be loaded.',
      )
    }
  }

  async function loadStateFile(file: string) {
    if (!file) {
      return
    }

    try {
      const result = await fetchOpenGymState(file)

      if (!result || !isValidOpenGymData(result.data)) {
        throw new Error(
          `State file "${file}" is not a valid OpenGym backup.`,
        )
      }

      setData(result.data)

      setDataSource(
        result.file
          ? `/opt/opengym/data/${result.file}`
          : `State file: ${file}`,
      )

      setSelectedStateFile(result.file ?? file)
      setDataError('')
    } catch (error) {
      console.error('Unable to load selected state file:', error)

      setDataError(
        error instanceof Error
          ? error.message
          : 'Unable to load the selected state file.',
      )
    }
  }

  async function loadBodyMeasurements(cancelled = false) {
    try {
      const store = await fetchBodyMeasurements()

      if (cancelled) {
        return
      }

      if (!store || !Array.isArray(store.measurements)) {
        throw new Error('The body-measurement server response is invalid.')
      }

      setBodyStore(store)

      const latest = getLatestMeasurement(store.measurements)

      setBodyDraft(latest ?? emptyMeasurement())
      setBodyStatus('')
    } catch (error) {
      if (cancelled) {
        return
      }

      console.error('Unable to load body measurements:', error)

      setBodyStatus(
        error instanceof Error
          ? error.message
          : 'Unable to load body measurements.',
      )

      setBodyDraft(emptyMeasurement())
    } finally {
      if (!cancelled) {
        setBodyLoading(false)
      }
    }
  }

  async function handleJsonUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)

      if (!isValidOpenGymData(parsed)) {
        throw new Error(
          'This does not look like a valid OpenGym backup JSON file.',
        )
      }

      setData(parsed)
      setDataSource(`Uploaded: ${file.name}`)
      setDataError('')
    } catch (error) {
      console.error('Unable to parse uploaded JSON:', error)

      setDataError(
        error instanceof Error
          ? error.message
          : 'Unable to parse JSON upload.',
      )
    }
  }

  /*
   * Normalize workout data using the exercise catalogue.
   *
   * normalizeWorkouts applies the metadata precedence defined in analytics.ts:
   * manual overrides, catalogue, snapshot, custom exercise, then routine
   * fallback. The catalogue map is a dependency so updated catalogue data
   * automatically triggers normalization.
   */
  const normalized = useMemo(() => {
    try {
      if (!isValidOpenGymData(data)) {
        return []
      }

      return normalizeWorkouts(
        data,
        includeWarmups,
        catalogById,
      )
    } catch (error) {
      console.error('Unable to normalize workout data:', error)

      return []
    }
  }, [data, includeWarmups, catalogById])

  const allDates = useMemo(
    () =>
      normalized
        .map((set) => set.workoutDate)
        .filter(Boolean)
        .sort(),
    [normalized],
  )

  const latestDate =
    allDates[allDates.length - 1] ??
    new Date().toISOString().slice(0, 10)

  const selectedPeriod =
    PERIODS.find((periodOption) => periodOption.label === period) ??
    PERIODS[0]

  const startDate =
    selectedPeriod.days == null
      ? undefined
      : new Date(`${latestDate}T12:00:00`).getTime() -
        selectedPeriod.days * 86400000

  const startDateString =
    startDate == null
      ? undefined
      : new Date(startDate).toISOString().slice(0, 10)

  const periodSets = useMemo(() => {
    try {
      return filterByDate(normalized, startDateString, latestDate)
    } catch (error) {
      console.error('Unable to filter workout data:', error)

      return []
    }
  }, [normalized, startDateString, latestDate])

  const muscles = useMemo(() => {
    try {
      return getMuscleAnalytics(periodSets)
    } catch (error) {
      console.error('Unable to calculate muscle analytics:', error)

      return []
    }
  }, [periodSets])

  const muscleOptions = muscles.map((item) => item.muscleGroup)

  const exerciseOptions = useMemo(() => {
    const source =
      muscle === 'all'
        ? periodSets
        : periodSets.filter((set) =>
            set.muscleGroups.includes(muscle),
          )

    return [
      ...new Map(
        source.map((set) => [set.exerciseId, set.exerciseName]),
      ).entries(),
    ]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [periodSets, muscle])

  const selectedExerciseSets =
    exercise === 'all'
      ? periodSets
      : periodSets.filter((set) => set.exerciseId === exercise)

  const timeline = useMemo(() => {
    try {
      return getTimeline(selectedExerciseSets)
    } catch (error) {
      console.error('Unable to calculate timeline:', error)

      return []
    }
  }, [selectedExerciseSets])

  const selectedExercise = exerciseOptions.find(
    (item) => item.id === exercise,
  )

  const classification = useMemo(() => {
    try {
      return getClassificationStats(periodSets)
    } catch (error) {
      console.error('Unable to calculate classification statistics:', error)

      return {
        unclassified: 0,
      }
    }
  }, [periodSets])

  const totalVolume = periodSets.reduce(
    (sum, set) => sum + set.weight * set.reps,
    0,
  )

  const totalReps = periodSets.reduce(
    (sum, set) => sum + set.reps,
    0,
  )

  const workoutCount = new Set(
    periodSets.map((set) => set.workoutId),
  ).size

  const unclassified = classification.unclassified ?? 0

  const hierarchicalMuscles = useMemo(() => {
    try {
      return getHierarchicalMuscleAnalytics(periodSets)
    } catch (error) {
      console.error('Unable to calculate hierarchical muscle analytics:', error)

      return []
    }
  }, [periodSets])

  const sessions = useMemo(() => {
    try {
      return getWorkoutSessions(data)
    } catch (error) {
      console.error('Unable to extract workout sessions:', error)

      return []
    }
  }, [data])

  const sessionTimeline = useMemo(() => {
    try {
      const filtered = filterSessionsByDate(
        sessions,
        startDateString,
        latestDate,
      )

      return getSessionTimeline(filtered)
    } catch (error) {
      console.error('Unable to build session timeline:', error)

      return []
    }
  }, [sessions, startDateString, latestDate])

  const masterStackedTimeline = useMemo(() => {
    try {
      return buildStackedTimeline(timeline, sessionTimeline)
    } catch (error) {
      console.error('Unable to merge session durations into timeline:', error)

      return []
    }
  }, [timeline, sessionTimeline])

  const routineGroups = useMemo(() => {
    try {
      return getRoutineGroupTimelines(
        normalized,
        selectedExerciseSets,
        sessions,
        startDateString,
        latestDate,
      )
    } catch (error) {
      console.error('Unable to build routine-group timelines:', error)

      return [] as RoutineGroupTimeline[]
    }
  }, [normalized, selectedExerciseSets, sessions, startDateString, latestDate])

  const selectedSessionPeriod =
    SESSION_PERIODS.find(
      (periodOption) => periodOption.label === sessionPeriod,
    ) ?? SESSION_PERIODS[SESSION_PERIODS.length - 1]

  const sessionPeriodStart =
    selectedSessionPeriod.days == null
      ? undefined
      : new Date(`${latestDate}T12:00:00`).getTime() -
        selectedSessionPeriod.days * 86400000

  const sessionPeriodStartString =
    sessionPeriodStart == null
      ? undefined
      : new Date(sessionPeriodStart).toISOString().slice(0, 10)

  const sessionSummary = useMemo(() => {
    const filtered = filterSessionsByDate(
      sessions,
      sessionPeriodStartString,
      latestDate,
    )

    if (filtered.length === 0) {
      return { count: 0, averageMinutes: null }
    }

    const totalMinutes = filtered.reduce(
      (sum, session) => sum + session.durationMinutes,
      0,
    )

    return {
      count: filtered.length,
      averageMinutes: totalMinutes / filtered.length,
    }
  }, [sessions, sessionPeriodStartString, latestDate])

  const latestBody =
    bodyDraft ?? getLatestMeasurement(bodyStore.measurements)

  const reevesRows = useMemo(
    () => calculateReevesRows(latestBody),
    [latestBody],
  )

  function updateBodyField<K extends keyof BodyMeasurement>(
    field: K,
    value: string,
  ) {
    setBodyDraft((current) => ({
      ...(current ?? emptyMeasurement()),
      [field]:
        field === 'date'
          ? value
          : value === ''
            ? null
            : Number(value),
    }))

    setBodyStatus('Unsaved changes')
  }

  function addMeasurement() {
    const nextWeek =
      Math.max(
        0,
        ...bodyStore.measurements.map((measurement) => measurement.week),
      ) + 1

    const next = emptyMeasurement(nextWeek)

    setBodyStore((current) => ({
      measurements: [...current.measurements, next],
    }))

    setBodyDraft(next)

    setBodyStatus('New measurement created. Enter values and save.')
  }

  async function saveBody() {
    if (!bodyDraft) {
      return
    }

    const measurements = [...bodyStore.measurements]

    const index = measurements.findIndex(
      (measurement) => measurement.week === bodyDraft.week,
    )

    if (index >= 0) {
      measurements[index] = bodyDraft
    } else {
      measurements.push(bodyDraft)
    }

    measurements.sort((a, b) => a.week - b.week)

    try {
      const saved = await saveBodyMeasurements({ measurements })

      setBodyStore(saved)
      setBodyDraft(getLatestMeasurement(saved.measurements))
      setBodyStatus('Saved to server/body-measurements.json')
    } catch (error) {
      console.error('Unable to save body measurements:', error)

      setBodyStatus(
        error instanceof Error
          ? error.message
          : 'Unable to save measurements.',
      )
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">OpenGym</div>

          <h1>Analytics</h1>

          <p className="subtitle">
            Training analytics and body-proportion tracking in one persistent
            dashboard.
          </p>
        </div>

        <div className="dataset-badge">
          {Array.isArray(data.workouts) ? data.workouts.length : 0} workouts
          loaded
        </div>
      </header>

      <nav className="tabs card">
        <button
          className={tab === 'analytics' ? 'active' : ''}
          onClick={() => setTab('analytics')}
        >
          Workout Analytics
        </button>

        <button
          className={tab === 'body' ? 'active' : ''}
          onClick={() => setTab('body')}
        >
          Body Measurements
        </button>
      </nav>

      {tab === 'analytics' ? (
        <>
          <Card.Root mb="4">
            <Card.Body>
              <Flex
                justify="space-between"
                align="center"
                gap="4"
                wrap="wrap"
              >
                <Box minW="0">
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    Workout data source
                  </Text>

                  <Text fontWeight="semibold" truncate>
                    {dataSource}
                  </Text>

                  <Text fontSize="xs" color="fg.muted" mt="1">
                    {catalogLoading
                      ? 'Loading exercise catalogue...'
                      : `${exerciseCatalog.length} catalogue exercises loaded`}
                  </Text>
                </Box>

                <HStack gap="3" wrap="wrap">
                  <NativeSelect.Root size="sm" w="260px">
                    <NativeSelect.Field
                      value={selectedStateFile}
                      onChange={(e) => void loadStateFile(e.target.value)}
                    >
                      <option value="">Server state files...</option>

                      {stateFiles.map((file) => (
                        <option key={file} value={file}>
                          {file}
                        </option>
                      ))}
                    </NativeSelect.Field>

                    <NativeSelect.Indicator />
                  </NativeSelect.Root>

                  <Button asChild size="sm" variant="outline">
                    <label>
                      Upload JSON
                      <input
                        type="file"
                        hidden
                        accept="application/json,.json"
                        onChange={handleJsonUpload}
                      />
                    </label>
                  </Button>
                </HStack>
              </Flex>
            </Card.Body>
          </Card.Root>

          {dataError && (
            <div className="error notice">{dataError}</div>
          )}

          {catalogError && (
            <div className="notice">
              <strong>Exercise catalogue:</strong> {catalogError}
            </div>
          )}

          <Card.Root mb="4">
            <Card.Body>
              <Flex gap="4" align="end" wrap="wrap">
                <Field.Root w={{ base: 'full', md: '200px' }}>
                  <Field.Label>Period</Field.Label>

                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      {PERIODS.map((p) => (
                        <option key={p.label}>{p.label}</option>
                      ))}
                    </NativeSelect.Field>

                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root w={{ base: 'full', md: '220px' }}>
                  <Field.Label>Muscle group</Field.Label>

                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={muscle}
                      onChange={(e) => {
                        setMuscle(e.target.value)
                        setExercise('all')
                      }}
                    >
                      <option value="all">All muscle groups</option>

                      {muscleOptions.map((item) => (
                        <option key={item} value={item}>
                          {titleCase(item)}
                        </option>
                      ))}
                    </NativeSelect.Field>

                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root w={{ base: 'full', md: '280px' }}>
                  <Field.Label>Exercise</Field.Label>

                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={exercise}
                      onChange={(e) => setExercise(e.target.value)}
                    >
                      <option value="all">All exercises</option>

                      {exerciseOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </NativeSelect.Field>

                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <Checkbox.Root
                  colorPalette="green"
                  checked={includeWarmups}
                  onCheckedChange={(d) =>
                    setIncludeWarmups(d.checked === true)
                  }
                  pb="2"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>Include warm-ups</Checkbox.Label>
                </Checkbox.Root>
              </Flex>
            </Card.Body>
          </Card.Root>

          {unclassified > 0 && (
            <div className="notice">
              <strong>{formatNumber(unclassified)} sets</strong> do not have
              exercise-level muscle metadata.
            </div>
          )}

          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="4" mb="5">
            <Metric
              title="Total volume"
              value={formatVolume(totalVolume)}
              detail="weight × reps"
            />

            <Metric
              title="Working sets"
              value={formatNumber(periodSets.length)}
              detail={
                includeWarmups ? 'including warm-ups' : 'warm-ups excluded'
              }
            />

            <Metric
              title="Total reps"
              value={formatNumber(totalReps)}
              detail={`${workoutCount} workouts`}
            />

            <Card.Root>
              <Card.Body>
                <Stat.Root>
                  <Stat.Label>Average Workout session length</Stat.Label>
                  <Stat.ValueText>
                    {sessionSummary.averageMinutes == null
                      ? '-'
                      : formatDuration(sessionSummary.averageMinutes)}
                  </Stat.ValueText>
                  <Stat.HelpText>
                    {sessionSummary.count === 0
                      ? 'no sessions'
                      : `${formatNumber(sessionSummary.count)} session${
                          sessionSummary.count === 1 ? '' : 's'
                        }`}
                  </Stat.HelpText>
                </Stat.Root>

                <NativeSelect.Root size="sm" mt="2" w="full">
                  <NativeSelect.Field
                    value={sessionPeriod}
                    onChange={(e) => setSessionPeriod(e.target.value)}
                  >
                    {SESSION_PERIODS.map((periodOption) => (
                      <option key={periodOption.label}>
                        {periodOption.label}
                      </option>
                    ))}
                  </NativeSelect.Field>

                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

          <Box mb="6">
            <Box
              borderTop="1px solid"
              borderColor="border"
              my="4"
            />
            <Heading size="md" mb="3">
              Average max weight by muscle group
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
              {hierarchicalMuscles.map((group) => (
                <Card.Root key={group.muscleKey}>
                  <Card.Body>
                    <Box mb="2">
                      <Text fontWeight="semibold" textTransform="capitalize">
                        {group.label}
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        Aggregated average max weight across all muscle subgroups
                      </Text>
                      <Text fontSize="lg" fontWeight="semibold" mt="1">
                        {group.aggregateAverageWeight == null
                          ? '-'
                          : formatWeight(group.aggregateAverageWeight)}
                      </Text>
                    </Box>
                    {group.topExercises.length === 0 ? (
                      <Text fontSize="sm" color="fg.muted">-</Text>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Exercise</th>
                              <th>Sets</th>
                              <th>Reps</th>
                              <th>Volume</th>
                              <th>Avg</th>
                              <th>Max</th>
                            </tr>
                          </thead>

                          <tbody>
                            {group.topExercises.map((exercise) => (
                              <tr key={exercise.exerciseId}>
                                <td>
                                  <strong>{exercise.exerciseName}</strong>
                                </td>

                                <td>{formatNumber(exercise.sets)}</td>
                                <td>{formatNumber(exercise.reps)}</td>
                                <td>{formatVolume(exercise.volume)}</td>
                                <td>{formatWeight(exercise.averageWeight)}</td>
                                <td>{formatWeight(exercise.maxWeight)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <Text fontSize="sm" color="fg.muted" mt="2">
                      {formatNumber(group.totalExercises)} distinct exercise
                      {group.totalExercises === 1 ? '' : 's'} tried for{' '}
                      {group.label.toLowerCase()}
                    </Text>
                  </Card.Body>
                </Card.Root>
              ))}
            </SimpleGrid>
          </Box>

          <section className="chart-grid">
            <ChartCard
              title="Volume by muscle group"
              subtitle="Total performed volume in pounds, aggregated by muscle group"
            >
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={[...hierarchicalMuscles]
                    .sort((a, b) => b.volume - a.volume)
                    .slice(0, 12)}
                  layout="vertical"
                  margin={{ left: 20, right: 24 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    horizontal={false}
                  />

                  <XAxis
                    type="number"
                    tickFormatter={(value) =>
                      `${Math.round(Number(value) / 1000)}k`
                    }
                    {...AXIS_PROPS}
                  />

                  <YAxis
                    type="category"
                    dataKey="label"
                    width={95}
                    tickFormatter={titleCase}
                    {...AXIS_PROPS}
                  />

                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => formatVolume(Number(value))}
                    labelFormatter={(value) => titleCase(String(value))}
                  />

                  <Bar
                    dataKey="volume"
                    fill={CHART_GREEN}
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Average maximum working weight"
              subtitle="Aggregated mean of exercise maximum weights by muscle group, highest to lowest"
            >
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={[...hierarchicalMuscles]
                    .filter((group) => group.aggregateAverageWeight != null)
                    .sort((a, b) =>
                      (b.aggregateAverageWeight ?? 0) -
                      (a.aggregateAverageWeight ?? 0))
                    .slice(0, 12)}
                  margin={{ left: 4, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    tickFormatter={titleCase}
                    angle={-28}
                    textAnchor="end"
                    height={70}
                    interval={0}
                    {...AXIS_PROPS}
                  />

                  <YAxis
                    tickFormatter={(value) => `${value} lb`}
                    {...AXIS_PROPS}
                  />

                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => formatWeight(Number(value))}
                    labelFormatter={(value) => titleCase(String(value))}
                  />

                  <Bar
                    dataKey="aggregateAverageWeight"
                    fill={CHART_GREEN}
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="chart-grid">
            <ChartCard
              title="Sets and reps by muscle group"
              subtitle="Training workload distribution, aggregated by muscle group"
            >
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={[...hierarchicalMuscles]
                    .sort((a, b) => b.volume - a.volume)
                    .slice(0, 10)}
                  margin={{ left: 0, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    tickFormatter={titleCase}
                    angle={-28}
                    textAnchor="end"
                    height={70}
                    interval={0}
                    {...AXIS_PROPS}
                  />

                  <YAxis {...AXIS_PROPS} />

                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => formatNumber(Number(value))}
                    labelFormatter={(value) => titleCase(String(value))}
                  />

                  <Legend wrapperStyle={{ color: CHART_TEXT }} />

                  <Bar
                    dataKey="sets"
                    name="Sets"
                    fill={CHART_GREEN}
                    radius={[5, 5, 0, 0]}
                  />

                  <Bar
                    dataKey="reps"
                    name="Reps"
                    fill={CHART_GREEN_LIGHT}
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title={
                exercise === 'all'
                  ? sessionOverlays.master
                    ? 'Volume and session length over time'
                    : 'Volume over time'
                  : `${
                      sessionOverlays.master
                    ? 'Volume and session length'
                    : 'Volume'
                  } for ${selectedExercise?.name ?? 'Exercise'}`
              }
              subtitle="Performed volume by workout date"
              action={
                <SessionLengthToggle
                  shown={Boolean(sessionOverlays.master)}
                  onToggle={() => toggleSessionOverlay('master')}
                />
              }
            >
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart
                  data={masterStackedTimeline}
                  margin={{ left: 0, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => String(value).slice(5)}
                    {...AXIS_PROPS}
                  />

                  <YAxis
                    yAxisId="volume"
                    tickFormatter={(value) =>
                      `${Math.round(Number(value) / 1000)}k`
                    }
                    {...AXIS_PROPS}
                  />

                  {sessionOverlays.master && (
                    <YAxis
                      yAxisId="minutes"
                      orientation="right"
                      tickFormatter={(value) =>
                        `${Math.round(Number(value))} min`
                      }
                      {...AXIS_PROPS}
                    />
                  )}

                  {sessionOverlays.master && (
                    <Area
                      dataKey="sessionMinutes"
                      name="Session length (min)"
                      yAxisId="minutes"
                      type="monotone"
                      stroke={CHART_BLUE}
                      fill={CHART_BLUE}
                      fillOpacity={0.35}
                      strokeWidth={2}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="volume"
                    name="Volume"
                    yAxisId="volume"
                    stroke={CHART_GREEN}
                    strokeWidth={2.5}
                    dot={false}
                  />

                  <Tooltip
                    content={
                      <StackedTooltip showSession={sessionOverlays.master} />
                    }
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <Box mb="6">
            <Heading size="md" mb="2">
              Volume over time by routine
            </Heading>

            <Text fontSize="sm" color="fg.muted" mb="4">
              One chart per recurring routine family, with a Show session
              length button that toggles the blue recorded session time
              (min, right axis) on top of the green volume (lb, left axis).
              Recorded names are aggregated by their muscle keywords: Push
              Day 1, Push Day 2 and Chest And Triceps all count as Push;
              Pull Day 1, Pull Day 2 and Back And Biceps all count as Pull.
              One-off session names such as Midnight Workout, Evening
              Workout and Full Body Calisthenics are excluded.
            </Text>

            <section className="chart-grid">
              {routineGroups.map((group) => {
                const overlayKey = `routine-${group.groupKey}`
                const showSession = Boolean(sessionOverlays[overlayKey])

                return (
                  <ChartCard
                    key={group.groupKey}
                    title={
                      showSession
                        ? `${titleCase(group.groupKey)} volume & session length`
                        : `${titleCase(group.groupKey)} volume`
                    }
                    subtitle={`Aggregates: ${group.workoutNames.join(', ')}`}
                    action={
                      <SessionLengthToggle
                        shown={showSession}
                        onToggle={() => toggleSessionOverlay(overlayKey)}
                      />
                    }
                  >
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart
                        data={group.stackedTimeline}
                        margin={{ left: 0, right: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={CHART_GRID}
                          vertical={false}
                        />

                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => String(value).slice(5)}
                          {...AXIS_PROPS}
                        />

                        <YAxis
                          yAxisId="volume"
                          tickFormatter={(value) =>
                            `${Math.round(Number(value) / 1000)}k`
                          }
                          {...AXIS_PROPS}
                        />

                        {showSession && (
                          <YAxis
                            yAxisId="minutes"
                            orientation="right"
                            tickFormatter={(value) =>
                              `${Math.round(Number(value))} min`
                            }
                            {...AXIS_PROPS}
                          />
                        )}

                        {showSession && (
                          <Area
                            dataKey="sessionMinutes"
                            name="Session length (min)"
                            yAxisId="minutes"
                            type="monotone"
                            stroke={CHART_BLUE}
                            fill={CHART_BLUE}
                            fillOpacity={0.35}
                            strokeWidth={2}
                          />
                        )}

                        <Line
                          type="monotone"
                          dataKey="volume"
                          name="Volume"
                          yAxisId="volume"
                          stroke={CHART_GREEN}
                          strokeWidth={2.5}
                          dot={false}
                        />

                        <Tooltip
                          content={
                            <StackedTooltip showSession={showSession} />
                          }
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )
              })}
            </section>
          </Box>

          <section className="lower-grid">
            <ChartCard
              title="Muscle-group distribution"
              subtitle="Share of performed volume, aggregated by muscle group"
            >
              <ResponsiveContainer width="100%" height={500}>
                <PieChart>
                  <Pie
                    data={[...hierarchicalMuscles]
                      .filter((group) => group.volume > 0)
                      .sort((a, b) => b.volume - a.volume)
                      .slice(0, 10)}
                    dataKey="volume"
                    nameKey="label"
                    cx="50%"
                    cy="45%"
                    outerRadius={145}
                    stroke="#1c1c1e"
                    label={({ x, y, textAnchor, name }) => (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        fill={CHART_TEXT}
                        fontSize={12}
                      >
                        {titleCase(String(name))}
                      </text>
                    )}
                  >
                    {[...hierarchicalMuscles]
                      .filter((group) => group.volume > 0)
                      .sort((a, b) => b.volume - a.volume)
                      .slice(0, 10)
                      .map((item, index) => (
                        <Cell
                          key={item.muscleKey}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                  </Pie>

                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => formatVolume(Number(value))}
                  />

                  <Legend wrapperStyle={{ color: CHART_TEXT }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Workout session length"
              subtitle="Duration of each workout session by date"
            >
              <ResponsiveContainer width="100%" height={500}>
                <LineChart
                  data={sessionTimeline}
                  margin={{ left: 0, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => String(value).slice(5)}
                    {...AXIS_PROPS}
                  />

                  <YAxis
                    tickFormatter={(value) => `${Math.round(Number(value))} min`}
                    {...AXIS_PROPS}
                  />

                  <Tooltip content={<SessionTooltip />} />

                  <Line
                    type="monotone"
                    dataKey="totalMinutes"
                    name="Session length"
                    stroke={CHART_GREEN}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <footer>
            <span>Source: {dataSource}</span>

            <span>
              Muscle-group metrics show the equal-weighted mean of each
              associated exercise’s maximum working weight.
            </span>
          </footer>
        </>
      ) : (
        <BodyMeasurementsView
          measurements={bodyStore.measurements}
          draft={bodyDraft}
          loading={bodyLoading}
          status={bodyStatus}
          rows={reevesRows}
          onChange={updateBodyField}
          onAdd={addMeasurement}
          onSave={() => void saveBody()}
          onSelect={(week) => {
            const selected = bodyStore.measurements.find(
              (measurement) => measurement.week === week,
            )

            if (selected) {
              setBodyDraft(selected)
              setBodyStatus('')
            }
          }}
        />
      )}
    </main>
  )
}

function Metric({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <Card.Root>
      <Card.Body>
        <Stat.Root>
          <Stat.Label>{title}</Stat.Label>
          <Stat.ValueText>{value}</Stat.ValueText>
          <Stat.HelpText>{detail}</Stat.HelpText>
        </Stat.Root>
      </Card.Body>
    </Card.Root>
  )
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="chart-card card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {action && <div className="card-action">{action}</div>}
      </div>

      {children}
    </div>
  )
}

function SessionLengthToggle({
  shown,
  onToggle,
}: {
  shown: boolean
  onToggle: () => void
}) {
  return (
    <Button
      size="xs"
      colorPalette="green"
      variant={shown ? 'solid' : 'outline'}
      onClick={onToggle}
    >
      {shown ? 'Hide session length' : 'Show session length'}
    </Button>
  )
}

function SessionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: unknown }>
}) {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0].payload as SessionTimelinePoint | undefined

  if (!point) return null

  return (
    <div style={TOOLTIP_STYLE} className="custom-tooltip">
      <strong>{point.date}</strong>

      {point.sessionNames.length > 0 && (
        <div>{point.sessionNames.join(', ')}</div>
      )}

      <div>{formatDuration(point.totalMinutes)}</div>
    </div>
  )
}

function StackedTooltip({
  active,
  payload,
  showSession = true,
}: {
  active?: boolean
  payload?: Array<{ payload?: unknown }>
  showSession?: boolean
}) {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0].payload as RoutineGroupStackPoint | undefined

  if (!point) return null

  return (
    <div style={TOOLTIP_STYLE} className="custom-tooltip">
      <strong>{point.date}</strong>

      <div>Volume: {formatVolume(point.volume)}</div>

      {showSession && point.sessionMinutes > 0 && (
        <div>Session length: {formatDuration(point.sessionMinutes)}</div>
      )}

      {point.workoutNames.length > 0 && (
        <div>{point.workoutNames.join(', ')}</div>
      )}
    </div>
  )
}

function BodyMeasurementsView({
  measurements,
  draft,
  loading,
  status,
  rows,
  onChange,
  onAdd,
  onSave,
  onSelect,
}: {
  measurements: BodyMeasurement[]
  draft: BodyMeasurement | null
  loading: boolean
  status: string
  rows: ReturnType<typeof calculateReevesRows>
  onChange: <K extends keyof BodyMeasurement>(
    field: K,
    value: string,
  ) => void
  onAdd: () => void
  onSave: () => void
  onSelect: (week: number) => void
}) {
  const fields: Array<{
    key: keyof BodyMeasurement
    label: string
  }> = [
    { key: 'leftArm', label: 'Left Arm' },
    { key: 'rightArm', label: 'Right Arm' },
    { key: 'leftCalf', label: 'Left Calf' },
    { key: 'rightCalf', label: 'Right Calf' },
    { key: 'neck', label: 'Neck' },
    { key: 'leftThigh', label: 'Left Thigh' },
    { key: 'rightThigh', label: 'Right Thigh' },
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'leftWrist', label: 'Left Wrist' },
    { key: 'rightWrist', label: 'Right Wrist' },
    { key: 'leftAnkle', label: 'Left Ankle' },
    { key: 'rightAnkle', label: 'Right Ankle' },
    { key: 'head', label: 'Head' },
    { key: 'pelvis', label: 'Pelvis' },
    { key: 'knee', label: 'Knee' },
  ]

  return (
    <>
      <Card.Root mb="4">
        <Card.Body>
          <Flex
            justify="space-between"
            align={{ base: 'stretch', md: 'center' }}
            direction={{ base: 'column', md: 'row' }}
            gap="4"
          >
            <Box>
              <Text
                fontSize="xs"
                color="green.400"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Body Measurements
              </Text>

              <Heading size="lg">Weekly measurements</Heading>

              <Text color="fg.muted" fontSize="sm">
                Persistent JSON storage with Reeves ideals recalculated
                automatically from the current measurements.
              </Text>
            </Box>

            <HStack gap="3" wrap="wrap">
              <NativeSelect.Root size="sm" w="220px">
                <NativeSelect.Field
                  value={draft?.week ?? ''}
                  onChange={(e) => onSelect(Number(e.target.value))}
                >
                  <option value="">Select week</option>

                  {measurements.map((m) => (
                    <option key={m.week} value={m.week}>
                      Week {m.week} · {m.date}
                    </option>
                  ))}
                </NativeSelect.Field>

                <NativeSelect.Indicator />
              </NativeSelect.Root>

              <Button size="sm" variant="outline" onClick={onAdd}>
                New week
              </Button>

              <Button
                size="sm"
                colorPalette="green"
                onClick={onSave}
                disabled={!draft || loading}
              >
                Save
              </Button>
            </HStack>
          </Flex>
        </Card.Body>
      </Card.Root>

      {status && <div className="notice">{status}</div>}

      {loading ? (
        <div className="card loading">Loading measurements...</div>
      ) : (
        draft && (
          <>
            <section className="body-form card">
              <div className="form-meta">
                <label>
                  Week
                  <input
                    type="number"
                    value={draft.week}
                    onChange={(event) =>
                      onChange('week', event.target.value)
                    }
                  />
                </label>

                <label>
                  Date
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) =>
                      onChange('date', event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="measurement-grid">
                {fields.map(({ key, label }) => (
                  <label key={key}>
                    {label} (in)
                    <input
                      type="number"
                      step="0.01"
                      value={draft[key] ?? ''}
                      onChange={(event) =>
                        onChange(key, event.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="card reeves-card">
              <div className="card-heading">
                <div>
                  <h2>Reeves ideal proportions</h2>

                  <p>
                    Current values and ideals are calculated from the selected
                    week&apos;s measurements.
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="reeves-table">
                  <thead>
                    <tr>
                      <th>Body part</th>
                      <th>Current</th>
                      <th>Reeves ideal</th>
                      <th>Difference</th>
                      <th>% deviation</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.bodyPart}>
                        <td>
                          <strong>{row.bodyPart}</strong>
                        </td>

                        <td>{formatInches(row.current)}</td>
                        <td>{formatInches(row.ideal)}</td>

                        <td className={deviationClass(row.deviationPercent)}>
                          {formatDifference(row.difference)}
                        </td>

                        <td className={deviationClass(row.deviationPercent)}>
                          {formatPercent(row.deviationPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card formula-card">
              <h2>Formula source</h2>

              <ul>
                <li>Arms = average left/right wrist × 2.52</li>
                <li>Calves = average left/right ankle × 1.92</li>
                <li>Neck = head × 0.79</li>
                <li>Chest = pelvis × 1.48</li>
                <li>Waist = pelvis × 0.86</li>
                <li>Thighs = knee × 1.75</li>
              </ul>

              <p>
                Difference = Reeves ideal − current. % deviation = (current −
                Reeves ideal) ÷ Reeves ideal × 100.
              </p>
            </section>
          </>
        )
      )}
    </>
  )
}

function formatInches(value: number | null) {
  return value == null ? '-' : `${value.toFixed(2)}"`
}

function formatDifference(value: number | null) {
  return value == null
    ? '-'
    : `${value >= 0 ? '+' : ''}${value.toFixed(2)}" needed`
}

function formatPercent(value: number | null) {
  return value == null
    ? '-'
    : `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`
}

/*
 * Color bands shared by the Difference and % deviation cells:
 * below ideal: yellow (0 to -10%), red (beyond -10%)
 * above ideal: light blue (0 to +10%), teal (beyond +10%)
 */
function deviationClass(pct: number | null) {
  if (pct == null) return ''
  if (pct < -10) return 'dev-red'
  if (pct < 0) return 'dev-yellow'
  if (pct > 10) return 'dev-teal'
  if (pct > 0) return 'dev-lightblue'
  return ''
}

export default App

