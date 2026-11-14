import { useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Color, DoubleSide, Vector3 } from 'three';

import { createEnvironmentPatch, sampleEnvironmentHeight } from './environment-perspective.js';

function EnvironmentPatch({ scene, planetId }) {
  const geometry = useRef(null);
  const patch = useMemo(() => createEnvironmentPatch(planetId), [planetId]);
  const colors = useMemo(() => {
    const palette = scene.ground.map((color) => new Color(color));
    const accent = new Color(scene.accent ?? scene.ground[0]);
    const color = new Color();
    const output = new Float32Array(patch.positions.length);
    for (let index = 0; index < patch.tones.length; index += 1) {
      const value = patch.tones[index] * (palette.length - 1);
      const lower = Math.floor(value);
      color.lerpColors(palette[lower], palette[Math.min(lower + 1, palette.length - 1)], value - lower);
      const x = patch.positions[index * 3];
      const z = patch.positions[index * 3 + 2];
      if (planetId === 'jupiter' || planetId === 'neptune') {
        const dx = (x + 7) / 10;
        const dz = (z + 35) / 6;
        const radius = Math.hypot(dx, dz);
        const swirl = 0.5 + 0.5 * Math.sin(Math.atan2(dz, dx) * 2 + radius * 11);
        color.lerp(accent, Math.max(0, 1 - radius / 1.4) * (0.55 + swirl * 0.45));
      }
      if (scene.kind === 'plasma') color.multiplyScalar(0.8 + patch.tones[index] * 0.5);
      output.set([color.r, color.g, color.b], index * 3);
    }
    return output;
  }, [patch, scene]);

  useLayoutEffect(() => {
    geometry.current.computeVertexNormals();
  }, [patch]);

  return (
    <mesh name={`EnvironmentPatch:${scene.kind}`} castShadow={scene.kind === 'surface'} receiveShadow={scene.kind === 'surface'}>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[patch.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="index" args={[patch.indices, 1]} />
      </bufferGeometry>
      {scene.kind === 'plasma'
        ? <meshBasicMaterial vertexColors toneMapped={false} />
        : <meshStandardMaterial vertexColors flatShading roughness={1} />}
    </mesh>
  );
}

function SolarProminences() {
  const loops = useMemo(() => [
    { x: -10, z: -32, width: 5, height: 12, lean: 3 },
    { x: 12, z: -58, width: 7, height: 17, lean: -4 },
    { x: -29, z: -76, width: 4, height: 10, lean: 2 },
  ].map((loop) => new CatmullRomCurve3(Array.from({ length: 25 }, (_, index) => {
    const angle = index / 24 * Math.PI;
    const x = loop.x + Math.cos(angle) * loop.width;
    const z = loop.z + Math.sin(angle) * loop.lean;
    return new Vector3(x, sampleEnvironmentHeight(x, z, 'sun') + Math.sin(angle) * loop.height, z);
  }))), []);

  return loops.map((curve, index) => (
    <group key={index} name="SolarProminence">
      <mesh>
        <tubeGeometry args={[curve, 48, 0.13, 5, false]} />
        <meshBasicMaterial color="#ffe1a0" toneMapped={false} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 48, 0.4, 6, false]} />
        <meshBasicMaterial color="#ff7635" transparent opacity={0.24} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  ));
}

function SaturnRingPlane({ scene }) {
  return (
    <group name="AtmosphericRingPerspective" position={[0, 20, -155]} rotation={[0.25, 0.15, -0.28]} scale={[1.6, 0.32, 1]}>
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={index}>
          <ringGeometry args={[94 + index * 2.6, 95.5 + index * 2.6, 128]} />
          <meshBasicMaterial color={scene.ground[index % scene.ground.length]} side={DoubleSide} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function EnvironmentLandscape({ scene, planetId }) {
  return (
    <group name={`Environment:${planetId}`}>
      <EnvironmentPatch scene={scene} planetId={planetId} />
      {scene.rocks.map(({ x, z, scale }, index) => (
        <mesh key={index} position={[x, sampleEnvironmentHeight(x, z, planetId) + scale * 0.3, z]} scale={[scale * 1.4, scale * 0.7, scale]} rotation={[0, index, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={scene.rock} flatShading roughness={1} />
        </mesh>
      ))}
      {planetId === 'saturn' && <SaturnRingPlane scene={scene} />}
      {scene.kind === 'plasma' && <SolarProminences />}
    </group>
  );
}
