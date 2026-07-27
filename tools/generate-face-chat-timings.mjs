import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { env, pipeline } from '@huggingface/transformers'
import ffmpegPath from 'ffmpeg-static'

const TOOL_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_DIRECTORY = path.resolve(TOOL_DIRECTORY, '..')
const CLIP_DIRECTORY = path.join(PROJECT_DIRECTORY, 'src', 'features', 'faceChat', 'clips')
const OUTPUT_PATH = path.join(
  PROJECT_DIRECTORY,
  'src',
  'features',
  'faceChat',
  'transcriptTimings.json',
)
const SAMPLE_RATE = 16_000
const MINIMUM_WORD_DURATION_MS = 40
const DEFAULT_MODEL = 'Xenova/whisper-tiny.en'

const argumentsByName = new Map(
  process.argv.slice(2).map((argument) => {
    const [name, ...valueParts] = argument.replace(/^--/, '').split('=')
    return [name, valueParts.join('=') || true]
  }),
)
const selectedClipIds = String(argumentsByName.get('clip') ?? '')
  .split(',')
  .map((clipId) => clipId.trim())
  .filter(Boolean)
const modelId = String(argumentsByName.get('model') ?? DEFAULT_MODEL)

env.cacheDir = path.join(PROJECT_DIRECTORY, '.cache', 'huggingface')
env.allowLocalModels = false

function normalizeWord(value) {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
}

function tokenizeReference(text) {
  return [...text.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    normalized: normalizeWord(match[0]),
    startChar: match.index,
    endChar: match.index + match[0].length,
  }))
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }

    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function substitutionCost(left, right) {
  if (left === right) return 0
  if (!left || !right) return 1
  return editDistance(left, right) / Math.max(left.length, right.length)
}

function alignWordSequences(referenceWords, recognizedWords) {
  const rowCount = referenceWords.length + 1
  const columnCount = recognizedWords.length + 1
  const costs = Array.from({ length: rowCount }, () => Array(columnCount).fill(0))
  const operations = Array.from({ length: rowCount }, () => Array(columnCount).fill(null))

  for (let row = 1; row < rowCount; row += 1) {
    costs[row][0] = row
    operations[row][0] = 'delete'
  }
  for (let column = 1; column < columnCount; column += 1) {
    costs[0][column] = column
    operations[0][column] = 'insert'
  }

  for (let row = 1; row < rowCount; row += 1) {
    for (let column = 1; column < columnCount; column += 1) {
      const candidates = [
        {
          operation: 'substitute',
          cost: costs[row - 1][column - 1] + substitutionCost(
            referenceWords[row - 1].normalized,
            recognizedWords[column - 1].normalized,
          ),
        },
        { operation: 'delete', cost: costs[row - 1][column] + 1 },
        { operation: 'insert', cost: costs[row][column - 1] + 1 },
      ].sort((left, right) => left.cost - right.cost)

      costs[row][column] = candidates[0].cost
      operations[row][column] = candidates[0].operation
    }
  }

  const referenceToRecognized = Array(referenceWords.length).fill(null)
  let row = referenceWords.length
  let column = recognizedWords.length

  while (row > 0 || column > 0) {
    const operation = operations[row][column]

    if (operation === 'substitute') {
      referenceToRecognized[row - 1] = column - 1
      row -= 1
      column -= 1
    } else if (operation === 'delete') {
      row -= 1
    } else {
      column -= 1
    }
  }

  return {
    cost: costs[referenceWords.length][recognizedWords.length],
    referenceToRecognized,
  }
}

function decodeAudio(filePath) {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide an executable path.')

  const result = spawnSync(
    ffmpegPath,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-f',
      'f32le',
      '-acodec',
      'pcm_f32le',
      'pipe:1',
    ],
    { encoding: null, maxBuffer: 64 * 1024 * 1024 },
  )

  if (result.status !== 0) {
    throw new Error(`FFmpeg failed for ${path.basename(filePath)}: ${result.stderr.toString()}`)
  }

  const samples = new Float32Array(
    result.stdout.buffer,
    result.stdout.byteOffset,
    result.stdout.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )

  return {
    durationMs: Math.round((samples.length / SAMPLE_RATE) * 1000),
    // Copy away from Node's pooled Buffer so ONNX receives a tightly sized array.
    samples: new Float32Array(samples),
  }
}

function interpolateMissingTimings(words, durationMs) {
  let index = 0

  while (index < words.length) {
    if (words[index].startMs !== null) {
      index += 1
      continue
    }

    const blockStart = index
    while (index < words.length && words[index].startMs === null) index += 1
    const blockEnd = index
    const previousWord = words[blockStart - 1]
    const nextWord = words[blockEnd]
    const availableStart = previousWord?.endMs ?? 0
    const availableEnd = nextWord?.startMs ?? durationMs

    // ASR may omit a short word between two adjacent recognized words (for example an acronym).
    // If there is no literal gap, repartition the surrounding recognized span so the missing
    // word still receives a useful interval rather than a 1ms placeholder.
    if (previousWord && nextWord && availableEnd - availableStart < blockEnd - blockStart) {
      const surroundingWords = words.slice(blockStart - 1, blockEnd + 1)
      const surroundingStart = previousWord.startMs
      const surroundingEnd = nextWord.endMs
      const surroundingWeights = surroundingWords.map(
        (word) => Math.max(normalizeWord(word.text).length, 1),
      )
      const totalSurroundingWeight = surroundingWeights.reduce(
        (total, weight) => total + weight,
        0,
      )
      let surroundingCursor = surroundingStart

      surroundingWords.forEach((word, surroundingIndex) => {
        word.startMs = Math.round(surroundingCursor)
        surroundingCursor += (surroundingEnd - surroundingStart)
          * (surroundingWeights[surroundingIndex] / totalSurroundingWeight)
        word.endMs = Math.round(surroundingCursor)
      })

      index = blockEnd
      continue
    }

    const availableDuration = Math.max(availableEnd - availableStart, blockEnd - blockStart)
    const weights = words
      .slice(blockStart, blockEnd)
      .map((word) => Math.max(normalizeWord(word.text).length, 1))
    const totalWeight = weights.reduce((total, weight) => total + weight, 0)
    let cursor = availableStart

    for (let wordIndex = blockStart; wordIndex < blockEnd; wordIndex += 1) {
      const duration = availableDuration * (weights[wordIndex - blockStart] / totalWeight)
      words[wordIndex].startMs = Math.round(cursor)
      cursor += duration
      words[wordIndex].endMs = Math.round(cursor)
    }
  }

  let previousStart = 0
  words.forEach((word) => {
    word.startMs = Math.max(previousStart, Math.min(word.startMs, durationMs))
    word.endMs = Math.min(
      durationMs,
      Math.max(word.startMs + MINIMUM_WORD_DURATION_MS, word.endMs),
    )
    previousStart = word.startMs
  })
}

function buildTimingEntry(text, recognizedOutput, durationMs) {
  const referenceWords = tokenizeReference(text)
  const recognizedWords = (recognizedOutput.chunks ?? [])
    .map((chunk) => ({
      text: chunk.text.trim(),
      normalized: normalizeWord(chunk.text),
      startMs: Math.round((chunk.timestamp?.[0] ?? 0) * 1000),
      endMs: Math.round((chunk.timestamp?.[1] ?? chunk.timestamp?.[0] ?? 0) * 1000),
    }))
    .filter((word) => word.normalized)
  const alignment = alignWordSequences(referenceWords, recognizedWords)
  const words = referenceWords.map((word, referenceIndex) => {
    const recognizedIndex = alignment.referenceToRecognized[referenceIndex]
    const recognizedWordCandidate = recognizedIndex === null ? null : recognizedWords[recognizedIndex]
    const recognizedWord = recognizedWordCandidate && substitutionCost(
      word.normalized,
      recognizedWordCandidate.normalized,
    ) <= 0.55
      ? recognizedWordCandidate
      : null
    const maximumWordDuration = Math.min(
      1200,
      250 + Math.max(word.normalized.length, 1) * 70,
    )
    const endMs = recognizedWord?.endMs ?? null
    const startMs = recognizedWord
      ? Math.max(recognizedWord.startMs, recognizedWord.endMs - maximumWordDuration)
      : null

    return {
      text: word.text,
      startChar: word.startChar,
      endChar: word.endChar,
      startMs,
      endMs,
    }
  })

  interpolateMissingTimings(words, durationMs)

  return {
    durationMs,
    text,
    recognizedText: recognizedOutput.text.trim(),
    alignmentCost: Number((alignment.cost / Math.max(referenceWords.length, 1)).toFixed(4)),
    words,
  }
}

async function loadDialogueData() {
  const transcriptUrl = pathToFileURL(path.join(
    PROJECT_DIRECTORY,
    'src',
    'features',
    'faceChat',
    'transcriptScript.ts',
  )).href
  const graphUrl = pathToFileURL(path.join(
    PROJECT_DIRECTORY,
    'src',
    'features',
    'faceChat',
    'dialogueGraph.ts',
  )).href
  const [{ TRANSCRIPT_SCRIPT }, { DIALOGUE_GRAPH }] = await Promise.all([
    import(transcriptUrl),
    import(graphUrl),
  ])

  return Object.values(DIALOGUE_GRAPH)
    .filter((node) => node.type !== 'loop')
    .map((node) => ({
      clipId: node.clipId,
      nodeId: node.id,
      text: TRANSCRIPT_SCRIPT[node.id].response,
    }))
}

async function main() {
  const dialogueClips = await loadDialogueData()
  const requestedClips = selectedClipIds.length > 0
    ? dialogueClips.filter(({ clipId }) => selectedClipIds.includes(clipId))
    : dialogueClips

  if (requestedClips.length === 0) {
    throw new Error(`No dialogue clips matched: ${selectedClipIds.join(', ')}`)
  }

  const unknownClipIds = selectedClipIds.filter(
    (clipId) => !dialogueClips.some((clip) => clip.clipId === clipId),
  )
  if (unknownClipIds.length > 0) {
    throw new Error(`Unknown dialogue clip ids: ${unknownClipIds.join(', ')}`)
  }

  console.log(`Loading ${modelId} for word-level alignment…`)
  const transcriber = await pipeline('automatic-speech-recognition', modelId, {
    dtype: 'q8',
  })
  const existingOutput = existsSync(OUTPUT_PATH)
    ? JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
    : null
  const clips = selectedClipIds.length > 0 && existingOutput?.clips
    ? { ...existingOutput.clips }
    : {}

  for (const [index, clip] of requestedClips.entries()) {
    const audioPath = path.join(CLIP_DIRECTORY, `${clip.clipId}.webm`)

    if (!existsSync(audioPath)) throw new Error(`Missing audio file: ${audioPath}`)

    console.log(`[${index + 1}/${requestedClips.length}] Aligning ${clip.clipId}.webm…`)
    const { durationMs, samples } = decodeAudio(audioPath)
    const recognizedOutput = await transcriber(samples, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    })
    const timingEntry = buildTimingEntry(clip.text, recognizedOutput, durationMs)

    clips[clip.clipId] = {
      nodeId: clip.nodeId,
      ...timingEntry,
    }
    console.log(
      `    ${timingEntry.words.length} words, ${durationMs} ms, alignment cost ${timingEntry.alignmentCost}`,
    )
  }

  const output = {
    version: 1,
    model: modelId,
    sampleRate: SAMPLE_RATE,
    clips,
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await transcriber.dispose?.()
  console.log(`Wrote ${path.relative(PROJECT_DIRECTORY, OUTPUT_PATH)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
