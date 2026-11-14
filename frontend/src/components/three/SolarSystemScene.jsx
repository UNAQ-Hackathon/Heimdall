import {
  Suspense,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  iss: 'Earth',
  lunarBase: 'Moon',
  rover: 'Moon',
  spacesuit: 'Earth',
  mars: 'Mars',
};

const STAR_COUNT = 1600;
const STAR_PALETTE = ['#e2e8f0', '#93c5fd', '#fcd34d', '#8f9db7', '#c7d2fe'];

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
 * Individual 3D Asteroid instance cloned from one of the 13 GLB files in assets3d/asteroides/.
 */
function Asteroid3DInstance({ url, radius, angle, yOffset, scale, rotSpeed, paused }) {
  const { scene } = useGLTF(url, false, false);
  const clone = useMemo(() => normalizeModel(scene), [scene]);
  const groupRef = useRef(null);
  const spinRef = useRef(null);

  useFrame((_, delta) => {
    if (paused) return;
    if (spinRef.current) {
      spinRef.current.rotation.x += rotSpeed[0] * delta;
      spinRef.current.rotation.y += rotSpeed[1] * delta;
      spinRef.current.rotation.z += rotSpeed[2] * delta;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius]}
      scale={scale}
    >
      <group ref={spinRef} rotation={[angle, angle * 0.5, 0]}>
        <primitive object={clone} dispose={null} />
      </group>
    </group>
  );
}

/**
 * 3D Asteroid Belt Ring between Earth (distance 10.2) and Mars (distance 18.2),
 * populated with the 13 3D asteroid GLB models from assets3d/asteroides/.
 */
function AsteroidBelt3D({ paused }) {
  const beltRef = useRef(null);

  const beltItems = useMemo(() => {
    if (!ASTEROID_URLS.length) return [];
    const total = ASTEROID_URLS.length * 4; // 52 3D asteroids around the ring
    return Array.from({ length: total }, (_, i) => {
      const asset = ASTEROID_URLS[i % ASTEROID_URLS.length];
      const baseAngle = (i / total) * Math.PI * 2;
      const jitterAngle = (pseudoRandom(i * 13 + 7) - 0.5) * 0.11;
      const radius = 13.3 + pseudoRandom(i * 19 + 3) * 2.1; // Between Earth (10.2) and Mars (18.2)
      const yOffset = (pseudoRandom(i * 29 + 11) - 0.5) * 0.7;
      const scale = 0.12 + pseudoRandom(i * 37 + 5) * 0.15;
      const rotSpeed = [
        (pseudoRandom(i * 41) - 0.5) * 0.9,
        (pseudoRandom(i * 43) - 0.5) * 1.1,
        (pseudoRandom(i * 47) - 0.5) * 0.7,
      ];
      return {
        key: `${asset.name}-${i}`,
        url: asset.url,
        radius,
        angle: baseAngle + jitterAngle,
        yOffset,
        scale,
        rotSpeed,
      };
    });
  }, []);

  useFrame((_, delta) => {
    if (!paused && beltRef.current) {
      beltRef.current.rotation.y += 0.032 * delta;
    }
  });

  return (
    <group ref={beltRef}>
      {/* Subtle inner & outer boundary rings for the asteroid corridor */}
      <OrbitRing radius={13.2} color="#334155" opacity={0.18} />
      <OrbitRing radius={15.4} color="#334155" opacity={0.18} />
      {beltItems.map((item) => (
        <Asteroid3DInstance
          key={item.key}
          url={item.url}
          radius={item.radius}
          angle={item.angle}
          yOffset={item.yOffset}
          scale={item.scale}
          rotSpeed={item.rotSpeed}
          paused={paused}
        />
      ))}
    </group>
  );
}

/**
 * 3D Spacecraft that indicates the currently active planet/moon and flies smoothly
 * along a 3D curved transfer trajectory when switching between planets!
 */
function SpacecraftNavigator({
  targetBodyName,
  planetObjectsRef,
  shipFile = 'Nave_Azul_LowPoly.glb',
  paused = false,
}) {
  const shipUrl = getShipUrl(shipFile);
  const { scene } = useGLTF(shipUrl, false, false);
  const shipModel = useMemo(() => normalizeModel(scene), [scene]);

  const shipGroupRef = useRef(null);
  const thrusterRef = useRef(null);
  const beaconRef = useRef(null);

  const flightState = useRef({
    currentTarget: targetBodyName,
    inTransit: false,
    progress: 1,
    duration: 1.75,
    startPos: new THREE.Vector3(10.2, 1.2, 0),
    lastPos: new THREE.Vector3(10.2, 1.2, 0),
    orbitAngle: 0,
    initialized: false,
  });

  const arcPointsRef = useRef([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ]);

  // Trigger smooth interplanetary flight whenever targetBodyName changes
  useEffect(() => {
    const st = flightState.current;
    if (st.currentTarget !== targetBodyName) {
      if (shipGroupRef.current) {
        st.startPos.copy(shipGroupRef.current.position);
      }
      st.currentTarget = targetBodyName;
      st.inTransit = true;
      st.progress = 0;
    }
  }, [targetBodyName]);

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
    const localOrbitRadius = Math.max(0.42, bodySize * 1.45 + 0.25);
    const localHoverHeight = Math.max(0.22, bodySize * 0.55);

    if (!paused) {
      st.orbitAngle += delta * 1.35;
    }

    // Destination orbital slot around the target planet
    const destPos = new THREE.Vector3(
      planetWorldPos.x + Math.cos(st.orbitAngle) * localOrbitRadius,
      planetWorldPos.y + localHoverHeight + Math.sin(st.orbitAngle * 2) * 0.06,
      planetWorldPos.z + Math.sin(st.orbitAngle) * localOrbitRadius
    );

    if (!st.initialized) {
      ship.position.copy(destPos);
      st.startPos.copy(destPos);
      st.lastPos.copy(destPos);
      st.initialized = true;
      return;
    }

    if (st.inTransit) {
      st.progress = Math.min(1, st.progress + delta / st.duration);
      // Cubic ease-in-out for smooth acceleration and deceleration
      const t = st.progress;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const dist = st.startPos.distanceTo(destPos);
      const arcLift = Math.min(6.5, Math.max(1.2, dist * 0.24));

      const currentPos = new THREE.Vector3().lerpVectors(st.startPos, destPos, ease);
      currentPos.y += Math.sin(Math.PI * ease) * arcLift;

      // Orient spacecraft nose along flight velocity vector
      const velocity = currentPos.clone().sub(st.lastPos);
      if (velocity.lengthSq() > 1e-6) {
        const lookTarget = currentPos.clone().add(velocity.normalize());
        const m = new THREE.Matrix4().lookAt(lookTarget, currentPos, new THREE.Vector3(0, 1, 0));
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
        ship.quaternion.slerp(targetQuat, Math.min(1, delta * 12));
      }

      ship.position.copy(currentPos);
      st.lastPos.copy(currentPos);

      // Update thruster pulse during transit
      if (thrusterRef.current) {
        thrusterRef.current.visible = true;
        const pulse = 0.85 + Math.sin(t * Math.PI * 16) * 0.25;
        thrusterRef.current.scale.set(pulse, pulse * 1.4, pulse);
      }

      if (st.progress >= 1) {
        st.inTransit = false;
      }
    } else {
      // Smoothly follow parking orbit around active planet
      const prevPos = ship.position.clone();
      ship.position.lerp(destPos, Math.min(1, delta * 8));

      // Tangent direction of parking orbit
      const tangent = new THREE.Vector3(
        -Math.sin(st.orbitAngle),
        0,
        Math.cos(st.orbitAngle)
      ).normalize();
      const lookTarget = ship.position.clone().add(tangent);
      const m = new THREE.Matrix4().lookAt(lookTarget, ship.position, new THREE.Vector3(0, 1, 0));
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
      ship.quaternion.slerp(targetQuat, Math.min(1, delta * 8));

      st.lastPos.copy(prevPos);
      if (thrusterRef.current) {
        thrusterRef.current.visible = false;
      }
    }

    // Keep low-poly triangular beacon hovering over the active planet
    if (beaconRef.current) {
      beaconRef.current.position.set(
        planetWorldPos.x,
        planetWorldPos.y + bodySize * 1.35 + 0.32 + Math.sin(st.orbitAngle * 2) * 0.06,
        planetWorldPos.z
      );
      beaconRef.current.rotation.y += delta * 1.8;
    }

    arcPointsRef.current = [st.startPos.clone(), ship.position.clone()];
  });

  return (
    <>
      {/* Spacecraft 3D Mesh */}
      <group ref={shipGroupRef} scale={0.38}>
        <primitive object={shipModel} dispose={null} />
        {/* Low-poly triangular thruster plume during interplanetary transit */}
        <mesh
          ref={thrusterRef}
          position={[0, 0, -1.05]}
          rotation={[Math.PI / 2, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.28, 0.95, 4]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
        </mesh>
        <pointLight color="#38bdf8" intensity={3.5} distance={3.5} />
      </group>

      {/* Low-Poly Triangular Marker Beacon above the active planet */}
      <group ref={beaconRef}>
        <mesh rotation={[Math.PI, 0, 0]} scale={[0.14, 0.22, 0.14]}>
          <coneGeometry args={[1, 1.4, 3]} />
          <meshBasicMaterial color="#fc3d21" wireframe={false} />
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

function CameraController({ focusPlanet, planetObjectsRef, controlsRef, panelCollapsed = false }) {
  const overviewTarget = useMemo(
    () => (panelCollapsed ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(3, 0, 0)),
    [panelCollapsed]
  );
  const overviewPosition = useMemo(
    () => (panelCollapsed ? new THREE.Vector3(0, 22, 38) : new THREE.Vector3(12, 22, 36)),
    [panelCollapsed]
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
    const dampFactor = Math.min(1, 1 - Math.exp(-4.5 * delta));
    const controls = controlsRef.current;
    if (!controls) return;

    if (focusPlanet && planetObjectsRef.current[focusPlanet]) {
      const obj = planetObjectsRef.current[focusPlanet];
      const worldPos = new THREE.Vector3();
      obj.getWorldPosition(worldPos);

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

  // Active target planet for the spacecraft (either clicked/selected planet or active scenario body)
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
        target={panelCollapsed ? [0, 0, 0] : [3, 0, 0]}
        minDistance={0.5}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2 + 0.18}
        enableDamping
        dampingFactor={0.05}
      />

      <CameraController
        focusPlanet={focusPlanet}
        planetObjectsRef={planetObjectsRef}
        controlsRef={controlsRef}
        panelCollapsed={panelCollapsed}
      />

      {/* Low-Poly Octahedral Starfield */}
      <LowPolyStarfield />

      <Suspense fallback={null}>
        {/* 3D Asteroid Belt Ring between Earth and Mars using assets3d/asteroides/*.glb */}
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
        camera={{ position: panelCollapsed ? [0, 22, 38] : [12, 22, 36], fov: 44, far: 400 }}
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
