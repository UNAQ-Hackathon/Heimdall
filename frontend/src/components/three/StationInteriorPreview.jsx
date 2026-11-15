import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import LowPolySpace from './LowPolySpace.jsx';
import {
  prepareAnimatableAstronaut,
  applyAstronautPose,
} from './astronaut-limb-anim.js';

const astroUrlMap = import.meta.glob('../../../../assets3d/trajesEspaciales/astronautaNormal.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const ASTRO_NORMAL_URL = Object.values(astroUrlMap)[0];

const RIB_Z_POSITIONS = [2.5, 0, -2.5, -5.0, -7.5, -10.0];

function IssModuleCorridor() {
  const flameRef = useRef(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (flameRef.current) {
      const pulse = 1 + Math.sin(t * 4.2) * 0.07;
      flameRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Faceted floor deck & yellow safety guide rails */}
      <mesh position={[0, -0.08, -3.5]} receiveShadow>
        <boxGeometry args={[5.8, 0.16, 15.5]} />
        <meshStandardMaterial color="#182235" flatShading roughness={0.85} />
      </mesh>
      <mesh position={[-1.4, 0.01, -3.5]}>
        <boxGeometry args={[0.1, 0.02, 14.5]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>
      <mesh position={[1.4, 0.01, -3.5]}>
        <boxGeometry args={[0.1, 0.02, 14.5]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>

      {/* Ceiling hull & recessed overhead lighting strips */}
      <mesh position={[0, 3.85, -3.5]}>
        <boxGeometry args={[5.2, 0.18, 15.5]} />
        <meshStandardMaterial color="#0f172a" flatShading roughness={0.9} />
      </mesh>
      {[-0.85, 0.85].map((x, idx) => (
        <mesh key={idx} position={[x, 3.72, -3.5]}>
          <boxGeometry args={[0.24, 0.06, 13.5]} />
          <meshBasicMaterial color="#bae6fd" />
        </mesh>
      ))}

      {/* Angled upper/lower chamfered walls matching octagonal ISS module cross-section */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 2.95, 1.9, -3.5]}>
            <boxGeometry args={[0.18, 3.1, 15.5]} />
            <meshStandardMaterial color="#1e293b" flatShading roughness={0.82} />
          </mesh>
          <mesh position={[side * 2.45, 3.45, -3.5]} rotation={[0, 0, side * 0.68]}>
            <boxGeometry args={[1.3, 0.16, 15.5]} />
            <meshStandardMaterial color="#162136" flatShading roughness={0.85} />
          </mesh>
          {/* Crew Microgravity Translation Handrails */}
          <mesh position={[side * 2.75, 1.35, -3.5]}>
            <boxGeometry args={[0.06, 0.06, 13.2]} />
            <meshStandardMaterial color="#fbbf24" flatShading roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Structural Faceted Bulkhead Rib Rings */}
      {RIB_Z_POSITIONS.map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[-2.8, 1.9, 0]}>
            <boxGeometry args={[0.22, 3.4, 0.24]} />
            <meshStandardMaterial color="#334155" flatShading roughness={0.75} />
          </mesh>
          <mesh position={[2.8, 1.9, 0]}>
            <boxGeometry args={[0.22, 3.4, 0.24]} />
            <meshStandardMaterial color="#334155" flatShading roughness={0.75} />
          </mesh>
          <mesh position={[0, 3.65, 0]}>
            <boxGeometry args={[5.5, 0.22, 0.24]} />
            <meshStandardMaterial color="#334155" flatShading roughness={0.75} />
          </mesh>
        </group>
      ))}

      {/* Left Foreground Rack: CIR (Combustion Integrated Rack) with 0g Blue Spherical Flame Chamber */}
      <group position={[-2.42, 1.55, -0.7]}>
        <mesh>
          <boxGeometry args={[0.88, 2.55, 2.2]} />
          <meshStandardMaterial color="#243248" flatShading roughness={0.75} />
        </mesh>
        {/* Observation chamber window */}
        <mesh position={[0.46, 0.18, 0.15]}>
          <boxGeometry args={[0.04, 0.85, 1.05]} />
          <meshBasicMaterial color="#040914" />
        </mesh>
        {/* 0g Spherical Diffusion Flame inside CIR Chamber */}
        <group ref={flameRef} position={[0.49, 0.18, 0.15]}>
          <mesh>
            <icosahedronGeometry args={[0.2, 0]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.92} />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.31, 0]} />
            <meshBasicMaterial color="#1d4ed8" transparent opacity={0.35} />
          </mesh>
        </group>
        {/* CIR Telemetry Console Screen */}
        <mesh position={[0.46, -0.58, 0.15]}>
          <boxGeometry args={[0.04, 0.36, 0.9]} />
          <meshBasicMaterial color="#0ea5e9" />
        </mesh>
        <pointLight position={[0.9, 0.2, 0.15]} color="#38bdf8" intensity={1.8} distance={3.5} />
      </group>

      {/* Right Midground Rack: MSG (Microgravity Science Glovebox) & FLEX Controls */}
      <group position={[2.42, 1.55, -1.9]}>
        <mesh>
          <boxGeometry args={[0.88, 2.55, 2.4]} />
          <meshStandardMaterial color="#243248" flatShading roughness={0.75} />
        </mesh>
        <mesh position={[-0.46, 0.35, 0]}>
          <boxGeometry args={[0.04, 0.65, 1.1]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-0.47, 0.35, -0.2]}>
          <boxGeometry args={[0.03, 0.38, 0.45]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
        <mesh position={[-0.47, 0.35, 0.3]}>
          <boxGeometry args={[0.03, 0.38, 0.4]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        {/* Warning indicator strip */}
        <mesh position={[-0.46, -0.35, 0]}>
          <boxGeometry args={[0.04, 0.12, 1.3]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* Far Right Storage / ECLSS Life-Support Bay */}
      <group position={[2.42, 1.55, -6.2]}>
        <mesh>
          <boxGeometry args={[0.88, 2.55, 2.8]} />
          <meshStandardMaterial color="#1e293b" flatShading roughness={0.82} />
        </mesh>
        <mesh position={[-0.46, 0.2, 0]}>
          <boxGeometry args={[0.04, 1.6, 2.1]} />
          <meshStandardMaterial color="#334155" flatShading roughness={0.8} />
        </mesh>
      </group>

      {/* Far End Bulkhead (-Z = -10.8) with Octagonal Cupola Earth-Observation Viewport */}
      <group position={[0, 1.9, -10.8]}>
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[6.0, 1.65, 0.3]} />
          <meshStandardMaterial color="#162136" flatShading roughness={0.85} />
        </mesh>
        <mesh position={[0, -1.35, 0]}>
          <boxGeometry args={[6.0, 1.2, 0.3]} />
          <meshStandardMaterial color="#162136" flatShading roughness={0.85} />
        </mesh>
        <mesh position={[-2.15, 0, 0]}>
          <boxGeometry args={[1.9, 2.4, 0.3]} />
          <meshStandardMaterial color="#162136" flatShading roughness={0.85} />
        </mesh>
        <mesh position={[2.15, 0, 0]}>
          <boxGeometry args={[1.9, 2.4, 0.3]} />
          <meshStandardMaterial color="#162136" flatShading roughness={0.85} />
        </mesh>
        {/* Metallic octagonal window frame */}
        <mesh>
          <torusGeometry args={[1.18, 0.14, 6, 8]} />
          <meshStandardMaterial color="#475569" flatShading roughness={0.6} />
        </mesh>
      </group>

      {/* Stylized Low-Poly Earth Limb Visible Outside Cupola Viewport */}
      <group position={[0.4, -2.5, -24]}>
        <mesh>
          <icosahedronGeometry args={[6.6, 2]} />
          <meshStandardMaterial color="#1d4ed8" flatShading roughness={0.8} />
        </mesh>
        <mesh scale={1.015}>
          <icosahedronGeometry args={[6.6, 1]} />
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.18} />
        </mesh>
      </group>
    </group>
  );
}

function AirlockEntrySequence({ replayKey, onPhaseChange }) {
  const { scene: astroScene } = useGLTF(ASTRO_NORMAL_URL, false, false);
  const { root: astroModel, parts: astroParts } = useMemo(
    () => prepareAnimatableAstronaut(astroScene),
    [astroScene]
  );

  const leftDoorRef = useRef(null);
  const rightDoorRef = useRef(null);
  const beaconMatRef = useRef(null);
  const astroGroupRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastPhaseRef = useRef(null);

  useEffect(() => {
    startTimeRef.current = null;
    lastPhaseRef.current = null;
  }, [replayKey]);

  const startPos = useMemo(() => new THREE.Vector3(-3.0, 0.4, -6.9), []);
  const thresholdPos = useMemo(() => new THREE.Vector3(-1.45, 0.45, -5.0), []);
  const targetPos = useMemo(() => new THREE.Vector3(0.05, 0.42, -1.65), []);

  useFrame((state) => {
    const now = state.clock.getElapsedTime();
    if (startTimeRef.current === null) {
      startTimeRef.current = now;
    }
    const elapsed = Math.max(0, now - startTimeRef.current);

    let phase = 'pressurize';
    if (elapsed >= 1.15 && elapsed < 3.6) phase = 'ingress';
    else if (elapsed >= 3.6) phase = 'sealed';

    if (lastPhaseRef.current !== phase) {
      lastPhaseRef.current = phase;
      onPhaseChange?.(phase);
    }

    // Airlock hatch door opening & closing curve
    let openAmount = 0;
    if (elapsed >= 0.55 && elapsed < 1.35) {
      const p = (elapsed - 0.55) / 0.8;
      openAmount = p * p * (3 - 2 * p);
    } else if (elapsed >= 1.35 && elapsed < 3.55) {
      openAmount = 1;
    } else if (elapsed >= 3.55 && elapsed < 4.3) {
      const p = 1 - (elapsed - 3.55) / 0.75;
      openAmount = Math.max(0, p * p * (3 - 2 * p));
    }

    if (leftDoorRef.current && rightDoorRef.current) {
      const slide = 0.52 + openAmount * 0.72;
      leftDoorRef.current.position.x = -slide;
      rightDoorRef.current.position.x = slide;
    }

    if (beaconMatRef.current) {
      if (phase === 'pressurize') {
        const pulse = Math.sin(elapsed * 9) > 0 ? '#f59e0b' : '#78350f';
        beaconMatRef.current.color.set(pulse);
      } else if (phase === 'ingress') {
        beaconMatRef.current.color.set('#38bdf8');
      } else {
        beaconMatRef.current.color.set('#10b981');
      }
    }

    // Astronaut glides out of the airlock vestibule into 0g laboratory hover
    if (astroGroupRef.current) {
      if (elapsed < 1.15) {
        astroGroupRef.current.position.copy(startPos);
        astroGroupRef.current.rotation.set(0.08, 0.56, 0);
        astroGroupRef.current.scale.setScalar(1.18);
        applyAstronautPose(astroParts, { walkSwing: 0, waveRaise: 0, waveOsc: 0 });
      } else if (elapsed < 3.5) {
        const u = (elapsed - 1.15) / 2.35;
        const smooth = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        if (smooth < 0.45) {
          astroGroupRef.current.position.lerpVectors(startPos, thresholdPos, smooth / 0.45);
        } else {
          astroGroupRef.current.position.lerpVectors(thresholdPos, targetPos, (smooth - 0.45) / 0.55);
        }
        const floatY = Math.sin(elapsed * 3.2) * 0.1;
        astroGroupRef.current.position.y += floatY;

        const yaw = THREE.MathUtils.lerp(0.56, 0.18, smooth);
        const pitch = Math.sin(u * Math.PI) * 0.16;
        astroGroupRef.current.rotation.set(pitch, yaw, Math.sin(elapsed * 4) * 0.04);
        astroGroupRef.current.scale.setScalar(1.18 + smooth * 0.08);
        applyAstronautPose(astroParts, {
          walkSwing: Math.sin(elapsed * 7.5) * 0.42,
          waveRaise: 0,
          waveOsc: 0,
        });
      } else {
        const hoverT = elapsed - 3.5;
        astroGroupRef.current.position.set(
          targetPos.x + Math.sin(hoverT * 0.9) * 0.05,
          targetPos.y + Math.sin(hoverT * 1.8) * 0.09,
          targetPos.z
        );
        astroGroupRef.current.rotation.set(
          Math.sin(hoverT * 1.2) * 0.05,
          0.18 + Math.sin(hoverT * 0.7) * 0.08,
          Math.cos(hoverT * 1.4) * 0.04
        );
        astroGroupRef.current.scale.setScalar(1.26);
        const waveRaise = Math.min(1, hoverT / 0.4);
        const waveOsc = Math.sin(hoverT * 7.2) * 0.38;
        applyAstronautPose(astroParts, { walkSwing: 0, waveRaise, waveOsc });
      }
    }
  });

  return (
    <group>
      {/* Angled Quest Airlock Bulkhead + Vestibule Tunnel */}
      <group position={[-1.7, 0, -5.2]} rotation={[0, 0.52, 0]}>
        {/* Outer airlock frame */}
        <mesh position={[-1.32, 1.5, 0]}>
          <boxGeometry args={[0.7, 3.0, 0.45]} />
          <meshStandardMaterial color="#334155" flatShading roughness={0.75} />
        </mesh>
        <mesh position={[1.32, 1.5, 0]}>
          <boxGeometry args={[0.7, 3.0, 0.45]} />
          <meshStandardMaterial color="#334155" flatShading roughness={0.75} />
        </mesh>
        <mesh position={[0, 2.75, 0]}>
          <boxGeometry args={[3.35, 0.58, 0.45]} />
          <meshStandardMaterial color="#334155" flatShading roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[2.1, 0.28, 0.55]} />
          <meshStandardMaterial color="#eab308" flatShading roughness={0.65} />
        </mesh>

        {/* Illuminated Airlock Vestibule Behind the Hatch */}
        <mesh position={[0, 1.5, -1.6]}>
          <boxGeometry args={[2.4, 2.8, 3.0]} />
          <meshStandardMaterial color="#0b1528" side={THREE.BackSide} flatShading roughness={0.9} />
        </mesh>
        <pointLight position={[0, 2.2, -1.5]} color="#f59e0b" intensity={3.2} distance={5.5} />

        {/* Status Beacon Light Bar */}
        <mesh position={[0, 2.66, 0.25]}>
          <boxGeometry args={[0.95, 0.14, 0.08]} />
          <meshBasicMaterial ref={beaconMatRef} color="#f59e0b" />
        </mesh>

        {/* Left & Right Segmented Sliding Airlock Doors */}
        <group ref={leftDoorRef} position={[-0.52, 1.42, 0]}>
          <mesh>
            <boxGeometry args={[1.02, 2.32, 0.18]} />
            <meshStandardMaterial color="#475569" flatShading roughness={0.6} />
          </mesh>
          <mesh position={[0.25, 0.15, 0.1]}>
            <boxGeometry args={[0.32, 0.55, 0.04]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
        </group>

        <group ref={rightDoorRef} position={[0.52, 1.42, 0]}>
          <mesh>
            <boxGeometry args={[1.02, 2.32, 0.18]} />
            <meshStandardMaterial color="#475569" flatShading roughness={0.6} />
          </mesh>
          <mesh position={[-0.25, 0.15, 0.1]}>
            <boxGeometry args={[0.32, 0.55, 0.04]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
        </group>
      </group>

      {/* Entering Astronaut */}
      <group ref={astroGroupRef}>
        <primitive object={astroModel} dispose={null} />
      </group>
    </group>
  );
}

export default function StationInteriorPreview({ replayKey = 0, onPhaseChange }) {
  const camPos = useMemo(() => new THREE.Vector3(0, 1.95, 4.9), []);
  const camTarget = useMemo(() => new THREE.Vector3(0, 1.45, -4.5), []);
  const offset = camPos.clone().sub(camTarget);
  const polar = Math.acos(offset.y / offset.length());
  const azimuth = Math.atan2(offset.x, offset.z);

  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [camPos.x, camPos.y, camPos.z], fov: 54, near: 0.1, far: 160 }}
      fallback={<p>3D preview unavailable: WebGL is required.</p>}
    >
      <color attach="background" args={['#050a16']} />
      <ambientLight intensity={0.68} />
      <hemisphereLight args={['#dbeafe', '#0f172a', 0.55]} />
      <directionalLight position={[2, 4, 3]} intensity={1.35} color="#f8fafc" />

      <LowPolySpace />
      <IssModuleCorridor />

      <Suspense fallback={null}>
        {ASTRO_NORMAL_URL && (
          <AirlockEntrySequence replayKey={replayKey} onPhaseChange={onPhaseChange} />
        )}
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping={false}
        rotateSpeed={0.32}
        target={[camTarget.x, camTarget.y, camTarget.z]}
        minPolarAngle={polar - 0.18}
        maxPolarAngle={polar + 0.14}
        minAzimuthAngle={azimuth - 0.38}
        maxAzimuthAngle={azimuth + 0.38}
      />
    </Canvas>
  );
}
