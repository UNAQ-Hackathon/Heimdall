import {
  Suspense,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import SolarSystemPlanet from './SolarSystemPlanet.jsx';
import { normalizeModel } from './normalize-model.js';
import { PLANETS } from '../../services/mockData.js';
import { useApp } from '../../context/AppContext.jsx';

const asteroidUrlMap = import.meta.glob('../../../../assets3d/asteroides/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const newShipUrlMap = import.meta.glob('../../../../assets3d/nuevasNaves/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const legacyShipUrlMap = import.meta.glob('../../../../assets3d/naves/*.glb', {
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

const ASTEROID_URLS = Object.entries(asteroidUrlMap)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    name: path.split('/').pop().replace('.glb', ''),
    url,
  }));

const LEGACY_TO_NEW_SHIP = {
  'Nave_Azul_LowPoly.glb': 'naveAzulNuevo.glb',
  'Nave_Roja_LowPoly.glb': 'naveRojaNuevo.glb',
  'Nave_Verde_LowPoly.glb': 'naveVerdeNuevo.glb',
  'OVNI_LowPoly.glb': 'ovniNuevo.glb',
};

export const SHIP_CATALOG = [
  {
    id: 'naveAzulNuevo.glb',
    label: 'Blue Explorer',
    role: 'Deep-Space Research Vessel',
    accent: '#38bdf8',
  },
  {
    id: 'naveRojaNuevo.glb',
    label: 'Red Cruiser',
    role: 'High-Thrust Rapid Transit',
    accent: '#f87171',
  },
  {
    id: 'naveVerdeNuevo.glb',
    label: 'Green Scout',
    role: 'Orbital Reconnaissance Craft',
    accent: '#34d399',
  },
  {
    id: 'ovniNuevo.glb',
    label: 'Orbital Saucer',
    role: 'Experimental Ion-Plasma Disc',
    accent: '#c084fc',
  },
].filter(
  (s) =>
    newShipUrlMap[`../../../../assets3d/nuevasNaves/${s.id}`] ||
    legacyShipUrlMap[`../../../../assets3d/naves/${s.id}`]
);

export function getShipUrl(shipFile = 'naveAzulNuevo.glb') {
  const mappedNew = LEGACY_TO_NEW_SHIP[shipFile] ?? shipFile;
  return (
    newShipUrlMap[`../../../../assets3d/nuevasNaves/${mappedNew}`] ??
    legacyShipUrlMap[`../../../../assets3d/naves/${shipFile}`] ??
    Object.values(newShipUrlMap)[0] ??
    Object.values(legacyShipUrlMap)[0]
  );
}

const SPACE_TILE_URL = spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_tileable.png'];
const SPACE_HEX_URL = spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex.png'];

const SCENARIO_DEFAULT_BODY = {
  earth: 'Earth',
  iss: 'Earth',
  moon: 'Moon',
  mars: 'Mars',
  suit: 'Earth',
  lunarBase: 'Moon',
  rover: 'Moon',
  spacesuit: 'Earth',
};

const STAR_COUNT = 1600;
const STAR_PALETTE = ['#e2e8f0', '#93c5fd', '#fcd34d', '#8f9db7', '#c7d2fe'];
const MICRO_ASTEROID_COUNT = 950;
const ASTEROID_PALETTE = ['#94a3b8', '#64748b', '#a8a29e', '#cbd5e1', '#78716c'];

const pseudoRandom = (seed) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Space Background Sky Dome using the uploaded space map textures
 * (`espacio_tileable.png` + `espacio_hex.png`)
 */
function SpaceTextureSkyDome() {
  const urls = useMemo(
    () => [SPACE_TILE_URL, SPACE_HEX_URL].filter(Boolean),
    []
  );
  const textures = useTexture(urls);

  useMemo(() => {
    textures.forEach((tex) => {
      if (!tex) return;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(2, 1);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    });
  }, [textures]);

  if (!textures.length) return null;

  return (
    <group>
      {textures[0] && (
        <mesh scale={[-1, 1, 1]} rotation={[0, Math.PI * 0.5, 0]}>
          <sphereGeometry args={[245, 32, 24]} />
          <meshBasicMaterial
            map={textures[0]}
            side={THREE.BackSide}
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      )}
      {textures[1] && (
        <mesh scale={[-1, 1, 1]} rotation={[0, -Math.PI * 0.25, 0]}>
          <sphereGeometry args={[238, 28, 20]} />
          <meshBasicMaterial
            map={textures[1]}
            side={THREE.BackSide}
            transparent
            opacity={0.14}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * Low-poly octahedral (8-triangle) starfield matching the faceted models.
 */
function LowPolyStarfield() {
  const meshRef = useRef(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const y = 1 - (2 * (i + 0.5)) / STAR_COUNT;
      const radius = 95 + pseudoRandom(i) * 115;
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      const horiz = Math.sqrt(Math.max(0, 1 - y * y));
      const s = 0.09 + pseudoRandom(i + STAR_COUNT) * 0.16;

      dummy.position.set(
        Math.cos(angle) * horiz * radius,
        y * radius,
        Math.sin(angle) * horiz * radius
      );
      dummy.rotation.set(
        pseudoRandom(i * 2) * Math.PI,
        angle,
        pseudoRandom(i * 3) * Math.PI
      );
      dummy.scale.set(s, s * 1.35, s * 0.85);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, color.set(STAR_PALETTE[i % STAR_PALETTE.length]));
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.instanceColor.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, STAR_COUNT]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * Renders 20 instances of a single 3D Asteroid GLB model around the Earth-Mars ring
 */
function AsteroidModelGroup({ url, instances, paused }) {
  const { scene } = useGLTF(url, false, false);
  const baseModel = useMemo(() => normalizeModel(scene), [scene]);
  const spinRefs = useRef([]);

  const clones = useMemo(
    () => instances.map(() => baseModel.clone(true)),
    [baseModel, instances]
  );

  useFrame((_, delta) => {
    if (paused) return;
    for (let i = 0; i < instances.length; i += 1) {
      const ref = spinRefs.current[i];
      if (ref) {
        const [rx, ry, rz] = instances[i].rotSpeed;
        ref.rotation.x += rx * delta;
        ref.rotation.y += ry * delta;
        ref.rotation.z += rz * delta;
      }
    }
  });

  return (
    <>
      {instances.map((item, idx) => (
        <group key={item.key} position={item.position} scale={item.scale}>
          <group
            ref={(el) => {
              spinRefs.current[idx] = el;
            }}
            rotation={item.initialRot}
          >
            <primitive object={clones[idx]} dispose={null} />
          </group>
        </group>
      ))}
    </>
  );
}

/**
 * Dense, cohesive 3D Asteroid Ring between Earth (distance 10.2) and Mars (distance 18.2)
 */
function AsteroidBelt3D({ paused }) {
  const beltRef = useRef(null);
  const microMeshRef = useRef(null);

  const groupedByAsset = useMemo(() => {
    if (!ASTEROID_URLS.length) return [];
    const copiesPerModel = 20;
    const total = ASTEROID_URLS.length * copiesPerModel;

    return ASTEROID_URLS.map((asset, assetIdx) => {
      const instances = [];
      for (let c = 0; c < copiesPerModel; c += 1) {
        const globalIdx = c * ASTEROID_URLS.length + assetIdx;
        const baseAngle = (globalIdx / total) * Math.PI * 2;
        const jitterAngle = (pseudoRandom(globalIdx * 13 + 7) - 0.5) * 0.04;
        const angle = baseAngle + jitterAngle;
        const radius = 13.75 + pseudoRandom(globalIdx * 19 + 3) * 0.7;
        const yOffset = (pseudoRandom(globalIdx * 29 + 11) - 0.5) * 0.16;
        const scale = 0.022 + pseudoRandom(globalIdx * 37 + 5) * 0.028;
        const rotSpeed = [
          (pseudoRandom(globalIdx * 41) - 0.5) * 1.2,
          (pseudoRandom(globalIdx * 43) - 0.5) * 1.4,
          (pseudoRandom(globalIdx * 47) - 0.5) * 0.9,
        ];
        instances.push({
          key: `${asset.name}-${c}`,
          position: [Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius],
          scale,
          initialRot: [angle, angle * 0.7, pseudoRandom(globalIdx) * Math.PI],
          rotSpeed,
        });
      }
      return { asset, instances };
    });
  }, []);

  useLayoutEffect(() => {
    if (!microMeshRef.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < MICRO_ASTEROID_COUNT; i += 1) {
      const angle = (i / MICRO_ASTEROID_COUNT) * Math.PI * 2 + pseudoRandom(i * 3) * 0.03;
      const radius = 13.68 + pseudoRandom(i + 500) * 0.84;
      const yOffset = (pseudoRandom(i + 900) - 0.5) * 0.18;
      const s = 0.014 + pseudoRandom(i + 1300) * 0.02;

      dummy.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
      dummy.rotation.set(
        pseudoRandom(i * 5) * Math.PI,
        pseudoRandom(i * 7) * Math.PI,
        pseudoRandom(i * 11) * Math.PI
      );
      dummy.scale.set(s * 1.25, s * 0.85, s);
      dummy.updateMatrix();
      microMeshRef.current.setMatrixAt(i, dummy.matrix);
      microMeshRef.current.setColorAt(
        i,
        color.set(ASTEROID_PALETTE[i % ASTEROID_PALETTE.length])
      );
    }

    microMeshRef.current.instanceMatrix.needsUpdate = true;
    microMeshRef.current.instanceColor.needsUpdate = true;
    microMeshRef.current.computeBoundingSphere();
  }, []);

  useFrame((_, delta) => {
    if (!paused && beltRef.current) {
      beltRef.current.rotation.y += 0.025 * delta;
    }
  });

  return (
    <group ref={beltRef}>
      <instancedMesh ref={microMeshRef} args={[undefined, undefined, MICRO_ASTEROID_COUNT]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading roughness={0.85} metalness={0.15} />
      </instancedMesh>

      {groupedByAsset.map(({ asset, instances }) => (
        <AsteroidModelGroup
          key={asset.name}
          url={asset.url}
          instances={instances}
          paused={paused}
        />
      ))}
    </group>
  );
}

/**
 * Creates a cone geometry whose wide base is pinned at y = 0 and whose tip points to +Y.
 * When rotated by [Math.PI / 2, 0, 0], the wide base stays pinned at z = 0 (the tail nozzle)
 * and the flame tip extends strictly backward along +Z!
 */
function createTailConeGeometry(radius, length, radialSegs = 5) {
  const geo = new THREE.ConeGeometry(radius, length, radialSegs);
  geo.translate(0, length / 2, 0);
  return geo;
}

/**
 * Multi-layered Rocket Exhaust (Red, Orange, Yellow Fire + 3D Smoke Plume)
 * pinned strictly to the spacecraft's rear thruster nozzle `[0, -0.17, 1.02]`
 * OR Alien Plasma / Antigravity Ring Trail when piloting the UFO (`ovniNuevo.glb`)!
 */
function SpacecraftExhaustFX({ isUfo, isLander, inTransitRef }) {
  const yellowFlameRef = useRef(null);
  const orangeFlameRef = useRef(null);
  const redFlameRef = useRef(null);
  const smokePuffsRef = useRef(null);
  const ufoRingsRef = useRef(null);

  const yellowGeo = useMemo(() => createTailConeGeometry(0.14, 0.75, 5), []);
  const orangeGeo = useMemo(() => createTailConeGeometry(0.21, 1.15, 5), []);
  const redGeo = useMemo(() => createTailConeGeometry(0.28, 1.55, 6), []);

  const puffSeeds = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        phase: i / 20,
        speed: 1.5 + (i % 5) * 0.24,
        spreadX: Math.cos(i * 2.399) * (0.14 + (i % 4) * 0.06),
        spreadY: Math.sin(i * 2.399) * (0.14 + (i % 4) * 0.06),
        spinRate: (i % 2 === 0 ? 1 : -1) * (1.8 + (i % 4) * 0.5),
        color: i % 3 === 0 ? '#e2e8f0' : i % 3 === 1 ? '#cbd5e1' : '#94a3b8',
      })),
    []
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const inTransit = inTransitRef.current?.inTransit ?? false;
    const thrustPower = inTransit ? 1.0 : 0.42;

    if (!isUfo) {
      // Animate multi-layered Yellow -> Orange -> Red rocket fire from the tail nozzle (z = 0 in nozzle group)
      const f1 = 0.88 + Math.sin(t * 34) * 0.16;
      const f2 = 0.92 + Math.cos(t * 27) * 0.2;
      const f3 = 0.95 + Math.sin(t * 21 + 1.2) * 0.22;

      if (yellowFlameRef.current) {
        yellowFlameRef.current.scale.set(
          f1 * thrustPower,
          (0.85 + f1 * 0.4) * thrustPower,
          f1 * thrustPower
        );
        yellowFlameRef.current.rotation.y = t * 8;
      }
      if (orangeFlameRef.current) {
        orangeFlameRef.current.scale.set(
          f2 * thrustPower,
          (0.95 + f2 * 0.45) * thrustPower,
          f2 * thrustPower
        );
        orangeFlameRef.current.rotation.y = -t * 6;
      }
      if (redFlameRef.current) {
        redFlameRef.current.scale.set(
          f3 * thrustPower,
          (1.0 + f3 * 0.5) * thrustPower,
          f3 * thrustPower
        );
        redFlameRef.current.rotation.y = t * 4.5;
      }
      if (smokePuffsRef.current) {
        const children = smokePuffsRef.current.children;
        for (let i = 0; i < children.length; i += 1) {
          const puff = children[i];
          const s = puffSeeds[i];
          const cycle = (t * s.speed * (inTransit ? 1.25 : 0.72) + s.phase) % 1;
          const zDist = 0.52 + cycle * (inTransit ? 3.8 : 1.35);
          const billow = Math.sin(Math.PI * Math.min(1, cycle * 0.95 + 0.05));
          const size = (0.14 + billow * 0.36) * thrustPower;
          const swirl = 1 + cycle * 2.2;
          puff.position.set(
            s.spreadX * swirl + Math.sin(t * 4.5 + i * 1.3) * 0.11 * cycle,
            s.spreadY * swirl + Math.cos(t * 3.9 + i * 1.1) * 0.11 * cycle,
            zDist
          );
          puff.scale.setScalar(Math.max(0.015, size));
          puff.rotation.set(t * s.spinRate + i, t * s.spinRate * 0.8, i * 0.7);
          if (puff.material) {
            puff.material.opacity = Math.max(0, (1 - cycle) * (inTransit ? 0.78 : 0.45));
          }
        }
      }
    } else if (ufoRingsRef.current) {
      // Alien UFO Plasma Ring & Ion Wake Animation (no fire or smoke)
      const children = ufoRingsRef.current.children;
      for (let i = 0; i < children.length; i += 1) {
        const ring = children[i];
        const cycle = (t * (inTransit ? 1.8 : 0.85) + i / children.length) % 1;
        ring.position.set(0, -0.08 - cycle * 0.18, 0.95 + cycle * (inTransit ? 3.0 : 1.1));
        const rScale = (0.4 + cycle * 0.85) * (inTransit ? 1.1 : 0.65);
        ring.scale.set(rScale, rScale, rScale);
        ring.rotation.z = t * 3 * (i % 2 === 0 ? 1 : -1);
      }
    }
  });

  if (isUfo) {
    return (
      <group>
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.52, 0.08, 6, 12]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} />
        </mesh>
        <group ref={ufoRingsRef}>
          {Array.from({ length: 8 }, (_, idx) => (
            <mesh key={idx}>
              <torusGeometry args={[0.42, 0.055, 5, 8]} />
              <meshBasicMaterial
                color={idx % 2 === 0 ? '#22d3ee' : '#c084fc'}
                transparent
                opacity={0.78}
              />
            </mesh>
          ))}
        </group>
        <pointLight color="#22d3ee" intensity={4.5} distance={3.2} />
      </group>
    );
  }

  // Exact rear thruster nozzle position in normalized model coordinates:
  // For `naveAzulNuevo` / `naveRojaNuevo` / `naveVerdeNuevo`, `LP_Propulsor` is at [0, -0.17, +1.02].
  const nozzlePos = isLander ? [0, -0.65, 0.85] : [0, -0.17, 1.02];

  return (
    <group position={nozzlePos}>
      {/* 1. Inner White-Yellow Core Rocket Flame (base pinned at nozzle z=0, pointing +Z) */}
      <mesh
        ref={yellowFlameRef}
        geometry={yellowGeo}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial color="#fde047" />
      </mesh>

      {/* 2. Mid Vibrant Orange Rocket Plume */}
      <mesh
        ref={orangeFlameRef}
        geometry={orangeGeo}
        position={[0, 0, 0.04]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial color="#f97316" transparent opacity={0.92} />
      </mesh>

      {/* 3. Outer Crimson-Red Combustion Envelope */}
      <mesh
        ref={redFlameRef}
        geometry={redGeo}
        position={[0, 0, 0.08]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial color="#ef4444" transparent opacity={0.78} />
      </mesh>

      {/* 4. Dynamic Billowing Low-Poly Exhaust Smoke Puffs */}
      <group ref={smokePuffsRef}>
        {puffSeeds.map((s, idx) => (
          <mesh key={idx}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={s.color}
              flatShading
              roughness={0.92}
              transparent
              depthWrite={false}
              opacity={0.7}
            />
          </mesh>
        ))}
      </group>

      <pointLight color="#f97316" intensity={5.0} distance={3.2} position={[0, 0, 0.45]} />
    </group>
  );
}

/**
 * 3D Spacecraft that indicates the currently active planet/moon and flies smoothly
 * along a visible 3D curved transfer trajectory from planet to planet!
 */
function SpacecraftNavigator({
  targetBodyName,
  planetObjectsRef,
  shipTransitRef,
  shipFile = 'naveAzulNuevo.glb',
  paused = false,
}) {
  const shipUrl = getShipUrl(shipFile);
  const { scene } = useGLTF(shipUrl, false, false);
  const shipModel = useMemo(() => normalizeModel(scene), [scene]);
  const isUfo = shipFile.toLowerCase().includes('ovni');
  const isLander = shipFile.toLowerCase().includes('lander');

  const shipGroupRef = useRef(null);
  const beaconRef = useRef(null);

  const TRAJECTORY_STEPS = 36;
  const trajectoryLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array((TRAJECTORY_STEPS + 1) * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineDashedMaterial({
      color: isUfo ? '#c084fc' : '#f97316',
      dashSize: 0.28,
      gapSize: 0.14,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    return line;
  }, [isUfo]);

  useEffect(() => () => {
    trajectoryLine.geometry.dispose();
    trajectoryLine.material.dispose();
  }, [trajectoryLine]);

  const scratch = useMemo(
    () => ({
      planetWorldPos: new THREE.Vector3(),
      destPos: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      chord: new THREE.Vector3(),
      perp: new THREE.Vector3(),
      controlPt: new THREE.Vector3(),
      currentPos: new THREE.Vector3(),
      aheadPos: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      diff: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      mat4: new THREE.Matrix4(),
      targetQuat: new THREE.Quaternion(),
      obstacles: PLANETS.map((p) => ({
        name: p.name,
        pos: new THREE.Vector3(),
        safeR:
          p.name === 'Sol'
            ? p.size * 1.26 + 0.14
            : p.name === 'Saturn'
              ? p.size * 1.62 + 0.12
              : p.size * 1.22 + 0.10,
      })),
    }),
    []
  );

  const flightState = useRef({
    currentTarget: targetBodyName,
    inTransit: false,
    progress: 1,
    duration: 4.0,
    startPos: new THREE.Vector3(10.2, 0.8, 0),
    lastPos: new THREE.Vector3(10.2, 0.8, 0),
    orbitAngle: 0,
    initialized: false,
  });

  useEffect(() => {
    const st = flightState.current;
    if (st.currentTarget !== targetBodyName) {
      if (shipGroupRef.current) {
        st.startPos.copy(shipGroupRef.current.position);
      }
      const destObj = planetObjectsRef.current?.[targetBodyName];
      let tripDist = 10;
      if (destObj) {
        const destWorld = new THREE.Vector3();
        destObj.getWorldPosition(destWorld);
        tripDist = st.startPos.distanceTo(destWorld);
      }
      st.duration = Math.min(7.5, Math.max(3.2, 2.5 + tripDist * 0.18));
      st.currentTarget = targetBodyName;
      st.inTransit = true;
      st.progress = 0;

      if (shipTransitRef) {
        shipTransitRef.current.inTransit = true;
        shipTransitRef.current.progress = 0;
        shipTransitRef.current.startPos.copy(st.startPos);
      }
    }
  }, [targetBodyName, planetObjectsRef, shipTransitRef]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const st = flightState.current;
    const ship = shipGroupRef.current;
    if (!ship) return;

    const targetObj = planetObjectsRef.current[st.currentTarget];
    if (!targetObj) return;

    const {
      planetWorldPos,
      destPos,
      mid,
      chord,
      perp,
      controlPt,
      currentPos,
      aheadPos,
      tangent,
      diff,
      up,
      mat4,
      targetQuat,
      obstacles,
    } = scratch;

    targetObj.getWorldPosition(planetWorldPos);

    const planetMeta = PLANETS.find((p) => p.name === st.currentTarget);
    const bodySize = planetMeta?.size ?? 0.6;
    const localOrbitRadius =
      st.currentTarget === 'Saturn'
        ? bodySize * 1.68 + 0.14
        : st.currentTarget === 'Sol'
          ? bodySize * 1.32 + 0.16
          : bodySize * 1.28 + 0.14;

    let activeObstacles = 0;
    for (let i = 0; i < obstacles.length; i += 1) {
      const obs = obstacles[i];
      const obj = planetObjectsRef.current[obs.name];
      if (obj) {
        obj.getWorldPosition(obs.pos);
        obs.active = true;
        activeObstacles += 1;
      } else {
        obs.active = false;
      }
    }

    const pushOutsideObstacles = (pt) => {
      if (activeObstacles === 0) return pt;
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < obstacles.length; i += 1) {
          const obs = obstacles[i];
          if (!obs.active) continue;
          diff.subVectors(pt, obs.pos);
          const dist = diff.length();
          const influenceR = obs.safeR * 2.15;
          if (dist < influenceR) {
            const s = Math.min(1, Math.max(0, (influenceR - dist) / (influenceR - obs.safeR)));
            const falloff = s * s * (3 - 2 * s);
            if (dist < 1e-4) {
              diff.set(1, 0, 0);
            } else {
              diff.normalize();
            }
            const clearedDist = Math.max(dist, THREE.MathUtils.lerp(dist, obs.safeR, falloff));
            pt.copy(obs.pos).addScaledVector(diff, clearedDist);
          }
        }
      }
      return pt;
    };

    if (st.inTransit) {
      const approachAngle =
        Math.atan2(
          st.startPos.z - planetWorldPos.z,
          st.startPos.x - planetWorldPos.x
        ) + 0.65;
      st.orbitAngle = approachAngle;
    } else if (!paused) {
      st.orbitAngle += delta * 0.95;
    }

    destPos.set(
      planetWorldPos.x + Math.cos(st.orbitAngle) * localOrbitRadius,
      planetWorldPos.y + Math.sin(st.orbitAngle * 2) * 0.015,
      planetWorldPos.z + Math.sin(st.orbitAngle) * localOrbitRadius
    );
    pushOutsideObstacles(destPos);

    if (!st.initialized) {
      ship.position.copy(destPos);
      st.startPos.copy(destPos);
      st.lastPos.copy(destPos);
      st.initialized = true;
      if (shipTransitRef) {
        shipTransitRef.current.shipPos.copy(destPos);
      }
      return;
    }

    if (st.inTransit) {
      st.progress = Math.min(1, st.progress + delta / st.duration);
      const t = st.progress;
      const ease = t * t * t * (t * (t * 6 - 15) + 10);

      const dist = st.startPos.distanceTo(destPos);
      chord.subVectors(destPos, st.startPos);
      mid.addVectors(st.startPos, destPos).multiplyScalar(0.5);
      perp.set(-chord.z, 0, chord.x);
      if (perp.lengthSq() > 1e-6) {
        perp.normalize();
      } else {
        perp.set(1, 0, 0);
      }
      if (mid.dot(perp) < 0) {
        perp.negate();
      }
      const lateralSweep = Math.min(5.2, Math.max(0.75, dist * 0.3));
      controlPt.copy(mid).addScaledVector(perp, lateralSweep);
      pushOutsideObstacles(controlPt);
      controlPt.y = Math.max(st.startPos.y, destPos.y, controlPt.y) + 0.24;

      const evalTransferCurve = (u, out) => {
        const inv = 1 - u;
        out.set(
          inv * inv * st.startPos.x + 2 * inv * u * controlPt.x + u * u * destPos.x,
          inv * inv * st.startPos.y + 2 * inv * u * controlPt.y + u * u * destPos.y,
          inv * inv * st.startPos.z + 2 * inv * u * controlPt.z + u * u * destPos.z
        );
        return pushOutsideObstacles(out);
      };

      evalTransferCurve(ease, currentPos);
      const nextT = Math.min(1, ease + 0.06);
      evalTransferCurve(nextT, aheadPos);

      if (aheadPos.distanceToSquared(currentPos) > 1e-6) {
        mat4.lookAt(ship.position, aheadPos, up);
        targetQuat.setFromRotationMatrix(mat4);
        ship.quaternion.slerp(targetQuat, 1 - Math.exp(-delta * 6.0));
      }

      ship.position.lerp(currentPos, 1 - Math.exp(-delta * 9.0));
      st.lastPos.copy(ship.position);

      if (shipTransitRef) {
        shipTransitRef.current.inTransit = true;
        shipTransitRef.current.progress = ease;
        shipTransitRef.current.shipPos.copy(ship.position);
        shipTransitRef.current.destPos.copy(planetWorldPos);
      }

      const posAttr = trajectoryLine.geometry.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i <= TRAJECTORY_STEPS; i += 1) {
        evalTransferCurve(i / TRAJECTORY_STEPS, aheadPos);
        const idx = i * 3;
        arr[idx] = aheadPos.x;
        arr[idx + 1] = aheadPos.y;
        arr[idx + 2] = aheadPos.z;
      }
      posAttr.needsUpdate = true;
      trajectoryLine.computeLineDistances();
      trajectoryLine.visible = true;

      if (st.progress >= 1) {
        st.inTransit = false;
        trajectoryLine.visible = false;
        if (shipTransitRef) {
          shipTransitRef.current.inTransit = false;
        }
      }
    } else {
      trajectoryLine.visible = false;
      ship.position.lerp(destPos, 1 - Math.exp(-delta * 8));

      tangent.set(-Math.sin(st.orbitAngle), 0, Math.cos(st.orbitAngle)).normalize();
      aheadPos.copy(ship.position).add(tangent);
      mat4.lookAt(ship.position, aheadPos, up);
      targetQuat.setFromRotationMatrix(mat4);
      ship.quaternion.slerp(targetQuat, 1 - Math.exp(-delta * 8));

      if (shipTransitRef) {
        shipTransitRef.current.inTransit = false;
        shipTransitRef.current.shipPos.copy(ship.position);
      }
    }

    if (beaconRef.current) {
      beaconRef.current.position.set(
        planetWorldPos.x,
        planetWorldPos.y + bodySize * 1.38 + 0.24 + Math.sin(st.orbitAngle * 2) * 0.03,
        planetWorldPos.z
      );
      beaconRef.current.rotation.y += delta * 1.8;
    }
  });

  return (
    <>
      <primitive object={trajectoryLine} />

      {/* Spacecraft 3D Mesh at realistic miniature scale relative to planets (nose at -Z, tail at +Z) */}
      <group ref={shipGroupRef} scale={0.075}>
        <primitive object={shipModel} dispose={null} />
        <SpacecraftExhaustFX isUfo={isUfo} isLander={isLander} inTransitRef={flightState} />
      </group>

      {/* Low-Poly Triangular Marker Beacon above the active planet */}
      <group ref={beaconRef}>
        <mesh rotation={[Math.PI, 0, 0]} scale={[0.065, 0.11, 0.065]}>
          <coneGeometry args={[1, 1.4, 3]} />
          <meshBasicMaterial color="#fc3d21" />
        </mesh>
      </group>
    </>
  );
}

function OrbitRing({ radius, color = '#1e293b', opacity = 0.32 }) {
  if (radius <= 0) return null;
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.025, radius + 0.025, 160]} />
      <meshBasicMaterial
        color={color}
        side={THREE.DoubleSide}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function CameraController({
  focusPlanet,
  planetObjectsRef,
  shipTransitRef,
  controlsRef,
  panelCollapsed = false,
}) {
  const overviewTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const overviewPosition = useMemo(
    () => new THREE.Vector3(0, 18, 32),
    []
  );

  const prevFocusRef = useRef(null);
  const prevPanelCollapsedRef = useRef(panelCollapsed);
  const isTransitioningRef = useRef(false);
  const targetCamPosRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      isTransitioningRef.current = false;
    };

    controls.addEventListener('start', handleStart);
    return () => {
      controls.removeEventListener('start', handleStart);
    };
  }, [controlsRef]);

  useEffect(() => {
    if (prevPanelCollapsedRef.current !== panelCollapsed) {
      prevPanelCollapsedRef.current = panelCollapsed;
      if (!focusPlanet) {
        isTransitioningRef.current = true;
      }
    }
  }, [panelCollapsed, focusPlanet]);

  useEffect(() => {
    if (focusPlanet !== prevFocusRef.current) {
      prevFocusRef.current = focusPlanet;
      isTransitioningRef.current = true;

      if (focusPlanet && planetObjectsRef.current[focusPlanet]) {
        const obj = planetObjectsRef.current[focusPlanet];
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);

        const planetData = PLANETS.find((p) => p.name === focusPlanet);
        const size = planetData?.size || 0.6;
        const zoomDist = Math.max(0.95, size * 3.2);

        targetCamPosRef.current.set(
          worldPos.x + zoomDist * 0.72,
          worldPos.y + zoomDist * 0.48,
          worldPos.z + zoomDist * 0.85
        );
      } else {
        targetCamPosRef.current.copy(overviewPosition);
      }
    }
  }, [focusPlanet, planetObjectsRef, overviewPosition]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const controls = controlsRef.current;
    if (!controls) return;

    const transit = shipTransitRef?.current;

    if (transit?.inTransit) {
      const shipPos = transit.shipPos;
      const startPos = transit.startPos;
      const destPos = transit.destPos;
      const p = transit.progress ?? 0.5;

      const followRate = Math.min(1, 1 - Math.exp(-8.0 * delta));
      controls.target.lerp(shipPos, followRate);

      const chordDist = Math.max(2, startPos.distanceTo(destPos));
      const wideFactor = Math.sin(Math.PI * p);
      const distOut = 0.9 + wideFactor * Math.min(4.8, chordDist * 0.24);
      const heightUp = 0.65 + wideFactor * Math.min(3.2, chordDist * 0.16);

      const chaseOffset = new THREE.Vector3(distOut * 0.65, heightUp, distOut);
      const desiredCam = shipPos.clone().add(chaseOffset);
      state.camera.position.lerp(desiredCam, Math.min(1, 1 - Math.exp(-6.0 * delta)));
      isTransitioningRef.current = true;
      controls.update();
      return;
    }

    const dampFactor = Math.min(1, 1 - Math.exp(-4.5 * delta));

    if (focusPlanet && planetObjectsRef.current[focusPlanet]) {
      const obj = planetObjectsRef.current[focusPlanet];
      const worldPos = new THREE.Vector3();
      obj.getWorldPosition(worldPos);

      const planetData = PLANETS.find((p) => p.name === focusPlanet);
      const size = planetData?.size || 0.6;
      const zoomDist = Math.max(0.95, size * 3.2);

      targetCamPosRef.current.set(
        worldPos.x + zoomDist * 0.72,
        worldPos.y + zoomDist * 0.48,
        worldPos.z + zoomDist * 0.85
      );

      if (isTransitioningRef.current) {
        controls.target.lerp(worldPos, dampFactor);
        state.camera.position.lerp(targetCamPosRef.current, dampFactor);

        if (
          controls.target.distanceTo(worldPos) < 0.05 &&
          state.camera.position.distanceTo(targetCamPosRef.current) < 0.1
        ) {
          isTransitioningRef.current = false;
        }
      } else {
        controls.target.copy(worldPos);
      }
    } else if (isTransitioningRef.current) {
      controls.target.lerp(overviewTarget, dampFactor);
      state.camera.position.lerp(overviewPosition, dampFactor);

      if (
        controls.target.distanceTo(overviewTarget) < 0.05 &&
        state.camera.position.distanceTo(overviewPosition) < 0.1
      ) {
        isTransitioningRef.current = false;
      }
    }

    controls.update();
  });

  return null;
}

function EarthMoonSystem({
  earthData,
  moonData,
  focusPlanet,
  onPlanetClick,
  registerPlanet,
  paused,
}) {
  const earthOrbitGroup = useRef();
  const moonOrbitGroup = useRef();

  const isEarthSelected = focusPlanet === 'Earth';
  const isMoonSelected = focusPlanet === 'Moon';
  const isAnySelected = isEarthSelected || isMoonSelected;

  useEffect(() => {
    if (earthOrbitGroup.current) {
      earthOrbitGroup.current.rotation.y = earthData.initialAngle ?? 0;
    }
    if (moonOrbitGroup.current) {
      moonOrbitGroup.current.rotation.y = moonData.initialAngle ?? 0;
    }
  }, [earthData.initialAngle, moonData.initialAngle]);

  useFrame((_, delta) => {
    if (!paused && !isAnySelected && earthOrbitGroup.current) {
      earthOrbitGroup.current.rotation.y += earthData.orbitSpeed * 15 * delta;
    }
    if (!paused && !isMoonSelected && moonOrbitGroup.current) {
      moonOrbitGroup.current.rotation.y += moonData.orbitSpeed * 15 * delta;
    }
  });

  return (
    <group ref={earthOrbitGroup}>
      <OrbitRing radius={earthData.distance} color="#1d4ed8" opacity={0.35} />

      <group position={[earthData.distance, 0, 0]}>
        <SolarSystemPlanet
          name={earthData.name}
          model={earthData.model}
          size={earthData.size}
          distance={0}
          orbitSpeed={0}
          color={earthData.color}
          isSelected={isEarthSelected}
          onClick={onPlanetClick}
          paused={paused}
          registerPlanet={registerPlanet}
        />

        <OrbitRing radius={moonData.distance} color="#38bdf8" opacity={0.28} />

        <group ref={moonOrbitGroup}>
          <SolarSystemPlanet
            name={moonData.name}
            model={moonData.model}
            size={moonData.size}
            distance={moonData.distance}
            orbitSpeed={0}
            color={moonData.color}
            isSelected={isMoonSelected}
            onClick={onPlanetClick}
            paused={paused}
            registerPlanet={registerPlanet}
          />
        </group>
      </group>
    </group>
  );
}

function SceneContent({ paused, panelCollapsed = false, shipFile = 'naveAzulNuevo.glb' }) {
  const { focusPlanet, setFocusPlanet, scenarioKey } = useApp();
  const controlsRef = useRef();
  const planetObjectsRef = useRef({});
  const shipTransitRef = useRef({
    inTransit: false,
    progress: 1,
    shipPos: new THREE.Vector3(10.2, 0.8, 0),
    startPos: new THREE.Vector3(10.2, 0.8, 0),
    destPos: new THREE.Vector3(10.2, 0, 0),
  });

  const registerPlanet = useCallback((name, mesh) => {
    planetObjectsRef.current[name] = mesh;
  }, []);

  const handlePlanetClick = useCallback(
    (name) => {
      setFocusPlanet((prev) => (prev === name ? null : name));
    },
    [setFocusPlanet]
  );

  const earthData = useMemo(() => PLANETS.find((p) => p.name === 'Earth'), []);
  const moonData = useMemo(() => PLANETS.find((p) => p.name === 'Moon'), []);
  const otherPlanets = useMemo(
    () => PLANETS.filter((p) => p.name !== 'Earth' && p.name !== 'Moon'),
    []
  );

  const activeSpacecraftBody =
    focusPlanet || SCENARIO_DEFAULT_BODY[scenarioKey] || 'Moon';

  return (
    <>
      <color attach="background" args={['#040711']} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#dbeafe', '#0f172a', 0.45]} />
      <directionalLight position={[18, 28, 22]} intensity={1.1} color="#fff7ed" />
      <pointLight position={[0, 0, 0]} intensity={180} distance={260} decay={1.2} color="#fde68a" />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        minDistance={0.5}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2 + 0.18}
        enableDamping
        dampingFactor={0.05}
      />

      <CameraController
        focusPlanet={focusPlanet}
        planetObjectsRef={planetObjectsRef}
        shipTransitRef={shipTransitRef}
        controlsRef={controlsRef}
        panelCollapsed={panelCollapsed}
      />

      {/* Low-Poly Octahedral Starfield */}
      <LowPolyStarfield />

      <Suspense fallback={null}>
        {/* Space Map Texture Backdrop uploaded by dev */}
        <SpaceTextureSkyDome />

        {/* Dense 3D Asteroid Belt Ring between Earth and Mars */}
        <AsteroidBelt3D paused={paused} />

        {/* Earth + Moon compound system */}
        {earthData && moonData && (
          <EarthMoonSystem
            earthData={earthData}
            moonData={moonData}
            focusPlanet={focusPlanet}
            onPlanetClick={handlePlanetClick}
            registerPlanet={registerPlanet}
            paused={paused}
          />
        )}

        {/* Other planets & Sun */}
        {otherPlanets.map((planet) => {
          const isSun = planet.name === 'Sol';
          const isSelected = focusPlanet === planet.name;

          return (
            <group key={planet.name}>
              {planet.distance > 0 && <OrbitRing radius={planet.distance} />}

              <SolarSystemPlanet
                name={planet.name}
                model={planet.model}
                size={planet.size}
                distance={planet.distance}
                orbitSpeed={planet.orbitSpeed}
                initialAngle={planet.initialAngle ?? 0}
                color={planet.color}
                isSun={isSun}
                isSelected={isSelected}
                onClick={handlePlanetClick}
                paused={paused}
                registerPlanet={registerPlanet}
              />
            </group>
          );
        })}

        {/* 3D Low-Poly Spacecraft with Smooth Interplanetary Flight & Red/Orange/Yellow Fire + Smoke */}
        <SpacecraftNavigator
          targetBodyName={activeSpacecraftBody}
          planetObjectsRef={planetObjectsRef}
          shipTransitRef={shipTransitRef}
          shipFile={shipFile}
          paused={paused}
        />
      </Suspense>
    </>
  );
}

export default function SolarSystemScene({
  paused = false,
  panelCollapsed = false,
  shipFile = 'naveAzulNuevo.glb',
}) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 18, 32], fov: 44, far: 400 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', background: '#040711' }}
      >
        <SceneContent
          paused={paused}
          panelCollapsed={panelCollapsed}
          shipFile={shipFile}
        />
      </Canvas>
    </div>
  );
}
