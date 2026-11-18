import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import type { QualityTier } from './renderQuality'

// Post-processing for the realistic avatar. Loaded lazily (dynamic import from ClipAvatar) so the
// GTAO/denoise shaders only download when the avatar actually renders.
//
// Pipeline (all linear HDR until the final pass):
//   1. Scene → MSAA HalfFloat target. MSAA gives clean silhouettes and makes hair
//      alpha-to-coverage work; it replaces SMAA/FXAA.
//   2. GTAO (optional) renders its own depth/normal buffer at reduced resolution, excluding hair,
//      corneas and the HUD (separate camera layers), then denoises.
//   3. HUD bloom (optional): threshold + a screen-space mask around the projected temple LED, so
//      only the LED blooms — never skin highlights or catchlights. Two blurred mip levels.
//   4. Final composite to the canvas. The canvas is transparent and sits over the page
//      background, so colour is handled in premultiplied form: un-premultiply, apply AO, tone map,
//      encode sRGB, add vignette/grain, re-premultiply. Bloom is added as premultiplied light
//      (alpha untouched), which composites additively over the page. No black box, no dark fringe.

export const AO_EXCLUDED_LAYER = 3

const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

const BLOOM_PREFILTER = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform vec2 uHudPixel;
uniform float uHudRadius;
uniform float uThreshold;
uniform float uHudVisible;
varying vec2 vUv;

vec3 fetch( vec2 uv ) {
  vec4 c = texture2D( tScene, uv );
  return c.rgb;
}

void main() {
  // Four bilinear taps cover a 4x4 block so the thin LED ring cannot fall between samples.
  vec3 c = fetch( vUv + uTexel * vec2( -1.0, -1.0 ) )
    + fetch( vUv + uTexel * vec2( 1.0, -1.0 ) )
    + fetch( vUv + uTexel * vec2( -1.0, 1.0 ) )
    + fetch( vUv + uTexel * vec2( 1.0, 1.0 ) );
  c *= 0.25;

  float luma = max( max( c.r, c.g ), c.b );
  float knee = uThreshold * 0.5;
  float soft = clamp( luma - uThreshold + knee, 0.0, 2.0 * knee );
  soft = soft * soft / ( 4.0 * knee + 1e-4 );
  float contribution = max( soft, luma - uThreshold ) / max( luma, 1e-4 );

  float distanceToHud = length( gl_FragCoord.xy - uHudPixel );
  float mask = 1.0 - smoothstep( uHudRadius * 0.45, uHudRadius, distanceToHud );

  gl_FragColor = vec4( c * contribution * mask * uHudVisible, 1.0 );
}
`

const BLOOM_BLUR = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDirection;
varying vec2 vUv;

void main() {
  // 9-tap Gaussian folded into 5 bilinear fetches.
  vec3 sum = texture2D( tInput, vUv ).rgb * 0.2270270270;
  vec2 off1 = uDirection * 1.3846153846;
  vec2 off2 = uDirection * 3.2307692308;
  sum += texture2D( tInput, vUv + off1 ).rgb * 0.3162162162;
  sum += texture2D( tInput, vUv - off1 ).rgb * 0.3162162162;
  sum += texture2D( tInput, vUv + off2 ).rgb * 0.0702702703;
  sum += texture2D( tInput, vUv - off2 ).rgb * 0.0702702703;
  gl_FragColor = vec4( sum, 1.0 );
}
`

const FINAL_COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tAo;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float uAoStrength;
uniform float uBloomStrength;
uniform float uGrain;
uniform float uVignette;
uniform float uTime;
uniform vec4 uFrame; // crop offset (xy) and full frame size (zw), in pixels
uniform vec2 uVignetteCenter; // in full-frame UV
varying vec2 vUv;

// colorspace_pars_fragment (sRGBTransferOETF) is already in three's ShaderMaterial prefix;
// tonemapping_pars_fragment is not (toneMapped: false) and declares toneMappingExposure.
#include <tonemapping_pars_fragment>

float hash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

vec3 toneMap( vec3 color ) {
  #if defined( AGX_TONE_MAPPING )
    return AgXToneMapping( color );
  #elif defined( ACES_FILMIC_TONE_MAPPING )
    return ACESFilmicToneMapping( color );
  #else
    return NeutralToneMapping( color );
  #endif
}

void main() {
  vec4 scene = texture2D( tScene, vUv );
  float alpha = clamp( scene.a, 0.0, 1.0 );
  bool covered = alpha > 0.003;
  vec3 color = covered ? scene.rgb / alpha : scene.rgb;

  float ao = texture2D( tAo, vUv ).r;
  color *= mix( 1.0, ao, uAoStrength );

  vec3 mapped = clamp( toneMap( color ), 0.0, 1.0 );
  vec3 encoded = sRGBTransferOETF( vec4( mapped, 1.0 ) ).rgb;

  // Vignette relative to the full (uncropped) frame, centred on the face.
  vec2 framePixel = uFrame.xy + gl_FragCoord.xy;
  vec2 frameUv = framePixel / uFrame.zw;
  vec2 fromCenter = ( frameUv - uVignetteCenter ) * vec2( uFrame.z / uFrame.w, 1.0 );
  encoded *= 1.0 - uVignette * smoothstep( 0.25, 0.95, length( fromCenter ) );

  // Luma-weighted film grain (stronger in midtones, like real film/sensor noise).
  float grainLuma = dot( encoded, vec3( 0.299, 0.587, 0.114 ) );
  float noise = hash12( framePixel + fract( uTime * 0.6180339 ) * 1024.0 ) - 0.5;
  encoded += noise * uGrain * ( 0.35 + grainLuma * ( 1.0 - grainLuma ) * 2.6 );

  vec3 premultiplied = covered ? clamp( encoded, 0.0, 1.0 ) * alpha : vec3( 0.0 );

  // Bloom is emitted light: added in premultiplied space without touching alpha, so it glows over
  // the transparent page instead of drawing an opaque halo.
  vec3 bloom = ( texture2D( tBloomA, vUv ).rgb * 0.7 + texture2D( tBloomB, vUv ).rgb * 0.9 ) * uBloomStrength * toneMappingExposure;
  bloom = 1.0 - exp( - bloom );
  premultiplied += sRGBTransferOETF( vec4( bloom, 1.0 ) ).rgb * ( 1.0 - alpha * 0.35 );

  gl_FragColor = vec4( min( premultiplied, vec3( 1.0 ) ), alpha );
}
`

export interface HudBloomSource {
  position: THREE.Vector3
  brightness: number
}

export interface AvatarPostProcessingOptions {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  tier: QualityTier
  toneMapping: THREE.ToneMapping
}

export interface AvatarPostProcessing {
  setSize: (width: number, height: number, frame: { offsetX: number; fullWidth: number; fullHeight: number }) => void
  setTier: (tier: QualityTier) => void
  setToneMapping: (toneMapping: THREE.ToneMapping) => void
  render: (nowMs: number, hud: HudBloomSource | null) => void
  // Most recent measured GPU time for one full frame (scene + post), in ms, or null when the
  // EXT_disjoint_timer_query_webgl2 extension is unavailable or no result has arrived yet.
  readonly gpuMs: number | null
  dispose: () => void
}

function createHdrTarget(width: number, height: number, samples = 0) {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: samples > 0,
    samples,
  })
}

export function createAvatarPostProcessing(options: AvatarPostProcessingOptions): AvatarPostProcessing {
  const { renderer, scene, camera } = options
  let tier = options.tier
  let width = 1
  let height = 1

  const sceneTarget = createHdrTarget(1, 1, tier.msaaSamples)
  const bloomHalfA = createHdrTarget(1, 1)
  const bloomHalfB = createHdrTarget(1, 1)
  const bloomQuarterA = createHdrTarget(1, 1)
  const bloomQuarterB = createHdrTarget(1, 1)

  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  white.needsUpdate = true
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  black.needsUpdate = true

  // GTAO sees the scene through its own camera so hair cards, corneas and the HUD (layers 2 and 3)
  // do not occlude skin in the AO buffer.
  const aoCamera = new THREE.PerspectiveCamera()
  let gtao: GTAOPass | null = null

  const ensureGtao = () => {
    if (gtao) return gtao
    gtao = new GTAOPass(scene, aoCamera, 1, 1)
    gtao.output = GTAOPass.OUTPUT.Off
    gtao.updateGtaoMaterial({
      radius: 0.07,
      distanceExponent: 1.6,
      thickness: 0.6,
      distanceFallOff: 1,
      scale: 1,
      samples: 8,
      screenSpaceRadius: false,
    })
    gtao.updatePdMaterial({
      lumaPhi: 10,
      depthPhi: 2,
      normalPhi: 3,
      radius: 5,
      rings: 2,
      samples: 8,
    })
    gtao.setSize(Math.max(1, Math.round(width * tier.aoResolutionScale)), Math.max(1, Math.round(height * tier.aoResolutionScale)))
    return gtao
  }

  const quad = new FullScreenQuad()

  // Non-blocking GPU timing: results are read a few frames later, never with a stall.
  const gl = renderer.getContext() as WebGL2RenderingContext
  const timerExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as {
    TIME_ELAPSED_EXT: number
    GPU_DISJOINT_EXT: number
  } | null
  const pendingQueries: WebGLQuery[] = []
  let gpuMs: number | null = null

  const collectQueries = () => {
    if (!timerExtension) return
    while (pendingQueries.length > 0) {
      const query = pendingQueries[0]
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break
      const disjoint = gl.getParameter(timerExtension.GPU_DISJOINT_EXT)
      if (!disjoint) gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6
      gl.deleteQuery(query)
      pendingQueries.shift()
    }
  }

  const prefilterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneTarget.texture },
      uTexel: { value: new THREE.Vector2() },
      uHudPixel: { value: new THREE.Vector2(-1e4, -1e4) },
      uHudRadius: { value: 20 },
      uThreshold: { value: 1.6 },
      uHudVisible: { value: 0 },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BLOOM_PREFILTER,
    depthTest: false,
    depthWrite: false,
  })

  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tInput: { value: null },
      uDirection: { value: new THREE.Vector2() },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BLOOM_BLUR,
    depthTest: false,
    depthWrite: false,
  })

  const finalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneTarget.texture },
      tAo: { value: white },
      tBloomA: { value: black },
      tBloomB: { value: black },
      uAoStrength: { value: 0 },
      uBloomStrength: { value: 0 },
      uGrain: { value: 0 },
      uVignette: { value: 0 },
      uTime: { value: 0 },
      uFrame: { value: new THREE.Vector4(0, 0, 1, 1) },
      uVignetteCenter: { value: new THREE.Vector2(0.5, 0.55) },
      toneMappingExposure: { value: 1 },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: FINAL_COMPOSITE,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  })

  const setToneMapping = (toneMapping: THREE.ToneMapping) => {
    const defines: Record<string, string> = {}
    if (toneMapping === THREE.AgXToneMapping) defines.AGX_TONE_MAPPING = ''
    else if (toneMapping === THREE.ACESFilmicToneMapping) defines.ACES_FILMIC_TONE_MAPPING = ''
    finalMaterial.defines = defines
    finalMaterial.needsUpdate = true
  }
  setToneMapping(options.toneMapping)

  const resizeTargets = () => {
    sceneTarget.setSize(width, height)
    const halfWidth = Math.max(1, Math.round(width / 2))
    const halfHeight = Math.max(1, Math.round(height / 2))
    const quarterWidth = Math.max(1, Math.round(width / 4))
    const quarterHeight = Math.max(1, Math.round(height / 4))
    bloomHalfA.setSize(halfWidth, halfHeight)
    bloomHalfB.setSize(halfWidth, halfHeight)
    bloomQuarterA.setSize(quarterWidth, quarterHeight)
    bloomQuarterB.setSize(quarterWidth, quarterHeight)
    prefilterMaterial.uniforms.uTexel.value.set(1 / width, 1 / height)
    gtao?.setSize(Math.max(1, Math.round(width * tier.aoResolutionScale)), Math.max(1, Math.round(height * tier.aoResolutionScale)))
  }

  const blur = (input: THREE.WebGLRenderTarget, scratch: THREE.WebGLRenderTarget) => {
    blurMaterial.uniforms.tInput.value = input.texture
    blurMaterial.uniforms.uDirection.value.set(1 / input.width, 0)
    quad.material = blurMaterial
    renderer.setRenderTarget(scratch)
    quad.render(renderer)

    blurMaterial.uniforms.tInput.value = scratch.texture
    blurMaterial.uniforms.uDirection.value.set(0, 1 / input.height)
    renderer.setRenderTarget(input)
    quad.render(renderer)
  }

  const projected = new THREE.Vector3()
  const edge = new THREE.Vector3()
  const cameraRight = new THREE.Vector3()
  const clearColor = new THREE.Color()

  return {
    setSize(nextWidth, nextHeight, frame) {
      width = Math.max(1, Math.round(nextWidth))
      height = Math.max(1, Math.round(nextHeight))
      const pixelRatio = renderer.getPixelRatio()
      finalMaterial.uniforms.uFrame.value.set(
        frame.offsetX * pixelRatio,
        0,
        Math.max(1, frame.fullWidth * pixelRatio),
        Math.max(1, frame.fullHeight * pixelRatio),
      )
      resizeTargets()
    },
    setTier(nextTier) {
      const samplesChanged = nextTier.msaaSamples !== tier.msaaSamples
      const aoScaleChanged = nextTier.aoResolutionScale !== tier.aoResolutionScale
      tier = nextTier

      if (samplesChanged) {
        sceneTarget.samples = nextTier.msaaSamples
        sceneTarget.dispose()
      }
      if (aoScaleChanged) resizeTargets()
      if (!nextTier.ambientOcclusion && gtao) {
        gtao.dispose()
        gtao = null
      }
    },
    setToneMapping,
    get gpuMs() {
      return gpuMs
    },
    render(nowMs, hud) {
      collectQueries()
      let query: WebGLQuery | null = null
      if (timerExtension && pendingQueries.length < 4) {
        query = gl.createQuery()
        if (query) gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, query)
      }

      renderer.getClearColor(clearColor)
      const clearAlpha = renderer.getClearAlpha()
      renderer.setClearColor(0x000000, 0)

      renderer.setRenderTarget(sceneTarget)
      renderer.clear()
      renderer.render(scene, camera)

      if (tier.ambientOcclusion) {
        const pass = ensureGtao()
        aoCamera.copy(camera)
        aoCamera.layers.set(0)
        aoCamera.layers.enable(1)
        aoCamera.updateMatrixWorld()
        pass.render(renderer, sceneTarget, sceneTarget, 0, false)
        finalMaterial.uniforms.tAo.value = pass.pdRenderTarget.texture
        finalMaterial.uniforms.uAoStrength.value = 0.85
      } else {
        finalMaterial.uniforms.tAo.value = white
        finalMaterial.uniforms.uAoStrength.value = 0
      }

      let bloomActive = false
      if (tier.bloom && hud && hud.brightness > 0) {
        projected.copy(hud.position).project(camera)
        const inFront = projected.z > -1 && projected.z < 1
        if (inFront) {
          bloomActive = true
          const halfWidth = bloomHalfA.width
          const halfHeight = bloomHalfA.height
          // Mask radius ≈ the on-screen size of 2.5 cm at the LED's depth.
          cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
          edge.copy(hud.position).addScaledVector(cameraRight, 0.025).project(camera)
          const radius = Math.max(4, Math.abs(edge.x - projected.x) * 0.5 * halfWidth)

          prefilterMaterial.uniforms.uHudPixel.value.set(
            (projected.x * 0.5 + 0.5) * halfWidth,
            (projected.y * 0.5 + 0.5) * halfHeight,
          )
          prefilterMaterial.uniforms.uHudRadius.value = radius
          prefilterMaterial.uniforms.uHudVisible.value = hud.brightness
          prefilterMaterial.uniforms.uTexel.value.set(1 / width, 1 / height)
          quad.material = prefilterMaterial
          renderer.setRenderTarget(bloomHalfA)
          quad.render(renderer)
          blur(bloomHalfA, bloomHalfB)

          blurMaterial.uniforms.tInput.value = bloomHalfA.texture
          blurMaterial.uniforms.uDirection.value.set(0, 0)
          quad.material = blurMaterial
          renderer.setRenderTarget(bloomQuarterA)
          quad.render(renderer)
          blur(bloomQuarterA, bloomQuarterB)
        }
      }

      finalMaterial.uniforms.tBloomA.value = bloomActive ? bloomHalfA.texture : black
      finalMaterial.uniforms.tBloomB.value = bloomActive ? bloomQuarterA.texture : black
      finalMaterial.uniforms.uBloomStrength.value = bloomActive ? 0.8 : 0
      finalMaterial.uniforms.uGrain.value = tier.filmGrain ? 0.022 : 0
      finalMaterial.uniforms.uVignette.value = tier.filmGrain ? 0.16 : 0.1
      finalMaterial.uniforms.uTime.value = nowMs / 1000
      finalMaterial.uniforms.tScene.value = sceneTarget.texture
      finalMaterial.uniforms.toneMappingExposure.value = renderer.toneMappingExposure

      quad.material = finalMaterial
      renderer.setRenderTarget(null)
      quad.render(renderer)

      renderer.setClearColor(clearColor, clearAlpha)

      if (query && timerExtension) {
        gl.endQuery(timerExtension.TIME_ELAPSED_EXT)
        pendingQueries.push(query)
      }
    },
    dispose() {
      pendingQueries.forEach((query) => gl.deleteQuery(query))
      pendingQueries.length = 0
      sceneTarget.dispose()
      bloomHalfA.dispose()
      bloomHalfB.dispose()
      bloomQuarterA.dispose()
      bloomQuarterB.dispose()
      gtao?.dispose()
      gtao = null
      prefilterMaterial.dispose()
      blurMaterial.dispose()
      finalMaterial.dispose()
      quad.dispose()
      white.dispose()
      black.dispose()
    },
  }
}
