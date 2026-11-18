import * as THREE from 'three'
import { computeEyeGaze, NEUTRAL_EYE_GAZE, smoothEyeGaze, type EyeGaze } from './eyeGaze'
import {
  generateFaceRegionMask,
  generatePoreNormalMap,
  generateWeaveNormalMap,
} from './skinTextures'
import { createTempleHud, findHeadNode, updateTempleHud, type TempleHud } from './templeHud'

// Realistic material treatment for the Ready Player Me avatar ("Detroit android" look: a real
// person with only the temple LED as a machine cue). Everything works on the GLB's own meshes and
// morph targets; nothing is replaced, so blendshape playback and bone poses are untouched.
//
//  Skin  — keeps the authored albedo, normal and roughness maps (no blur), adds a tiling
//          procedural pore/microrelief normal, area-dependent roughness (oily T-zone, dry
//          cheeks, wet lid margin, lips), curvature-driven wrap lighting for subsurface
//          scattering, a red-shifted shadow penumbra, and back-lit translucency in thin areas
//          (ears, nostril wings). The cyan android rim is reduced to a faint edge.
//  Eyes  — iris parallax under the cornea, cleaned-up sclera with a limbal ring, socket
//          occlusion, a clear additive cornea that shows sharp environment catchlights, and
//          eyeball rotation driven by the recorded eyeLook* blendshapes.
//  Hair  — anisotropic specular with alpha-to-coverage strand edges (needs an MSAA target).
//  Cloth — woven-fabric detail normal and sheen.

export const HUD_LAYER = 2

export interface AvatarVisualController {
  update: (
    nowMs: number,
    jawOpenAmount: number,
    critical?: boolean,
    yellowHud?: boolean,
  ) => void
  // Feeds the latest calibrated blendshapes so the eyeballs can follow the eyeLook* scores.
  setBlendshapes?: (categories: readonly { categoryName: string; score: number }[]) => void
  // Temple LED world position + colour, for the HUD-masked bloom.
  hud?: TempleHud
  dispose?: () => void
}

export interface RealisticVisualOptions {
  // Reuse textures between instances (the hero avatar and the project-card preview).
  textures?: SharedAvatarTextures
}

export interface SharedAvatarTextures {
  poreNormal: THREE.DataTexture
  faceRegions: THREE.DataTexture
  weaveNormal: THREE.DataTexture
  refCount: number
}

let sharedTextures: SharedAvatarTextures | null = null

function makeDataTexture(data: Uint8Array, size: number, repeat: boolean, colorSpace: THREE.ColorSpace = THREE.NoColorSpace) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.colorSpace = colorSpace
  texture.needsUpdate = true
  return texture
}

export function acquireAvatarTextures(): SharedAvatarTextures {
  if (!sharedTextures) {
    sharedTextures = {
      poreNormal: makeDataTexture(generatePoreNormalMap(512), 512, true),
      faceRegions: makeDataTexture(generateFaceRegionMask(256), 256, false),
      weaveNormal: makeDataTexture(generateWeaveNormalMap(128), 128, true),
      refCount: 0,
    }
  }

  sharedTextures.refCount += 1
  return sharedTextures
}

export function releaseAvatarTextures(textures: SharedAvatarTextures) {
  textures.refCount -= 1

  if (textures.refCount <= 0) {
    textures.poreNormal.dispose()
    textures.faceRegions.dispose()
    textures.weaveNormal.dispose()
    if (sharedTextures === textures) sharedTextures = null
  }
}

function getSingleSurfaceMaterial(mesh: THREE.Mesh): THREE.MeshStandardMaterial | null {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material instanceof THREE.MeshStandardMaterial ? material : null
}

function physicalFrom(original: THREE.MeshStandardMaterial, overrides: THREE.MeshPhysicalMaterialParameters) {
  const material = new THREE.MeshPhysicalMaterial({
    name: original.name,
    map: original.map,
    color: original.color,
    normalMap: original.normalMap,
    normalScale: original.normalScale.clone(),
    roughnessMap: original.roughnessMap,
    roughness: original.roughness,
    metalness: 0,
    aoMap: original.aoMap,
    aoMapIntensity: original.aoMapIntensity,
    alphaMap: original.alphaMap,
    side: original.side,
    ...overrides,
  })

  return material
}

// The (shared) original material is replaced; dispose it but keep the textures the new material
// still references (they are released with the avatar in ClipAvatar's disposeAvatar).
function replaceMaterial(mesh: THREE.Mesh, material: THREE.Material) {
  const previous = mesh.material
  mesh.material = material
  const previousList = Array.isArray(previous) ? previous : [previous]
  previousList.forEach((item) => {
    if (item !== material) item.dispose()
  })
}

// ---------------------------------------------------------------------------------------------
// Curvature
// ---------------------------------------------------------------------------------------------

// Per-vertex mean curvature estimate (welded across UV seams, smoothed), mapped to 0..1. High on
// the nose, lips, ears and eyelids, low on cheeks and forehead. Drives how far light wraps past
// the terminator — thin, tightly curved features scatter more visibly.
export function computeCurvatureAttributes(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()

  if (!position || !normal || !index) return null

  const count = position.count
  const weldMap = new Map<string, number>()
  const weld = new Int32Array(count)

  for (let vertex = 0; vertex < count; vertex += 1) {
    const key = `${Math.round(position.getX(vertex) * 1e5)},${Math.round(position.getY(vertex) * 1e5)},${Math.round(position.getZ(vertex) * 1e5)}`
    let id = weldMap.get(key)
    if (id === undefined) {
      id = weldMap.size
      weldMap.set(key, id)
    }
    weld[vertex] = id
  }

  const welded = weldMap.size
  const px = new Float32Array(welded * 3)
  const nx = new Float32Array(welded * 3)

  for (let vertex = 0; vertex < count; vertex += 1) {
    const id = weld[vertex]
    px[id * 3] = position.getX(vertex)
    px[id * 3 + 1] = position.getY(vertex)
    px[id * 3 + 2] = position.getZ(vertex)
    nx[id * 3] += normal.getX(vertex)
    nx[id * 3 + 1] += normal.getY(vertex)
    nx[id * 3 + 2] += normal.getZ(vertex)
  }

  for (let id = 0; id < welded; id += 1) {
    const length = Math.hypot(nx[id * 3], nx[id * 3 + 1], nx[id * 3 + 2]) || 1
    nx[id * 3] /= length
    nx[id * 3 + 1] /= length
    nx[id * 3 + 2] /= length
  }

  const sum = new Float32Array(welded)
  const weight = new Float32Array(welded)
  const neighbours: number[][] = Array.from({ length: welded }, () => [])

  const addEdge = (a: number, b: number) => {
    if (a === b) return
    const dx = px[a * 3] - px[b * 3]
    const dy = px[a * 3 + 1] - px[b * 3 + 1]
    const dz = px[a * 3 + 2] - px[b * 3 + 2]
    const lengthSq = dx * dx + dy * dy + dz * dz
    if (lengthSq < 1e-12) return
    const dnx = nx[a * 3] - nx[b * 3]
    const dny = nx[a * 3 + 1] - nx[b * 3 + 1]
    const dnz = nx[a * 3 + 2] - nx[b * 3 + 2]
    const k = (dnx * dx + dny * dy + dnz * dz) / lengthSq
    sum[a] += k
    weight[a] += 1
    neighbours[a].push(b)
  }

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = weld[index.getX(offset)]
    const b = weld[index.getX(offset + 1)]
    const c = weld[index.getX(offset + 2)]
    addEdge(a, b)
    addEdge(b, a)
    addEdge(b, c)
    addEdge(c, b)
    addEdge(c, a)
    addEdge(a, c)
  }

  const smoothstep01 = (t: number) => {
    const clamped = Math.min(1, Math.max(0, t))
    return clamped * clamped * (3 - 2 * clamped)
  }

  let curvature = new Float32Array(welded)
  let cavity = new Float32Array(welded)
  for (let id = 0; id < welded; id += 1) {
    const k = weight[id] > 0 ? sum[id] / weight[id] : 0
    // Map 1/radius (metres): ~10 for broad cheek curvature → 0, ~150 (tight features) → 1.
    curvature[id] = smoothstep01((Math.abs(k) - 12) / 140)
    // Concave creases (negative mean curvature): nostrils, alar crease, lip corners, lid folds.
    cavity[id] = smoothstep01((-k - 15) / 110)
  }

  // Smoothing passes so both terms vary gently across the face.
  const smooth = (values: Float32Array<ArrayBuffer>, passes: number): Float32Array<ArrayBuffer> => {
    let current = values
    for (let pass = 0; pass < passes; pass += 1) {
      const next = new Float32Array(welded)
      for (let id = 0; id < welded; id += 1) {
        const list = neighbours[id]
        let total = current[id]
        list.forEach((other) => {
          total += current[other]
        })
        next[id] = total / (list.length + 1)
      }
      current = next
    }
    return current
  }
  curvature = smooth(curvature, 2)
  cavity = smooth(cavity, 1)

  const curvatureData = new Float32Array(count)
  const cavityData = new Float32Array(count)
  for (let vertex = 0; vertex < count; vertex += 1) {
    curvatureData[vertex] = curvature[weld[vertex]]
    cavityData[vertex] = cavity[weld[vertex]]
  }

  return {
    curvature: new THREE.BufferAttribute(curvatureData, 1),
    cavity: new THREE.BufferAttribute(cavityData, 1),
  }
}

// ---------------------------------------------------------------------------------------------
// Skin
// ---------------------------------------------------------------------------------------------

export interface SkinUniforms {
  uSkinDetailNormal: { value: THREE.Texture | null }
  uSkinDetailRepeat: { value: number }
  uSkinDetailStrength: { value: number }
  uSkinRegions: { value: THREE.Texture | null }
  uSkinUseRegions: { value: number }
  uSssWrap: { value: THREE.Vector3 }
  uSssShadowSoftness: { value: number }
  uSssTransmissionColor: { value: THREE.Color }
  uSssTransmission: { value: number }
  uRimColor: { value: THREE.Color }
  uRimIntensity: { value: number }
  uHeadCenter: { value: THREE.Vector3 }
}

const SKIN_COMMON_FRAGMENT = /* glsl */ `
uniform sampler2D uSkinDetailNormal;
uniform float uSkinDetailRepeat;
uniform float uSkinDetailStrength;
uniform sampler2D uSkinRegions;
uniform float uSkinUseRegions;
uniform vec3 uSssWrap;
uniform float uSssShadowSoftness;
uniform vec3 uSssTransmissionColor;
uniform float uSssTransmission;
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform vec3 uHeadCenter;
varying float vSkinCurvature;
varying float vSkinCavity;

vec3 skinDiffuseNormal = vec3( 0.0, 0.0, 1.0 );
vec4 skinRegionSample = vec4( 0.0 );
float skinCurvatureValue = 0.0;
vec3 skinUnshadowedColor = vec3( 0.0 );

// Light that only just reaches past an occluder has travelled through skin: red survives, blue
// does not. Lifting the red channel in the penumbra gives the warm shadow edge of real skin.
vec3 skinShadowTint( float shadow ) {
  vec3 tinted = pow( vec3( shadow ), vec3( 0.58, 0.94, 1.04 ) );
  return mix( vec3( shadow ), tinted, uSssShadowSoftness );
}
`

const SKIN_DIRECT_DIFFUSE = /* glsl */ `
vec3 skinDirectDiffuse( const in IncidentLight directLight, const in vec3 viewDir ) {
  float ndl = dot( skinDiffuseNormal, directLight.direction );
  // Per-channel wrap lighting: red scatters furthest past the terminator, blue least. Thin or
  // tightly curved areas (nose, lips, ears, lids) scatter more.
  // Lights without shadows (rim, kicker) would otherwise wrap through the head onto the front.
  vec3 wrap = uSssWrap * ( 0.65 + 0.35 * skinCurvatureValue + 0.5 * skinRegionSample.g );
  vec3 lit = clamp( ( vec3( ndl ) + wrap ) / ( 1.0 + wrap ), 0.0, 1.0 );
  // Keep the lit side close to Lambert so wrap only softens the falloff instead of flattening.
  lit = mix( lit, vec3( saturate( ndl ) ), 0.25 );
  vec3 diffuse = lit * directLight.color;

  // Back-lit translucency through thin regions. Uses the unshadowed light: that light is exactly
  // what passes through an ear or nostril wing.
  vec3 transmitDir = normalize( directLight.direction + skinDiffuseNormal * 0.4 );
  float backLit = pow( saturate( dot( viewDir, - transmitDir ) ), 3.0 ) + 0.35 * saturate( - ndl );
  diffuse += uSssTransmissionColor * ( backLit * uSssTransmission * skinRegionSample.g ) * skinUnshadowedColor;

  return diffuse;
}
`

function patchChunk(source: string, search: string, replacement: string, label: string) {
  if (!source.includes(search)) {
    console.warn(`[avatar] shader patch "${label}" did not apply; three.js chunk changed.`)
    return source
  }
  return source.replace(search, replacement)
}

function patchedLightsPhysicalPars() {
  const original = THREE.ShaderChunk.lights_physical_pars_fragment
  const patched = patchChunk(
    original,
    'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );\n}',
    'reflectedLight.directDiffuse += skinDirectDiffuse( directLight, geometryViewDir ) * BRDF_Lambert( material.diffuseContribution );\n}',
    'skin direct diffuse',
  )
  // skinDirectDiffuse needs IncidentLight (lights_pars_begin, included earlier).
  return `${SKIN_DIRECT_DIFFUSE}\n${patched}`
}

function patchedLightsFragmentBegin() {
  let source = THREE.ShaderChunk.lights_fragment_begin

  source = patchChunk(
    source,
    'getDirectionalLightInfo( directionalLight, directLight );',
    [
      'getDirectionalLightInfo( directionalLight, directLight );',
      // Rim/kicker lights have no shadow map, so nothing stops them reaching front-facing
      // features (nostrils, lids) from behind. Real back light is occluded by the head; keep
      // these to grazing angles only. three sorts shadow-casting lights first.
      // The head is approximated as a sphere occluder: a point only sees the light if it sits on
      // the light's side of the skull centre.
      '\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX >= NUM_DIR_LIGHT_SHADOWS )',
      '\t\t{',
      '\t\t\tvec3 skinHeadCenterView = ( viewMatrix * vec4( uHeadCenter, 1.0 ) ).xyz;',
      '\t\t\tfloat skinFacing = dot( normalize( geometryPosition - skinHeadCenterView ), directLight.direction );',
      '\t\t\tfloat skinGrazing = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );',
      '\t\t\tdirectLight.color *= smoothstep( -0.05, 0.4, skinFacing ) * smoothstep( 0.0, 0.65, skinGrazing );',
      '\t\t}',
      '\t\t#endif',
      '\t\tskinUnshadowedColor = directLight.color;',
    ].join('\n'),
    'skin unshadowed directional',
  )
  source = patchChunk(
    source,
    'getPointLightInfo( pointLight, geometryPosition, directLight );',
    'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tskinUnshadowedColor = directLight.color;',
    'skin unshadowed point',
  )
  source = patchChunk(
    source,
    'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;',
    'directLight.color *= skinShadowTint( ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0 );',
    'skin shadow tint',
  )

  return source
}

const SKIN_NORMAL_MAPS = /* glsl */ `
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  // Diffuse light in skin is averaged over the scattering radius, so it sees a softer surface
  // than the specular reflection does.
  skinDiffuseNormal = normalize( tbn * vec3( mapN.xy * 0.5, mapN.z ) );
  vec3 detailN = texture2D( uSkinDetailNormal, vNormalMapUv * uSkinDetailRepeat ).xyz * 2.0 - 1.0;
  float detailAmount = uSkinDetailStrength
    * ( 1.0 - 0.8 * skinRegionSample.b )
    * ( 1.0 - 0.45 * skinRegionSample.a )
    * ( 1.0 + 0.35 * skinRegionSample.r );
  mapN = normalize( vec3( mapN.xy + detailN.xy * detailAmount, mapN.z ) );
  normal = normalize( tbn * mapN );
#else
  skinDiffuseNormal = normal;
#endif
`

const SKIN_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
skinCurvatureValue = vSkinCurvature;
#ifdef USE_MAP
  if ( uSkinUseRegions > 0.5 ) skinRegionSample = texture2D( uSkinRegions, vMapUv );
#endif
// Oily T-zone reads shinier, cheeks drier; lid margins are wet; lips slightly glossy.
roughnessFactor *= mix( 1.08, 0.74, skinRegionSample.r );
roughnessFactor *= mix( 1.0, 0.8, skinRegionSample.a );
roughnessFactor = mix( roughnessFactor, 0.22, skinRegionSample.b * 0.8 );
roughnessFactor = clamp( roughnessFactor, 0.16, 1.0 );
`

// Geometric cavity occlusion: creases can't see most of the environment, so they lose most of
// their indirect light and nearly all reflection (no bright rims around nostrils or lip corners).
const SKIN_CAVITY_OCCLUSION = /* glsl */ `
#include <aomap_fragment>
float skinCavityAo = 1.0 - clamp( vSkinCavity, 0.0, 1.0 ) * 0.7;
reflectedLight.indirectDiffuse *= skinCavityAo;
reflectedLight.indirectSpecular *= skinCavityAo * skinCavityAo;
reflectedLight.directSpecular *= mix( 1.0, skinCavityAo, 0.6 );
`

const SKIN_RIM = /* glsl */ `
float synthFresnel = pow( 1.0 - saturate( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 4.0 );
gl_FragColor.rgb += uRimColor * synthFresnel * uRimIntensity * gl_FragColor.a;
#include <dithering_fragment>
`

// The 1024px albedo stretches the face over ~450px, so "pores" in it are really blotches and
// blemishes. This lifts only small, low-contrast dark speckles toward their surroundings (a
// one-sided frequency separation). Brows, lash lines, lips and all the lighter texture stay
// exactly as authored; nothing is blurred.
export function liftSkinBlemishes(originalMap: THREE.Texture | null | undefined) {
  const image = originalMap?.image as (CanvasImageSource & { width?: number; height?: number }) | undefined
  if (!image || !image.width || !image.height || typeof document === 'undefined') return null

  const width = image.width
  const height = image.height
  const sharpCanvas = document.createElement('canvas')
  const blurCanvas = document.createElement('canvas')
  sharpCanvas.width = blurCanvas.width = width
  sharpCanvas.height = blurCanvas.height = height
  const sharpContext = sharpCanvas.getContext('2d', { willReadFrequently: true })
  const blurContext = blurCanvas.getContext('2d', { willReadFrequently: true })
  if (!sharpContext || !blurContext) return null

  let sharp: ImageData
  let blurred: ImageData

  try {
    sharpContext.drawImage(image, 0, 0, width, height)
    sharp = sharpContext.getImageData(0, 0, width, height)
    blurContext.filter = `blur(${Math.max(1, Math.round(width / 400))}px)`
    blurContext.drawImage(image, 0, 0, width, height)
    blurred = blurContext.getImageData(0, 0, width, height)
  } catch {
    return null
  }

  const out = sharp.data
  const soft = blurred.data

  for (let i = 0; i < out.length; i += 4) {
    const sharpLuma = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]
    const softLuma = 0.299 * soft[i] + 0.587 * soft[i + 1] + 0.114 * soft[i + 2]
    const darker = softLuma - sharpLuma
    // Only small dark deviations on bright-ish skin: big contrasts (brows, lashes, nostrils) and
    // dark regions (hair) are left alone.
    if (darker <= 0 || softLuma < 95) continue
    const amount = 0.65 * (1 - Math.min(1, Math.max(0, (darker - 10) / 22)))
    if (amount <= 0) continue
    out[i] += (soft[i] - out[i]) * amount
    out[i + 1] += (soft[i + 1] - out[i + 1]) * amount
    out[i + 2] += (soft[i + 2] - out[i + 2]) * amount
  }

  sharpContext.putImageData(sharp, 0, 0)
  const texture = new THREE.CanvasTexture(sharpCanvas)
  texture.colorSpace = originalMap?.colorSpace ?? THREE.SRGBColorSpace
  texture.flipY = originalMap?.flipY ?? false
  texture.wrapS = originalMap?.wrapS ?? THREE.ClampToEdgeWrapping
  texture.wrapT = originalMap?.wrapT ?? THREE.ClampToEdgeWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

export function createSkinMaterial(
  original: THREE.MeshStandardMaterial,
  textures: SharedAvatarTextures,
  options: { regions: boolean; detailRepeat: number },
) {
  const material = physicalFrom(original, {
    roughness: 1,
    normalScale: original.normalScale.clone(),
    ior: 1.4,
    specularIntensity: 0.85,
    envMapIntensity: 1,
  })

  const uniforms: SkinUniforms = {
    uSkinDetailNormal: { value: textures.poreNormal },
    uSkinDetailRepeat: { value: options.detailRepeat },
    uSkinDetailStrength: { value: 0.16 },
    uSkinRegions: { value: textures.faceRegions },
    uSkinUseRegions: { value: options.regions ? 1 : 0 },
    uSssWrap: { value: new THREE.Vector3(0.32, 0.14, 0.09) },
    uSssShadowSoftness: { value: 0.85 },
    uSssTransmissionColor: { value: new THREE.Color(1.0, 0.32, 0.18) },
    uSssTransmission: { value: 0.45 },
    uRimColor: { value: new THREE.Color(0x66d9ff) },
    uRimIntensity: { value: 0.03 },
    uHeadCenter: { value: new THREE.Vector3(0, 1.65, 0) },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float skinCurvature;\nattribute float skinCavity;\nvarying float vSkinCurvature;\nvarying float vSkinCavity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinCurvature = skinCurvature;\nvSkinCavity = skinCavity;')

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SKIN_COMMON_FRAGMENT}`)
      .replace('#include <roughnessmap_fragment>', SKIN_ROUGHNESS)
      .replace('#include <normal_fragment_maps>', SKIN_NORMAL_MAPS)
      .replace('#include <lights_physical_pars_fragment>', patchedLightsPhysicalPars())
      .replace('#include <lights_fragment_begin>', patchedLightsFragmentBegin())
      .replace('#include <aomap_fragment>', SKIN_CAVITY_OCCLUSION)
      .replace('#include <dithering_fragment>', SKIN_RIM)
  }
  material.customProgramCacheKey = () => 'avatar-realistic-skin-v2'

  return { material, uniforms }
}

// ---------------------------------------------------------------------------------------------
// Eyes
// ---------------------------------------------------------------------------------------------

const EYE_COMMON = /* glsl */ `
uniform vec2 uIrisCenter;
uniform float uIrisRadius;
uniform float uIrisDepth;
uniform float uScleraClean;

mat3 eyeTangentFrame( vec3 eyePosition, vec3 surfaceNormal, vec2 uv ) {
  vec3 q0 = dFdx( eyePosition.xyz );
  vec3 q1 = dFdy( eyePosition.xyz );
  vec2 st0 = dFdx( uv.st );
  vec2 st1 = dFdy( uv.st );
  vec3 N = surfaceNormal;
  vec3 q1perp = cross( q1, N );
  vec3 q0perp = cross( N, q0 );
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max( dot( T, T ), dot( B, B ) );
  float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
  return mat3( T * scale, B * scale, N );
}
`

const EYE_MAP = /* glsl */ `
#ifdef USE_MAP
  vec2 eyeUv = vMapUv;
  float irisDistance = length( eyeUv - uIrisCenter ) / uIrisRadius;
  // Parallax: the iris sits behind the cornea's bulge, so it shifts against the view direction.
  mat3 eyeTbn = eyeTangentFrame( - vViewPosition, normalize( vNormal ), vMapUv );
  vec3 viewTangent = normalize( vec3(
    dot( eyeTbn[0], normalize( vViewPosition ) ),
    dot( eyeTbn[1], normalize( vViewPosition ) ),
    dot( eyeTbn[2], normalize( vViewPosition ) )
  ) );
  float irisMask = 1.0 - smoothstep( 0.9, 1.15, irisDistance );
  eyeUv -= viewTangent.xy / max( viewTangent.z, 0.3 ) * uIrisDepth * irisMask;
  vec4 sampledDiffuseColor = texture2D( map, eyeUv );
  diffuseColor *= sampledDiffuseColor;

  // Sclera: pull the painted veins and pink cast back toward a clean, slightly warm white.
  float sclera = smoothstep( 1.05, 1.35, irisDistance );
  float scleraLuma = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 cleanSclera = vec3( scleraLuma ) * vec3( 1.0, 0.955, 0.93 ) * 1.05;
  diffuseColor.rgb = mix( diffuseColor.rgb, cleanSclera, sclera * uScleraClean );
  // Limbal ring: the darker boundary between iris and sclera.
  float limbal = smoothstep( 0.78, 1.0, irisDistance ) * ( 1.0 - smoothstep( 1.0, 1.28, irisDistance ) );
  diffuseColor.rgb *= 1.0 - limbal * 0.5;

  // Socket occlusion: the eyeball darkens where it turns away into the lids, more so under the
  // upper lid.
  vec3 eyeViewNormal = normalize( vNormal );
  float facing = saturate( dot( eyeViewNormal, normalize( vViewPosition ) ) );
  float socket = mix( 0.42, 1.0, smoothstep( 0.35, 0.92, facing ) );
  socket *= 1.0 - 0.3 * smoothstep( 0.05, 0.55, eyeViewNormal.y );
  diffuseColor.rgb *= socket;
#endif
`

export interface EyeUniforms {
  uIrisCenter: { value: THREE.Vector2 }
  uIrisRadius: { value: number }
  uIrisDepth: { value: number }
  uScleraClean: { value: number }
}

export function createEyeballMaterial(original: THREE.MeshStandardMaterial) {
  const material = physicalFrom(original, {
    roughness: 0.38,
    roughnessMap: null,
    specularIntensity: 0.35,
    envMapIntensity: 0.9,
  })

  const uniforms: EyeUniforms = {
    // Measured on the RPM 512px eye texture: iris centred at (256, 310), radius ~50px.
    uIrisCenter: { value: new THREE.Vector2(0.5, 310 / 512) },
    uIrisRadius: { value: 52 / 512 },
    uIrisDepth: { value: 0.012 },
    uScleraClean: { value: 0.7 },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${EYE_COMMON}`)
      .replace('#include <map_fragment>', EYE_MAP)
  }
  material.customProgramCacheKey = () => 'avatar-realistic-eye-v1'

  return { material, uniforms }
}

// The cornea is a clear, wet shell: no diffuse at all, only reflection. Additive blending adds the
// environment/key reflections (catchlights) on top of the eyeball without darkening it.
export function createCorneaMaterial() {
  return new THREE.MeshPhysicalMaterial({
    name: 'AvatarCorneaRealistic',
    color: 0x000000,
    roughness: 0.02,
    metalness: 0,
    ior: 1.376,
    specularIntensity: 1,
    envMapIntensity: 1.5,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

// ---------------------------------------------------------------------------------------------
// Detail normal for non-skin materials (fabric weave)
// ---------------------------------------------------------------------------------------------

function addDetailNormal(material: THREE.MeshPhysicalMaterial, texture: THREE.Texture, repeat: number, strength: number, key: string) {
  const uniforms = {
    uDetailNormal: { value: texture },
    uDetailRepeat: { value: repeat },
    uDetailStrength: { value: strength },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetailNormal;\nuniform float uDetailRepeat;\nuniform float uDetailStrength;')
      .replace('#include <normal_fragment_maps>', /* glsl */ `
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  vec3 detailN = texture2D( uDetailNormal, vNormalMapUv * uDetailRepeat ).xyz * 2.0 - 1.0;
  mapN = normalize( vec3( mapN.xy + detailN.xy * uDetailStrength, mapN.z ) );
  normal = normalize( tbn * mapN );
#endif
`)
  }
  material.customProgramCacheKey = () => key

  return uniforms
}

// ---------------------------------------------------------------------------------------------
// Outfit cleanup (unchanged from the legacy path)
// ---------------------------------------------------------------------------------------------

// The Ready Player Me outfit can contain hand-influenced faces that stretch across the fingers.
export function removeHandCoveringFaces(mesh: THREE.SkinnedMesh) {
  const index = mesh.geometry.index
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const skinWeight = mesh.geometry.getAttribute('skinWeight')

  if (!index || !skinIndex || !skinWeight || !mesh.skeleton) return

  const handBoneIndices = new Set<number>()

  mesh.skeleton.bones.forEach((bone, boneIndex) => {
    if (/hand|thumb|index|middle|ring|pinky/i.test(bone.name)) handBoneIndices.add(boneIndex)
  })

  const component = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, vertex: number, item: number) => {
    if (item === 0) return attribute.getX(vertex)
    if (item === 1) return attribute.getY(vertex)
    if (item === 2) return attribute.getZ(vertex)
    return attribute.getW(vertex)
  }

  const isHandVertex = (vertex: number) => {
    for (let item = 0; item < 4; item += 1) {
      if (component(skinWeight, vertex, item) > 0.01 && handBoneIndices.has(component(skinIndex, vertex, item))) return true
    }
    return false
  }

  const nextIndex: number[] = []

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset)
    const b = index.getX(offset + 1)
    const c = index.getX(offset + 2)

    if (isHandVertex(a) || isHandVertex(b) || isHandVertex(c)) continue
    nextIndex.push(a, b, c)
  }

  mesh.geometry.setIndex(nextIndex)
}

// ---------------------------------------------------------------------------------------------
// Eye bones
// ---------------------------------------------------------------------------------------------

interface EyeRig {
  bone: THREE.Object3D
  restLocal: THREE.Quaternion
  parentRestWorld: THREE.Quaternion
  parentRestWorldInverse: THREE.Quaternion
}

function createEyeRig(bone: THREE.Object3D | undefined): EyeRig | null {
  if (!bone?.parent) return null

  bone.updateWorldMatrix(true, false)
  const parentRestWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion())

  return {
    bone,
    restLocal: bone.quaternion.clone(),
    parentRestWorld,
    parentRestWorldInverse: parentRestWorld.clone().invert(),
  }
}

const gazeEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const gazeQuaternion = new THREE.Quaternion()

function applyEyeRotation(rig: EyeRig, yaw: number, pitch: number) {
  // Rotation in avatar space (yaw about +Y toward the avatar's left, pitch up = -X), expressed in
  // the eye's parent frame at rest, then applied on top of the authored rest orientation.
  gazeEuler.set(-pitch, yaw, 0)
  gazeQuaternion.setFromEuler(gazeEuler)
  gazeQuaternion.premultiply(rig.parentRestWorldInverse).multiply(rig.parentRestWorld)
  rig.bone.quaternion.copy(gazeQuaternion).multiply(rig.restLocal)
}

// ---------------------------------------------------------------------------------------------
// Treatment
// ---------------------------------------------------------------------------------------------

export function applyAvatarVisualTreatment(root: THREE.Group, options: RealisticVisualOptions = {}): AvatarVisualController {
  const textures = options.textures ?? acquireAvatarTextures()
  const ownsTextures = !options.textures
  const skinUniforms: SkinUniforms[] = []

  root.updateMatrixWorld(true)

  const head = root.getObjectByName('AvatarHead') as THREE.Mesh | undefined
  const headOriginal = head?.isMesh ? getSingleSurfaceMaterial(head) : null
  if (head && headOriginal) {
    const curvature = computeCurvatureAttributes(head.geometry)
    if (curvature) {
      head.geometry.setAttribute('skinCurvature', curvature.curvature)
      head.geometry.setAttribute('skinCavity', curvature.cavity)
    }
    // Head UV: 1 unit ≈ 33 cm, so 26 repeats ≈ a 13 mm pore tile.
    const skin = createSkinMaterial(headOriginal, textures, { regions: true, detailRepeat: 26 })
    const cleanedMap = liftSkinBlemishes(headOriginal.map)
    if (cleanedMap) skin.material.map = cleanedMap
    replaceMaterial(head, skin.material)
    skinUniforms.push(skin.uniforms)
  }

  const body = root.getObjectByName('AvatarBody') as THREE.Mesh | undefined
  const bodyOriginal = body?.isMesh ? getSingleSurfaceMaterial(body) : null
  if (body && bodyOriginal) {
    const curvature = computeCurvatureAttributes(body.geometry)
    if (curvature) {
      body.geometry.setAttribute('skinCurvature', curvature.curvature)
      body.geometry.setAttribute('skinCavity', curvature.cavity)
    }
    const skin = createSkinMaterial(bodyOriginal, textures, { regions: false, detailRepeat: 30 })
    replaceMaterial(body, skin.material)
    skinUniforms.push(skin.uniforms)
  }

  const eyeUniforms: EyeUniforms[] = []
  for (const name of ['AvatarLeftEyeball', 'AvatarRightEyeball']) {
    const eyeball = root.getObjectByName(name) as THREE.Mesh | undefined
    const original = eyeball?.isMesh ? getSingleSurfaceMaterial(eyeball) : null
    if (!eyeball || !original) continue
    const eye = createEyeballMaterial(original)
    replaceMaterial(eyeball, eye.material)
    eyeUniforms.push(eye.uniforms)
  }

  for (const name of ['AvatarLeftCornea', 'AvatarRightCornea']) {
    const cornea = root.getObjectByName(name) as THREE.Mesh | undefined
    if (!cornea?.isMesh) continue
    replaceMaterial(cornea, createCorneaMaterial())
    cornea.renderOrder = 2
  }

  const hair = root.getObjectByName('haircut') as THREE.Mesh | undefined
  const hairOriginal = hair?.isMesh ? getSingleSurfaceMaterial(hair) : null
  if (hair && hairOriginal) {
    const material = physicalFrom(hairOriginal, {
      // The authored roughness map is a flat 0.63; 0.55 of that keeps the strand highlight tight.
      roughness: 0.55,
      metalness: 0,
      ior: 1.55,
      specularIntensity: 0.75,
      specularColor: new THREE.Color(0.95, 0.93, 0.9),
      anisotropy: 0.85,
      anisotropyRotation: Math.PI / 2,
      aoMapIntensity: 1,
      // Soft, antialiased strand edges without sorting: alpha-to-coverage on the MSAA target.
      // alphaTest makes three sharpen alpha to a ~1px ramp, so strand interiors are fully covered.
      transparent: false,
      alphaToCoverage: true,
      alphaTest: 0.42,
      depthWrite: true,
      // Coverage already encodes the strand edge; the alpha channel must not let the page show
      // through hair that sits over skin, so alpha keeps the maximum of hair and what's behind.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.ZeroFactor,
      blendEquationAlpha: THREE.MaxEquation,
    })
    // The albedo is pure black; real black hair still carries a little warm brown in its body.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\ndiffuseColor.rgb = max( diffuseColor.rgb, vec3( 0.009, 0.0075, 0.0065 ) );',
        )
        // three's alpha-to-coverage ramp is one pixel wide, which leaves hair card tips looking
        // cut out. A ~2.5px ramp spreads each strand edge over more MSAA samples.
        .replace(
          '#include <alphatest_fragment>',
          [
            '#ifdef USE_ALPHATEST',
            '  float hairEdge = max( fwidth( diffuseColor.a ), 1e-3 ) * 1.25;',
            '  diffuseColor.a = smoothstep( alphaTest - hairEdge, alphaTest + hairEdge, diffuseColor.a );',
            '  if ( diffuseColor.a <= 0.0 ) discard;',
            '#endif',
          ].join('\n'),
        )
    }
    material.customProgramCacheKey = () => 'avatar-realistic-hair-v2'
    replaceMaterial(hair, material)
  }

  const outfit = root.getObjectByName('outfit') as THREE.SkinnedMesh | undefined
  const outfitOriginal = outfit?.isMesh ? getSingleSurfaceMaterial(outfit) : null
  if (outfit && outfitOriginal) {
    if (outfit.isSkinnedMesh) removeHandCoveringFaces(outfit)
    const material = physicalFrom(outfitOriginal, {
      roughness: 1,
      normalScale: outfitOriginal.normalScale.clone().multiplyScalar(1.2),
      specularIntensity: 0.45,
      sheen: 0.9,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0.32, 0.33, 0.36),
    })
    addDetailNormal(material, textures.weaveNormal, 110, 0.12, 'avatar-realistic-fabric-v1')
    replaceMaterial(outfit, material)
  }

  for (const name of ['AvatarTeethUpper', 'AvatarTeethLower']) {
    const teeth = root.getObjectByName(name) as THREE.Mesh | undefined
    const original = teeth?.isMesh ? getSingleSurfaceMaterial(teeth) : null
    if (!teeth || !original) continue
    replaceMaterial(teeth, physicalFrom(original, {
      color: new THREE.Color(0.86, 0.84, 0.8),
      roughness: 1,
      specularIntensity: 0.6,
      envMapIntensity: 0.6,
    }))
  }

  const lashes = root.getObjectByName('AvatarEyelashes') as THREE.Mesh | undefined
  const lashOriginal = lashes?.isMesh ? getSingleSurfaceMaterial(lashes) : null
  if (lashes && lashOriginal) {
    replaceMaterial(lashes, physicalFrom(lashOriginal, {
      color: new THREE.Color(0.02, 0.018, 0.016),
      roughness: 0.55,
      specularIntensity: 0.4,
    }))
  }

  // Shadows: everything opaque casts and receives, except the clear corneas.
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const isCornea = /cornea/i.test(mesh.name)
    mesh.castShadow = !isCornea && !/eyeball/i.test(mesh.name)
    mesh.receiveShadow = !isCornea
  })

  const headNode = findHeadNode(root)
  // The Head bone sits at the base of the skull; this offset lands near the skull's centre.
  const headCenterOffset = new THREE.Vector3(0, 0.075, 0.015)
  const headCenter = new THREE.Vector3()

  const templeHud = createTempleHud(headNode, performance.now(), {
    emissiveScale: 2.4,
    lightScale: 0.5,
    layer: HUD_LAYER,
  })

  // Keep the LED's practical light on the temple and brow; at the legacy 15 cm reach it also put a
  // cyan specular on the nose.
  templeHud.light.distance = 0.085

  const leftEye = createEyeRig(root.getObjectByName('LeftEye'))
  const rightEye = createEyeRig(root.getObjectByName('RightEye'))
  let gazeTarget: EyeGaze = NEUTRAL_EYE_GAZE
  let gaze: EyeGaze = NEUTRAL_EYE_GAZE
  let lastUpdateMs: number | null = null

  return {
    hud: templeHud,
    setBlendshapes(categories) {
      gazeTarget = computeEyeGaze(categories)
    },
    update(nowMs, jawOpenAmount, critical = false, yellowHud = false) {
      const deltaMs = lastUpdateMs === null ? 16 : Math.min(100, nowMs - lastUpdateMs)
      lastUpdateMs = nowMs

      updateTempleHud(templeHud, nowMs, jawOpenAmount, critical, yellowHud)

      gaze = smoothEyeGaze(gaze, gazeTarget, deltaMs)
      if (leftEye) applyEyeRotation(leftEye, gaze.left.yaw, gaze.left.pitch)
      if (rightEye) applyEyeRotation(rightEye, gaze.right.yaw, gaze.right.pitch)

      headCenter.copy(headCenterOffset)
      headNode.localToWorld(headCenter)

      // The android cue stays faint: a slow breathing cyan edge, never a sheen.
      const skinPulse = 0.5 + 0.5 * Math.sin((nowMs / 1000) * 0.6 + Math.PI / 3)
      const rimIntensity = 0.02 + 0.02 * skinPulse
      skinUniforms.forEach((uniforms) => {
        uniforms.uRimIntensity.value = rimIntensity
        uniforms.uHeadCenter.value.copy(headCenter)
      })
    },
    dispose() {
      if (ownsTextures) releaseAvatarTextures(textures)
    },
  }
}
