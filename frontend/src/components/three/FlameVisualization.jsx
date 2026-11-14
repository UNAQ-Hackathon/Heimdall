import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Creates a base low-poly triangulated teardrop geometry whose vertices
 * can be animated in real time while preserving crisp flat-shaded triangles.
 */
function createTeardropBaseGeometry(radius = 0.65, height = 2.1, radialSegs = 12, heightSegs = 9) {
  const geo = new THREE.CylinderGeometry(0.02, radius, height, radialSegs, heightSegs, false);
  geo.translate(0, height / 2, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = Math.max(0, Math.min(1, y / height));

    // Organic flame envelope: rounded base, widest around u=0.28, tapering to a sharp tip at u=1
    const profile = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.85) * (1.15 - 0.3 * u);
    const currentR = Math.hypot(x, z);
    if (currentR > 1e-4) {
      const targetR = radius * profile;
      const factor = targetR / currentR;
      // Add slight deterministic facet jitter so triangles catch the light
      const angle = Math.atan2(z, x);
      const jitter = 1 + Math.sin(angle * 5 + u * 9) * 0.04;
      pos.setX(i, x * factor * jitter);
      pos.setZ(i, z * factor * jitter);
    }
  }

  const nonIndexed = geo.toNonIndexed();
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

/**
 * Low-poly tetrahedral embers rising from the flame
 */
function RisingLowPolyEmbers({ count = 18, color = '#fbbf24', isSpherical = false }) {
  const groupRef = useRef();
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        phase: (i / count) * Math.PI * 2,
        speed: 0.55 + ((i * 7) % 11) * 0.06,
        radius: 0.15 + ((i * 13) % 9) * 0.055,
        size: 0.025 + ((i * 5) % 6) * 0.008,
      })),
    [count]
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i += 1) {
      const mesh = children[i];
      const s = seeds[i];
      const cycle = (t * s.speed + s.phase) % 1;
      if (isSpherical) {
        const r = 0.55 + cycle * 0.65;
        const theta = s.phase + t * 0.5;
        const phi = (i % 5) * 0.6 - 1.2;
        mesh.position.set(
          Math.cos(theta) * Math.cos(phi) * r,
          Math.sin(phi) * r,
          Math.sin(theta) * Math.cos(phi) * r
        );
      } else {
        const y = 0.25 + cycle * 2.15;
        const spiral = s.phase + t * 1.8 + cycle * 3.0;
        const spread = s.radius * (1 - cycle * 0.55);
        mesh.position.set(Math.cos(spiral) * spread, y, Math.sin(spiral) * spread);
      }
      const scale = s.size * (1 - cycle * 0.75);
      mesh.scale.setScalar(Math.max(0.005, scale));
      mesh.rotation.x = t * 2.2 + s.phase;
      mesh.rotation.y = t * 1.7 + s.phase;
    }
  });

  return (
    <group ref={groupRef}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <tetrahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Microgravity (~0g) Triangulated Low-Poly Spherical Diffusion Flame
 */
function SphericalFlame({ oxygen = 30, airflow = 0.05 }) {
  const outerShellRef = useRef();
  const midShellRef = useRef();
  const coreRef = useRef();
  const wireRef = useRef();

  const baseGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.78, 2).toNonIndexed();
    g.computeVertexNormals();
    return g;
  }, []);

  const basePositions = useMemo(
    () => Float32Array.from(baseGeo.attributes.position.array),
    [baseGeo]
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const posAttr = midShellRef.current?.geometry?.attributes?.position;
    if (posAttr) {
      const arr = posAttr.array;
      const drift = Math.min(0.32, airflow * 0.85);
      for (let i = 0; i < arr.length; i += 3) {
        const bx = basePositions[i];
        const by = basePositions[i + 1];
        const bz = basePositions[i + 2];
        const wave =
          1 +
          Math.sin(bx * 4.5 + t * 3.4) * 0.035 +
          Math.cos(by * 5.0 - t * 2.8) * 0.035;
        // Slight convective wake elongation when forced ventilation airflow increases
        const wakeStretch = by > 0 ? 1 + drift * 0.45 : 1 - drift * 0.12;
        arr[i] = bx * wave;
        arr[i + 1] = by * wave * wakeStretch + drift * 0.12;
        arr[i + 2] = bz * wave;
      }
      posAttr.needsUpdate = true;
      midShellRef.current.geometry.computeVertexNormals();
    }

    const pulse = 1 + Math.sin(t * 4.2) * 0.04;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.rotation.y = t * 0.35;
    }
    if (outerShellRef.current) {
      outerShellRef.current.scale.setScalar(1.22 + Math.sin(t * 2.6) * 0.03);
      outerShellRef.current.rotation.y = -t * 0.2;
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = t * 0.25;
      wireRef.current.rotation.x = Math.sin(t * 0.5) * 0.15;
    }
  });

  const o2Factor = 0.78 + Math.min(1.4, Math.max(0.5, oxygen / 35)) * 0.38;
  const hotO2 = oxygen > 50;

  return (
    <group position={[0, 0.18, 0]} scale={[o2Factor, o2Factor, o2Factor]}>
      {/* Low-Poly Burner Nozzle Stem */}
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 1.15, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, -0.56, 0]}>
        <cylinderGeometry args={[0.12, 0.09, 0.12, 6]} />
        <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} flatShading />
      </mesh>

      {/* Porous Spherical Burner Matrix at Center */}
      <mesh position={[0, -0.1, 0]}>
        <icosahedronGeometry args={[0.14, 1]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} flatShading />
      </mesh>

      {/* Inner White-Cyan Radical Core (Faceted Icosahedron) */}
      <mesh ref={coreRef} position={[0, 0.05, 0]}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial
          color="#e0f2fe"
          emissive={hotO2 ? '#bae6fd' : '#38bdf8'}
          emissiveIntensity={1.6}
          flatShading
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Mid Faceted CH* Chemiluminescence Reaction Zone */}
      <mesh ref={midShellRef} geometry={baseGeo}>
        <meshStandardMaterial
          color={hotO2 ? '#7dd3fc' : '#38bdf8'}
          emissive={hotO2 ? '#0284c7' : '#0369a1'}
          emissiveIntensity={1.1}
          roughness={0.35}
          flatShading
          transparent
          opacity={0.68}
        />
      </mesh>

      {/* Crispy Low-Poly Triangle Wireframe Accent */}
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[0.8, 2]} />
        <meshBasicMaterial
          color="#7dd3fc"
          wireframe
          transparent
          opacity={0.22}
        />
      </mesh>

      {/* Outer Molecular Diffusion Halo */}
      <mesh ref={outerShellRef}>
        <icosahedronGeometry args={[0.82, 1]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0ea5e9"
          emissiveIntensity={0.6}
          flatShading
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>

      <RisingLowPolyEmbers count={16} color="#7dd3fc" isSpherical />
      <pointLight color="#38bdf8" intensity={18} distance={10} decay={2} />
    </group>
  );
}

/**
 * 1g / Partial-Gravity Triangulated Low-Poly Buoyant Teardrop Plume
 */
function TeardropFlame({ oxygen = 30, airflow = 0.05 }) {
  const outerGeo = useMemo(() => createTeardropBaseGeometry(0.62, 2.05, 12, 9), []);
  const midGeo = useMemo(() => createTeardropBaseGeometry(0.46, 1.62, 10, 8), []);
  const coreGeo = useMemo(() => createTeardropBaseGeometry(0.26, 1.05, 8, 6), []);

  const outerBase = useMemo(
    () => Float32Array.from(outerGeo.attributes.position.array),
    [outerGeo]
  );
  const midBase = useMemo(
    () => Float32Array.from(midGeo.attributes.position.array),
    [midGeo]
  );

  const outerRef = useRef();
  const midRef = useRef();
  const coreRef = useRef();
  const wireRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const turbulence = 1 + airflow * 3.5;

    const animateMesh = (mesh, baseArr, height, amp) => {
      if (!mesh?.geometry?.attributes?.position) return;
      const pos = mesh.geometry.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = baseArr[i];
        const by = baseArr[i + 1];
        const bz = baseArr[i + 2];
        const u = Math.max(0, Math.min(1, by / height));

        // Upward travelling wave + lateral flicker stronger toward the flame tip
        const waveX =
          Math.sin(by * 4.2 - t * 8.5 * turbulence + bz * 2) * amp * Math.pow(u, 1.3);
        const waveZ =
          Math.cos(by * 3.8 - t * 7.2 * turbulence + bx * 2) * amp * Math.pow(u, 1.3);
        const radialPulse = 1 + Math.sin(by * 5 - t * 10) * 0.05 * u;
        const heightStretch = 1 + airflow * 0.85 * u + Math.sin(t * 9) * 0.03 * u;

        arr[i] = bx * radialPulse + waveX;
        arr[i + 1] = by * heightStretch;
        arr[i + 2] = bz * radialPulse + waveZ;
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    };

    animateMesh(outerRef.current, outerBase, 2.05, 0.09);
    animateMesh(midRef.current, midBase, 1.62, 0.06);

    if (coreRef.current) {
      const flicker = 1 + Math.sin(t * 13) * 0.05;
      coreRef.current.scale.set(1 / flicker, flicker, 1 / flicker);
    }
    if (wireRef.current && outerRef.current) {
      wireRef.current.geometry = outerRef.current.geometry;
    }
  });

  const o2Scale = 0.82 + Math.min(1.4, Math.max(0.55, oxygen / 32)) * 0.28;

  return (
    <group position={[0, -0.78, 0]} scale={[o2Scale, o2Scale, o2Scale]}>
      {/* Low-Poly Hexagonal Burner Nozzle */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 1.1, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.11, 0.12, 6]} />
        <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} flatShading />
      </mesh>

      {/* Low-Poly Blue Oxidizer Entrainment Base Ring */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.38, 0.22, 0.26, 8, 1]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={1.2}
          flatShading
          transparent
          opacity={0.72}
        />
      </mesh>

      {/* Hot White-Yellow Inner Core (Triangulated Low-Poly) */}
      <mesh ref={coreRef} geometry={coreGeo} position={[0, 0.08, 0]}>
        <meshStandardMaterial
          color="#fef9c3"
          emissive="#fde047"
          emissiveIntensity={1.8}
          flatShading
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Mid Faceted Golden-Orange Incandescent Soot Zone */}
      <mesh ref={midRef} geometry={midGeo} position={[0, 0.05, 0]}>
        <meshStandardMaterial
          color="#fb923c"
          emissive="#f59e0b"
          emissiveIntensity={1.25}
          roughness={0.3}
          flatShading
          transparent
          opacity={0.82}
        />
      </mesh>

      {/* Outer Faceted Crimson-Amber Plume Envelope */}
      <mesh ref={outerRef} geometry={outerGeo} position={[0, 0.02, 0]}>
        <meshStandardMaterial
          color="#ea580c"
          emissive="#dc2626"
          emissiveIntensity={0.85}
          roughness={0.4}
          flatShading
          transparent
          opacity={0.46}
        />
      </mesh>

      {/* Crisp Low-Poly Triangular Wireframe Overlay */}
      <mesh ref={wireRef} geometry={outerGeo} position={[0, 0.02, 0]}>
        <meshBasicMaterial
          color="#fde047"
          wireframe
          transparent
          opacity={0.18}
        />
      </mesh>

      {/* Rising Low-Poly Tetrahedral Embers */}
      <RisingLowPolyEmbers count={20} color="#fbbf24" isSpherical={false} />

      <pointLight color="#f59e0b" intensity={24} distance={12} decay={2} position={[0, 0.9, 0.6]} />
      <pointLight color="#38bdf8" intensity={8} distance={6} decay={2} position={[0, 0.1, 0.5]} />
    </group>
  );
}

export default function FlameVisualization({
  type = 'spherical',
  oxygen = 30,
  airflow = 0.05,
}) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0.15, 3.6], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', background: '#050811' }}
      >
        <color attach="background" args={['#050811']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} color="#ffffff" />
        <directionalLight position={[-3, -2, -2]} intensity={0.4} color="#38bdf8" />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
        />

        {type === 'spherical' ? (
          <SphericalFlame oxygen={oxygen} airflow={airflow} />
        ) : (
          <TeardropFlame oxygen={oxygen} airflow={airflow} />
        )}
      </Canvas>
    </div>
  );
}
