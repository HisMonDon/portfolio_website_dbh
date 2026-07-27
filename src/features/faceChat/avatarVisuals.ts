import * as THREE from 'three'

const SYNTH_SKIN_RIM_COLOR = 0x66d9ff
const TEMPLE_HUD_RADIUS = 0.006
const TEMPLE_HUD_TICK_COUNT = 6
const TEMPLE_HUD_ROTATION_SPEED = 0.6
const TEMPLE_HUD_PULSE_SPEED = 1.8
const TEMPLE_HUD_CRITICAL_COLOR = 0xff3b30
const TEMPLE_HUD_CRITICAL_DIM_COLOR = 0x330000
const TEMPLE_HUD_CRITICAL_BLINK_MS = 220

interface SyntheticSkinUniforms {
  uRimColor: { value: THREE.Color }
  uRimIntensity: { value: number }
}

interface TempleHud {
  ring: THREE.Group
  mainMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  tickMaterials: THREE.MeshBasicMaterial[]
  light: THREE.PointLight
  flickerUntil: number
  nextFlickerAt: number
  angle: number
  lastUpdateMs: number | null
}

export interface AvatarVisualController {
  update: (nowMs: number, jawOpenAmount: number, critical?: boolean) => void
}

function getSingleSurfaceMaterial(mesh: THREE.Mesh): THREE.MeshStandardMaterial | null {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material instanceof THREE.MeshStandardMaterial ? material : null
}

function physicalMaterialFrom(
  original: THREE.MeshStandardMaterial,
  overrides: Partial<THREE.MeshPhysicalMaterialParameters>,
) {
  return new THREE.MeshPhysicalMaterial({
    map: original.map,
    color: original.color,
    normalMap: original.normalMap,
    normalScale: original.normalScale,
    roughnessMap: original.roughnessMap,
    metalnessMap: original.metalnessMap,
    roughness: original.roughness,
    metalness: original.metalness,
    aoMap: original.aoMap,
    aoMapIntensity: original.aoMapIntensity,
    emissive: original.emissive,
    emissiveMap: original.emissiveMap,
    emissiveIntensity: original.emissiveIntensity,
    alphaMap: original.alphaMap,
    alphaTest: original.alphaTest,
    transparent: original.transparent,
    opacity: original.opacity,
    depthTest: original.depthTest,
    depthWrite: original.depthWrite,
    side: original.side,
    ...overrides,
  })
}

// The Ready Player Me outfit can contain hand-influenced faces that stretch across the fingers.
// This is the same cleanup pass used by the recording harness before pose playback.
function removeHandCoveringFaces(mesh: THREE.SkinnedMesh) {
  const index = mesh.geometry.index
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const skinWeight = mesh.geometry.getAttribute('skinWeight')

  if (!index || !skinIndex || !skinWeight || !mesh.skeleton) return

  const handBoneIndices = new Set<number>()

  mesh.skeleton.bones.forEach((bone, boneIndex) => {
    if (/hand|thumb|index|middle|ring|pinky/i.test(bone.name)) handBoneIndices.add(boneIndex)
  })

  const attributeComponent = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, vertex: number, component: number) => {
    if (component === 0) return attribute.getX(vertex)
    if (component === 1) return attribute.getY(vertex)
    if (component === 2) return attribute.getZ(vertex)
    return attribute.getW(vertex)
  }

  const isHandVertex = (vertex: number) => {
    for (let component = 0; component < 4; component += 1) {
      const boneIndex = attributeComponent(skinIndex, vertex, component)
      const weight = attributeComponent(skinWeight, vertex, component)

      if (weight > 0.01 && handBoneIndices.has(boneIndex)) return true
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

// Finds the lip region from the vertices affected most strongly by mouth morph targets, then
// gives only those triangles a stronger clearcoat. This preserves every facial morph because the
// gloss remains a second material group on the original morphable head geometry.
function addLipGloss(mesh: THREE.Mesh) {
  const dictionary = mesh.morphTargetDictionary
  const morphPositions = mesh.geometry.morphAttributes.position
  const index = mesh.geometry.index
  const original = getSingleSurfaceMaterial(mesh)

  if (!dictionary || !morphPositions || !index || !original) return

  const mouthMorphNames = Object.keys(dictionary).filter((name) => /mouth|lip/i.test(name))
  const vertexCount = mesh.geometry.getAttribute('position')?.count ?? 0

  if (mouthMorphNames.length === 0 || vertexCount === 0) return

  const deltas = new Float32Array(vertexCount)

  mouthMorphNames.forEach((name) => {
    const attribute = morphPositions[dictionary[name]]

    if (!attribute) return

    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      deltas[vertex] += Math.hypot(
        attribute.getX(vertex),
        attribute.getY(vertex),
        attribute.getZ(vertex),
      )
    }
  })

  const sortedDeltas = Array.from(deltas).sort((a, b) => b - a)
  const cutoff = sortedDeltas[Math.floor(vertexCount * 0.05)] ?? Number.POSITIVE_INFINITY
  const isLipVertex = (vertex: number) => deltas[vertex] >= cutoff && deltas[vertex] > 1e-6
  const restTriangles: number[] = []
  const lipTriangles: number[] = []

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset)
    const b = index.getX(offset + 1)
    const c = index.getX(offset + 2)
    const target = isLipVertex(a) || isLipVertex(b) || isLipVertex(c)
      ? lipTriangles
      : restTriangles

    target.push(a, b, c)
  }

  mesh.geometry.setIndex([...restTriangles, ...lipTriangles])
  mesh.geometry.clearGroups()
  mesh.geometry.addGroup(0, restTriangles.length, 0)
  mesh.geometry.addGroup(restTriangles.length, lipTriangles.length, 1)

  const lipMaterial = physicalMaterialFrom(original, {
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
  })

  mesh.material = [original, lipMaterial]
}

function makeGlossy(
  mesh: THREE.Mesh,
  options: Pick<
    THREE.MeshPhysicalMaterialParameters,
    'roughness' | 'clearcoat' | 'clearcoatRoughness'
  >,
) {
  const original = getSingleSurfaceMaterial(mesh)

  if (!original) return

  mesh.material = physicalMaterialFrom(original, options)
  original.dispose()
}

// Converts the baked skin to a physical clearcoat material and injects the source file's
// view-dependent cyan Fresnel term into the compiled fragment shader.
function applySyntheticSkin(
  mesh: THREE.Mesh,
  syntheticSkinUniforms: SyntheticSkinUniforms[],
  roughness?: number,
) {
  const original = getSingleSurfaceMaterial(mesh)

  if (!original) return

  const material = physicalMaterialFrom(original, {
    roughness: roughness ?? original.roughness,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
  })
  const uniforms: SyntheticSkinUniforms = {
    uRimColor: { value: new THREE.Color(SYNTH_SKIN_RIM_COLOR) },
    uRimIntensity: { value: 0.12 },
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = uniforms.uRimColor
    shader.uniforms.uRimIntensity = uniforms.uRimIntensity
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimIntensity;',
      )
      .replace(
        '#include <dithering_fragment>',
        `float synthFresnel = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        gl_FragColor.rgb += uRimColor * synthFresnel * uRimIntensity;
        #include <dithering_fragment>`,
      )
  }
  material.customProgramCacheKey = () => 'clip-avatar-synthetic-skin-v1'

  mesh.material = material
  original.dispose()
  syntheticSkinUniforms.push(uniforms)
}

function createTempleHud(headNode: THREE.Object3D, nowMs: number): TempleHud {
  const mount = new THREE.Group()
  mount.name = 'TempleHudMount'
  headNode.add(mount)
  headNode.updateMatrixWorld(true)

  // Exact calibrated left-temple world position from phase5-recording/test.js.
  const restWorldPosition = new THREE.Vector3(-0.06, 1.707, 0.08)
  mount.position.copy(headNode.worldToLocal(restWorldPosition.clone()))
  mount.rotation.y = -Math.PI / 2

  const ring = new THREE.Group()
  ring.name = 'TempleHudRing'
  mount.add(ring)

  const mainMaterial = new THREE.MeshBasicMaterial({
    color: 0x33e6ff,
    toneMapped: false,
  })
  const mainRing = new THREE.Mesh(
    new THREE.TorusGeometry(TEMPLE_HUD_RADIUS, 0.0012, 8, 48),
    mainMaterial,
  )
  ring.add(mainRing)

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x33e6ff,
    toneMapped: false,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(TEMPLE_HUD_RADIUS, 0.004, 8, 48),
    glowMaterial,
  )
  ring.add(glowRing)

  const tickMaterials: THREE.MeshBasicMaterial[] = []

  for (let index = 0; index < TEMPLE_HUD_TICK_COUNT; index += 1) {
    const angle = (index / TEMPLE_HUD_TICK_COUNT) * Math.PI * 2
    const tickMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8fbff,
      toneMapped: false,
      transparent: true,
      opacity: 0.8,
    })
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.0018, 0.0042, 0.0008),
      tickMaterial,
    )

    tick.position.set(
      Math.cos(angle) * TEMPLE_HUD_RADIUS,
      Math.sin(angle) * TEMPLE_HUD_RADIUS,
      0,
    )
    tick.rotation.z = angle + Math.PI / 2
    ring.add(tick)
    tickMaterials.push(tickMaterial)
  }

  // The source includes a tiny practical light so the ring casts cyan back onto nearby skin.
  const light = new THREE.PointLight(0x33e6ff, 0.05, 0.15, 2)
  mount.add(light)

  return {
    ring,
    mainMaterial,
    glowMaterial,
    tickMaterials,
    light,
    flickerUntil: nowMs + 900,
    nextFlickerAt: nowMs + 5000 + Math.random() * 8000,
    angle: 0,
    lastUpdateMs: null,
  }
}

function findHeadNode(root: THREE.Object3D) {
  let headNode: THREE.Object3D | null = null

  root.traverse((object) => {
    const bone = object as THREE.Bone
    if (!headNode && bone.isBone && /head/i.test(bone.name)) headNode = bone
  })

  if (headNode) return headNode

  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!headNode && mesh.isMesh && /head/i.test(mesh.name)) headNode = mesh
  })

  return headNode ?? root
}

function tuneMaterialRoughness(object: THREE.Object3D | undefined, roughness: number) {
  if (!object) return

  const mesh = object as THREE.Mesh

  if (!mesh.isMesh) return

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

  materials.forEach((material) => {
    if (material instanceof THREE.MeshStandardMaterial) material.roughness = roughness
  })
}

export function applyAvatarVisualTreatment(root: THREE.Group): AvatarVisualController {
  const syntheticSkinUniforms: SyntheticSkinUniforms[] = []

  tuneMaterialRoughness(root.getObjectByName('AvatarLeftCornea'), 0.05)
  tuneMaterialRoughness(root.getObjectByName('AvatarRightCornea'), 0.05)

  for (const name of ['AvatarLeftEyeball', 'AvatarRightEyeball']) {
    const eyeball = root.getObjectByName(name) as THREE.Mesh | undefined
    const material = eyeball?.isMesh ? getSingleSurfaceMaterial(eyeball) : null

    if (material) material.roughness = Math.min(material.roughness, 0.25)
  }

  const avatarHead = root.getObjectByName('AvatarHead') as THREE.Mesh | undefined

  if (avatarHead?.isMesh) {
    applySyntheticSkin(avatarHead, syntheticSkinUniforms, 0.6)
    addLipGloss(avatarHead)
  }

  const avatarBody = root.getObjectByName('AvatarBody') as THREE.Mesh | undefined
  if (avatarBody?.isMesh) applySyntheticSkin(avatarBody, syntheticSkinUniforms)

  const haircut = root.getObjectByName('haircut') as THREE.Mesh | undefined

  if (haircut?.isMesh) {
    makeGlossy(haircut, {
      roughness: 0.3,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
    })
  }

  const outfit = root.getObjectByName('outfit') as THREE.SkinnedMesh | undefined
  if (outfit?.isSkinnedMesh) removeHandCoveringFaces(outfit)

  const templeHud = createTempleHud(findHeadNode(root), performance.now())

  // Match the source's lighting-layer intent: the cyan rim light reaches the avatar and HUD,
  // while eye/cornea surfaces stay on the normal key/fill lighting layer.
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) mesh.layers.enable(1)
  })
  for (const name of [
    'AvatarLeftCornea',
    'AvatarRightCornea',
    'AvatarLeftEyeball',
    'AvatarRightEyeball',
  ]) {
    root.getObjectByName(name)?.layers.disable(1)
  }

  return {
    update(nowMs, jawOpenAmount, critical = false) {
      const elapsedSeconds = nowMs / 1000
      const deltaSeconds = templeHud.lastUpdateMs === null
        ? 0
        : Math.min((nowMs - templeHud.lastUpdateMs) / 1000, 0.1)
      templeHud.lastUpdateMs = nowMs

      let ringColor: number
      let tickColor: number
      let speedMultiplier: number

      if (critical) {
        const blinkOn = Math.floor(nowMs / TEMPLE_HUD_CRITICAL_BLINK_MS) % 2 === 0
        ringColor = blinkOn ? TEMPLE_HUD_CRITICAL_COLOR : TEMPLE_HUD_CRITICAL_DIM_COLOR
        tickColor = blinkOn ? 0xff9c94 : TEMPLE_HUD_CRITICAL_DIM_COLOR
        speedMultiplier = 2.6
      } else {
        if (nowMs >= templeHud.nextFlickerAt) {
          templeHud.flickerUntil = nowMs + 70 + Math.random() * 120
          templeHud.nextFlickerAt = nowMs + 4500 + Math.random() * 8500
        }

        const flickeringAmber = nowMs < templeHud.flickerUntil
          && Math.floor(nowMs / 45) % 2 === 0
        ringColor = flickeringAmber ? 0xffc233 : 0x33e6ff
        tickColor = flickeringAmber ? 0xffe38a : 0xd8fbff
        speedMultiplier = 1 + jawOpenAmount * 1.2
      }

      templeHud.mainMaterial.color.setHex(ringColor)
      templeHud.glowMaterial.color.setHex(ringColor)
      templeHud.tickMaterials.forEach((material) => material.color.setHex(tickColor))

      templeHud.angle += deltaSeconds * TEMPLE_HUD_ROTATION_SPEED * speedMultiplier
      templeHud.ring.rotation.z = templeHud.angle

      const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * TEMPLE_HUD_PULSE_SPEED)
      templeHud.glowMaterial.opacity = 0.2 + 0.3 * pulse
      templeHud.tickMaterials.forEach((material, index) => {
        const phase = elapsedSeconds * TEMPLE_HUD_PULSE_SPEED
          + (index / templeHud.tickMaterials.length) * Math.PI * 2
        material.opacity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(phase))
      })

      templeHud.light.color.setHex(ringColor)
      templeHud.light.intensity = (critical ? 0.03 : 0.05) + 0.04 * pulse

      const skinPulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * 0.6 + Math.PI / 3)
      const skinRimIntensity = 0.1 + 0.08 * skinPulse
      syntheticSkinUniforms.forEach((uniforms) => {
        uniforms.uRimIntensity.value = skinRimIntensity
      })
    },
  }
}
