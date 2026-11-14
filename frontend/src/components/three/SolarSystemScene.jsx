import { Suspense, useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import PlanetModel from './PlanetModel.jsx';
import { PLANETS } from '../../services/mockData.js';
import { useApp } from '../../context/AppContext.jsx';

function OrbitRing({ radius, color = '#223354', opacity = 0.35 }) {
  if (radius <= 0) return null;
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.04, radius + 0.04, 96]} />
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
  // Center camera at (0, 0, 0) when panel is collapsed (100% width),
  // or offset to (4, 0, 0) when panel is open to compensate for the left analytics drawer
  const overviewTarget = useMemo(
    () => (panelCollapsed ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(4, 0, 0)),
    [panelCollapsed]
  );
  const overviewPosition = useMemo(
    () => (panelCollapsed ? new THREE.Vector3(0, 18, 30) : new THREE.Vector3(14, 18, 28)),
    [panelCollapsed]
  );

  const prevFocusRef = useRef(null);
  const prevPanelCollapsedRef = useRef(panelCollapsed);
  const isTransitioningRef = useRef(false);
  const targetCamPosRef = useRef(new THREE.Vector3());

  // Listen for user interaction (mouse drag / touch) on OrbitControls.
  // The moment the user moves the mouse to adjust the angle of view,
  // we immediately hand over full control to OrbitControls!
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

  // When panelCollapsed changes while in overview mode, trigger smooth camera re-centering
  useEffect(() => {
    if (prevPanelCollapsedRef.current !== panelCollapsed) {
      prevPanelCollapsedRef.current = panelCollapsed;
      if (!focusPlanet) {
        isTransitioningRef.current = true;
      }
    }
  }, [panelCollapsed, focusPlanet]);

  // When focusPlanet changes, trigger smooth flight transition
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
        const zoomDist = Math.max(1.8, size * 3.6);

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
        // Smoothly lerp towards the planet
        controls.target.lerp(worldPos, dampFactor);
        state.camera.position.lerp(targetCamPosRef.current, dampFactor);

        // Once close enough, release position so user can freely orbit/change angle
        if (
          controls.target.distanceTo(worldPos) < 0.05 &&
          state.camera.position.distanceTo(targetCamPosRef.current) < 0.1
        ) {
          isTransitioningRef.current = false;
        }
      } else {
        // When not transitioning, keep the orbit pivot locked to the planet center,
        // which allows the user to freely drag, rotate, tilt, and view from any angle!
        controls.target.copy(worldPos);
      }
    } else {
      // General overview: dynamically shifts between centered (0,0,0) and offset (4,0,0)
      if (isTransitioningRef.current) {
        controls.target.lerp(overviewTarget, dampFactor);
        state.camera.position.lerp(overviewPosition, dampFactor);

        if (
          controls.target.distanceTo(overviewTarget) < 0.05 &&
          state.camera.position.distanceTo(overviewPosition) < 0.1
        ) {
          isTransitioningRef.current = false;
        }
      }
    }

    controls.update();
  });

  return null;
}

// Earth and Moon compound system so Moon properly orbits Earth (not the Sun!)
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

  useFrame((state, delta) => {
    // Earth orbits Sun (paused if Earth or Moon is focused or scene is paused)
    if (!paused && !isAnySelected && earthOrbitGroup.current) {
      earthOrbitGroup.current.rotation.y += earthData.orbitSpeed * 15 * delta;
    }

    // Moon orbits Earth (paused if Moon is focused for close inspection)
    if (!paused && !isMoonSelected && moonOrbitGroup.current) {
      moonOrbitGroup.current.rotation.y += moonData.orbitSpeed * 15 * delta;
    }
  });

  return (
    <group ref={earthOrbitGroup}>
      {/* Sun orbit ring for Earth */}
      <OrbitRing radius={earthData.distance} />

      {/* Earth local position arm */}
      <group position={[earthData.distance, 0, 0]}>
        {/* Earth Model */}
        <PlanetModel
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

        {/* Moon local orbit ring around Earth */}
        <OrbitRing radius={moonData.distance} color="#38bdf8" opacity={0.25} />

        {/* Moon local orbit group */}
        <group ref={moonOrbitGroup}>
          <PlanetModel
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

function SceneContent({ paused, panelCollapsed = false }) {
  const { focusPlanet, setFocusPlanet } = useApp();
  const controlsRef = useRef();
  const planetObjectsRef = useRef({});

  const registerPlanet = useCallback((name, mesh) => {
    planetObjectsRef.current[name] = mesh;
  }, []);

  const handlePlanetClick = useCallback((name) => {
    setFocusPlanet((prev) => (prev === name ? null : name));
  }, [setFocusPlanet]);

  const earthData = useMemo(() => PLANETS.find((p) => p.name === 'Earth'), []);
  const moonData = useMemo(() => PLANETS.find((p) => p.name === 'Moon'), []);
  const otherPlanets = useMemo(
    () => PLANETS.filter((p) => p.name !== 'Earth' && p.name !== 'Moon'),
    []
  );

  return (
    <>
      <color attach="background" args={['#040711']} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={120} distance={200} decay={1.5} color="#fff8e7" />

      {/* OrbitControls configured with damping */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={panelCollapsed ? [0, 0, 0] : [4, 0, 0]}
        minDistance={1.2}
        maxDistance={90}
        maxPolarAngle={Math.PI / 2 + 0.15}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Camera transition controller with dynamic panel awareness */}
      <CameraController
        focusPlanet={focusPlanet}
        planetObjectsRef={planetObjectsRef}
        controlsRef={controlsRef}
        panelCollapsed={panelCollapsed}
      />

      <Stars radius={120} depth={60} count={3000} factor={4} saturation={0} fade speed={1} />

      <Suspense fallback={null}>
        {/* Render Earth and Moon compound system */}
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

        {/* Render other planets & Sun */}
        {otherPlanets.map((planet) => {
          const isSun = planet.name === 'Sol';
          const isSelected = focusPlanet === planet.name;

          return (
            <group key={planet.name}>
              {planet.distance > 0 && <OrbitRing radius={planet.distance} />}

              <PlanetModel
                name={planet.name}
                model={planet.model}
                size={planet.size}
                distance={planet.distance}
                orbitSpeed={planet.orbitSpeed}
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
      </Suspense>
    </>
  );
}

export default function SolarSystemScene({ paused = false, panelCollapsed = false }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: panelCollapsed ? [0, 18, 30] : [14, 18, 28], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', background: '#040711' }}
      >
        <SceneContent paused={paused} panelCollapsed={panelCollapsed} />
      </Canvas>
    </div>
  );
}
