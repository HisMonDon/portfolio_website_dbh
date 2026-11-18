import * as THREE from 'three'
import { createStudioEnvironment, STUDIO_KEY_DIRECTION, STUDIO_RIM_DIRECTION } from './studioEnvironment'
import type { QualityTier } from './renderQuality'

// Lighting rigs for the two render modes. Both add their lights to `scene` and return a dispose
// function that removes and frees everything they created.

export interface AvatarStage {
  applyTier?: (tier: QualityTier) => void
  dispose: () => void
}

const HEAD_CENTER = new THREE.Vector3(0, 1.62, 0)

// Portrait lighting on top of the studio IBL: the environment supplies the soft area light and
// the catchlights; a shadow-casting key aligned with the key softbox adds self-shadowing (nose,
// jaw onto neck, hair onto forehead); a cyan rim from behind-left separates the silhouette.
export function setupRealisticStage(renderer: THREE.WebGLRenderer, scene: THREE.Scene, tier: QualityTier): AvatarStage {
  const environment = createStudioEnvironment(renderer)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.62

  const key = new THREE.DirectionalLight(0xfff5ec, 2.8)
  key.position.copy(HEAD_CENTER).addScaledVector(STUDIO_KEY_DIRECTION, 3)
  key.target.position.copy(HEAD_CENTER)
  key.castShadow = true
  // Tight orthographic frustum around the head and shoulders: ~0.35 mm per texel at 2048.
  const shadowCamera = key.shadow.camera
  shadowCamera.left = -0.36
  shadowCamera.right = 0.36
  shadowCamera.top = 0.36
  shadowCamera.bottom = -0.42
  shadowCamera.near = 2
  shadowCamera.far = 4.2
  shadowCamera.updateProjectionMatrix()
  // Hair cards live on layer 3 (excluded from AO) but must still cast shadows.
  shadowCamera.layers.enable(3)
  key.shadow.bias = -0.00025
  key.shadow.normalBias = 0.0035
  scene.add(key, key.target)

  const rim = new THREE.DirectionalLight(0x74dcff, 0.75)
  rim.position.copy(HEAD_CENTER).addScaledVector(STUDIO_RIM_DIRECTION, 3)
  rim.target.position.copy(HEAD_CENTER)
  scene.add(rim, rim.target)

  // A faint warm kicker from behind-right keeps the jaw line from merging into dark clothing.
  const kicker = new THREE.DirectionalLight(0xffe6d0, 0.45)
  kicker.position.set(1.6, 2.0, -1.6)
  kicker.target.position.copy(HEAD_CENTER)
  scene.add(kicker, kicker.target)

  const applyTier = (nextTier: QualityTier) => {
    const size = nextTier.shadowMapSize
    if (key.shadow.mapSize.x !== size) {
      key.shadow.mapSize.set(size, size)
      key.shadow.map?.dispose()
      key.shadow.map = null
    }
    key.shadow.radius = nextTier.shadowRadius
  }
  applyTier(tier)

  return {
    applyTier,
    dispose() {
      scene.remove(key, key.target, rim, rim.target, kicker, kicker.target)
      key.dispose()
      rim.dispose()
      kicker.dispose()
      if (scene.environment === environment.texture) scene.environment = null
      environment.dispose()
    },
  }
}

// The original rig, untouched, for `?render=legacy`.
export function setupLegacyStage(scene: THREE.Scene): AvatarStage {
  const hemisphere = new THREE.HemisphereLight(0xdcecff, 0x293241, 1.3)
  scene.add(hemisphere)

  const keyLight = new THREE.DirectionalLight(0xf2f7ff, 2)
  keyLight.position.set(1, 2, 2)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xd7e6ff, 1.2)
  fillLight.position.set(-1.5, 1, 1.5)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0x6fe3ff, 1.5)
  rimLight.position.set(-0.5, 2.2, -2)
  rimLight.layers.set(1)
  scene.add(rimLight)

  return {
    dispose() {
      scene.remove(hemisphere, keyLight, fillLight, rimLight)
      hemisphere.dispose()
      keyLight.dispose()
      fillLight.dispose()
      rimLight.dispose()
    },
  }
}
