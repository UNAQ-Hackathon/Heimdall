import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  prepareAnimatableAstronaut,
  applyAstronautPose,
} from './astronaut-limb-anim.js';
import { normalizeModel } from './normalize-model.js';

const suitUrlMap = import.meta.glob('../../../../assets3d/trajesEspaciales/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const shipUrlMap = import.meta.glob('../../../../assets3d/nuevasNaves/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const fxUrlMap = import.meta.glob('../../../../assets3d/FX/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const spaceTexUrlMap = import.meta.glob('../../../../assets3d/texturaMapaEspacio/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});

const ASTRO_NORMAL_URL = suitUrlMap['../../../../assets3d/trajesEspaciales/astronautaNormal.glb'];
const ASTRO_FLAMES_URL = suitUrlMap['../../../../assets3d/trajesEspaciales/astronautaLlamas.glb'];
const ASTRO_BURNED_URL = suitUrlMap['../../../../assets3d/trajesEspaciales/astronautaQuemado.glb'];
const LANDER_URL = shipUrlMap['../../../../assets3d/nuevasNaves/landerNuevo.glb'];
const BLUE_SHIP_URL = shipUrlMap['../../../../assets3d/nuevasNaves/naveAzulNuevo.glb'];
const BLUE_SHIP_FLAMES_URL = shipUrlMap['../../../../assets3d/nuevasNaves/naveAzulLlamas.glb'];
const BLUE_SHIP_BURNED_URL = shipUrlMap['../../../../assets3d/nuevasNaves/naveAzulQuemada.glb'];
const SMOKE_COL_URL = fxUrlMap['../../../../assets3d/FX/humo_despegue_columna_chico.glb'];
const SPACE_HEX_URL = spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex.png'];

export const TEST_SUBJECT_OPTIONS = [
  { id: 'astronaut', label: 'EVA Spacesuit', kind: 'suit' },
  { id: 'lander', label: 'Lunar Lander / Habitat', kind: 'vehicle' },
  { id: 'spacecraft-blue', label: 'Spacecraft · Blue Explorer', kind: 'vehicle' },
];

const VEHICLE_TEST_CONFIG = {
  lander: {
    url: LANDER_URL,
    flamesUrl: null,
    burnedUrl: null,
    scale: 1.05,
    y: -0.18,
    pitch: 0.14,
    smokePos: [0, 0.56, -0.08],
    flameAnchors: [
      { pos: [0, 0.12, 0.24], rot: [0.12, 0, 0] },
      { pos: [-0.26, 0.04, 0.06], rot: [0, 0, 0.2] },
      { pos: [0.26, 0.04, -0.06], rot: [0, 0, -0.2] },
    ],
  },
  'spacecraft-blue': {
    url: BLUE_SHIP_URL,
    flamesUrl: BLUE_SHIP_FLAMES_URL,
    burnedUrl: BLUE_SHIP_BURNED_URL,
    scale: 1.08,
    y: -0.05,
    pitch: 0.34,
    smokePos: [0, 0.36, 0.04],
    flameAnchors: [],
  },
};

[
  ASTRO_NORMAL_URL,
  ASTRO_FLAMES_URL,
  ASTRO_BURNED_URL,
  BLUE_SHIP_URL,
  BLUE_SHIP_FLAMES_URL,
  BLUE_SHIP_BURNED_URL,
  SMOKE_COL_URL,
]
  .filter(Boolean)
  .forEach((url) => useGLTF.preload(url));

/**
 * Creates a base low-poly triangulated teardrop geometry whose vertices
 * can be animated in real time while preserving crisp flat-shaded triangles.
 */
function createTeardropBaseGeometry(radius = 0.65, height = 2.1, radialSegs = 12, heightSegs = 9) {
  const geo = new THREE.CylinderGeometry(0.02, radius, height, radialSegs, heightSegs, false);
  geo.translate(0, height / 2, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = Math.max(0, Math.min(1, y / height));

    const profile = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.85) * (1.15 - 0.3 * u);
    const currentR = Math.hypot(x, z);
    if (currentR > 1e-4) {
      const targetR = radius * profile;
      const factor = targetR / currentR;
      const angle = Math.atan2(z, x);
      const jitter = 1 + Math.sin(angle * 5 + u * 9) * 0.04;
      pos.setX(i, x * factor * jitter);
      pos.setZ(i, z * factor * jitter);
    }
  }

  const nonIndexed = geo.toNonIndexed();
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

/**
 * Cone geometry with wide base pinned at y=0 so scaling grows strictly upward!
 */
function createUpwardFlameCone(radius, height, segs = 5) {
  const geo = new THREE.ConeGeometry(radius, height, segs);
  geo.translate(0, height / 2, 0);
  return geo;
}

/**
 * Subtle Space Hex Background Plane inside the 3D Chamber
 */
function ChamberSpaceBackdrop() {
  if (!SPACE_HEX_URL) return null;
  const tex = useTexture(SPACE_HEX_URL);
  useMemo(() => {
    if (!tex) return;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(2, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);

  return (
    <mesh position={[0, 0, -4.5]}>
      <planeGeometry args={[14, 9]} />
      <meshBasicMaterial map={tex} transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

/**
 * Low-poly tetrahedral embers rising from the flame
 */
function RisingLowPolyEmbers({ count = 18, color = '#fbbf24', isSpherical = false, levelScale = 1 }) {
  const groupRef = useRef();
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        phase: (i / count) * Math.PI * 2,
        speed: 0.55 + ((i * 7) % 11) * 0.06,
        radius: 0.15 + ((i * 13) % 9) * 0.055,
        size: 0.025 + ((i * 5) % 6) * 0.008,
      })),
    [count]
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i += 1) {
      const mesh = children[i];
      const s = seeds[i];
      const cycle = (t * s.speed * (0.8 + levelScale * 0.4) + s.phase) % 1;
      if (isSpherical) {
        const r = (0.5 + cycle * 0.65) * levelScale;
        const theta = s.phase + t * 0.5;
        const phi = (i % 5) * 0.6 - 1.2;
        mesh.position.set(
          Math.cos(theta) * Math.cos(phi) * r,
          Math.sin(phi) * r,
          Math.sin(theta) * Math.cos(phi) * r
        );
      } else {
        const y = 0.2 + cycle * (1.2 + levelScale * 1.15);
        const spiral = s.phase + t * 1.8 + cycle * 3.0;
        const spread = s.radius * (0.7 + levelScale * 0.45) * (1 - cycle * 0.5);
        mesh.position.set(Math.cos(spiral) * spread, y, Math.sin(spiral) * spread);
      }
      const scale = s.size * (0.7 + levelScale * 0.5) * (1 - cycle * 0.75);
      mesh.scale.setScalar(Math.max(0.004, scale));
      mesh.rotation.x = t * 2.2 + s.phase;
      mesh.rotation.y = t * 1.7 + s.phase;
    }
  });

  return (
    <group ref={groupRef}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <tetrahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function extractFlameMeshParts(root, isFlameMesh) {
  const flameParts = [];

  root.traverse((node) => {
    if (node.isMesh && node.geometry?.attributes?.position && isFlameMesh(node)) {
      node.geometry = node.geometry.clone();
      const posAttr = node.geometry.attributes.position;
      const basePos = Float32Array.from(posAttr.array);
      let minY = Infinity;
      let maxY = -Infinity;
      let sumX = 0;
      let sumZ = 0;
      for (let i = 0; i < posAttr.count; i += 1) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumX += x;
        sumZ += z;
      }
      const cx = sumX / Math.max(1, posAttr.count);
      const cz = sumZ / Math.max(1, posAttr.count);
      const spanY = Math.max(0.05, maxY - minY);
      flameParts.push({ mesh: node, basePos, minY, spanY, cx, cz });
    }
  });

  return flameParts;
}

function animateFlameMeshParts(flameParts, t, flameGrowth) {
  for (let p = 0; p < flameParts.length; p += 1) {
    const { mesh, basePos, minY, spanY, cx, cz } = flameParts[p];
    const posAttr = mesh.geometry.attributes.position;
    const arr = posAttr.array;

    for (let i = 0; i < arr.length; i += 3) {
      const bx = basePos[i];
      const by = basePos[i + 1];
      const bz = basePos[i + 2];
      const u = Math.max(0, (by - minY) / spanY);

      const flicker = 1 + Math.sin(t * 16 + bx * 12 + p) * 0.18 * u;
      const swayX = Math.sin(t * 11 + by * 8 + p) * 0.028 * u * flameGrowth;
      const swayZ = Math.cos(t * 9 + bx * 8 + p) * 0.028 * u * flameGrowth;
      const radialGrow = 0.45 + flameGrowth * 0.55;
      const verticalGrow = 0.35 + flameGrowth * 0.85 * flicker;

      arr[i] = cx + (bx - cx) * radialGrow + swayX;
      arr[i + 1] = minY + (by - minY) * verticalGrow;
      arr[i + 2] = cz + (bz - cz) * radialGrow + swayZ;
    }
    posAttr.needsUpdate = true;
  }
}

/**
 * Prepares `astronautaLlamas.glb` so that its built-in flame primitives (`Mat_Llama_*`)
 * can dynamically grow and flicker from tiny sparks to roaring flames as `oxygen` increases!
 */
function prepareFlamesAstronaut(scene) {
  const root = scene.clone(true);
  const flameParts = extractFlameMeshParts(
    root,
    (node) => node.material?.name?.startsWith('Mat_Llama_') ?? false
  );
  return { root, flameParts };
}

/**
 * Normalizes `naveAzulLlamas.glb` using the intact ship hull bounds so flames and smoke
 * extend outward cleanly without shrinking the ship itself, and extracts animatable flames.
 */
function prepareFlamesVehicle(flamesScene, hullReferenceScene) {
  const refBox = new THREE.Box3().setFromObject(hullReferenceScene);
  const refCenter = refBox.getCenter(new THREE.Vector3());
  const refSize = refBox.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(refSize.x, refSize.y, refSize.z, 1e-4);

  const root = new THREE.Group();
  const clone = flamesScene.clone(true);
  clone.scale.setScalar(scale);
  clone.position.set(
    -refCenter.x * scale,
    -refCenter.y * scale,
    -refCenter.z * scale
  );
  root.add(clone);

  const flameParts = extractFlameMeshParts(
    clone,
    (node) =>
      /^Llama_/i.test(node.name ?? '') ||
      (node.material?.name?.startsWith('LP_Fuego_') ?? false)
  );
  return { root, flameParts };
}

/**
 * 3D Astronaut Suit Fire Hazard Test Model:
 * Flames grow progressively with `oxygen` level:
 * - `< 25% O2` (`normal`): `astronautaNormal.glb` intact white suit waving cleanly.
 * - `25% – 59% O2` (`flames`): `astronautaLlamas.glb` where the built-in 3D flames AND
 *   surrounding yellow/orange/red cones grow smoothly from small incipient flames (at 25% O2)
 *   to huge roaring flames (at 58% O2)!
 * - `>= 60% O2` (`burned`): `astronautaQuemado.glb` charred soot suit with shattered visor,
 *   glowing red embers & smoldering dark smoke.
 */
function AstronautSuitFireTest({ oxygen = 30, airflow = 0.05, suitState = 'auto' }) {
  const resolvedState =
    suitState !== 'auto'
      ? suitState
      : oxygen >= 60
        ? 'burned'
        : oxygen >= 25
          ? 'flames'
          : 'normal';

  // Normalized flame growth factor [0.22 .. 2.15] driven directly by oxygen level (25% -> 60%+)
  const levelProgress = Math.max(0, Math.min(1.35, (oxygen - 24) / 34));
  const flameGrowth = 0.25 + levelProgress * 1.45 + airflow * 0.45;

  const { scene: normalScene } = useGLTF(ASTRO_NORMAL_URL, false, false);
  const { scene: flamesScene } = useGLTF(ASTRO_FLAMES_URL, false, false);
  const { scene: burnedScene } = useGLTF(ASTRO_BURNED_URL, false, false);
  const { scene: smokeScene } = useGLTF(SMOKE_COL_URL, false, false);

  const { root: normalClone, parts: normalParts } = useMemo(
    () => prepareAnimatableAstronaut(normalScene),
    [normalScene]
  );
  const { root: flamesClone, flameParts } = useMemo(
    () => prepareFlamesAstronaut(flamesScene),
    [flamesScene]
  );
  const burnedClone = useMemo(() => burnedScene.clone(true), [burnedScene]);
  const smokeClone = useMemo(() => smokeScene.clone(true), [smokeScene]);

  const coneYellowGeo = useMemo(() => createUpwardFlameCone(0.085, 0.34, 5), []);
  const coneOrangeGeo = useMemo(() => createUpwardFlameCone(0.125, 0.46, 5), []);
  const coneRedGeo = useMemo(() => createUpwardFlameCone(0.165, 0.58, 6), []);

  const groupRef = useRef(null);
  const fireConesRef = useRef(null);
  const smokeGroupRef = useRef(null);
  const smokePuffsRef = useRef(null);

  const puffSeeds = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        phase: i / 12,
        angle: (i / 12) * Math.PI * 2,
        speed: 0.65 + (i % 4) * 0.16 + airflow * 1.1,
        color:
          resolvedState === 'burned'
            ? i % 2 === 0
              ? '#334155'
              : '#475569'
            : i % 2 === 0
              ? '#cbd5e1'
              : '#94a3b8',
      })),
    [airflow, resolvedState]
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (groupRef.current) {
      const bob =
        resolvedState === 'normal'
          ? Math.sin(t * 2.6) * 0.025
          : resolvedState === 'flames'
            ? Math.sin(t * (5 + levelProgress * 5)) * 0.015
            : Math.sin(t * 2.0) * 0.008;
      groupRef.current.position.y = -0.92 + bob;
      groupRef.current.rotation.y = Math.sin(t * 0.75) * 0.28;
    }

    // 1. Nominal Suit: Glitch-free rigid arm wave
    if (resolvedState === 'normal') {
      const waveOsc = Math.sin(t * 7.2) * 0.36;
      applyAstronautPose(normalParts, {
        walkSwing: 0,
        waveRaise: 1,
        waveOsc,
      });
    }

    // 2. Suit in Flames: Dynamically grow & flicker both the GLB's own flame meshes and the 3D fire cones!
    if (resolvedState === 'flames') {
      animateFlameMeshParts(flameParts, t, flameGrowth);

      if (fireConesRef.current) {
        const children = fireConesRef.current.children;
        for (let i = 0; i < children.length; i += 1) {
          const cone = children[i];
          const pulse = 0.85 + Math.sin(t * (20 + i * 3) + i) * 0.22;
          const wScale = pulse * (0.35 + flameGrowth * 0.65);
          const hScale = pulse * (0.3 + flameGrowth * 1.05);
          cone.scale.set(wScale, hScale, wScale);
          cone.rotation.y = t * (i % 2 === 0 ? 5 : -5);
        }
      }
    }

    if (smokeGroupRef.current && resolvedState !== 'normal') {
      const baseSmoke = resolvedState === 'flames' ? 0.45 + flameGrowth * 0.55 : 0.9;
      const sPulse = baseSmoke * (0.92 + Math.sin(t * 5) * 0.1);
      smokeGroupRef.current.scale.set(sPulse, sPulse * 1.15, sPulse);
      smokeGroupRef.current.rotation.y = t * 0.9;
    }

    if (smokePuffsRef.current && resolvedState !== 'normal') {
      const children = smokePuffsRef.current.children;
      const puffMult = resolvedState === 'flames' ? 0.5 + flameGrowth * 0.55 : 1.1;
      for (let i = 0; i < children.length; i += 1) {
        const puff = children[i];
        const s = puffSeeds[i];
        const cycle = (t * s.speed + s.phase) % 1;
        const r = (0.18 + cycle * 0.34) * puffMult;
        puff.position.set(
          Math.cos(s.angle + t * 0.9) * r,
          0.45 + cycle * 1.15 * puffMult,
          Math.sin(s.angle + t * 0.9) * r - 0.1
        );
        const sc = Math.sin(cycle * Math.PI) * 0.11 * puffMult;
        puff.scale.setScalar(Math.max(0.005, sc));
        puff.rotation.set(t * 1.8 + i, t * 1.4, i);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.92, 0]} scale={1.78}>
      {/* Low-Poly Pedestal Pad */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.42, 0.48, 0.06, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} flatShading />
      </mesh>
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.4, 8]} />
        <meshBasicMaterial
          color={
            resolvedState === 'normal'
              ? '#10b981'
              : resolvedState === 'flames'
                ? '#f59e0b'
                : '#ef4444'
          }
        />
      </mesh>

      {/* 1. Nominal Suit (`astronautaNormal.glb`) */}
      {resolvedState === 'normal' && <primitive object={normalClone} dispose={null} />}

      {/* 2. Suit on Fire (`astronautaLlamas.glb`) with Level-Scaled Red/Orange/Yellow Flames + Smoke */}
      {resolvedState === 'flames' && (
        <>
          <primitive object={flamesClone} dispose={null} />
          <group ref={fireConesRef}>
            {/* Left & Right Yellow Inner Flame Cones */}
            <mesh geometry={coneYellowGeo} position={[0.19, 0.34, -0.04]} rotation={[0, 0, -0.15]}>
              <meshBasicMaterial color="#fde047" />
            </mesh>
            <mesh geometry={coneYellowGeo} position={[-0.19, 0.32, 0.04]} rotation={[0, 0, 0.15]}>
              <meshBasicMaterial color="#fde047" />
            </mesh>
            {/* Mid Orange Flame Cones */}
            <mesh geometry={coneOrangeGeo} position={[0.2, 0.32, -0.05]} rotation={[0, 0, -0.18]}>
              <meshBasicMaterial color="#f97316" transparent opacity={0.88} />
            </mesh>
            <mesh geometry={coneOrangeGeo} position={[-0.2, 0.3, 0.04]} rotation={[0, 0, 0.18]}>
              <meshBasicMaterial color="#f97316" transparent opacity={0.88} />
            </mesh>
            {/* Outer Red Flame Cones */}
            <mesh geometry={coneRedGeo} position={[0.21, 0.28, -0.06]} rotation={[0, 0, -0.2]}>
              <meshBasicMaterial color="#ef4444" transparent opacity={0.76} />
            </mesh>
            <mesh geometry={coneRedGeo} position={[-0.21, 0.28, 0.03]} rotation={[0, 0, 0.2]}>
              <meshBasicMaterial color="#ef4444" transparent opacity={0.76} />
            </mesh>
            <mesh geometry={coneRedGeo} position={[0, 0.44, -0.14]}>
              <meshBasicMaterial color="#ef4444" transparent opacity={0.74} />
            </mesh>
          </group>
          <group ref={smokeGroupRef} position={[0, 0.78, -0.16]} scale={0.95}>
            <primitive object={smokeClone} dispose={null} />
          </group>
          <group ref={smokePuffsRef}>
            {puffSeeds.map((s, idx) => (
              <mesh key={idx}>
                <dodecahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                  color={s.color}
                  flatShading
                  roughness={0.95}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            ))}
          </group>
          <RisingLowPolyEmbers
            count={16}
            color="#fde047"
            isSpherical={false}
            levelScale={flameGrowth}
          />
          <pointLight
            color="#f97316"
            intensity={6 + flameGrowth * 8}
            distance={6}
            position={[0, 0.65, 0.45]}
          />
        </>
      )}

      {/* 3. Burned / Charred Suit (`astronautaQuemado.glb`) with Broken Visor, Red Embers & Dark Smoke */}
      {resolvedState === 'burned' && (
        <>
          <primitive object={burnedClone} dispose={null} />
          <group ref={smokeGroupRef} position={[0, 0.76, -0.2]} scale={0.88}>
            <primitive object={smokeClone} dispose={null} />
          </group>
          <group ref={smokePuffsRef}>
            {puffSeeds.map((s, idx) => (
              <mesh key={idx}>
                <dodecahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                  color={s.color}
                  flatShading
                  roughness={0.98}
                  transparent
                  opacity={0.76}
                />
              </mesh>
            ))}
          </group>
          <RisingLowPolyEmbers count={18} color="#ef4444" isSpherical={false} levelScale={1.2} />
          <pointLight color="#ef4444" intensity={10} distance={5} position={[0, 0.55, 0.45]} />
        </>
      )}
    </group>
  );
}

function resolveHazardState(suitState, oxygen) {
  if (suitState && suitState !== 'auto') return suitState;
  if (oxygen >= 60) return 'burned';
  if (oxygen >= 25) return 'flames';
  return 'normal';
}

function prepareCharredVehicle(modelRoot) {
  const charred = modelRoot.clone(true);
  charred.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const applyChar = (mat) => {
      const cloned = mat.clone();
      if (cloned.color) cloned.color.multiplyScalar(0.32);
      if ('emissive' in cloned && cloned.emissive) {
        cloned.emissive.set('#3b0c06');
        cloned.emissiveIntensity = 0.35;
      }
      if ('roughness' in cloned) cloned.roughness = 0.92;
      return cloned;
    };
    node.material = Array.isArray(node.material)
      ? node.material.map(applyChar)
      : applyChar(node.material);
  });
  return charred;
}

/**
 * 3D Spacecraft / Lunar Lander / Habitat Fire Hazard Test Rig
 */
function VehicleFireTest({ variant, oxygen = 30, airflow = 0.05, suitState = 'auto' }) {
  const cfg = VEHICLE_TEST_CONFIG[variant] ?? VEHICLE_TEST_CONFIG.lander;
  const resolvedState = resolveHazardState(suitState, oxygen);
  const levelProgress = Math.max(0, Math.min(1.35, (oxygen - 24) / 34));
  const flameGrowth = 0.28 + levelProgress * 1.35 + airflow * 0.45;

  const { scene: rawScene } = useGLTF(cfg.url, false, false);
  const { scene: flamesRawScene } = useGLTF(cfg.flamesUrl ?? cfg.url, false, false);
  const { scene: burnedRawScene } = useGLTF(cfg.burnedUrl ?? cfg.url, false, false);
  const { scene: smokeScene } = useGLTF(SMOKE_COL_URL, false, false);

  const normalModel = useMemo(() => normalizeModel(rawScene), [rawScene]);
  const { root: flamesModel, flameParts } = useMemo(
    () =>
      cfg.flamesUrl
        ? prepareFlamesVehicle(flamesRawScene, rawScene)
        : { root: normalModel, flameParts: [] },
    [cfg.flamesUrl, flamesRawScene, rawScene, normalModel]
  );
  const charredModel = useMemo(
    () =>
      cfg.burnedUrl
        ? normalizeModel(burnedRawScene)
        : prepareCharredVehicle(normalModel),
    [cfg.burnedUrl, burnedRawScene, normalModel]
  );
  const smokeClone = useMemo(() => smokeScene.clone(true), [smokeScene]);

  const coneYellowGeo = useMemo(() => createUpwardFlameCone(0.11, 0.38, 5), []);
  const coneOrangeGeo = useMemo(() => createUpwardFlameCone(0.16, 0.52, 5), []);
  const coneRedGeo = useMemo(() => createUpwardFlameCone(0.21, 0.66, 6), []);

  const rigRef = useRef(null);
  const fireGroupRef = useRef(null);
  const smokeGroupRef = useRef(null);
  const smokePuffsRef = useRef(null);

  const puffSeeds = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        phase: i / 12,
        angle: (i / 12) * Math.PI * 2,
        speed: 0.62 + (i % 4) * 0.15 + airflow * 1.1,
        color:
          resolvedState === 'burned'
            ? i % 2 === 0
              ? '#334155'
              : '#475569'
            : i % 2 === 0
              ? '#cbd5e1'
              : '#94a3b8',
      })),
    [airflow, resolvedState]
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (rigRef.current) {
      const bob =
        resolvedState === 'flames'
          ? Math.sin(t * (4 + levelProgress * 4)) * 0.025
          : Math.sin(t * 1.8) * 0.03;
      rigRef.current.position.y = cfg.y + bob;
      rigRef.current.rotation.y = t * 0.48 + 0.5;
    }

    if (resolvedState === 'flames' && flameParts.length > 0) {
      animateFlameMeshParts(flameParts, t, flameGrowth);
    }

    if (fireGroupRef.current && resolvedState === 'flames') {
      const anchors = fireGroupRef.current.children;
      for (let a = 0; a < anchors.length; a += 1) {
        const cones = anchors[a].children;
        for (let c = 0; c < cones.length; c += 1) {
          const cone = cones[c];
          const pulse = 0.85 + Math.sin(t * (18 + c * 3) + a * 2 + c) * 0.22;
          const wScale = pulse * (0.4 + flameGrowth * 0.65);
          const hScale = pulse * (0.35 + flameGrowth * 1.0);
          cone.scale.set(wScale, hScale, wScale);
          cone.rotation.y = t * (c % 2 === 0 ? 4.5 : -4.5);
        }
      }
    }

    if (smokeGroupRef.current && resolvedState !== 'normal') {
      const baseSmoke = resolvedState === 'flames' ? 0.42 + flameGrowth * 0.48 : 0.85;
      const sPulse = baseSmoke * (0.92 + Math.sin(t * 4.8) * 0.1);
      smokeGroupRef.current.scale.set(sPulse, sPulse * 1.1, sPulse);
      smokeGroupRef.current.rotation.y = t * 0.85;
    }

    if (smokePuffsRef.current && resolvedState !== 'normal') {
      const children = smokePuffsRef.current.children;
      const puffMult = resolvedState === 'flames' ? 0.55 + flameGrowth * 0.5 : 1.05;
      for (let i = 0; i < children.length; i += 1) {
        const puff = children[i];
        const s = puffSeeds[i];
        const cycle = (t * s.speed + s.phase) % 1;
        const r = (0.24 + cycle * 0.46) * puffMult;
        puff.position.set(
          Math.cos(s.angle + t * 0.85) * r,
          0.25 + cycle * 1.2 * puffMult,
          Math.sin(s.angle + t * 0.85) * r
        );
        const sc = Math.sin(cycle * Math.PI) * 0.14 * puffMult;
        puff.scale.setScalar(Math.max(0.005, sc));
        puff.rotation.set(t * 1.6 + i, t * 1.2, i);
      }
    }
  });

  const activeModel =
    resolvedState === 'burned'
      ? charredModel
      : resolvedState === 'flames'
        ? flamesModel
        : normalModel;
  const ringColor =
    resolvedState === 'normal'
      ? '#10b981'
      : resolvedState === 'flames'
        ? '#f59e0b'
        : '#ef4444';

  return (
    <group>
      {/* Orbital Test Chamber Pedestal */}
      <group position={[0, -1.04, 0]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.88, 1.02, 0.08, 10]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} flatShading />
        </mesh>
        <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.82, 10]} />
          <meshBasicMaterial color={ringColor} />
        </mesh>
      </group>

      {/* Test Subject Vehicle */}
      <group ref={rigRef} position={[0, cfg.y, 0]} scale={cfg.scale}>
        <group rotation={[cfg.pitch, 0, 0]}>
          <primitive object={activeModel} dispose={null} />
        </group>

        {resolvedState === 'flames' && (
          <>
            <group ref={fireGroupRef}>
              {cfg.flameAnchors.map((anchor, idx) => (
                <group key={idx} position={anchor.pos} rotation={anchor.rot}>
                  <mesh geometry={coneYellowGeo}>
                    <meshBasicMaterial color="#fde047" />
                  </mesh>
                  <mesh geometry={coneOrangeGeo}>
                    <meshBasicMaterial color="#f97316" transparent opacity={0.86} />
                  </mesh>
                  <mesh geometry={coneRedGeo}>
                    <meshBasicMaterial color="#ef4444" transparent opacity={0.74} />
                  </mesh>
                </group>
              ))}
            </group>
            <group ref={smokeGroupRef} position={cfg.smokePos} scale={0.8}>
              <primitive object={smokeClone} dispose={null} />
            </group>
            <group ref={smokePuffsRef}>
              {puffSeeds.map((s, idx) => (
                <mesh key={idx}>
                  <dodecahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial
                    color={s.color}
                    flatShading
                    roughness={0.95}
                    transparent
                    opacity={0.72}
                  />
                </mesh>
              ))}
            </group>
            <RisingLowPolyEmbers
              count={16}
              color="#fde047"
              isSpherical={false}
              levelScale={flameGrowth}
            />
            <pointLight
              color="#f97316"
              intensity={6 + flameGrowth * 8}
              distance={6}
              position={[0, 0.65, 0.65]}
            />
          </>
        )}

        {resolvedState === 'burned' && (
          <>
            <group ref={smokeGroupRef} position={cfg.smokePos} scale={0.85}>
              <primitive object={smokeClone} dispose={null} />
            </group>
            <group ref={smokePuffsRef}>
              {puffSeeds.map((s, idx) => (
                <mesh key={idx}>
                  <dodecahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial
                    color={s.color}
                    flatShading
                    roughness={0.98}
                    transparent
                    opacity={0.78}
                  />
                </mesh>
              ))}
            </group>
            <RisingLowPolyEmbers count={18} color="#ef4444" isSpherical={false} levelScale={1.15} />
            <pointLight color="#ef4444" intensity={10} distance={5} position={[0, 0.5, 0.6]} />
          </>
        )}
      </group>
    </group>
  );
}

/**
 * Microgravity (~0g) Triangulated Low-Poly Spherical Diffusion Flame
 * Scales noticeably with oxygen level!
 */
function SphericalFlame({ oxygen = 30, airflow = 0.05 }) {
  const outerShellRef = useRef();
  const midShellRef = useRef();
  const coreRef = useRef();
  const wireRef = useRef();

  const baseGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.78, 2).toNonIndexed();
    g.computeVertexNormals();
    return g;
  }, []);

  const basePositions = useMemo(
    () => Float32Array.from(baseGeo.attributes.position.array),
    [baseGeo]
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const posAttr = midShellRef.current?.geometry?.attributes?.position;
    if (posAttr) {
      const arr = posAttr.array;
      const drift = Math.min(0.32, airflow * 0.85);
      for (let i = 0; i < arr.length; i += 3) {
        const bx = basePositions[i];
        const by = basePositions[i + 1];
        const bz = basePositions[i + 2];
        const wave =
          1 +
          Math.sin(bx * 4.5 + t * 3.4) * 0.035 +
          Math.cos(by * 5.0 - t * 2.8) * 0.035;
        const wakeStretch = by > 0 ? 1 + drift * 0.45 : 1 - drift * 0.12;
        arr[i] = bx * wave;
        arr[i + 1] = by * wave * wakeStretch + drift * 0.12;
        arr[i + 2] = bz * wave;
      }
      posAttr.needsUpdate = true;
      midShellRef.current.geometry.computeVertexNormals();
    }

    const pulse = 1 + Math.sin(t * 4.2) * 0.04;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.rotation.y = t * 0.35;
    }
    if (outerShellRef.current) {
      outerShellRef.current.scale.setScalar(1.22 + Math.sin(t * 2.6) * 0.03);
      outerShellRef.current.rotation.y = -t * 0.2;
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = t * 0.25;
      wireRef.current.rotation.x = Math.sin(t * 0.5) * 0.15;
    }
  });

  // Dramatic growth from 15% O2 (0.55x) to 85%+ O2 (1.45x)
  const o2Factor = 0.48 + Math.min(1.1, Math.max(0.1, (oxygen - 10) / 68)) * 0.92;
  const hotO2 = oxygen > 50;

  return (
    <group position={[0, 0.18, 0]} scale={[o2Factor, o2Factor, o2Factor]}>
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 1.15, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, -0.56, 0]}>
        <cylinderGeometry args={[0.12, 0.09, 0.12, 6]} />
        <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} flatShading />
      </mesh>

      <mesh position={[0, -0.1, 0]}>
        <icosahedronGeometry args={[0.14, 1]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} flatShading />
      </mesh>

      <mesh ref={coreRef} position={[0, 0.05, 0]} renderOrder={1}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial
          color="#e0f2fe"
          emissive={hotO2 ? '#bae6fd' : '#38bdf8'}
          emissiveIntensity={1.6}
          flatShading
          transparent
          depthWrite={false}
          opacity={0.92}
        />
      </mesh>

      <mesh ref={midShellRef} geometry={baseGeo} renderOrder={2}>
        <meshStandardMaterial
          color={hotO2 ? '#7dd3fc' : '#38bdf8'}
          emissive={hotO2 ? '#0284c7' : '#0369a1'}
          emissiveIntensity={1.1}
          roughness={0.35}
          flatShading
          transparent
          depthWrite={false}
          opacity={0.68}
        />
      </mesh>

      <mesh ref={wireRef} renderOrder={4}>
        <icosahedronGeometry args={[0.8, 2]} />
        <meshBasicMaterial color="#7dd3fc" wireframe transparent depthWrite={false} opacity={0.22} />
      </mesh>

      <mesh ref={outerShellRef} renderOrder={3}>
        <icosahedronGeometry args={[0.82, 1]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0ea5e9"
          emissiveIntensity={0.6}
          flatShading
          transparent
          depthWrite={false}
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>

      <RisingLowPolyEmbers count={16} color="#7dd3fc" isSpherical levelScale={o2Factor} />
      <pointLight color="#38bdf8" intensity={18} distance={10} decay={2} />
    </group>
  );
}

/**
 * 1g / Partial-Gravity Triangulated Low-Poly Buoyant Teardrop Plume
 * Grows taller and wider as oxygen and airflow increase!
 */
function TeardropFlame({ oxygen = 30, airflow = 0.05 }) {
  const outerGeo = useMemo(() => createTeardropBaseGeometry(0.62, 2.05, 12, 9), []);
  const midGeo = useMemo(() => createTeardropBaseGeometry(0.46, 1.62, 10, 8), []);
  const coreGeo = useMemo(() => createTeardropBaseGeometry(0.26, 1.05, 8, 6), []);

  const outerBase = useMemo(
    () => Float32Array.from(outerGeo.attributes.position.array),
    [outerGeo]
  );
  const midBase = useMemo(
    () => Float32Array.from(midGeo.attributes.position.array),
    [midGeo]
  );

  const outerRef = useRef();
  const midRef = useRef();
  const coreRef = useRef();
  const wireRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const turbulence = 1 + airflow * 3.5;

    const animateMesh = (mesh, baseArr, height, amp) => {
      if (!mesh?.geometry?.attributes?.position) return;
      const pos = mesh.geometry.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = baseArr[i];
        const by = baseArr[i + 1];
        const bz = baseArr[i + 2];
        const u = Math.max(0, Math.min(1, by / height));

        const waveX =
          Math.sin(by * 4.2 - t * 8.5 * turbulence + bz * 2) * amp * Math.pow(u, 1.3);
        const waveZ =
          Math.cos(by * 3.8 - t * 7.2 * turbulence + bx * 2) * amp * Math.pow(u, 1.3);
        const radialPulse = 1 + Math.sin(by * 5 - t * 10) * 0.05 * u;
        const heightStretch = 1 + airflow * 0.85 * u + Math.sin(t * 9) * 0.03 * u;

        arr[i] = bx * radialPulse + waveX;
        arr[i + 1] = by * heightStretch;
        arr[i + 2] = bz * radialPulse + waveZ;
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    };

    animateMesh(outerRef.current, outerBase, 2.05, 0.09);
    animateMesh(midRef.current, midBase, 1.62, 0.06);

    if (coreRef.current) {
      const flicker = 1 + Math.sin(t * 13) * 0.05;
      coreRef.current.scale.set(1 / flicker, flicker, 1 / flicker);
    }
    if (wireRef.current && outerRef.current) {
      wireRef.current.geometry = outerRef.current.geometry;
    }
  });

  // Dramatic growth with oxygen level: 0.55x at 15% O2 up to 1.38x at 85%+ O2
  const o2ScaleW = 0.58 + Math.min(1.0, Math.max(0.08, (oxygen - 10) / 70)) * 0.65;
  const o2ScaleH = 0.52 + Math.min(1.1, Math.max(0.08, (oxygen - 10) / 65)) * 0.85;

  return (
    <group position={[0, -0.82, 0]} scale={[o2ScaleW, o2ScaleH, o2ScaleW]}>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 1.1, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.11, 0.12, 6]} />
        <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} flatShading />
      </mesh>

      <mesh position={[0, 0.16, 0]} renderOrder={0}>
        <cylinderGeometry args={[0.38, 0.22, 0.26, 8, 1]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={1.2}
          flatShading
          transparent
          depthWrite={false}
          opacity={0.72}
        />
      </mesh>

      <mesh ref={coreRef} geometry={coreGeo} position={[0, 0.08, 0]} renderOrder={1}>
        <meshStandardMaterial
          color="#fef9c3"
          emissive="#fde047"
          emissiveIntensity={1.8}
          flatShading
          transparent
          depthWrite={false}
          opacity={0.95}
        />
      </mesh>

      <mesh ref={midRef} geometry={midGeo} position={[0, 0.05, 0]} renderOrder={2}>
        <meshStandardMaterial
          color="#fb923c"
          emissive="#f59e0b"
          emissiveIntensity={1.25}
          roughness={0.3}
          flatShading
          transparent
          depthWrite={false}
          opacity={0.82}
        />
      </mesh>

      <mesh ref={outerRef} geometry={outerGeo} position={[0, 0.02, 0]} renderOrder={3}>
        <meshStandardMaterial
          color="#ea580c"
          emissive="#dc2626"
          emissiveIntensity={0.85}
          roughness={0.4}
          flatShading
          transparent
          depthWrite={false}
          opacity={0.46}
        />
      </mesh>

      <mesh ref={wireRef} geometry={outerGeo} position={[0, 0.02, 0]} renderOrder={4}>
        <meshBasicMaterial color="#fde047" wireframe transparent depthWrite={false} opacity={0.18} />
      </mesh>

      <RisingLowPolyEmbers count={20} color="#fbbf24" isSpherical={false} levelScale={o2ScaleH} />

      <pointLight color="#f59e0b" intensity={24} distance={12} decay={2} position={[0, 0.9, 0.6]} />
      <pointLight color="#38bdf8" intensity={8} distance={6} decay={2} position={[0, 0.1, 0.5]} />
    </group>
  );
}

export default function FlameVisualization({
  type = 'spherical',
  oxygen = 30,
  airflow = 0.05,
  suitState = 'auto',
}) {
  const isVehicle = Boolean(VEHICLE_TEST_CONFIG[type]);
  const isFlamingOrBurned =
    suitState === 'flames' ||
    suitState === 'burned' ||
    (suitState === 'auto' && oxygen >= 25);
  const showAstronautEasterEgg = type === 'astronaut' && isFlamingOrBurned;
  const showVehicleDisclaimer = isVehicle && isFlamingOrBurned;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0.15, 3.6], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', background: '#050811' }}
      >
        <color attach="background" args={['#050811']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.25} color="#ffffff" />
        <directionalLight position={[-3, -2, -2]} intensity={0.45} color="#38bdf8" />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
        />

        <Suspense fallback={null}>
          <ChamberSpaceBackdrop />
          {type === 'astronaut' ? (
            <AstronautSuitFireTest
              oxygen={oxygen}
              airflow={airflow}
              suitState={suitState}
            />
          ) : isVehicle ? (
            <VehicleFireTest
              variant={type}
              oxygen={oxygen}
              airflow={airflow}
              suitState={suitState}
            />
          ) : type === 'spherical' ? (
            <SphericalFlame oxygen={oxygen} airflow={airflow} />
          ) : (
            <TeardropFlame oxygen={oxygen} airflow={airflow} />
          )}
        </Suspense>
      </Canvas>

      {/* Easter Egg / Rig Disclaimer shown when fire level rises on a 3D test subject */}
      {(showAstronautEasterEgg || showVehicleDisclaimer) && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '10px',
            right: '10px',
            marginInline: 'auto',
            width: 'fit-content',
            maxWidth: 'calc(100% - 20px)',
            zIndex: 12,
            padding: '5px 12px',
            borderRadius: '12px',
            background: 'rgba(10, 15, 29, 0.88)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fde68a',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            lineHeight: 1.35,
            textAlign: 'center',
            letterSpacing: '0.02em',
            whiteSpace: 'normal',
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
          }}
        >
          {showAstronautEasterEgg ? (
            <>
              No astronauts were harmed in this test.
              <br />
              100% thermal mannequin.
            </>
          ) : (
            <>Thermal chamber test rig · Spacecraft &amp; habitat hull simulation.</>
          )}
        </div>
      )}
    </div>
  );
}
