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
import {
  computeInspectorCenterOffsetX,
  computeTrailScale,
} from './solar-system-model.js';
import { ISS_DESTINATION, PLANETS } from '../../services/mockData.js';
import { useApp } from '../../context/AppContext.jsx';
import { useSound } from '../../context/SoundContext.jsx';

const ALL_NAV_BODIES = [...PLANETS, ISS_DESTINATION];

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

const milleniumUrlMap = import.meta.glob('../../../../assets3d/millenium/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const issUrlMap = import.meta.glob('../../../../assets3d/ISS/*.glb', {
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
  {
    id: 'MilleniumTriangle.glb',
    label: 'Millennium Falcon',
    role: 'YT-1300 Corellian Freighter',
    accent: '#60a5fa',
  },
].filter(
  (s) =>
    newShipUrlMap[`../../../../assets3d/nuevasNaves/${s.id}`] ||
    milleniumUrlMap[`../../../../assets3d/millenium/${s.id}`] ||
    legacyShipUrlMap[`../../../../assets3d/naves/${s.id}`]
);

export function getShipUrl(shipFile = 'naveAzulNuevo.glb') {
  const mappedNew = LEGACY_TO_NEW_SHIP[shipFile] ?? shipFile;
  return (
    milleniumUrlMap[`../../../../assets3d/millenium/${mappedNew}`] ??
    newShipUrlMap[`../../../../assets3d/nuevasNaves/${mappedNew}`] ??
    legacyShipUrlMap[`../../../../assets3d/naves/${shipFile}`] ??
    Object.values(newShipUrlMap)[0] ??
    Object.values(legacyShipUrlMap)[0]
  );
}

const ISS_MODEL_URL =
  issUrlMap['../../../../assets3d/ISS/issNuevo.glb'] ?? Object.values(issUrlMap)[0];

const SPACE_TILE_URL = spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_tileable.png'];
const SPACE_HEX_URL = spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex.png'];

const SCENARIO_DEFAULT_BODY = {
  earth: 'Earth',
  iss: 'ISS',
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
 * Builds a wide curved crescent-ribbon plume matching the Millennium Falcon's
 * broad rear sublight engine arc (`x in [-halfWidth, +halfWidth]`, streaming +Z).
 */
function createFalconRibbonGeometry(halfWidth, halfHeight, length, arcBack = 0.16) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 12, 1, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const u = pos.getX(i) * 2; // -1 .. +1 across width
    const sy = pos.getY(i) * 2; // -1 or +1 across height
    const v = pos.getZ(i) + 0.5; // 0 .. 1 from engine slit to wake tip
    const taperX = 1 - 0.28 * v;
    const taperY = 1 - 0.88 * v;
    const x = u * halfWidth * taperX;
    const y = sy * halfHeight * taperY * (1 - 0.28 * u * u);
    const z = -arcBack * u * u * (1 - 0.7 * v) + v * length;
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Multi-layered Rocket Exhaust (Red, Orange, Yellow Fire + 3D Smoke Plume),
 * Wide Millennium Falcon Sublight Ion Ribbon, OR Alien Plasma Ring Trail (`ovniNuevo.glb`).
 */
function SpacecraftExhaustFX({ isUfo, isLander, isFalcon, inTransitRef }) {
  const exhaustGroupRef = useRef(null);
  const yellowFlameRef = useRef(null);
  const orangeFlameRef = useRef(null);
  const redFlameRef = useRef(null);
  const smokePuffsRef = useRef(null);
  const ufoRingsRef = useRef(null);

  const yellowGeo = useMemo(
    () =>
      isFalcon
        ? createFalconRibbonGeometry(0.48, 0.034, 1.35, 0.16)
        : createTailConeGeometry(0.14, 0.75, 5),
    [isFalcon]
  );
  const orangeGeo = useMemo(
    () =>
      isFalcon
        ? createFalconRibbonGeometry(0.55, 0.06, 2.35, 0.16)
        : createTailConeGeometry(0.21, 1.15, 5),
    [isFalcon]
  );
  const redGeo = useMemo(
    () =>
      isFalcon
        ? createFalconRibbonGeometry(0.63, 0.095, 3.35, 0.16)
        : createTailConeGeometry(0.28, 1.55, 6),
    [isFalcon]
  );

  const puffSeeds = useMemo(
    () =>
      Array.from({ length: isFalcon ? 14 : 20 }, (_, i) => ({
        phase: i / (isFalcon ? 14 : 20),
        speed: 1.5 + (i % 5) * 0.24,
        spreadX: isFalcon
          ? ((i % 3) - 1) * 0.12
          : Math.cos(i * 2.399) * (0.14 + (i % 4) * 0.06),
        spreadY: isFalcon
          ? ((i % 2) * 2 - 1) * 0.015
          : Math.sin(i * 2.399) * (0.14 + (i % 4) * 0.06),
        spinRate: (i % 2 === 0 ? 1 : -1) * (1.8 + (i % 4) * 0.5),
        color: isFalcon
          ? i % 3 === 0
            ? '#e0f2fe'
            : i % 3 === 1
              ? '#7dd3fc'
              : '#38bdf8'
          : i % 3 === 0
            ? '#e2e8f0'
            : i % 3 === 1
              ? '#cbd5e1'
              : '#94a3b8',
      })),
    [isFalcon]
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const inTransit = inTransitRef.current?.inTransit ?? false;
    const isParked = !inTransit && inTransitRef.current?.currentTarget === 'ISS';
    if (exhaustGroupRef.current) {
      exhaustGroupRef.current.visible = !isParked;
    }
    if (isParked) return;

    const trailScale = Math.max(0.12, Math.min(1, inTransitRef.current?.trailScale ?? (inTransit ? 0.85 : 0.3)));
    const thrustPower = 0.14 + trailScale * 0.86;
    const wakeSpeed = 0.45 + trailScale * 0.9;

    if (!isUfo && isFalcon) {
      // Wide movie-style sublight ribbon glow across the Falcon's entire rear engine arc,
      // with trail length scaled by orbital acceleration
      const f1 = 0.96 + Math.sin(t * 30) * 0.06;
      const f2 = 0.98 + Math.cos(t * 24) * 0.08;
      const f3 = 0.97 + Math.sin(t * 18 + 1.0) * 0.09;
      const lengthBoost = 0.18 + trailScale * 1.05;

      if (yellowFlameRef.current) {
        yellowFlameRef.current.scale.set(f1, f1, (0.9 + f1 * 0.25) * lengthBoost);
      }
      if (orangeFlameRef.current) {
        orangeFlameRef.current.scale.set(f2, f2, (0.95 + f2 * 0.3) * lengthBoost);
      }
      if (redFlameRef.current) {
        redFlameRef.current.scale.set(f3, f3, (1.0 + f3 * 0.35) * lengthBoost);
      }
      if (smokePuffsRef.current) {
        const children = smokePuffsRef.current.children;
        for (let i = 0; i < children.length; i += 1) {
          const streak = children[i];
          const s = puffSeeds[i];
          const cycle = (t * s.speed * wakeSpeed + s.phase) % 1;
          const zDist = 0.22 + cycle * (0.55 + trailScale * 3.6);
          streak.position.set(
            s.spreadX * (1 + cycle * 0.35),
            s.spreadY * (1 + cycle * 0.45),
            zDist
          );
          const wScale = (0.68 + Math.sin(Math.PI * cycle) * 0.38) * (1 - cycle * 0.32);
          streak.scale.set(
            Math.max(0.15, wScale),
            Math.max(0.25, (1 - cycle * 0.65) * (0.45 + trailScale * 0.7)),
            Math.max(0.18, (0.45 + cycle * 0.7) * (0.28 + trailScale * 1.05))
          );
          if (streak.material) {
            streak.material.opacity = Math.max(0, (1 - cycle) * (0.22 + trailScale * 0.42));
          }
        }
      }
    } else if (!isUfo) {
      // Animate multi-layered Yellow -> Orange -> Red rocket fire from the tail nozzle (z = 0 in nozzle group)
      const f1 = 0.88 + Math.sin(t * 34) * 0.16;
      const f2 = 0.92 + Math.cos(t * 27) * 0.2;
      const f3 = 0.95 + Math.sin(t * 21 + 1.2) * 0.22;

      if (yellowFlameRef.current) {
        yellowFlameRef.current.scale.set(
          f1 * thrustPower,
          (0.65 + f1 * 0.4) * thrustPower,
          f1 * thrustPower
        );
        yellowFlameRef.current.rotation.y = t * 8;
      }
      if (orangeFlameRef.current) {
        orangeFlameRef.current.scale.set(
          f2 * thrustPower,
          (0.72 + f2 * 0.45) * thrustPower,
          f2 * thrustPower
        );
        orangeFlameRef.current.rotation.y = -t * 6;
      }
      if (redFlameRef.current) {
        redFlameRef.current.scale.set(
          f3 * thrustPower,
          (0.78 + f3 * 0.5) * thrustPower,
          f3 * thrustPower
        );
        redFlameRef.current.rotation.y = t * 4.5;
      }
      if (smokePuffsRef.current) {
        const children = smokePuffsRef.current.children;
        for (let i = 0; i < children.length; i += 1) {
          const puff = children[i];
          const s = puffSeeds[i];
          const cycle = (t * s.speed * wakeSpeed + s.phase) % 1;
          const zDist = 0.28 + cycle * (0.55 + trailScale * 3.2);
          const billow = Math.sin(Math.PI * Math.min(1, cycle * 0.95 + 0.05));
          const size = (0.09 + billow * 0.34) * thrustPower;
          const swirl = 0.7 + cycle * (1.2 + trailScale * 1.1);
          puff.position.set(
            s.spreadX * swirl + Math.sin(t * 4.5 + i * 1.3) * 0.09 * cycle,
            s.spreadY * swirl + Math.cos(t * 3.9 + i * 1.1) * 0.09 * cycle,
            zDist
          );
          puff.scale.setScalar(Math.max(0.012, size));
          puff.rotation.set(t * s.spinRate + i, t * s.spinRate * 0.8, i * 0.7);
          if (puff.material) {
            puff.material.opacity = Math.max(0, (1 - cycle) * (0.28 + trailScale * 0.52));
          }
        }
      }
    } else if (ufoRingsRef.current) {
      // Alien UFO Plasma Ring & Ion Wake Animation scaled to orbital acceleration
      const children = ufoRingsRef.current.children;
      for (let i = 0; i < children.length; i += 1) {
        const ring = children[i];
        const cycle = (t * (0.65 + trailScale * 1.25) + i / children.length) % 1;
        ring.position.set(
          0,
          -0.06 - cycle * (0.08 + trailScale * 0.12),
          0.75 + cycle * (0.45 + trailScale * 2.55)
        );
        const rScale = (0.28 + cycle * 0.65) * (0.35 + trailScale * 0.75);
        ring.scale.set(rScale, rScale, rScale);
        ring.rotation.z = t * 3 * (i % 2 === 0 ? 1 : -1);
        if (ring.material) {
          ring.material.opacity = Math.max(0.12, (1 - cycle * 0.75) * (0.35 + trailScale * 0.5));
        }
      }
    }
  });

  if (isUfo) {
    return (
      <group ref={exhaustGroupRef}>
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
  // For `MilleniumTriangle` rotated +90deg around Y, rear `Motor_1` arc center is at [0, 0, +0.97].
  const nozzlePos = isFalcon ? [0, 0, 0.97] : isLander ? [0, -0.65, 0.85] : [0, -0.17, 1.02];
  const flameRot = isFalcon ? [0, 0, 0] : [Math.PI / 2, 0, 0];

  return (
    <group ref={exhaustGroupRef} position={nozzlePos}>
      {/* 1. Inner Core Flame / Wide Falcon Sublight Core */}
      <mesh
        ref={yellowFlameRef}
        geometry={yellowGeo}
        rotation={flameRot}
      >
        <meshBasicMaterial color={isFalcon ? '#f0f9ff' : '#fde047'} />
      </mesh>

      {/* 2. Mid Vibrant Plume */}
      <mesh
        ref={orangeFlameRef}
        geometry={orangeGeo}
        position={[0, 0, isFalcon ? 0.02 : 0.04]}
        rotation={flameRot}
      >
        <meshBasicMaterial
          color={isFalcon ? '#38bdf8' : '#f97316'}
          transparent
          opacity={isFalcon ? 0.85 : 0.92}
          depthWrite={!isFalcon}
        />
      </mesh>

      {/* 3. Outer Combustion / Broad Ion Glow Envelope */}
      <mesh
        ref={redFlameRef}
        geometry={redGeo}
        position={[0, 0, isFalcon ? 0.04 : 0.08]}
        rotation={flameRot}
      >
        <meshBasicMaterial
          color={isFalcon ? '#0284c7' : '#ef4444'}
          transparent
          opacity={isFalcon ? 0.48 : 0.78}
          depthWrite={!isFalcon}
        />
      </mesh>

      {/* 4. Wide Sublight Ion Wake Bars (Falcon) or Low-Poly Smoke Puffs (Rockets) */}
      <group ref={smokePuffsRef}>
        {puffSeeds.map((s, idx) => (
          <mesh key={idx}>
            {isFalcon ? (
              <boxGeometry args={[0.68, 0.026, 0.34]} />
            ) : (
              <dodecahedronGeometry args={[1, 0]} />
            )}
            {isFalcon ? (
              <meshBasicMaterial
                color={s.color}
                transparent
                depthWrite={false}
                opacity={0.55}
              />
            ) : (
              <meshStandardMaterial
                color={s.color}
                flatShading
                roughness={0.92}
                transparent
                depthWrite={false}
                opacity={0.7}
              />
            )}
          </mesh>
        ))}
      </group>

      <pointLight
        color={isFalcon ? '#38bdf8' : '#f97316'}
        intensity={isFalcon ? 6.2 : 5.0}
        distance={isFalcon ? 4.0 : 3.2}
        position={[0, 0, 0.5]}
      />
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
  const isFalcon = shipFile.toLowerCase().includes('millenium');

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
      obstacles: ALL_NAV_BODIES.map((p) => ({
        name: p.name,
        pos: new THREE.Vector3(),
        safeR:
          p.name === 'Sol'
            ? p.size * 1.26 + 0.14
            : p.name === 'Saturn'
              ? p.size * 1.62 + 0.12
              : p.name === 'ISS'
                ? p.size * 2.1 + 0.24
                : p.name === 'Earth'
                  ? p.size * 1.12 + 0.06
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
    tripDist: 10,
    trailScale: 0.3,
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
      st.tripDist = tripDist;
      st.duration = Math.min(7.5, Math.max(3.2, 2.5 + tripDist * 0.18));
      st.currentTarget = targetBodyName;
      st.inTransit = true;
      st.progress = 0;

      if (shipTransitRef) {
        shipTransitRef.current.inTransit = true;
        shipTransitRef.current.progress = 0;
        shipTransitRef.current.startPos.copy(st.startPos);
        shipTransitRef.current.target = targetBodyName;
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

    const planetMeta = ALL_NAV_BODIES.find((p) => p.name === st.currentTarget);
    const bodySize = planetMeta?.size ?? 0.6;
    const localOrbitRadius =
      st.currentTarget === 'Saturn'
        ? bodySize * 1.68 + 0.14
        : st.currentTarget === 'Sol'
          ? bodySize * 1.32 + 0.16
          : st.currentTarget === 'ISS'
            ? bodySize * 1.55 + 0.14
            : st.currentTarget === 'Earth'
              ? bodySize * 1.15 + 0.08
              : bodySize * 1.28 + 0.14;

    const targetTrailScale = computeTrailScale({
      orbitRadius: localOrbitRadius,
      inTransit: st.inTransit,
      tripDist: st.tripDist,
      progress: st.progress,
    });
    st.trailScale += (targetTrailScale - st.trailScale) * Math.min(1, 1 - Math.exp(-5 * delta));

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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let i = 0; i < obstacles.length; i += 1) {
          const obs = obstacles[i];
          if (!obs.active) continue;
          if (st.currentTarget === 'ISS' && obs.name === 'Earth') {
            diff.subVectors(pt, obs.pos);
            const earthDist = diff.length();
            if (earthDist < 0.88) {
              diff.normalize();
              pt.copy(obs.pos).addScaledVector(diff, 0.88);
            }
            continue;
          }
          diff.subVectors(pt, obs.pos);
          const dist = diff.length();
          const influenceR = obs.name === 'ISS' ? obs.safeR * 1.25 : obs.safeR * 1.45;
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

    const isDockingTarget = st.currentTarget === 'ISS';
    const dockObj = isDockingTarget ? planetObjectsRef.current['ISS_DOCK'] : null;

    if (st.inTransit) {
      const approachAngle =
        Math.atan2(
          st.startPos.z - planetWorldPos.z,
          st.startPos.x - planetWorldPos.x
        ) + 0.65;
      st.orbitAngle = approachAngle;
    } else if (!paused && !isDockingTarget) {
      st.orbitAngle += delta * 0.95;
    }

    if (isDockingTarget && dockObj) {
      dockObj.getWorldPosition(destPos);
    } else {
      const earthOrbitY =
        st.currentTarget === 'Earth'
          ? -0.07 + Math.sin(st.orbitAngle * 2) * 0.03
          : Math.sin(st.orbitAngle * 2) * 0.015;
      destPos.set(
        planetWorldPos.x + Math.cos(st.orbitAngle) * localOrbitRadius,
        planetWorldPos.y + earthOrbitY,
        planetWorldPos.z + Math.sin(st.orbitAngle) * localOrbitRadius
      );
      pushOutsideObstacles(destPos);
    }

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
        shipTransitRef.current.trailScale = st.trailScale;
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
      ship.position.lerp(destPos, 1 - Math.exp(-delta * (isDockingTarget ? 12 : 8)));

      if (isDockingTarget) {
        // Hold steady alongside the ISS docking berth with nose oriented toward the station
        mat4.lookAt(ship.position, planetWorldPos, up);
        targetQuat.setFromRotationMatrix(mat4);
        ship.quaternion.slerp(targetQuat, 1 - Math.exp(-delta * 10));
      } else {
        tangent.set(-Math.sin(st.orbitAngle), 0, Math.cos(st.orbitAngle)).normalize();
        aheadPos.copy(ship.position).add(tangent);
        mat4.lookAt(ship.position, aheadPos, up);
        targetQuat.setFromRotationMatrix(mat4);
        ship.quaternion.slerp(targetQuat, 1 - Math.exp(-delta * 8));
      }

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
      <group ref={shipGroupRef} scale={isFalcon ? 0.095 : 0.075}>
        <group rotation={[0, isFalcon ? Math.PI / 2 : 0, 0]}>
          <primitive object={shipModel} dispose={null} />
        </group>
        <SpacecraftExhaustFX
          isUfo={isUfo}
          isLander={isLander}
          isFalcon={isFalcon}
          inTransitRef={flightState}
        />
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
  const hasUserInteractedRef = useRef(false);
  const portraitFittedRef = useRef(false);
  const targetCamPosRef = useRef(new THREE.Vector3());
  const responsiveOverviewRef = useRef(new THREE.Vector3(0, 18, 32));
  const viewOffsetStateRef = useRef({
    offsetX: 0,
    appliedOffsetX: -1,
    width: 0,
    height: 0,
    expLeft: 0,
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      hasUserInteractedRef.current = true;
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

        const planetData = ALL_NAV_BODIES.find((p) => p.name === focusPlanet);
        const size = planetData?.size || 0.6;
        const zoomDist = focusPlanet === 'ISS' ? Math.max(0.85, size * 3.5) : Math.max(0.95, size * 3.2);

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

    // Keep focused planet/station smoothly centered horizontally between the left sidebar
    // (or viewport left edge when collapsed) and the floating right planet panel.
    const vs = viewOffsetStateRef.current;
    const explorer = state.gl.domElement.closest('.mission-hub__explorer');
    const inspectionEl = explorer?.querySelector('.mission-inspection');
    const expRect = explorer?.getBoundingClientRect();
    let targetOffsetX = 0;

    if (
      focusPlanet &&
      expRect &&
      inspectionEl &&
      typeof window !== 'undefined' &&
      window.innerWidth > 900
    ) {
      const inspRect = inspectionEl.getBoundingClientRect();
      const occludedRight = Math.max(0, expRect.right - inspRect.left);
      targetOffsetX = computeInspectorCenterOffsetX(state.size.width, occludedRight);
    }

    // Preserve visual continuity without a sudden jump when collapsing/expanding the left sidebar (desktop only)
    const isDesktop = typeof window === 'undefined' || window.innerWidth > 900;
    const expLeft = expRect?.left ?? 0;
    const sizeChanged = vs.width !== state.size.width || vs.height !== state.size.height;
    if (!isDesktop) {
      vs.offsetX = 0;
    } else if (vs.width > 0 && expRect && (vs.width !== state.size.width || Math.abs(vs.expLeft - expLeft) > 1)) {
      const prevScreenX = vs.expLeft + (vs.width * 0.5 - vs.offsetX);
      vs.offsetX = THREE.MathUtils.clamp(
        expLeft + state.size.width * 0.5 - prevScreenX,
        -state.size.width * 0.42,
        state.size.width * 0.45
      );
    }

    vs.offsetX += (targetOffsetX - vs.offsetX) * Math.min(1, 1 - Math.exp(-3.4 * delta));
    if (sizeChanged || Math.abs(vs.offsetX - vs.appliedOffsetX) > 0.05) {
      if (targetOffsetX === 0 && Math.abs(vs.offsetX) < 0.35) {
        vs.offsetX = 0;
        if (state.camera.view?.enabled) {
          state.camera.clearViewOffset();
        }
      } else if (state.size.width > 0 && state.size.height > 0) {
        state.camera.setViewOffset(
          state.size.width,
          state.size.height,
          vs.offsetX,
          0,
          state.size.width,
          state.size.height
        );
      }
      vs.appliedOffsetX = vs.offsetX;
      vs.width = state.size.width;
      vs.height = state.size.height;
      vs.expLeft = expLeft;
    }

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

    const aspect =
      state.size.width > 0 && state.size.height > 0
        ? state.size.width / state.size.height
        : 1.4;
    const portraitScale =
      aspect < 1 ? Math.min(1.8, Math.max(1, 1.02 / Math.max(aspect, 0.52))) : 1;
    responsiveOverviewRef.current.copy(overviewPosition).multiplyScalar(portraitScale);

    if (!portraitFittedRef.current && state.size.width > 0 && state.size.height > 0) {
      portraitFittedRef.current = true;
      if (!focusPlanet && !hasUserInteractedRef.current && portraitScale > 1.02) {
        state.camera.position.copy(responsiveOverviewRef.current);
      }
    }

    const dampFactor = Math.min(1, 1 - Math.exp(-3.6 * delta));

    if (focusPlanet && planetObjectsRef.current[focusPlanet]) {
      const obj = planetObjectsRef.current[focusPlanet];
      const worldPos = new THREE.Vector3();
      obj.getWorldPosition(worldPos);

      const planetData = ALL_NAV_BODIES.find((p) => p.name === focusPlanet);
      const size = planetData?.size || 0.6;
      const baseZoomDist = focusPlanet === 'ISS' ? Math.max(0.85, size * 3.5) : Math.max(0.95, size * 3.2);
      const zoomDist = aspect < 0.85 ? baseZoomDist * 1.25 : baseZoomDist;

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
      const targetOverview = responsiveOverviewRef.current;
      controls.target.lerp(overviewTarget, dampFactor);
      state.camera.position.lerp(targetOverview, dampFactor);

      if (
        controls.target.distanceTo(overviewTarget) < 0.05 &&
        state.camera.position.distanceTo(targetOverview) < 0.1
      ) {
        isTransitioningRef.current = false;
      }
    }

    controls.update();
  });

  return null;
}

/** Engine loop per ship class: UFO keeps the ion hum, the Falcon growls, the
 *  nave* rockets burn chemical propellant. */
function getEngineLoopName(shipFile = '') {
  const file = shipFile.toLowerCase();
  if (file.includes('ovni')) return 'engine';
  if (file.includes('millenium')) return 'engine-falcon';
  return 'engine-rocket';
}

/**
 * Drives the spacecraft audio bed from `shipTransitRef`: engine spool + looped
 * thrust while cruising between bodies (loudest mid-flight), then a retro burn /
 * touchdown rumble on arrival — or a docking clank when berthing with the ISS.
 */
function ShipSoundDriver({ shipTransitRef, shipFile, sfx }) {
  const prevRef = useRef({ inTransit: false });
  const loopNameRef = useRef(getEngineLoopName(shipFile));
  const stopLoopRef = useRef(sfx.stopLoop);
  stopLoopRef.current = sfx.stopLoop;

  useFrame(() => {
    const tr = shipTransitRef.current;
    const prev = prevRef.current;
    if (!tr) return;

    if (tr.inTransit && !prev.inTransit) {
      loopNameRef.current = getEngineLoopName(shipFile);
      sfx.play('ship-launch');
      sfx.startLoop(loopNameRef.current, 0.35);
    } else if (!tr.inTransit && prev.inTransit) {
      sfx.stopLoop(loopNameRef.current);
      sfx.play(tr.target === 'ISS' ? 'dock' : 'ship-arrive');
    }

    if (tr.inTransit) {
      const p = Math.min(1, Math.max(0, tr.progress ?? 0));
      const thrust = 0.3 + Math.sin(Math.PI * p) * 0.7;
      sfx.setLoopLevel(loopNameRef.current, thrust);
    }

    prev.inTransit = tr.inTransit;
  });

  useEffect(() => () => stopLoopRef.current(loopNameRef.current), []);

  return null;
}

function OrbitalStationMesh({
  stationData,
  isSelected,
  onClick,
  registerPlanet,
  paused,
}) {
  const orbitRef = useRef(null);
  const stationRef = useRef(null);
  const dockingBerthRef = useRef(null);
  const spinRef = useRef(null);
  const { scene } = useGLTF(ISS_MODEL_URL, false, false);
  const model = useMemo(() => normalizeModel(scene), [scene]);

  useEffect(() => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y = stationData.initialAngle ?? 0;
    }
  }, [stationData.initialAngle]);

  useEffect(() => {
    registerPlanet?.(stationData.name, stationRef.current);
    registerPlanet?.('ISS_DOCK', dockingBerthRef.current);
    return () => {
      registerPlanet?.(stationData.name, null);
      registerPlanet?.('ISS_DOCK', null);
    };
  }, [stationData.name, registerPlanet]);

  useFrame((_, delta) => {
    if (paused || isSelected) return;
    if (orbitRef.current) {
      orbitRef.current.rotation.y += (stationData.orbitSpeed ?? 0.08) * 15 * delta;
    }
  });

  const select = (event) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    onClick?.(stationData.name);
  };

  return (
    <group ref={orbitRef}>
      <group
        ref={stationRef}
        name="SolarDestination:iss"
        position={[stationData.distance, stationData.yOffset ?? 0.22, 0]}
        userData={{ planetId: 'iss', name: stationData.name }}
      >
        <group scale={stationData.size} onClick={select}>
          <group ref={spinRef} rotation={[0.14, 0.35, -0.06]}>
            <primitive object={model} dispose={null} />
          </group>
          {/* Collision-free outward LVLH docking berth well outside the ISS solar arrays */}
          <group ref={dockingBerthRef} position={[2.05, 0.42, 0.2]} />
        </group>
      </group>
    </group>
  );
}

function EarthMoonSystem({
  earthData,
  moonData,
  issData,
  focusPlanet,
  onPlanetClick,
  registerPlanet,
  paused,
}) {
  const earthOrbitGroup = useRef();
  const moonOrbitGroup = useRef();

  const isEarthSelected = focusPlanet === 'Earth';
  const isMoonSelected = focusPlanet === 'Moon';
  const isIssSelected = focusPlanet === 'ISS';
  const isAnySelected = isEarthSelected || isMoonSelected || isIssSelected;

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

        {issData && ISS_MODEL_URL && (
          <>
            <group position={[0, issData.yOffset ?? 0.16, 0]}>
              <OrbitRing radius={issData.distance} color="#38bdf8" opacity={0.28} />
            </group>
            <OrbitalStationMesh
              stationData={issData}
              isSelected={isIssSelected}
              onClick={onPlanetClick}
              registerPlanet={registerPlanet}
              paused={paused}
            />
          </>
        )}

        <OrbitRing radius={moonData.distance} color="#38bdf8" opacity={0.24} />

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

function SceneContent({ paused, panelCollapsed = false, shipFile = 'naveAzulNuevo.glb', sfx }) {
  const { focusPlanet, setFocusPlanet, scenarioKey } = useApp();
  const controlsRef = useRef();
  const planetObjectsRef = useRef({});
  const shipTransitRef = useRef({
    inTransit: false,
    progress: 1,
    shipPos: new THREE.Vector3(10.2, 0.8, 0),
    startPos: new THREE.Vector3(10.2, 0.8, 0),
    destPos: new THREE.Vector3(10.2, 0, 0),
    target: null,
    trailScale: 0.3,
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

      {sfx && <ShipSoundDriver shipTransitRef={shipTransitRef} shipFile={shipFile} sfx={sfx} />}

      {/* Low-Poly Octahedral Starfield */}
      <LowPolyStarfield />

      <Suspense fallback={null}>
        {/* Space Map Texture Backdrop uploaded by dev */}
        <SpaceTextureSkyDome />

        {/* Dense 3D Asteroid Belt Ring between Earth and Mars */}
        <AsteroidBelt3D paused={paused} />

        {/* Earth + ISS + Moon compound system */}
        {earthData && moonData && (
          <EarthMoonSystem
            earthData={earthData}
            moonData={moonData}
            issData={ISS_DESTINATION}
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
  const sfx = useSound();
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}>
      <Canvas
        camera={{ position: [0, 18, 32], fov: 44, far: 400 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', background: '#040711' }}
      >
        <SceneContent
          paused={paused}
          panelCollapsed={panelCollapsed}
          shipFile={shipFile}
          sfx={sfx}
        />
      </Canvas>
    </div>
  );
}
