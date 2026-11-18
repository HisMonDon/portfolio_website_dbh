import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import {
  applyAvatarVisualTreatment,
  computeCurvatureAttributes,
  createSkinMaterial,
  HUD_LAYER,
  acquireAvatarTextures,
  releaseAvatarTextures,
} from './avatarVisuals'

afterEach(() => {
  vi.restoreAllMocks()
})

function disposeTestRoot(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((material) => material.dispose())
  })
}

// Runs a material's onBeforeCompile against three's real MeshPhysicalMaterial shader source.
function compilePhysical(material: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  }
  material.onBeforeCompile(shader as never, null as never)
  return shader
}

function buildTestAvatar() {
  const root = new THREE.Group()
  const hips = new THREE.Bone()
  hips.name = 'Hips'
  root.add(hips)
  const headBone = new THREE.Bone()
  headBone.name = 'Head'
  headBone.position.set(0, 1.6, 0)
  hips.add(headBone)
  const leftEye = new THREE.Bone()
  leftEye.name = 'LeftEye'
  leftEye.position.set(0.03, 0.07, 0.06)
  headBone.add(leftEye)
  const rightEye = new THREE.Bone()
  rightEye.name = 'RightEye'
  rightEye.position.set(-0.03, 0.07, 0.06)
  headBone.add(rightEye)

  const normalMap = new THREE.Texture()
  const roughnessMap = new THREE.Texture()
  const headGeometry = new THREE.SphereGeometry(0.1, 16, 12)
  const head = new THREE.Mesh(
    headGeometry,
    new THREE.MeshStandardMaterial({ roughness: 0.9, normalMap, roughnessMap }),
  )
  head.name = 'AvatarHead'
  root.add(head)

  const add = (name: string, material: THREE.Material, geometry: THREE.BufferGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    root.add(mesh)
    return mesh
  }

  return {
    root,
    head,
    leftEye,
    body: add('AvatarBody', new THREE.MeshStandardMaterial({ roughness: 0.8 })),
    hair: add('haircut', new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true })),
    outfit: add('outfit', new THREE.MeshStandardMaterial({ roughness: 0.8, normalMap: new THREE.Texture() })),
    eyeball: add('AvatarLeftEyeball', new THREE.MeshStandardMaterial({ map: new THREE.Texture() }), new THREE.SphereGeometry(0.012)),
    cornea: add('AvatarLeftCornea', new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 }), new THREE.SphereGeometry(0.013)),
    normalMap,
    roughnessMap,
  }
}

describe('applyAvatarVisualTreatment (realistic)', () => {
  it('builds skin from the authored maps, with no plastic clearcoat', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const avatar = buildTestAvatar()
    const visuals = applyAvatarVisualTreatment(avatar.root)

    const skin = avatar.head.material as THREE.MeshPhysicalMaterial
    expect(skin).toBeInstanceOf(THREE.MeshPhysicalMaterial)
    expect(skin.clearcoat).toBe(0)
    expect(skin.normalMap).toBe(avatar.normalMap)
    expect(skin.roughnessMap).toBe(avatar.roughnessMap)
    expect(skin.metalness).toBe(0)
    expect(avatar.head.geometry.getAttribute('skinCurvature')).toBeDefined()
    expect(avatar.head.geometry.getAttribute('skinCavity')).toBeDefined()
    expect(avatar.head.castShadow).toBe(true)
    expect(avatar.head.receiveShadow).toBe(true)

    visuals.dispose?.()
    disposeTestRoot(avatar.root)
  })

  it('patches the real physical shader cleanly: every hook applies and varyings match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const textures = acquireAvatarTextures()
    const { material, uniforms } = createSkinMaterial(
      new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture(), map: new THREE.Texture() }),
      textures,
      { regions: true, detailRepeat: 20 },
    )
    const shader = compilePhysical(material)

    expect(warn).not.toHaveBeenCalled()
    for (const varying of ['vSkinCurvature', 'vSkinCavity']) {
      expect(shader.vertexShader).toContain(`varying float ${varying};`)
      expect(shader.fragmentShader).toContain(`varying float ${varying};`)
      expect(shader.vertexShader).toContain(`${varying} = `)
    }
    for (const marker of ['skinDirectDiffuse', 'skinShadowTint', 'skinCavityAo', 'synthFresnel', 'uSkinDetailNormal', 'skinHeadCenterView']) {
      expect(shader.fragmentShader).toContain(marker)
    }
    // The replaced includes are gone (they were inlined with patches).
    expect(shader.fragmentShader).not.toContain('#include <lights_physical_pars_fragment>')
    expect(shader.fragmentShader).not.toContain('#include <lights_fragment_begin>')
    expect(Object.keys(shader.uniforms)).toEqual(expect.arrayContaining(Object.keys(uniforms)))

    material.dispose()
    releaseAvatarTextures(textures)
  })

  it('gives hair anisotropic highlights with alpha-to-coverage edges and no clearcoat', () => {
    const avatar = buildTestAvatar()
    const visuals = applyAvatarVisualTreatment(avatar.root)
    const hair = avatar.hair.material as THREE.MeshPhysicalMaterial

    expect(hair.anisotropy).toBeGreaterThan(0.5)
    expect(hair.clearcoat).toBe(0)
    expect(hair.alphaToCoverage).toBe(true)
    expect(hair.transparent).toBe(false)
    expect(hair.alphaTest).toBeGreaterThan(0)
    expect(hair.blendEquationAlpha).toBe(THREE.MaxEquation)
    const shader = compilePhysical(hair)
    expect(shader.fragmentShader).toContain('hairEdge')

    visuals.dispose?.()
    disposeTestRoot(avatar.root)
  })

  it('makes fabric sheen-y with a weave detail and the cornea a clear additive shell', () => {
    const avatar = buildTestAvatar()
    const visuals = applyAvatarVisualTreatment(avatar.root)

    const outfit = avatar.outfit.material as THREE.MeshPhysicalMaterial
    expect(outfit.sheen).toBeGreaterThan(0.5)
    expect(compilePhysical(outfit).fragmentShader).toContain('uDetailNormal')

    const cornea = avatar.cornea.material as THREE.MeshPhysicalMaterial
    expect(cornea.blending).toBe(THREE.AdditiveBlending)
    expect(cornea.roughness).toBeLessThan(0.05)
    expect(avatar.cornea.castShadow).toBe(false)

    const eyeball = avatar.eyeball.material as THREE.MeshPhysicalMaterial
    const eyeShader = compilePhysical(eyeball)
    expect(eyeShader.fragmentShader).toContain('eyeTangentFrame')
    expect(eyeShader.fragmentShader).toContain('uIrisDepth')

    visuals.dispose?.()
    disposeTestRoot(avatar.root)
  })

  it('rotates the eyeballs from eyeLook blendshapes toward the right side', () => {
    const avatar = buildTestAvatar()
    const visuals = applyAvatarVisualTreatment(avatar.root)

    visuals.setBlendshapes?.([
      { categoryName: 'eyeLookOutLeft', score: 1 },
      { categoryName: 'eyeLookInRight', score: 1 },
    ])
    for (let now = 0; now < 1000; now += 16) visuals.update(now, 0)

    avatar.root.updateMatrixWorld(true)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(avatar.leftEye.getWorldQuaternion(new THREE.Quaternion()))
    // Avatar faces +Z, so its left is +X.
    expect(forward.x).toBeGreaterThan(0.3)
    expect(forward.z).toBeGreaterThan(0.7)

    visuals.dispose?.()
    disposeTestRoot(avatar.root)
  })

  it('keeps the temple HUD (all states) on its own layer with a practical light', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const avatar = buildTestAvatar()
    const visuals = applyAvatarVisualTreatment(avatar.root)

    const ring = avatar.root.getObjectByName('TempleHudRing') as THREE.Group
    expect(ring.children).toHaveLength(2 + 6)
    ring.traverse((object) => expect(object.layers.isEnabled(HUD_LAYER)).toBe(true))
    expect(visuals.hud?.light.isPointLight).toBe(true)

    visuals.update(1000, 0)
    visuals.update(1100, 0.5)
    expect(ring.rotation.z).toBeGreaterThan(0)

    visuals.update(1320, 0, true)
    expect(visuals.hud?.color.getHex()).toBe(0xff3b30)
    visuals.update(1400, 0, true, true)
    expect(visuals.hud?.color.getHex()).toBe(0xffc233)
    visuals.update(1500, 0, false, true)
    expect(visuals.hud?.color.getHex()).toBe(0xffc233)

    // HDR emissive so the HUD-masked bloom picks the LED up.
    const mainRing = (ring.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
    expect(mainRing.color.r).toBeGreaterThan(1)

    visuals.dispose?.()
    disposeTestRoot(avatar.root)
  })
})

describe('computeCurvatureAttributes', () => {
  it('reports convex curvature (no cavity) on a sphere and welds UV seams', () => {
    const geometry = new THREE.SphereGeometry(0.01, 24, 16)
    const result = computeCurvatureAttributes(geometry)
    expect(result).not.toBeNull()
    const curvature = result!.curvature.array as Float32Array
    const cavity = result!.cavity.array as Float32Array
    // 1/r = 100 → a tightly curved feature.
    const mean = curvature.reduce((sum, value) => sum + value, 0) / curvature.length
    expect(mean).toBeGreaterThan(0.4)
    expect(Math.max(...cavity)).toBeLessThan(0.05)
    geometry.dispose()
  })

  it('returns null for non-indexed geometry', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
    expect(computeCurvatureAttributes(geometry)).toBeNull()
  })
})

describe('shared procedural textures', () => {
  it('are reference counted across avatar instances', () => {
    const first = acquireAvatarTextures()
    const second = acquireAvatarTextures()
    expect(second).toBe(first)
    const dispose = vi.spyOn(first.poreNormal, 'dispose')
    releaseAvatarTextures(first)
    expect(dispose).not.toHaveBeenCalled()
    releaseAvatarTextures(second)
    expect(dispose).toHaveBeenCalled()
  })
})
