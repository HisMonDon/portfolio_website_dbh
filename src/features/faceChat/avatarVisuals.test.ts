import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { applyAvatarVisualTreatment } from './avatarVisuals'

function disposeTestRoot(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh

    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((material) => material.dispose())
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('applyAvatarVisualTreatment', () => {
  it('ports the physical reflections, skin shader, lip gloss, surface tuning, and temple HUD', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const root = new THREE.Group()
    const headBone = new THREE.Bone()
    headBone.name = 'Head'
    root.add(headBone)

    const headGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
    const head = new THREE.Mesh(
      headGeometry,
      new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    )
    head.name = 'AvatarHead'
    head.morphTargetDictionary = { mouthSmileLeft: 0 }
    headGeometry.morphAttributes.position = [
      new THREE.Float32BufferAttribute(
        new Float32Array(headGeometry.getAttribute('position').count * 3).fill(0.001),
        3,
      ),
    ]
    root.add(head)

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.4, 0.1),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    )
    body.name = 'AvatarBody'
    root.add(body)

    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    )
    hair.name = 'haircut'
    root.add(hair)

    const cornea = new THREE.Mesh(
      new THREE.SphereGeometry(0.01),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    )
    cornea.name = 'AvatarLeftCornea'
    root.add(cornea)

    root.updateMatrixWorld(true)
    const visuals = applyAvatarVisualTreatment(root)

    expect(Array.isArray(head.material)).toBe(true)
    const headMaterials = head.material as unknown as THREE.MeshPhysicalMaterial[]
    expect(headMaterials[0].clearcoat).toBe(0.15)
    expect(headMaterials[0].roughness).toBe(0.4)
    expect(headMaterials[1].clearcoat).toBe(0.6)
    expect(headMaterials[1].clearcoatRoughness).toBe(0.15)

    const compiledShader = {
      uniforms: {},
      fragmentShader: '#include <common>\n#include <dithering_fragment>',
    }
    headMaterials[0].onBeforeCompile(
      compiledShader as never,
      null as never,
    )
    expect(compiledShader.fragmentShader).toContain('synthFresnel')
    expect(compiledShader.uniforms).toHaveProperty('uRimColor')
    expect(compiledShader.uniforms).toHaveProperty('uRimIntensity')

    const bodyMaterial = body.material as THREE.MeshPhysicalMaterial
    expect(bodyMaterial.clearcoat).toBe(0.15)
    expect(bodyMaterial.clearcoatRoughness).toBe(0.2)
    expect(bodyMaterial.roughness).toBe(0.4)

    const hairMaterial = hair.material as THREE.MeshPhysicalMaterial
    expect(hairMaterial.roughness).toBe(0.3)
    expect(hairMaterial.clearcoat).toBe(0.4)
    expect(hairMaterial.clearcoatRoughness).toBe(0.25)
    expect((cornea.material as THREE.MeshStandardMaterial).roughness).toBe(0.05)

    const ring = root.getObjectByName('TempleHudRing') as THREE.Group
    expect(ring).toBeDefined()
    expect(ring.children).toHaveLength(2 + 6)
    expect(root.getObjectByProperty('isPointLight', true)).toBeDefined()

    visuals.update(1000, 0)
    visuals.update(1100, 0.5)
    expect(ring.rotation.z).toBeGreaterThan(0)

    visuals.update(1320, 0, true)
    const mainRingMaterial = (ring.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
    expect(mainRingMaterial.color.getHex()).toBe(0xff3b30)

    visuals.update(1400, 0, true, true)
    expect(mainRingMaterial.color.getHex()).toBe(0xffc233)
    visuals.update(1500, 0, false, true)
    expect(mainRingMaterial.color.getHex()).toBe(0xffc233)

    disposeTestRoot(root)
  })
})
