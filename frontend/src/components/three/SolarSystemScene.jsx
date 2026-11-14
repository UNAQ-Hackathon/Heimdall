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
import { OrbitControls, useGLTF, Line } from '@react-three/drei';
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

const shipUrlMap = import.meta.glob('../../../../assets3d/naves/*.glb', {
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

export const SHIP_CATALOG = [
  { id: 'Nave_Azul_LowPoly.glb', label: 'Blue Explorer' },
  { id: 'Nave_Roja_LowPoly.glb', label: 'Red Cruiser' },
  { id: 'Nave_Verde_LowPoly.glb', label: 'Green Scout' },
  { id: 'OVNI_LowPoly.glb', label: 'Orbital Saucer' },
].filter((s) => shipUrlMap[`../../../../assets3d/naves/${s.id}`]);

function getShipUrl(shipFile = 'Nave_Azul_LowPoly.glb') {
  return (
    shipUrlMap[`../../../../assets3d/naves/${shipFile}`] ??
    Object.values(shipUrlMap)[0]
  );
}

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
 * using InstancedMesh or lightweight cloned primitives at small, realistic ring scales.
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
        <group
          key={item.key}
          position={item.position}
          scale={item.scale}
        >
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
 * Dense, cohesive 3D Asteroid Ring between Earth (distance 10.2) and Mars (distance 18.2):
 * Combines 260 real 3D GLB asteroid models (20 copies of each of the 13 GLBs in assets3d/asteroides/)
 * at small scales (0.022–0.052) + 950 micro-asteroid fragments tightly packed into a ring (radius 13.7–14.5).
 */
function AsteroidBelt3D({ paused }) {
  const beltRef = useRef(null);
  const microMeshRef = useRef(null);

  const groupedByAsset = useMemo(() => {
    if (!ASTEROID_URLS.length) return [];
    const copiesPerModel = 20; // 13 * 20 = 260 3D GLB asteroids
    const total = ASTEROID_URLS.length * copiesPerModel;

    return ASTEROID_URLS.map((asset, assetIdx) => {
      const instances = [];
      for (let c = 0; c < copiesPerModel; c += 1) {
        const globalIdx = c * ASTEROID_URLS.length + assetIdx;
        const baseAngle = (globalIdx / total) * Math.PI * 2;
        const jitterAngle = (pseudoRandom(globalIdx * 13 + 7) - 0.5) * 0.04;
        const angle = baseAngle + jitterAngle;
        // Tight toroidal ring between 13.75 and 14.45
        const radius = 13.75 + pseudoRandom(globalIdx * 19 + 3) * 0.7;
        const yOffset = (pseudoRandom(globalIdx * 29 + 11) - 0.5) * 0.16;
        // Small realistic asteroid scale (much smaller than Moon 0.19)
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
      {/* Dense micro-asteroid ring core */}
      <instancedMesh ref={microMeshRef} args={[undefined, undefined, MICRO_ASTEROID_COUNT]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading roughness={0.85} metalness={0.15} />
      </instancedMesh>

      {/* 260 3D GLB Asteroids from assets3d/asteroides/ */}
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
 * 3D Spacecraft that indicates the currently active planet/moon and flies smoothly
 * along a visible 3D curved transfer trajectory from planet to planet!
 */
function SpacecraftNavigator({
  targetBodyName,
  planetObjectsRef,
  shipTransitRef,
  shipFile = 'Nave_Azul_LowPoly.glb',
  paused = false,
}) {
  const shipUrl = getShipUrl(shipFile);
  const { scene } = useGLTF(shipUrl, false, false);
  const shipModel = useMemo(() => normalizeModel(scene), [scene]);

  const shipGroupRef = useRef(null);
  const thrusterRef = useRef(null);
  const beaconRef = useRef(null);
  const [trajectoryCurve, setTrajectoryCurve] = useState(null);

  const flightState = useRef({
    currentTarget: targetBodyName,
    inTransit: false,
    progress: 1,
    duration: 7.5,
    startPos: new THREE.Vector3(10.2, 0.8, 0),
    lastPos: new THREE.Vector3(10.2, 0.8, 0),
    orbitAngle: 0,
    initialized: false,
  });

  // Trigger smooth interplanetary flight whenever targetBodyName changes
  useEffect(() => {
    const st = flightState.current;
    if (st.currentTarget !== targetBodyName) {
      if (shipGroupRef.current) {
        st.startPos.copy(shipGroupRef.current.position);
      }
      // Snappy, distance-aware travel duration (2.6s for Moon hop, ~4s for inner planets, max 6.5s)
      const destObj = planetObjectsRef.current?.[targetBodyName];
      let tripDist = 10;
      if (destObj) {
        const destWorld = new THREE.Vector3();
        destObj.getWorldPosition(destWorld);
        tripDist = st.startPos.distanceTo(destWorld);
      }
      st.duration = Math.min(6.5, Math.max(2.6, 2.2 + tripDist * 0.16));
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

  useFrame((_, delta) => {
    const st = flightState.current;
    const ship = shipGroupRef.current;
    if (!ship) return;

    const targetObj = planetObjectsRef.current[st.currentTarget];
    if (!targetObj) return;

    const planetWorldPos = new THREE.Vector3();
    targetObj.getWorldPosition(planetWorldPos);

    const planetMeta = PLANETS.find((p) => p.name === st.currentTarget);
    const bodySize = planetMeta?.size ?? 0.6;
    // Note: normalizeModel scales models to radius = 1 (diameter = 2), so planet surface radius = bodySize.
    // Keep orbital radius well outside bodySize + ship wingspan so wings never touch or clip any planet!
    const localOrbitRadius = bodySize * 1.48 + 0.32;
    const localHoverHeight = bodySize * 0.28 + 0.08;

    if (!paused) {
      st.orbitAngle += delta * 0.95;
    }

    // Destination orbital slot around the target planet
    const destPos = new THREE.Vector3(
      planetWorldPos.x + Math.cos(st.orbitAngle) * localOrbitRadius,
      planetWorldPos.y + localHoverHeight + Math.sin(st.orbitAngle * 2) * 0.02,
      planetWorldPos.z + Math.sin(st.orbitAngle) * localOrbitRadius
    );

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
      // Smooth ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const dist = st.startPos.distanceTo(destPos);
      // In-plane Hohmann-style orbital transfer curve in the XZ ecliptic plane (not a vertical parabola!)
      const chord = new THREE.Vector3().subVectors(destPos, st.startPos);
      const mid = new THREE.Vector3().addVectors(st.startPos, destPos).multiplyScalar(0.5);
      const perp = new THREE.Vector3(-chord.z, 0, chord.x);
      if (perp.lengthSq() > 1e-6) {
        perp.normalize();
      } else {
        perp.set(1, 0, 0);
      }
      // Bend outward away from the Sun [0,0,0] so the ship sweeps around orbits naturally
      if (mid.dot(perp) < 0) {
        perp.negate();
      }
      const lateralSweep = Math.min(5.0, Math.max(0.55, dist * 0.28));
      const controlPt = mid
        .clone()
        .addScaledVector(perp, lateralSweep);
      controlPt.y = Math.max(st.startPos.y, destPos.y) + 0.18;

      const evalTransferCurve = (u) => {
        const inv = 1 - u;
        return new THREE.Vector3(
          inv * inv * st.startPos.x + 2 * inv * u * controlPt.x + u * u * destPos.x,
          inv * inv * st.startPos.y + 2 * inv * u * controlPt.y + u * u * destPos.y,
          inv * inv * st.startPos.z + 2 * inv * u * controlPt.z + u * u * destPos.z
        );
      };

      const currentPos = evalTransferCurve(ease);
      const nextT = Math.min(1, ease + 0.025);
      const aheadPos = evalTransferCurve(nextT);

      if (aheadPos.distanceToSquared(currentPos) > 1e-6) {
        const m = new THREE.Matrix4().lookAt(
          currentPos,
          aheadPos,
          new THREE.Vector3(0, 1, 0)
        );
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
        ship.quaternion.slerp(targetQuat, Math.min(1, delta * 14));
      }

      ship.position.copy(currentPos);
      st.lastPos.copy(currentPos);

      if (shipTransitRef) {
        shipTransitRef.current.inTransit = true;
        shipTransitRef.current.progress = ease;
        shipTransitRef.current.shipPos.copy(currentPos);
        shipTransitRef.current.destPos.copy(planetWorldPos);
      }

      // Build visible 3D orbital transfer curve in the ecliptic plane
      const pts = [];
      const steps = 32;
      for (let i = 0; i <= steps; i += 1) {
        const p = evalTransferCurve(i / steps);
        pts.push([p.x, p.y, p.z]);
      }
      setTrajectoryCurve(pts);

      // Thruster plume at the tail (+Z)
      if (thrusterRef.current) {
        thrusterRef.current.visible = true;
        const pulse = 0.85 + Math.sin(t * Math.PI * 18) * 0.25;
        thrusterRef.current.scale.set(pulse, pulse * 1.4, pulse);
      }

      if (st.progress >= 1) {
        st.inTransit = false;
        setTrajectoryCurve(null);
        if (shipTransitRef) {
          shipTransitRef.current.inTransit = false;
        }
      }
    } else {
      // Smoothly follow parking orbit around active planet
      ship.position.lerp(destPos, Math.min(1, delta * 8));

      // Forward tangent direction of parking orbit
      const tangent = new THREE.Vector3(
        -Math.sin(st.orbitAngle),
        0,
        Math.cos(st.orbitAngle)
      ).normalize();
      const aheadPos = ship.position.clone().add(tangent);
      // lookAt(ship.position, aheadPos) points the ship's -Z nose forward along the orbit!
      const m = new THREE.Matrix4().lookAt(
        ship.position,
        aheadPos,
        new THREE.Vector3(0, 1, 0)
      );
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
      ship.quaternion.slerp(targetQuat, Math.min(1, delta * 8));

      if (thrusterRef.current) {
        thrusterRef.current.visible = false;
      }
      if (shipTransitRef) {
        shipTransitRef.current.inTransit = false;
        shipTransitRef.current.shipPos.copy(ship.position);
      }
    }

    // Keep low-poly triangular beacon hovering well above the active planet's north pole
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
      {/* Glowing 3D Curved Transfer Trajectory while flying between planets */}
      {trajectoryCurve && (
        <Line
          points={trajectoryCurve}
          color="#38bdf8"
          lineWidth={2.2}
          dashed
          dashSize={0.28}
          gapSize={0.14}
          transparent
          opacity={0.88}
        />
      )}

      {/* Spacecraft 3D Mesh at realistic miniature scale relative to planets (nose is at -Z, tail is at +Z) */}
      <group ref={shipGroupRef} scale={0.075}>
        <primitive object={shipModel} dispose={null} />
        {/* Low-poly triangular thruster plume at the tail (+Z) during interplanetary transit */}
        <mesh
          ref={thrusterRef}
          position={[0, 0, 1.1]}
          rotation={[Math.PI / 2, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.36, 1.6, 4]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.92} />
        </mesh>
        <pointLight color="#38bdf8" intensity={3.5} distance={2.5} />
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

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const transit = shipTransitRef?.current;

    // While the spacecraft is flying between planets, smoothly track the ship and transfer arc!
    if (transit?.inTransit) {
      const shipPos = transit.shipPos;
      const startPos = transit.startPos;
      const destPos = transit.destPos;
      const p = transit.progress ?? 0.5;

      const followRate = Math.min(1, 1 - Math.exp(-8.0 * delta));
      controls.target.lerp(shipPos, followRate);

      // Frame the miniature spacecraft and its transfer trajectory smoothly
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

function SceneContent({ paused, panelCollapsed = false, shipFile = 'Nave_Azul_LowPoly.glb' }) {
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

        {/* 3D Low-Poly Spacecraft with Smooth Interplanetary Flight Animation */}
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
  shipFile = 'Nave_Azul_LowPoly.glb',
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
