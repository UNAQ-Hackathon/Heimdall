import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SHIP_CATALOG, getShipUrl } from '../three/SolarSystemScene.jsx';
import { normalizeModel } from '../three/normalize-model.js';

function RotatingShipPreviewModel({ shipFile }) {
  const url = getShipUrl(shipFile);
  const { scene } = useGLTF(url, false, false);
  const model = useMemo(() => normalizeModel(scene), [scene]);
  const isUfo = shipFile.toLowerCase().includes('ovni');
  const isLander = shipFile.toLowerCase().includes('lander');

  const groupRef = useRef(null);
  const flameRef = useRef(null);

  const coneGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.18, 0.85, 5);
    g.translate(0, 0.85 / 2, 0);
    return g;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.95;
      groupRef.current.rotation.x = 0.22 + Math.sin(t * 1.6) * 0.06;
      groupRef.current.position.y = Math.sin(t * 2.2) * 0.05;
    }
    if (flameRef.current) {
      const pulse = 0.85 + Math.sin(t * 28) * 0.2;
      flameRef.current.scale.set(pulse, pulse * 1.2, pulse);
    }
  });

  return (
    <group ref={groupRef} scale={0.95}>
      <primitive object={model} dispose={null} />
      {isUfo ? (
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.52, 0.07, 6, 12]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} />
        </mesh>
      ) : (
        <group
          ref={flameRef}
          position={isLander ? [0, -0.75, 0] : [0, -0.17, 1.02]}
          rotation={isLander ? [Math.PI, 0, 0] : [Math.PI / 2, 0, 0]}
        >
          <mesh geometry={coneGeo} scale={[0.65, 0.65, 0.65]}>
            <meshBasicMaterial color="#fde047" />
          </mesh>
          <mesh geometry={coneGeo} scale={[0.95, 0.9, 0.95]}>
            <meshBasicMaterial color="#f97316" transparent opacity={0.88} />
          </mesh>
          <mesh geometry={coneGeo} scale={[1.2, 1.15, 1.2]}>
            <meshBasicMaterial color="#ef4444" transparent opacity={0.72} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export default function SpacecraftSelector({ shipFile, onSelect }) {
  const [open, setOpen] = useState(false);
  const [hoveredShip, setHoveredShip] = useState(null);
  const containerRef = useRef(null);

  const activeShip =
    SHIP_CATALOG.find((s) => s.id === shipFile) ?? SHIP_CATALOG[0];
  const previewShipId = hoveredShip ?? activeShip?.id ?? shipFile;
  const previewShipMeta =
    SHIP_CATALOG.find((s) => s.id === previewShipId) ?? activeShip;

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setHoveredShip(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setHoveredShip(null);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!activeShip) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Custom Minimalist Craft Trigger Button with Live 3D Ship Preview Thumbnail */}
      <button
        type="button"
        aria-label="Spacecraft model"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setHoveredShip(null);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: open ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
          border: 'none',
          borderRadius: '9999px',
          padding: '2px 8px 2px 4px',
          cursor: 'pointer',
          color: '#f8fafc',
          transition: 'background 0.15s ease',
        }}
      >
        {/* Inline Live 3D Ship Preview Badge */}
        <span
          style={{
            width: '32px',
            height: '24px',
            borderRadius: '9999px',
            background: 'rgba(5, 8, 17, 0.9)',
            border: `1px solid ${activeShip.accent ?? '#38bdf8'}55`,
            overflow: 'hidden',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          <Canvas
            camera={{ position: [1.6, 0.9, 1.9], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[3, 4, 3]} intensity={1.4} />
            <Suspense fallback={null}>
              <RotatingShipPreviewModel shipFile={activeShip.id} />
            </Suspense>
          </Canvas>
        </span>

        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#64748b',
            letterSpacing: '0.05em',
          }}
        >
          CRAFT
        </span>

        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            color: activeShip.accent ?? '#38bdf8',
          }}
        >
          {activeShip.label}
        </span>

        <span
          style={{
            fontSize: '10px',
            color: '#94a3b8',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown Hangar Popover with Large 3D Preview Stage & Craft List */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            width: '264px',
            borderRadius: '14px',
            background: 'rgba(10, 15, 29, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.65)',
            padding: '10px',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Large 3D Interactive Spacecraft Preview Stage */}
          <div
            style={{
              height: '126px',
              borderRadius: '10px',
              background:
                'radial-gradient(circle at 50% 45%, rgba(30, 58, 138, 0.32), rgba(4, 7, 17, 0.96))',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Canvas
              camera={{ position: [1.7, 0.95, 2.05], fov: 38 }}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={0.85} />
              <directionalLight position={[4, 6, 4]} intensity={1.5} />
              <pointLight
                position={[-2, -1, 2]}
                intensity={0.8}
                color={previewShipMeta?.accent ?? '#38bdf8'}
              />
              <Suspense fallback={null}>
                <RotatingShipPreviewModel shipFile={previewShipId} />
              </Suspense>
            </Canvas>

            <div
              style={{
                position: 'absolute',
                bottom: '7px',
                left: '10px',
                right: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#f8fafc',
                }}
              >
                {previewShipMeta?.label}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: previewShipMeta?.accent ?? '#38bdf8',
                }}
              >
                {previewShipMeta?.role}
              </span>
            </div>
          </div>

          {/* Selectable Craft Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {SHIP_CATALOG.map((ship) => {
              const selected = ship.id === shipFile;
              return (
                <button
                  key={ship.id}
                  type="button"
                  onMouseEnter={() => setHoveredShip(ship.id)}
                  onMouseLeave={() => setHoveredShip(null)}
                  onClick={() => {
                    onSelect(ship.id);
                    setOpen(false);
                    setHoveredShip(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: selected
                      ? `1px solid ${ship.accent ?? '#38bdf8'}66`
                      : '1px solid transparent',
                    background: selected
                      ? `${ship.accent ?? '#38bdf8'}18`
                      : 'rgba(15, 23, 42, 0.45)',
                    color: selected ? '#f8fafc' : '#cbd5e1',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: ship.accent ?? '#38bdf8',
                        boxShadow: selected ? `0 0 8px ${ship.accent}` : 'none',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: selected ? 600 : 500 }}>
                        {ship.label}
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                        {ship.role}
                      </div>
                    </div>
                  </div>
                  {selected && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: ship.accent ?? '#38bdf8',
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
