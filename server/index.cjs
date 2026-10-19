const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const PORT = Number(process.env.PORT || 3001)

const OPENGYM_DATA_DIR =
  process.env.OPENGYM_DATA_DIR || '/opt/opengym/data'

const EXERCISE_CATALOG_FILE =
  process.env.OPENGYM_EXERCISE_CATALOG_FILE ||
  '/opt/opengym/frontend/src/lib/exercises-data.js'

const BODY_FILE =
  process.env.BODY_MEASUREMENTS_FILE ||
  path.join(__dirname, 'body-measurements.json')

const DEFAULT_BODY_DATA = {
  measurements: [],
}

let exerciseCatalogCache = null
let exerciseCatalogCacheTime = 0

const EXERCISE_CATALOG_CACHE_MS = 60_000

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== null) {
      return fallback
    }

    throw error
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })

  await fs.writeFile(
    file,
    JSON.stringify(value, null, 2) + '\n',
    'utf8',
  )
}

function normalizeMuscle(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : ''
}

function normalizeMuscleList(values) {
  if (!Array.isArray(values)) {
    return []
  }

  return [
    ...new Set(
      values
        .map(normalizeMuscle)
        .filter(Boolean),
    ),
  ]
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}


function toCatalogItem(exercise) {
  const id = exercise?.id

  if (id === undefined || id === null) {
    return null
  }

  // Use "tg" as the canonical target muscle group.
  const targetMuscles = normalizeMuscleList(
    typeof exercise.tg === 'string'
      ? [exercise.tg]
      : Array.isArray(exercise.tg)
        ? exercise.tg
        : [],
  )

  // Preserve the catalogue's other muscle metadata for reference.
  const primaryMuscles = normalizeMuscleList(
    typeof exercise.mg === 'string'
      ? [exercise.mg]
      : Array.isArray(exercise.mg)
        ? exercise.mg
        : [],
  )

  const secondaryMuscles = normalizeMuscleList(
    Array.isArray(exercise.sm) ? exercise.sm : [],
  )

  return {
    id: String(id),
    name: asString(exercise.n) || `Exercise ${id}`,
    primaryMuscles: targetMuscles,
    secondaryMuscles,
    muscleGroups: targetMuscles,
  }
}

async function getExerciseCatalog() {
  const now = Date.now()

  if (
    exerciseCatalogCache &&
    now - exerciseCatalogCacheTime < EXERCISE_CATALOG_CACHE_MS
  ) {
    return exerciseCatalogCache
  }

  const fileUrl = pathToFileURL(EXERCISE_CATALOG_FILE).href

  // Import the ES module containing the EXDB exercise catalogue.
  // The query parameter allows the module to be reloaded after the
  // cache expires, instead of always reusing Node's module cache.
  const moduleUrl = new URL(fileUrl)
  moduleUrl.searchParams.set('catalogReload', String(now))

  const exerciseModule = await import(moduleUrl.href)
  const exerciseData = exerciseModule.EXDB

  if (!Array.isArray(exerciseData)) {
    throw new Error(
      `Expected EXDB to be an array exported by ${EXERCISE_CATALOG_FILE}.`,
    )
  }

  const catalog = exerciseData
    .map(toCatalogItem)
    .filter(Boolean)

  exerciseCatalogCache = catalog
  exerciseCatalogCacheTime = now

  return catalog
}

async function getStateFiles() {
  const entries = await fs.readdir(
    OPENGYM_DATA_DIR,
    { withFileTypes: true },
  )

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^state-.*\.json$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort()
}

async function getLatestStateFile() {
  const files = await getStateFiles()

  if (!files.length) {
    return null
  }

  const stats = await Promise.all(
    files.map(async (name) => ({
      name,
      stat: await fs.stat(
        path.join(OPENGYM_DATA_DIR, name),
      ),
    })),
  )

  stats.sort(
    (a, b) => b.stat.mtimeMs - a.stat.mtimeMs,
  )

  return stats[0].name
}

async function readBody(req) {
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length

    if (size > 20 * 1024 * 1024) {
      throw new Error('Request body exceeds 20 MB.')
    }

    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods':
      'GET,POST,PUT,OPTIONS',
  })

  res.end(body)
}

function sendError(res, status, message) {
  sendJson(res, status, {
    error: message,
  })
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods':
        'GET,POST,PUT,OPTIONS',
    })

    return res.end()
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host || 'localhost'}`,
  )

  try {
    /*
     * Health check
     */
    if (
      req.method === 'GET' &&
      url.pathname === '/api/health'
    ) {
      return sendJson(res, 200, {
        ok: true,
      })
    }

    /*
     * Exercise catalogue.
     *
     * Each item contains the exercise ID, name, primary muscles,
     * secondary muscles, and the combined muscle groups used by
     * the analytics frontend.
     */
    if (
      req.method === 'GET' &&
      url.pathname === '/api/exercise-catalog'
    ) {
      const exercises = await getExerciseCatalog()

      return sendJson(res, 200, {
        count: exercises.length,
        exercises,
      })
    }

    /*
     * List all OpenGym state files.
     */
    if (
      req.method === 'GET' &&
      url.pathname === '/api/opengym/state-files'
    ) {
      const files = await getStateFiles()

      const latest =
        files.length
          ? await getLatestStateFile()
          : null

      return sendJson(res, 200, {
        directory: OPENGYM_DATA_DIR,
        files,
        latest,
      })
    }

    /*
     * Load one OpenGym state file.
     *
     * If ?file= is omitted, load the newest state-*.json file.
     */
    if (
      req.method === 'GET' &&
      url.pathname === '/api/opengym/state'
    ) {
      const requested =
        url.searchParams.get('file')

      const file =
        requested ||
        await getLatestStateFile()

      if (!file) {
        return sendError(
          res,
          404,
          `No state-*.json files found in ${OPENGYM_DATA_DIR}.`,
        )
      }

      if (
        !/^state-.*\.json$/i.test(file) ||
        path.basename(file) !== file
      ) {
        return sendError(
          res,
          400,
          'Invalid state file name.',
        )
      }

      const fullPath = path.join(
        OPENGYM_DATA_DIR,
        file,
      )

      const data = await readJson(fullPath)

      return sendJson(res, 200, {
        file,
        data,
      })
    }

    /*
     * Read persistent body measurements.
     */
    if (
      req.method === 'GET' &&
      url.pathname === '/api/body-measurements'
    ) {
      const data = await readJson(
        BODY_FILE,
        DEFAULT_BODY_DATA,
      )

      return sendJson(res, 200, data)
    }

    /*
     * Replace persistent body measurements.
     */
    if (
      req.method === 'PUT' &&
      url.pathname === '/api/body-measurements'
    ) {
      const raw = await readBody(req)
      const payload = JSON.parse(raw)

      if (
        !payload ||
        !Array.isArray(payload.measurements)
      ) {
        return sendError(
          res,
          400,
          'Body measurements payload must contain a measurements array.',
        )
      }

      await writeJson(BODY_FILE, payload)

      return sendJson(res, 200, payload)
    }

    return sendError(res, 404, 'Not found.')
  } catch (error) {
    console.error(error)

    return sendError(
      res,
      500,
      error.message || 'Internal server error.',
    )
  }
}

http
  .createServer(handle)
  .listen(PORT, () => {
    console.log(
      `OpenGym API running on http://localhost:${PORT}`,
    )

    console.log(
      `OpenGym state directory: ${OPENGYM_DATA_DIR}`,
    )

    console.log(
      `OpenGym exercise catalogue: ${EXERCISE_CATALOG_FILE}`,
    )

    console.log(
      `Body measurements file: ${BODY_FILE}`,
    )
  })
