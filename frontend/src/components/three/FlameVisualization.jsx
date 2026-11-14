import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function SphericalFlame({ oxygen = 30, airflow = 0.05 }) {
  const innerRef = useRef();
  const outerRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 3) * 0.03;
    if (innerRef.current) {
      innerRef.current.scale.set(pulse, pulse, pulse);
    }
    if (outerRef.current) {
      outerRef.current.scale.set(pulse * 1.35, pulse * 1.35, pulse * 1.35);
    }
  });

  const baseScale = 0.8 + (oxygen / 30) * 0.4;

  return (
    <group position={[0, 0.2, 0]} scale={[baseScale, baseScale, baseScale]}>
      {/* Burner tip stem */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.2, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Dim outer blue haze (molecular diffusion radical zone) */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.18}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Mid chemiluminescence envelope (pure CH* radicals) */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Bright core */}
      <mesh>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.85} />
      </mesh>

      <pointLight color="#38bdf8" intensity={15} distance={10} decay={2} />
    </group>
  );
}

function TeardropFlame({ oxygen = 30, airflow = 0.05 }) {
  const flameGroup = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const flicker = 1 + Math.sin(t * 12) * 0.04 + Math.cos(t * 8) * 0.02;
    if (flameGroup.current) {
      flameGroup.current.scale.y = flicker * (1.4 + airflow * 2);
      flameGroup.current.scale.x = (1 / flicker) * 0.9;
      flameGroup.current.scale.z = (1 / flicker) * 0.9;
    }
  });

  const baseScale = 0.9 + (oxygen / 30) * 0.3;

  return (
    <group position={[0, -0.4, 0]} scale={[baseScale, baseScale, baseScale]}>
      {/* Burner tip stem */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.2, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      <group ref={flameGroup}>
        {/* Elongated outer yellow incandescent soot zone */}
        <mesh position={[0, 0.9, 0]}>
          <coneGeometry args={[0.65, 1.8, 32]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.65} />
        </mesh>

        {/* Lower bulbous base */}
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.7} />
        </mesh>

        {/* Hot white/yellow incandescent core */}
        <mesh position={[0, 0.4, 0]}>
          <coneGeometry args={[0.35, 1.1, 24]} />
          <meshBasicMaterial color="#fef08a" transparent opacity={0.9} />
        </mesh>

        {/* Tiny blue base flame */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.25, 0.2, 0.2, 16]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
        </mesh>
      </group>

      <pointLight color="#f59e0b" intensity={25} distance={12} decay={2} position={[0, 0.8, 0]} />
    </group>
  );
}

export default function FlameVisualization({ type = 'spherical', oxygen = 30, airflow = 0.05 }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 3.8], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', background: '#070b16' }}
      >
        <color attach="background" args={['#070b16']} />
        <ambientLight intensity={0.2} />

        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} />

        {type === 'spherical' ? (
          <SphericalFlame oxygen={oxygen} airflow={airflow} />
        ) : (
          <TeardropFlame oxygen={oxygen} airflow={airflow} />
        )}
      </Canvas>
    </div>
  );
}
