import { Component, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from '@react-three/rapier'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
import { drawBand, drawCardBack, drawCardFront, makeTexture } from './textures'

extend({ MeshLineGeometry, MeshLineMaterial })

const CARD_W = 1.6
const CARD_H = 2.25
const CARD_D = 0.05
const CARD_R = 0.08

// Teknik yang sama dengan komponen Lanyard di React Bits:
// beberapa badan fisika (Rapier) dihubungkan tali (rope joint), kartu bisa ditarik,
// dan tali digambar dengan meshline mengikuti posisi badan-badan itu.
function useTextures() {
  return useMemo(() => {
    const front = document.createElement('canvas')
    front.width = 800
    front.height = 1125
    const back = document.createElement('canvas')
    back.width = 800
    back.height = 1125
    const band = document.createElement('canvas')
    band.width = 2048
    band.height = 128

    let photo = null
    const draw = () => {
      drawCardFront(front, photo)
      drawCardBack(back)
      drawBand(band)
    }
    draw()

    const textures = { front: makeTexture(front), back: makeTexture(back), band: makeTexture(band) }
    textures.band.wrapS = textures.band.wrapT = THREE.RepeatWrapping

    // foto opsional: taruh di images/foto.jpg (jpg/png/webp). Kalau tidak ada, kartu tetap tampil tanpa foto.
    const tryPhoto = (i) => {
      const names = ['images/foto.jpg', 'images/foto.png', 'images/foto.webp', 'images/foto.jpeg']
      if (i >= names.length) return
      const img = new Image()
      img.onload = () => {
        // saat index.html dibuka langsung dari file://, foto dianggap "tainted" dan WebGL menolaknya
        // (canvas yang sudah tainted tidak bisa dipulihkan). Cek dulu di canvas kecil terpisah;
        // kalau gagal, kartu tetap tanpa foto. Di GitHub Pages atau server lokal foto tampil normal.
        try {
          const t = document.createElement('canvas')
          t.width = t.height = 1
          const c = t.getContext('2d')
          c.drawImage(img, 0, 0, 1, 1)
          c.getImageData(0, 0, 1, 1)
        } catch (e) {
          return
        }
        photo = img
        draw()
        textures.front.needsUpdate = true
      }
      img.onerror = () => tryPhoto(i + 1)
      img.src = names[i]
    }
    tryPhoto(0)

    // gambar ulang setelah font situs (Inter, Playfair Display) selesai dimuat
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('700 100px "Inter"'),
        document.fonts.load('500 30px "Inter"'),
        document.fonts.load('700 100px "Playfair Display"'),
      ])
        .then(() => {
          draw()
          Object.values(textures).forEach((t) => (t.needsUpdate = true))
        })
        .catch(() => {})
    }
    return textures
  }, [])
}

function roundedCardGeometry() {
  const w = CARD_W / 2
  const h = CARD_H / 2
  const r = CARD_R
  const s = new THREE.Shape()
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w, h - r)
  s.absarc(w - r, h - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w + r, h)
  s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w, -h + r)
  s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false)
  const g = new THREE.ExtrudeGeometry(s, { depth: CARD_D, bevelEnabled: false, curveSegments: 24 })
  g.translate(0, 0, -CARD_D / 2)
  return g
}

function Band({ maxSpeed = 50, minSpeed = 0 }) {
  const band = useRef()
  const fixed = useRef()
  const j1 = useRef()
  const j2 = useRef()
  const j3 = useRef()
  const card = useRef()

  const vec = useMemo(() => new THREE.Vector3(), [])
  const ang = useMemo(() => new THREE.Vector3(), [])
  const rot = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const ring = useMemo(() => new THREE.Vector3(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])

  const segmentProps = {
    type: 'dynamic',
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4,
  }

  const { width, height } = useThree((state) => state.size)
  const textures = useTextures()
  const bodyGeometry = useMemo(() => roundedCardGeometry(), [])
  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  )
  const [dragged, drag] = useState(false)
  const [hovered, hover] = useState(false)

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1])
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.4, 0]])

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab'
      return () => {
        document.body.style.cursor = 'auto'
      }
    }
  }, [hovered, dragged])

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      dir.copy(vec).sub(state.camera.position).normalize()
      vec.add(dir.multiplyScalar(state.camera.position.length()))
      ;[card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp())
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      })
    }
    if (fixed.current && band.current) {
      ;[j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation())
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())))
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)),
        )
      })
      // ujung tali berhenti tepat di cincin kartu (mengikuti rotasi kartu), bukan di badan fisika j3
      ring.set(0, CARD_H / 2 + 0.26, 0).applyQuaternion(quat.copy(card.current.rotation())).add(card.current.translation())
      curve.points[0].copy(ring)
      curve.points[1].copy(j2.current.lerped)
      curve.points[2].copy(j1.current.lerped)
      curve.points[3].copy(fixed.current.translation())
      band.current.geometry.setPoints(curve.getPoints(32))

      // redam putaran supaya kartu tidak berputar terus
      ang.copy(card.current.angvel())
      rot.copy(card.current.rotation())
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z })
    }
  })

  curve.curveType = 'chordal'

  return (
    <>
      <group position={[0, 3.3, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[CARD_W / 2, CARD_H / 2, 0.02]} />
          <group
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              e.target.releasePointerCapture(e.pointerId)
              drag(false)
            }}
            onPointerDown={(e) => {
              e.target.setPointerCapture(e.pointerId)
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())))
            }}
          >
            {/* badan kartu */}
            <mesh geometry={bodyGeometry}>
              <meshStandardMaterial color="#8a8a86" metalness={0.2} roughness={0.6} />
            </mesh>
            {/* sisi depan */}
            <mesh position={[0, 0, CARD_D / 2 + 0.0015]}>
              <planeGeometry args={[CARD_W, CARD_H]} />
              <meshBasicMaterial map={textures.front} transparent toneMapped={false} />
            </mesh>
            {/* sisi belakang */}
            <mesh position={[0, 0, -CARD_D / 2 - 0.0015]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[CARD_W, CARD_H]} />
              <meshBasicMaterial map={textures.back} transparent toneMapped={false} />
            </mesh>
            {/* penjepit logam abu-abu tempat tali masuk */}
            <RoundedBox args={[0.44, 0.3, 0.085]} radius={0.035} smoothness={4} position={[0, CARD_H / 2 + 0.2, 0]}>
              <meshStandardMaterial color="#b9bec6" metalness={0.85} roughness={0.38} />
            </RoundedBox>
            <mesh position={[0, CARD_H / 2 + 0.115, 0]}>
              <boxGeometry args={[0.45, 0.03, 0.09]} />
              <meshStandardMaterial color="#8d939c" metalness={0.85} roughness={0.45} />
            </mesh>
            {/* cincin: turun dari penjepit dan menembus lubang kartu */}
            <mesh position={[0, CARD_H / 2 - 0.01, 0]} rotation={[0, 1.1, 0]}>
              <torusGeometry args={[0.12, 0.023, 16, 40]} />
              <meshStandardMaterial color="#c4c9d1" metalness={1} roughness={0.25} />
            </mesh>
          </group>
        </RigidBody>
      </group>

      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest
          resolution={[width, height]}
          useMap
          map={textures.band}
          repeat={[-3, 1]}
          lineWidth={1.15}
        />
      </mesh>
    </>
  )
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('Lanyard tidak bisa ditampilkan:', error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function Lanyard() {
  const wrapper = useRef(null)
  const [visible, setVisible] = useState(true)

  // hentikan render dan fisika saat bagian hero tidak terlihat, supaya hemat baterai
  useEffect(() => {
    if (!wrapper.current || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 })
    io.observe(wrapper.current)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrapper} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 12.5], fov: 25 }}
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={[0, -40, 0]} timeStep={1 / 60}>
          <Band />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  )
}
