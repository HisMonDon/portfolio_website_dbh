// Procedurally generated detail textures for the realistic avatar. They are produced as plain
// RGBA byte arrays at load time (a few milliseconds each), so they add nothing to the download
// and can be unit tested without a DOM or WebGL context.

// Small deterministic PRNG (mulberry32) so every page load produces the same textures.
export function createRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function wrapIndex(value: number, size: number) {
  return ((value % size) + size) % size
}

// Tileable value noise on an integer lattice of `cells` per side.
function tileableValueNoise(size: number, cells: number, random: () => number) {
  const lattice = new Float32Array(cells * cells)
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = random()

  const out = new Float32Array(size * size)
  const smooth = (t: number) => t * t * (3 - 2 * t)

  for (let y = 0; y < size; y += 1) {
    const fy = (y / size) * cells
    const y0 = Math.floor(fy)
    const ty = smooth(fy - y0)
    const row0 = wrapIndex(y0, cells) * cells
    const row1 = wrapIndex(y0 + 1, cells) * cells

    for (let x = 0; x < size; x += 1) {
      const fx = (x / size) * cells
      const x0 = Math.floor(fx)
      const tx = smooth(fx - x0)
      const c0 = wrapIndex(x0, cells)
      const c1 = wrapIndex(x0 + 1, cells)
      const top = lattice[row0 + c0] + (lattice[row0 + c1] - lattice[row0 + c0]) * tx
      const bottom = lattice[row1 + c0] + (lattice[row1 + c1] - lattice[row1 + c0]) * tx
      out[y * size + x] = top + (bottom - top) * ty
    }
  }

  return out
}

// Converts a tileable height field into a tangent-space normal map (RGBA8, OpenGL convention).
export function heightToNormalMap(height: Float32Array, size: number, strength: number) {
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = height[y * size + wrapIndex(x - 1, size)]
      const right = height[y * size + wrapIndex(x + 1, size)]
      const up = height[wrapIndex(y - 1, size) * size + x]
      const down = height[wrapIndex(y + 1, size) * size + x]
      // Texture rows run top → bottom while tangent-space +Y points up the texture.
      const nx = (left - right) * strength
      const ny = (down - up) * strength
      const nz = 1
      const length = Math.hypot(nx, ny, nz)
      const offset = (y * size + x) * 4

      data[offset] = Math.round(((nx / length) * 0.5 + 0.5) * 255)
      data[offset + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255)
      data[offset + 2] = Math.round(((nz / length) * 0.5 + 0.5) * 255)
      data[offset + 3] = 255
    }
  }

  return data
}

// Skin micro-detail: pores (small soft dimples at jittered positions), a cross-hatch of very
// fine skin-line creases, and low-amplitude noise. Tileable in both directions.
export function generatePoreHeightField(size: number, seed = 1337) {
  const random = createRandom(seed)
  const height = new Float32Array(size * size)

  // Pores on a jittered grid so they never clump or leave bald patches.
  const poreSpacing = size / 40
  const poreCells = Math.round(size / poreSpacing)

  for (let gy = 0; gy < poreCells; gy += 1) {
    for (let gx = 0; gx < poreCells; gx += 1) {
      if (random() < 0.12) continue

      const cx = (gx + 0.15 + random() * 0.7) * poreSpacing
      const cy = (gy + 0.15 + random() * 0.7) * poreSpacing
      const radius = poreSpacing * (0.16 + random() * 0.16)
      const depth = 0.55 + random() * 0.45
      const reach = Math.ceil(radius * 2.6)

      for (let dy = -reach; dy <= reach; dy += 1) {
        for (let dx = -reach; dx <= reach; dx += 1) {
          const px = Math.round(cx) + dx
          const py = Math.round(cy) + dy
          const distanceSq = ((px - cx) ** 2 + (py - cy) ** 2) / (radius * radius)
          if (distanceSq > 6.5) continue
          height[wrapIndex(py, size) * size + wrapIndex(px, size)] -= depth * Math.exp(-distanceSq)
        }
      }
    }
  }

  // Skin microrelief: shallow grooves along the edges of an irregular polygon network (Worley
  // F2 - F1), the pattern real skin shows under raking light, plus low-amplitude noise.
  const cells = 11
  const feature = new Float32Array(cells * cells * 2)
  for (let i = 0; i < cells * cells; i += 1) {
    feature[i * 2] = random()
    feature[i * 2 + 1] = random()
  }

  const creaseNoise = tileableValueNoise(size, 6, random)
  const fine = tileableValueNoise(size, 96, random)
  const mid = tileableValueNoise(size, 28, random)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x
      const fx = (x / size) * cells
      const fy = (y / size) * cells
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      let f1 = Infinity
      let f2 = Infinity

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const cx = ix + ox
          const cy = iy + oy
          const cell = wrapIndex(cy, cells) * cells + wrapIndex(cx, cells)
          const dx = cx + feature[cell * 2] - fx
          const dy = cy + feature[cell * 2 + 1] - fy
          const distance = dx * dx + dy * dy

          if (distance < f1) {
            f2 = f1
            f1 = distance
          } else if (distance < f2) {
            f2 = distance
          }
        }
      }

      const edge = Math.sqrt(f2) - Math.sqrt(f1)
      const groove = Math.exp(-((edge / 0.045) ** 2))

      height[index] -= groove * (0.35 + 0.5 * creaseNoise[index])
      height[index] += (fine[index] - 0.5) * 0.3 + (mid[index] - 0.5) * 0.2
    }
  }

  return height
}

export function generatePoreNormalMap(size = 512, seed = 1337) {
  return heightToNormalMap(generatePoreHeightField(size, seed), size, 2.2)
}

// Woven fabric: an over/under twill weave with thread-level noise.
export function generateWeaveNormalMap(size = 128, threads = 32, seed = 7) {
  const random = createRandom(seed)
  const noise = tileableValueNoise(size, 16, random)
  const height = new Float32Array(size * size)
  const cell = size / threads

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      const fx = (x % cell) / cell
      const fy = (y % cell) / cell
      // 2/2 twill: the warp is on top for two cells, then the weft, offset one cell per row.
      const warpOnTop = ((cx + cy) & 3) < 2
      const across = warpOnTop ? Math.sin(Math.PI * fx) : Math.sin(Math.PI * fy)
      const along = warpOnTop ? Math.sin(Math.PI * fy) : Math.sin(Math.PI * fx)
      height[y * size + x] = across * (0.75 + 0.25 * along) + (noise[y * size + x] - 0.5) * 0.3
    }
  }

  return heightToNormalMap(height, size, 1.4)
}

// --- Face region mask -----------------------------------------------------------------------
//
// Hand-placed for the Ready Player Me head UV layout (shared by every RPM head, measured on this
// model's 1024px albedo). glTF UVs use a top-left origin, so (u, v) here equals (x, y) / 1024 in
// the texture image.
//   R: oiliness   — forehead, nose and chin are oilier (lower roughness); cheeks stay dry.
//   G: thinness   — ears, nostril wings and eyelids let more light through (SSS / translucency).
//   B: wetness    — the lid margin right around each eye opening, and a little on the lips.
//   A: lips       — lips get slightly lower roughness and more redness under SSS.

interface Ellipse {
  u: number
  v: number
  ru: number
  rv: number
  weight: number
}

const px = (value: number) => value / 1024

const OIL_REGIONS: Ellipse[] = [
  { u: px(512), v: px(225), ru: px(150), rv: px(70), weight: 0.9 }, // forehead
  { u: px(512), v: px(300), ru: px(38), rv: px(60), weight: 0.6 }, // glabella / nose bridge
  { u: px(512), v: px(425), ru: px(48), rv: px(52), weight: 1 }, // nose tip + alae
  { u: px(512), v: px(605), ru: px(60), rv: px(36), weight: 0.75 }, // chin
]

const THIN_REGIONS: Ellipse[] = [
  { u: px(228), v: px(445), ru: px(46), rv: px(86), weight: 1 }, // ear (image left)
  { u: px(795), v: px(445), ru: px(46), rv: px(86), weight: 1 }, // ear (image right)
  { u: px(490), v: px(458), ru: px(22), rv: px(16), weight: 0.3 }, // nostril wing
  { u: px(534), v: px(458), ru: px(22), rv: px(16), weight: 0.3 }, // nostril wing
  { u: px(420), v: px(342), ru: px(52), rv: px(34), weight: 0.45 }, // eyelids
  { u: px(602), v: px(342), ru: px(52), rv: px(34), weight: 0.45 },
]

const EYE_OPENINGS: Ellipse[] = [
  { u: px(420), v: px(345), ru: px(34), rv: px(20), weight: 1 },
  { u: px(602), v: px(345), ru: px(34), rv: px(20), weight: 1 },
]

const LIPS: Ellipse = { u: px(512), v: px(530), ru: px(60), rv: px(24), weight: 1 }

function ellipseDistance(u: number, v: number, region: Ellipse) {
  return Math.hypot((u - region.u) / region.ru, (v - region.v) / region.rv)
}

// 1 inside the ellipse, smooth falloff to 0 at `feather` times its radius.
function softEllipse(u: number, v: number, region: Ellipse, feather = 1.6) {
  const distance = ellipseDistance(u, v, region)
  if (distance >= feather) return 0
  if (distance <= 1) return region.weight
  const t = (distance - 1) / (feather - 1)
  return region.weight * (1 - t * t * (3 - 2 * t))
}

export interface FaceRegionSample {
  oil: number
  thin: number
  wet: number
  lips: number
}

export function sampleFaceRegions(u: number, v: number): FaceRegionSample {
  let oil = 0
  let thin = 0
  let wet = 0

  OIL_REGIONS.forEach((region) => {
    oil = Math.max(oil, softEllipse(u, v, region, 1.9))
  })
  THIN_REGIONS.forEach((region) => {
    thin = Math.max(thin, softEllipse(u, v, region, 1.5))
  })
  EYE_OPENINGS.forEach((region) => {
    // A ring hugging the opening: peaks at the rim, fades inward (eyeball) and outward (lid).
    const distance = ellipseDistance(u, v, region)
    const ring = Math.exp(-(((distance - 1.05) / 0.22) ** 2))
    wet = Math.max(wet, ring * region.weight)
  })

  const lips = softEllipse(u, v, LIPS, 1.35)
  wet = Math.max(wet, lips * 0.35)

  return { oil, thin, wet, lips }
}

export function generateFaceRegionMask(size = 256) {
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sample = sampleFaceRegions((x + 0.5) / size, (y + 0.5) / size)
      const offset = (y * size + x) * 4
      data[offset] = Math.round(sample.oil * 255)
      data[offset + 1] = Math.round(sample.thin * 255)
      data[offset + 2] = Math.round(sample.wet * 255)
      data[offset + 3] = Math.round(sample.lips * 255)
    }
  }

  return data
}
