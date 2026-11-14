import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import PlanetModel from './PlanetModel.jsx';
import { getSolarPlanetId } from './solar-system-model.js';

export default function SolarSystemPlanet({
  name,
  model,
  size = 1,
  distance = 0,
  orbitSpeed = 0,
  initialAngle = 0,
  isSelected = false,
  paused = false,
  onClick,
  registerPlanet,
}) {
  const orbitRef = useRef(null);
  const planetRef = useRef(null);
  const spinRef = useRef(null);
  const planetId = getSolarPlanetId(model);

  useEffect(() => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y = initialAngle;
    }
  }, [initialAngle]);

  useEffect(() => {
    registerPlanet?.(name, planetRef.current);
    return () => registerPlanet?.(name, null);
  }, [name, registerPlanet]);

  useFrame((_, delta) => {
    if (paused || isSelected) return;
    orbitRef.current.rotation.y += orbitSpeed * 15 * delta;
    spinRef.current.rotation.y += 0.14 * delta;
  });

  const select = (event) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    onClick?.(name);
  };

  return (
    <group ref={orbitRef}>
      <group
        ref={planetRef}
        name={`SolarPlanet:${planetId}`}
        position={[distance, 0, 0]}
        userData={{ planetId, name }}
      >
        <group scale={size} onClick={select}>
          <group ref={spinRef}>
            <PlanetModel planetId={planetId} />
          </group>
        </group>
      </group>
    </group>
  );
}
