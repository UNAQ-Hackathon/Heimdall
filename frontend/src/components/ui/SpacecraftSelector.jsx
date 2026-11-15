import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SHIP_CATALOG, getShipUrl } from '../three/SolarSystemScene.jsx';
import { normalizeModel } from '../three/normalize-model.js';

function RotatingShipPreviewModel({ shipFile, scale = 0.86 }) {
  const url = getShipUrl(shipFile);
  const { scene } = useGLTF(url, false, false);
  const model = useMemo(() => normalizeModel(scene), [scene]);
  const isUfo = shipFile.toLowerCase().includes('ovni');
  const isLander = shipFile.toLowerCase().includes('lander');

  const spinRef = useRef(null);
  const launchPitch = isUfo ? 0.16 : isLander ? 0.12 : 0.78;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (spinRef.current) {
      spinRef.current.rotation.y = t * 0.75 + 0.55;
      spinRef.current.position.y = Math.sin(t * 2.0) * 0.035;
    }
  });

  return (
    <group ref={spinRef} scale={scale}>
      <group rotation={[launchPitch, 0, 0]}>
        <primitive object={model} dispose={null} />
      </group>
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
          background: open ? '#13233b' : '#080f1c',
          border: open ? '1px solid #3b82f6' : '1px solid #263449',
          borderRadius: '8px',
          padding: '4px 10px 4px 5px',
          cursor: 'pointer',
          color: '#e2e8f0',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {/* Inline Live 3D Ship Preview Badge */}
        <span
          style={{
            width: '30px',
            height: '22px',
            borderRadius: '5px',
            background: '#0c1422',
            border: '1px solid #263449',
            overflow: 'hidden',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          <Canvas
            camera={{ position: [0, 0.3, 2.95], fov: 35 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 4, 3]} intensity={1.4} />
            <Suspense fallback={null}>
              <RotatingShipPreviewModel shipFile={activeShip.id} scale={0.9} />
            </Suspense>
          </Canvas>
        </span>

        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#94a3b8',
            letterSpacing: '0.04em',
          }}
        >
          CRAFT
        </span>

        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#e2e8f0',
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
            top: 'calc(100% + 8px)',
            left: 0,
            width: '280px',
            borderRadius: '10px',
            background: '#0c1422',
            border: '1px solid #263449',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
            padding: '10px',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Large Centered 3D Spacecraft Preview Stage */}
          <div
            style={{
              borderRadius: '8px',
              background: '#080f1c',
              border: '1px solid #263449',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ height: '132px', width: '100%' }}>
              <Canvas
                camera={{ position: [0, 0.35, 3.15], fov: 35 }}
                gl={{ antialias: true, alpha: true }}
              >
                <ambientLight intensity={0.9} />
                <directionalLight position={[4, 6, 4]} intensity={1.5} />
                <pointLight
                  position={[-2, -1, 2]}
                  intensity={0.6}
                  color="#60a5fa"
                />
                <Suspense fallback={null}>
                  <RotatingShipPreviewModel shipFile={previewShipId} scale={0.86} />
                </Suspense>
              </Canvas>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: '8px',
                padding: '7px 10px',
                borderTop: '1px solid #1c2640',
                background: '#0a1220',
              }}
            >
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#f1f5f9',
                  whiteSpace: 'nowrap',
                }}
              >
                {previewShipMeta?.label}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: '#93c5fd',
                  textAlign: 'right',
                }}
              >
                {previewShipMeta?.role}
              </span>
            </div>
          </div>

          {/* Selectable Craft Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
                    padding: '8px 10px',
                    borderRadius: '7px',
                    border: selected
                      ? '1px solid #3b82f6'
                      : '1px solid #263449',
                    background: selected ? '#13233b' : '#080f1c',
                    color: selected ? '#f1f5f9' : '#cbd5e1',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease, border-color 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: ship.accent ?? '#60a5fa',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: selected ? 600 : 500 }}>
                        {ship.label}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                        {ship.role}
                      </div>
                    </div>
                  </div>
                  {selected && (
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        color: '#93c5fd',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(59, 130, 246, 0.18)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
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
