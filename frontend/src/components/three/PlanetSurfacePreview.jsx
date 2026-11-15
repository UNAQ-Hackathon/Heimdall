import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Color, Object3D, Vector3 } from 'three';

import { createSurfacePreview, ISS_INTERIOR_PHASE_LABELS } from './surface-preview.js';
import LowPolySpace from './LowPolySpace.jsx';
import EnvironmentLandscape from './EnvironmentLandscape.jsx';
import StationInteriorPreview from './StationInteriorPreview.jsx';
import StaticCameraTarget from './StaticCameraTarget.jsx';
import {
  getEnvironmentPerspective,
  sampleEnvironmentHeight,
} from './environment-perspective.js';
import {
  prepareAnimatableAstronaut,
  applyAstronautPose,
} from './astronaut-limb-anim.js';
import { useSound } from '../../context/SoundContext.jsx';
import { useMobileViewport } from '../../utils/use-mobile-viewport.js';

const landerUrlMap = import.meta.glob('../../../../assets3d/nuevasNaves/landerNuevo.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const astroUrlMap = import.meta.glob('../../../../assets3d/trajesEspaciales/astronautaNormal.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const fxUrlMap = import.meta.glob('../../../../assets3d/FX/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const spaceTexUrlMap = import.meta.glob('../../../../assets3d/texturaMapaEspacio/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});

const LANDER_URL = Object.values(landerUrlMap)[0];
const ASTRO_NORMAL_URL = Object.values(astroUrlMap)[0];
const JET_FX_URL = fxUrlMap['../../../../assets3d/FX/humo_aterrizaje_chorro.glb'];
const DUST_SM_URL = fxUrlMap['../../../../assets3d/FX/humo_aterrizaje_polvo_chico.glb'];
const DUST_LG_URL = fxUrlMap['../../../../assets3d/FX/humo_aterrizaje_polvo_grande.glb'];

const BODY_SPACE_TEXTURE = {
  moon: spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex_var1.png'],
  mercury: spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex_var2.png'],
  mars: spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex_var3.png'],
  venus: spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex_var4.png'],
  earth: spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_hex.png'],
  default: spaceTexUrlMap['../../../../assets3d/texturaMapaEspacio/espacio_tileable.png'],
};

function sampleSurfaceGroundY(x, z, planetId, scene) {
  if (scene?.tiles?.length) {
    let bestTile = scene.tiles[0];
    let bestDist = Infinity;
    for (let i = 0; i < scene.tiles.length; i += 1) {
      const t = scene.tiles[i];
      const d = (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z);
      if (d < bestDist) {
        bestDist = d;
        bestTile = t;
      }
    }
    return bestTile.height;
  }
  return sampleEnvironmentHeight(x, z, planetId);
}

function createCubicAtmosphereScene(planetId, scene) {
  if (scene.tiles?.length) return scene;
  const palette = scene.ground ?? ['#64748b', '#94a3b8', '#475569'];
  const tiles = [];
  for (let row = 0; row < 24; row += 1) {
    for (let column = 0; column < 24; column += 1) {
      const x = (column - 11.5) * 2;
      const z = (row - 11.5) * 2;
      const isSun = planetId === 'sun';
      const wave = isSun
        ? Math.sin(x * 0.45 + Math.cos(z * 0.4)) * Math.cos(z * 0.35)
        : Math.sin(z * 0.25 + Math.sin(x * 0.12) * 1.4);
      const height = isSun
        ? 0.9 + Math.max(0, wave) * 0.95 + Math.max(0, -z / 16) * 0.65
        : 0.8 + (wave + 1) * 0.55 + Math.max(0, -z / 14) * 0.55;
      const bandIdx = Math.abs(Math.floor((z * 0.35 + wave * 1.5))) % palette.length;
      const isStorm =
        (planetId === 'jupiter' || planetId === 'neptune') &&
        Math.hypot((x + 4) / 6, (z + 8) / 4) < 1;
      const color = isStorm && scene.accent ? scene.accent : palette[bandIdx];
      tiles.push({ x, z, height, color });
    }
  }
  return { ...scene, tiles, plants: [], rocks: [] };
}

/**
 * Sky Dome Backdrop using the dev's uploaded `texturaMapaEspacio` textures
 */
function SurfaceSkyBackdrop({ planetId, isAirless }) {
  const texUrl = BODY_SPACE_TEXTURE[planetId] || BODY_SPACE_TEXTURE.default;
  if (!texUrl) return null;

  const texture = useTexture(texUrl);
  useMemo(() => {
    if (!texture) return;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(2, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[0, 18, -95]}>
      <planeGeometry args={[260, 140]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={isAirless ? 0.68 : 0.18}
        depthWrite={false}
      />
    </mesh>
  );
}

function Terrain({ scene, clearCenter, emissive = false }) {
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

  const filteredPlants = useMemo(() => {
    if (!clearCenter) return scene.plants;
    return scene.plants.filter(
      ({ x, z }) => Math.hypot(x - clearCenter.x, z - clearCenter.z) > 3.4
    );
  }, [scene.plants, clearCenter]);

  const filteredRocks = useMemo(() => {
    if (!clearCenter) return scene.rocks;
    return scene.rocks.filter(
      ({ x, z }) => Math.hypot(x - clearCenter.x, z - clearCenter.z) > 3.0
    );
  }, [scene.rocks, clearCenter]);

  return (
    <>
      <instancedMesh ref={tiles} args={[undefined, undefined, scene.tiles.length]}>
        <boxGeometry />
        {emissive ? (
          <meshBasicMaterial toneMapped={false} />
        ) : (
          <meshStandardMaterial flatShading roughness={1} />
        )}
      </instancedMesh>
      {filteredPlants.map(({ x, y, z, scale }, index) => (
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
              {scene.plant === 'pine' ? (
                <coneGeometry args={[0.85, 2.1, 5]} />
              ) : (
                <icosahedronGeometry args={[1.1, 0]} />
              )}
              <meshStandardMaterial color={scene.foliage} flatShading roughness={1} />
            </mesh>
          )}
        </group>
      ))}
      {filteredRocks.map(({ x, y, z, scale }, index) => (
        <mesh
          key={index}
          position={[x, y + scale * 0.45, z]}
          scale={[scale * 1.4, scale, scale]}
          rotation={[0, index, 0]}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={scene.rock} flatShading roughness={1} />
        </mesh>
      ))}
      {scene.clouds &&
        [-12, 0, 12].map((x) => (
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

/**
 * 3D Planetary Landing Sequence + Astronaut Exit & Friendly Wave Animation
 */
function PlanetaryLandingSequence({ planetId, zoneId, scene, view, replayKey, sfx }) {
  if (!LANDER_URL || !ASTRO_NORMAL_URL) return null;

  const { scene: landerScene } = useGLTF(LANDER_URL, false, false);
  const { scene: astroScene } = useGLTF(ASTRO_NORMAL_URL, false, false);
  const { scene: jetScene } = useGLTF(JET_FX_URL, false, false);
  const { scene: dustSmScene } = useGLTF(DUST_SM_URL, false, false);
  const { scene: dustLgScene } = useGLTF(DUST_LG_URL, false, false);

  const landerModel = useMemo(() => landerScene.clone(true), [landerScene]);
  const jetModel = useMemo(() => jetScene.clone(true), [jetScene]);
  const dustSmModel = useMemo(() => dustSmScene.clone(true), [dustSmScene]);
  const dustLgModel = useMemo(() => dustLgScene.clone(true), [dustLgScene]);
  const { root: astroModel, parts: astroParts } = useMemo(
    () => prepareAnimatableAstronaut(astroScene),
    [astroScene]
  );

  // Pin cone wide base at y=0 so rotating by [Math.PI, 0, 0] extends strictly downward (-Y) from nozzle
  const yellowNozzleGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.15, 0.55, 5);
    g.translate(0, 0.55 / 2, 0);
    return g;
  }, []);
  const orangeNozzleGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.22, 0.82, 5);
    g.translate(0, 0.82 / 2, 0);
    return g;
  }, []);
  const redNozzleGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.3, 1.08, 6);
    g.translate(0, 1.08 / 2, 0);
    return g;
  }, []);

  const landerGroupRef = useRef(null);
  const thrusterGroupRef = useRef(null);
  const yellowConeRef = useRef(null);
  const orangeConeRef = useRef(null);
  const redConeRef = useRef(null);
  const dustRingSmRef = useRef(null);
  const dustRingLgRef = useRef(null);
  const smokePuffsRef = useRef(null);
  const astroGroupRef = useRef(null);
  const startTimeRef = useRef(null);
  const soundStageRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = null;
    soundStageRef.current = 0;
  }, [planetId, zoneId, replayKey]);

  const placement = useMemo(() => {
    const camPos = new Vector3(...view.position);
    const camTarget = new Vector3(...view.target);
    const forward = camTarget.clone().sub(camPos);
    forward.y = 0;
    if (forward.lengthSq() > 1e-6) forward.normalize();
    else forward.set(0, 0, -1);
    const right = new Vector3(-forward.z, 0, forward.x).normalize();

    // Place lander slightly left in the mid-foreground, and astronaut stepping out in front & right
    const landerX = camPos.x + forward.x * 7.6 - right.x * 0.9;
    const landerZ = camPos.z + forward.z * 7.6 - right.z * 0.9;
    const landerY = sampleSurfaceGroundY(landerX, landerZ, planetId, scene);

    const astroEndX = camPos.x + forward.x * 5.2 + right.x * 0.65;
    const astroEndZ = camPos.z + forward.z * 5.2 + right.z * 0.65;
    const astroEndY = sampleSurfaceGroundY(astroEndX, astroEndZ, planetId, scene);

    const faceCamYaw = Math.atan2(camPos.x - astroEndX, camPos.z - astroEndZ);
    const walkYaw = Math.atan2(astroEndX - landerX, astroEndZ - landerZ);

    return {
      landerPos: new Vector3(landerX, landerY, landerZ),
      astroStartPos: new Vector3(
        landerX + (astroEndX - landerX) * 0.32,
        landerY,
        landerZ + (astroEndZ - landerZ) * 0.32
      ),
      astroEndPos: new Vector3(astroEndX, astroEndY, astroEndZ),
      faceCamYaw,
      walkYaw,
    };
  }, [view, planetId, scene]);

  const smokeSeeds = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        angle: (i / 16) * Math.PI * 2,
        speed: 0.9 + (i % 5) * 0.22,
        phase: (i % 7) * 0.14,
        color: i % 3 === 0 ? '#f1f5f9' : i % 3 === 1 ? '#cbd5e1' : '#94a3b8',
      })),
    []
  );

  useFrame((state) => {
    const now = state.clock.getElapsedTime();
    if (startTimeRef.current === null) {
      startTimeRef.current = now;
    }
    const elapsed = now - startTimeRef.current;

    const descentDuration = 2.6;
    const walkStart = 2.75;
    const walkDuration = 1.25;

    // Landing audio cues: retro-rocket burn, touchdown dust thump, hatch servo
    if (sfx) {
      if (soundStageRef.current === 0) {
        sfx.play('retro-burn');
        soundStageRef.current = 1;
      }
      if (elapsed >= descentDuration && soundStageRef.current === 1) {
        sfx.play('touchdown');
        soundStageRef.current = 2;
      }
      if (elapsed >= walkStart && soundStageRef.current === 2) {
        sfx.play('suit-servo');
        soundStageRef.current = 3;
      }
    }

    // 1. Lander Descent & Soft Touchdown Settle
    const p = Math.min(1, elapsed / descentDuration);
    const settleElapsed = Math.max(0, elapsed - descentDuration);
    const settleDip =
      elapsed >= descentDuration && settleElapsed < 0.45
        ? Math.sin((settleElapsed / 0.45) * Math.PI) * Math.exp(-settleElapsed * 6) * -0.09
        : 0;
    const heightOffset = (p < 1 ? Math.pow(1 - p, 2.35) * 7.0 : 0) + settleDip;

    if (landerGroupRef.current) {
      landerGroupRef.current.position.set(
        placement.landerPos.x + (p < 1 ? Math.sin(elapsed * 4.5) * 0.14 * (1 - p) : 0),
        placement.landerPos.y + heightOffset,
        placement.landerPos.z
      );
      const tilt = p < 1 ? (1 - p) * 0.1 : 0;
      landerGroupRef.current.rotation.set(
        Math.sin(elapsed * 5.2) * tilt,
        placement.faceCamYaw + 0.35,
        Math.cos(elapsed * 4.8) * tilt
      );
    }

    // Retro-thruster Red/Orange/Yellow Fire under lander
    const engineActive = elapsed < descentDuration + 0.18;
    if (thrusterGroupRef.current) {
      thrusterGroupRef.current.visible = engineActive;
      if (engineActive) {
        const throttle =
          elapsed < descentDuration
            ? 0.85 + 0.35 * Math.sin(p * Math.PI)
            : Math.max(0, 1 - (elapsed - descentDuration) / 0.18);
        const fYel = (0.85 + Math.sin(elapsed * 38) * 0.22) * throttle;
        const fOrg = (0.92 + Math.cos(elapsed * 31) * 0.25) * throttle;
        const fRed = (0.98 + Math.sin(elapsed * 24 + 1) * 0.28) * throttle;

        if (yellowConeRef.current) {
          yellowConeRef.current.scale.set(fYel, fYel * 1.25, fYel);
        }
        if (orangeConeRef.current) {
          orangeConeRef.current.scale.set(fOrg, fOrg * 1.35, fOrg);
        }
        if (redConeRef.current) {
          redConeRef.current.scale.set(fRed, fRed * 1.45, fRed);
        }
      }
    }

    // Ground Dust Rings + Rising Smoke
    const dustWindow = elapsed > 0.5 && elapsed < 4.3;
    if (dustRingSmRef.current && dustRingLgRef.current) {
      dustRingSmRef.current.visible = dustWindow;
      dustRingLgRef.current.visible = dustWindow;
      if (dustWindow) {
        const groundProximity = Math.max(0, 1 - heightOffset / 5.5);
        const fadeOut =
          elapsed <= descentDuration
            ? 1
            : Math.max(0, 1 - (elapsed - descentDuration) / 1.6);
        const smScale = (0.6 + groundProximity * 1.35) * fadeOut;
        const lgScale = (0.5 + groundProximity * 1.65) * fadeOut;
        dustRingSmRef.current.scale.set(smScale, smScale * 0.9, smScale);
        dustRingSmRef.current.rotation.y = elapsed * 1.4;
        dustRingLgRef.current.scale.set(lgScale, lgScale * 0.85, lgScale);
        dustRingLgRef.current.rotation.y = -elapsed * 0.9;
      }
    }

    if (smokePuffsRef.current) {
      smokePuffsRef.current.visible = dustWindow;
      if (dustWindow) {
        const groundProximity = Math.max(0, 1 - heightOffset / 5.8);
        const fadeOut =
          elapsed <= descentDuration
            ? 1
            : Math.max(0, 1 - (elapsed - descentDuration) / 1.6);
        const children = smokePuffsRef.current.children;
        for (let i = 0; i < children.length; i += 1) {
          const puff = children[i];
          const s = smokeSeeds[i];
          const cycle = (elapsed * s.speed + s.phase) % 1;
          const radius = (0.45 + cycle * 2.4) * groundProximity;
          const py = cycle * 1.15 * groundProximity;
          puff.position.set(
            Math.cos(s.angle + elapsed * 0.4) * radius,
            0.12 + py,
            Math.sin(s.angle + elapsed * 0.4) * radius
          );
          const pScale =
            Math.sin(cycle * Math.PI) * 0.34 * groundProximity * fadeOut;
          puff.scale.setScalar(Math.max(0.001, pScale));
          puff.rotation.set(elapsed * 2 + i, elapsed * 1.5, i);
        }
      }
    }

    // 2. Astronaut Exit, Walk Forward & Glitch-Free Rigid Arm-Wave Animation
    if (astroGroupRef.current) {
      if (elapsed < walkStart) {
        astroGroupRef.current.visible = false;
      } else {
        astroGroupRef.current.visible = true;
        const walkProgress = Math.min(1, (elapsed - walkStart) / walkDuration);
        const isWalking = walkProgress < 1;

        const smoothW =
          walkProgress < 0.5
            ? 2 * walkProgress * walkProgress
            : 1 - Math.pow(-2 * walkProgress + 2, 2) / 2;

        const curX = THREE.MathUtils.lerp(
          placement.astroStartPos.x,
          placement.astroEndPos.x,
          smoothW
        );
        const curZ = THREE.MathUtils.lerp(
          placement.astroStartPos.z,
          placement.astroEndPos.z,
          smoothW
        );
        const curGroundY = sampleSurfaceGroundY(curX, curZ, planetId, scene);

        const hopY = isWalking
          ? Math.abs(Math.sin(walkProgress * Math.PI * 4)) * 0.2
          : Math.abs(Math.sin((elapsed - walkStart - walkDuration) * 3.0)) * 0.05;

        const emergeRaw = Math.min(1, Math.max(0, (elapsed - walkStart) / 0.34));
        const emergeScale = emergeRaw * emergeRaw * (3 - 2 * emergeRaw) * 1.28;
        astroGroupRef.current.scale.setScalar(emergeScale);
        astroGroupRef.current.position.set(curX, curGroundY + hopY, curZ);

        const targetYaw = isWalking
          ? THREE.MathUtils.lerp(placement.walkYaw, placement.faceCamYaw, smoothW)
          : placement.faceCamYaw;
        const walkBlend = 1 - THREE.MathUtils.smoothstep(walkProgress, 0.78, 1.0);
        const bodySway = THREE.MathUtils.lerp(
          Math.sin(elapsed * 3.5) * 0.035,
          Math.sin(elapsed * 12) * 0.05,
          walkBlend
        );

        astroGroupRef.current.rotation.set(0, targetYaw, bodySway);

        const waveTime = Math.max(0, elapsed - (walkStart + walkDuration));
        const waveRaiseRaw = isWalking ? 0 : Math.min(1, waveTime / 0.42);
        const waveRaise = waveRaiseRaw * waveRaiseRaw * (3 - 2 * waveRaiseRaw);
        const waveOsc = Math.sin(waveTime * 7.5) * 0.38;
        const walkSwing = Math.sin(elapsed * 14) * 0.48 * walkBlend;

        applyAstronautPose(astroParts, { walkSwing, waveRaise, waveOsc });
      }
    }
  });

  return (
    <group>
      {/* 1. Descending / Landed Planetary Lander (`landerNuevo.glb`) */}
      <group ref={landerGroupRef} scale={1.15}>
        <primitive object={landerModel} dispose={null} />

        {/* Multi-Layered Red / Orange / Yellow Retro-Rocket Exhaust pinned to bottom nozzle (y=0.12) */}
        <group ref={thrusterGroupRef} position={[0, 0.12, 0]}>
          <group position={[0, -0.08, 0]} scale={[1.4, 1.6, 1.4]}>
            <primitive object={jetModel} dispose={null} />
          </group>
          <mesh ref={yellowConeRef} geometry={yellowNozzleGeo} rotation={[Math.PI, 0, 0]}>
            <meshBasicMaterial color="#fde047" />
          </mesh>
          <mesh ref={orangeConeRef} geometry={orangeNozzleGeo} rotation={[Math.PI, 0, 0]}>
            <meshBasicMaterial color="#f97316" transparent opacity={0.9} />
          </mesh>
          <mesh ref={redConeRef} geometry={redNozzleGeo} rotation={[Math.PI, 0, 0]}>
            <meshBasicMaterial color="#ef4444" transparent opacity={0.78} />
          </mesh>
          <pointLight color="#f97316" intensity={8} distance={7} position={[0, -0.45, 0]} />
        </group>
      </group>

      {/* 2. Ground Landing Dust Rings + Smoke Plumes */}
      <group position={[placement.landerPos.x, placement.landerPos.y, placement.landerPos.z]}>
        <group ref={dustRingSmRef}>
          <primitive object={dustSmModel} dispose={null} />
        </group>
        <group ref={dustRingLgRef}>
          <primitive object={dustLgModel} dispose={null} />
        </group>
        <group ref={smokePuffsRef}>
          {smokeSeeds.map((s, idx) => (
            <mesh key={idx}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={s.color}
                flatShading
                roughness={0.95}
                transparent
                opacity={0.78}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* 3. 3D Astronaut (`astronautaNormal.glb`) Exiting Lander & Waving to User */}
      <group ref={astroGroupRef} visible={false}>
        <primitive object={astroModel} dispose={null} />
      </group>
    </group>
  );
}

export function IssInteriorPreviewStage({ showCaption = false }) {
  const sfx = useSound();
  const isMobile = useMobileViewport();
  const [replayKey, setReplayKey] = useState(0);
  const [issPhase, setIssPhase] = useState('pressurize');
  const handlePhase = useCallback(
    (phase) => {
      setIssPhase(phase);
      sfx?.play(
        phase === 'ingress'
          ? 'airlock-door'
          : phase === 'sealed'
            ? 'airlock-seal'
            : 'airlock-pressurize'
      );
    },
    [sfx]
  );
  const phaseLabel =
    ISS_INTERIOR_PHASE_LABELS[issPhase] ?? ISS_INTERIOR_PHASE_LABELS.pressurize;
  const phaseColor =
    issPhase === 'sealed'
      ? '#34d399'
      : issPhase === 'ingress'
        ? '#38bdf8'
        : '#fbbf24';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        touchAction: isMobile ? 'pan-y' : undefined,
      }}
    >
      <StationInteriorPreview replayKey={replayKey} onPhaseChange={handlePhase} />

      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          zIndex: 10,
          padding: '4px 9px',
          borderRadius: '6px',
          fontSize: '9.5px',
          fontFamily: 'var(--font-mono)',
          background: 'rgba(10, 15, 29, 0.85)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: phaseColor,
          backdropFilter: 'blur(8px)',
        }}
      >
        ● {phaseLabel}
      </div>

      {showCaption && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            zIndex: 10,
            padding: '4px 9px',
            borderRadius: '6px',
            fontSize: '9.5px',
            fontFamily: 'var(--font-mono)',
            background: 'rgba(10, 15, 29, 0.82)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            color: '#94a3b8',
            backdropFilter: 'blur(8px)',
          }}
        >
          Drag to look around · CIR / MSG / Cupola
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setIssPhase('pressurize');
          setReplayKey((k) => k + 1);
        }}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10,
          padding: '4px 9px',
          borderRadius: '6px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          background: 'rgba(10, 15, 29, 0.82)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          color: '#e2e8f0',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        ↻ Replay Airlock Entry
      </button>
    </div>
  );
}

function PlanetarySurfacePreviewStage({ zoneId, planetId }) {
  const sfx = useSound();
  const isMobile = useMobileViewport();
  const [replayKey, setReplayKey] = useState(0);

  const rawScene = useMemo(() => createSurfacePreview(zoneId, planetId), [planetId, zoneId]);
  const scene = useMemo(
    () => createCubicAtmosphereScene(planetId, rawScene),
    [planetId, rawScene]
  );
  const view = useMemo(
    () => ({
      ...getEnvironmentPerspective(planetId),
      position: [0, 3.2, 8],
      target: [0, 2, -10],
      fov: 52,
    }),
    [planetId]
  );
  const offset = new Vector3(...view.position).sub(new Vector3(...view.target));
  const polar = Math.acos(offset.y / offset.length());
  const azimuth = Math.atan2(offset.x, offset.z);
  const rocky = planetId !== 'earth' && scene.kind === 'surface';
  const hasSolidSurface = planetId === 'earth' || scene.kind === 'surface';

  const landingZoneCenter = useMemo(() => {
    if (!hasSolidSurface) return null;
    const camPos = new Vector3(...view.position);
    const camTarget = new Vector3(...view.target);
    const forward = camTarget.clone().sub(camPos);
    forward.y = 0;
    if (forward.lengthSq() > 1e-6) forward.normalize();
    return {
      x: camPos.x + forward.x * 6.8,
      z: camPos.z + forward.z * 6.8,
    };
  }, [hasSolidSurface, view]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        touchAction: isMobile ? 'pan-y' : undefined,
      }}
    >
      <Canvas
        frameloop={hasSolidSurface ? 'always' : 'demand'}
        shadows={rocky}
        dpr={[1, 1.5]}
        camera={{ position: view.position, fov: view.fov, near: view.near, far: view.far }}
        style={isMobile ? { pointerEvents: 'none', touchAction: 'pan-y' } : undefined}
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

        <Suspense fallback={null}>
          <SurfaceSkyBackdrop planetId={planetId} isAirless={Boolean(scene.craters)} />
          {hasSolidSurface && (
            <PlanetaryLandingSequence
              planetId={planetId}
              zoneId={zoneId}
              scene={scene}
              view={view}
              replayKey={replayKey}
              sfx={sfx}
            />
          )}
        </Suspense>

        <Terrain
          scene={scene}
          clearCenter={landingZoneCenter}
          emissive={scene.kind === 'plasma'}
        />
        {planetId === 'saturn' && (
          <group position={[0, -36, 12]} rotation={[-Math.PI / 2 + 0.54, 0, -0.22]}>
            {[
              { inner: 96, outer: 103, color: '#a8926a', opacity: 0.28 },
              { inner: 104, outer: 111, color: '#e6d3a7', opacity: 0.58 },
              { inner: 111.6, outer: 117.5, color: '#d4bd8d', opacity: 0.52 },
              // Cassini Division gap between 117.5 and 120.5
              { inner: 120.5, outer: 126.5, color: '#cbb589', opacity: 0.42 },
              { inner: 127.2, outer: 129.5, color: '#b49e74', opacity: 0.26 },
            ].map((band, idx) => (
              <mesh key={idx}>
                <ringGeometry args={[band.inner, band.outer, 128]} />
                <meshBasicMaterial
                  color={band.color}
                  transparent
                  opacity={band.opacity}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            ))}
          </group>
        )}

        {isMobile ? (
          <StaticCameraTarget position={view.position} target={view.target} />
        ) : (
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
        )}
      </Canvas>

      {hasSolidSurface && (
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            padding: '4px 9px',
            borderRadius: '6px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            background: 'rgba(10, 15, 29, 0.82)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#e2e8f0',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          ↻ Replay Landing
        </button>
      )}
    </div>
  );
}

export default function PlanetSurfacePreview({ zoneId, planetId = 'earth' }) {
  if (planetId === 'iss') {
    return <IssInteriorPreviewStage />;
  }
  return <PlanetarySurfacePreviewStage zoneId={zoneId} planetId={planetId} />;
}
