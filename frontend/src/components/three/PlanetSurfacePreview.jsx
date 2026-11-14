import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Color, Object3D, Vector3 } from 'three';

import { createSurfacePreview } from './surface-preview.js';
import LowPolySpace from './LowPolySpace.jsx';
import EnvironmentLandscape from './EnvironmentLandscape.jsx';
import { getEnvironmentPerspective } from './environment-perspective.js';

function Terrain({ scene }) {
  const tiles = useRef(null);

  useLayoutEffect(() => {
    const transform = new Object3D();
    const color = new Color();
    scene.tiles.forEach((tile, index) => {
      transform.position.set(tile.x, tile.height / 2, tile.z);
      transform.scale.set(2.005, tile.height, 2.005);
      transform.updateMatrix();
      tiles.current.setMatrixAt(index, transform.matrix);
      tiles.current.setColorAt(index, color.set(tile.color));
    });
    tiles.current.instanceMatrix.needsUpdate = true;
    tiles.current.instanceColor.needsUpdate = true;
    tiles.current.computeBoundingSphere();
  }, [scene]);

  return (
    <>
      <instancedMesh ref={tiles} args={[undefined, undefined, scene.tiles.length]}>
        <boxGeometry />
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
      {scene.plants.map(({ x, y, z, scale }, index) => (
        <group key={index} position={[x, y, z]} scale={scale}>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[0.22, 1.6, 0.22]} />
            <meshStandardMaterial color={scene.trunk} roughness={1} />
          </mesh>
          {scene.plant === 'cactus' ? (
            <mesh position={[0.22, 1, 0]}>
              <boxGeometry args={[0.7, 0.22, 0.22]} />
              <meshStandardMaterial color={scene.foliage} roughness={1} />
            </mesh>
          ) : (
            <mesh position={[0, 1.9, 0]}>
              {scene.plant === 'pine' ? <coneGeometry args={[0.85, 2.1, 5]} /> : <icosahedronGeometry args={[1.1, 0]} />}
              <meshStandardMaterial color={scene.foliage} flatShading roughness={1} />
            </mesh>
          )}
        </group>
      ))}
      {scene.rocks.map(({ x, y, z, scale }, index) => (
        <mesh key={index} position={[x, y + scale * 0.45, z]} scale={[scale * 1.4, scale, scale]} rotation={[0, index, 0]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={scene.rock} flatShading roughness={1} />
        </mesh>
      ))}
      {scene.clouds && [-12, 0, 12].map((x) => (
        <group key={x} position={[x, 8 + Math.abs(x) / 12, -22]}>
          {[0, 1, 2].map((part) => (
            <mesh key={part} position={[part * 1.8, part === 1 ? 0.4 : 0, 0]}>
              <boxGeometry args={[2.8, 0.7, 1.2]} />
              <meshBasicMaterial color="#dce4df" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

export default function PlanetSurfacePreview({ zoneId, planetId = 'earth' }) {
  const scene = useMemo(() => createSurfacePreview(zoneId, planetId), [zoneId, planetId]);
  const view = getEnvironmentPerspective(planetId);
  const offset = new Vector3(...view.position).sub(new Vector3(...view.target));
  const polar = Math.acos(offset.y / offset.length());
  const azimuth = Math.atan2(offset.x, offset.z);
  const rocky = planetId !== 'earth' && scene.kind === 'surface';

  return (
    <Canvas
      frameloop="demand"
      shadows={rocky}
      dpr={[1, 1.5]}
      camera={{ position: view.position, fov: view.fov, near: view.near, far: view.far }}
      fallback={<p>3D preview unavailable: WebGL is required.</p>}
    >
      <color attach="background" args={[scene.sky]} />
      {view.fog && <fog attach="fog" args={[scene.sky, ...view.fog]} />}
      <ambientLight intensity={view.ambient} />
      <directionalLight
        position={view.light}
        intensity={view.emissive ? 0 : rocky ? 3 : 2}
        castShadow={rocky}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={180}
        shadow-normalBias={0.03}
      />
      {scene.craters && <LowPolySpace />}
      {planetId === 'earth' ? <Terrain scene={scene} /> : <EnvironmentLandscape scene={scene} planetId={planetId} />}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping={false}
        rotateSpeed={0.3}
        target={view.target}
        minPolarAngle={polar - 0.09}
        maxPolarAngle={polar + (scene.kind === 'surface' ? 0.035 : 0.14)}
        minAzimuthAngle={azimuth - 0.3}
        maxAzimuthAngle={azimuth + 0.3}
      />
    </Canvas>
  );
}
