import * as THREE from 'three'

// A procedural portrait studio used as the image-based lighting source. It is rendered once into
// a PMREM cube-UV texture, so it costs nothing per frame and adds no download. The layout is a
// classic three-quarter portrait setup around a subject facing +Z with the head at ~1.65 m:
//   - a large neutral-cool key softbox front-right and above (broad, soft key + rectangular catchlights)
//   - a big dim cool fill front-left
//   - a tall narrow cyan strip behind-left (the android rim)
//   - a narrow neutral strip behind-right for separation
//   - a soft overhead panel and a dim neutral floor bounce under the chin
// Everything else is a dark grey cyclorama, so reflections have something to show without
// washing out contrast.

interface Panel {
  width: number
  height: number
  position: [number, number, number]
  color: THREE.ColorRepresentation
  intensity: number
}

const SUBJECT = new THREE.Vector3(0, 1.65, 0)

const PANELS: Panel[] = [
  // Key
  { width: 1.5, height: 1.8, position: [1.55, 2.45, 1.85], color: 0xf6f8fc, intensity: 7.5 },
  // Fill
  { width: 2.4, height: 2.0, position: [-2.3, 1.75, 1.5], color: 0xe2edf9, intensity: 1.35 },
  // Cyan rim strip
  { width: 0.32, height: 2.6, position: [-1.1, 2.0, -2.6], color: 0x5fd6ff, intensity: 3.0 },
  // Neutral back strip
  { width: 0.28, height: 2.2, position: [1.7, 2.1, -1.6], color: 0xeef4ff, intensity: 2.4 },
  // Overhead
  { width: 2.0, height: 2.0, position: [0, 4.2, 0.4], color: 0xf4f7ff, intensity: 0.9 },
]

export function createStudioEnvironmentScene() {
  const scene = new THREE.Scene()
  const disposables: { dispose: () => void }[] = []

  // Cyclorama: dark grey walls with a slightly lighter neutral floor for under-chin bounce.
  const roomGeometry = new THREE.SphereGeometry(9, 32, 16)
  const roomColors: number[] = []
  const position = roomGeometry.getAttribute('position')
  const color = new THREE.Color()

  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index) / 9
    // Floor (y < 0): neutral grey bounce; walls: dark cool grey fading darker toward the ceiling.
    if (y < -0.15) color.setRGB(0.135, 0.14, 0.15)
    else color.setRGB(0.03, 0.034, 0.04).multiplyScalar(1.15 - Math.max(0, y) * 0.6)
    roomColors.push(color.r, color.g, color.b)
  }

  roomGeometry.setAttribute('color', new THREE.Float32BufferAttribute(roomColors, 3))
  const roomMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })
  const room = new THREE.Mesh(roomGeometry, roomMaterial)
  room.position.copy(SUBJECT)
  scene.add(room)
  disposables.push(roomGeometry, roomMaterial)

  const panelGeometry = new THREE.PlaneGeometry(1, 1)
  disposables.push(panelGeometry)

  PANELS.forEach((panel) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(panel.color).multiplyScalar(panel.intensity),
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(panelGeometry, material)
    mesh.scale.set(panel.width, panel.height, 1)
    mesh.position.set(...panel.position)
    mesh.lookAt(SUBJECT)
    scene.add(mesh)
    disposables.push(material)
  })

  return {
    scene,
    dispose: () => disposables.forEach((item) => item.dispose()),
  }
}

export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const studio = createStudioEnvironmentScene()
  const target = pmrem.fromScene(studio.scene, 0.015, 0.1, 30, { size: 256, position: SUBJECT })
  studio.dispose()
  pmrem.dispose()

  return target
}

// Direction (from the subject) of the key softbox, so the shadow-casting key light can be aligned
// with the reflection the eyes and skin show.
export const STUDIO_KEY_DIRECTION = new THREE.Vector3(...PANELS[0].position).sub(SUBJECT).normalize()
export const STUDIO_RIM_DIRECTION = new THREE.Vector3(...PANELS[2].position).sub(SUBJECT).normalize()
