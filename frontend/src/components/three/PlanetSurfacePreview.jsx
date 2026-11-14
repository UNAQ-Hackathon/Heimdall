import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Color, Object3D } from 'three';

import { createSurfacePreview } from './surface-preview.js';
import LowPolySpace from './LowPolySpace.jsx';

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

function Cloudscape({ scene, planetId }) {
  return (
    <group>
      {Array.from({ length: 63 }, (_, index) => {
        const row = Math.floor(index / 9);
        const x = (index % 9 - 4) * 6;
        const z = 8 - row * 6;
        return (
          <mesh key={index} position={[x, -1.5 + Math.sin(index * 1.7) * 0.65, z]} scale={[5, 0.65 + row * 0.12, 3]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={scene.ground[row % scene.ground.length]} flatShading roughness={1} />
          </mesh>
        );
      })}
      {planetId === 'jupiter' && [0, 1, 2].map((index) => (
        <mesh key={index} position={[-3, 0.25 + index * 0.1, -10]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.5, 1, 1]}>
          <torusGeometry args={[1.2 + index * 0.55, 0.3, 4, 12]} />
          <meshBasicMaterial color={index % 2 ? scene.ground[0] : scene.accent} />
        </mesh>
      ))}
      {planetId === 'saturn' && (
        <mesh position={[0, 14, -28]} rotation={[0.2, 0, -0.35]} scale={[1.8, 1, 1]}>
          <torusGeometry args={[15, 0.65, 3, 48, Math.PI]} />
          <meshBasicMaterial color={scene.ground[2]} />
        </mesh>
      )}
      {scene.kind === 'plasma' && [-7, 4].map((x) => (
        <mesh key={x} position={[x, 0, -12]} rotation={[0.1, 0.3, 0]}>
          <torusGeometry args={[3.5, 0.35, 4, 12, Math.PI]} />
          <meshBasicMaterial color={scene.accent} />
        </mesh>
      ))}
    </group>
  );
}

export default function PlanetSurfacePreview({ zoneId, planetId = 'earth' }) {
  const scene = useMemo(() => createSurfacePreview(zoneId, planetId), [zoneId, planetId]);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 3.2, 8], fov: 52, near: 0.1, far: 180 }}
      fallback={<p>3D preview unavailable: WebGL is required.</p>}
    >
      <color attach="background" args={[scene.sky]} />
      {(scene.haze || scene.clouds) && <fog attach="fog" args={[scene.sky, 18, 40]} />}
      <ambientLight intensity={1.1} />
      <directionalLight position={[-8, 12, 6]} intensity={2} />
      {scene.craters && <LowPolySpace />}
      {scene.kind === 'surface' ? <Terrain scene={scene} /> : <Cloudscape scene={scene} planetId={planetId} />}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping={false}
        rotateSpeed={0.35}
        target={[0, 2, -10]}
        minPolarAngle={1.35}
        maxPolarAngle={1.62}
        minAzimuthAngle={-0.4}
        maxAzimuthAngle={0.4}
      />
    </Canvas>
  );
}
