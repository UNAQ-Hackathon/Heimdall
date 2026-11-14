import { Component, Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useGLTF } from '@react-three/drei';

import PlanetModel from './PlanetModel.jsx';
import { PLANET_MODELS } from './planet-catalog.js';
import { getPlanetUrl } from './planet-assets.js';
import { getEarthZone } from './planet-analysis.js';
import { AnalysisFocus, EarthAnalysisZones } from './PlanetAnalysisScene.jsx';
import LowPolySpace from './LowPolySpace.jsx';

const easeCamera = (value) => value * value * (3 - 2 * value);

class ViewerBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return this.props.renderError?.(this.state.error, this.props.onRetry) ?? (
        <div role="alert">
          <p>The 3D model could not be displayed.</p>
          <button type="button" onClick={this.props.onRetry}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function LoadingSignal({ onChange }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

function Scene({
  planetId, autoRotate, autoRotateSpeed, spaceBackground, reducedMotion,
  enableAnalysis, selection, onRegionSelect, onLoad, onLoadingChange,
}) {
  const selectSurface = (event) => {
    if (!enableAnalysis || !onRegionSelect || event.delta > 5) return;
    event.stopPropagation();
    const point = event.point.toArray();
    onRegionSelect({ planetId, point, zoneId: planetId === 'earth' ? getEarthZone(point).id : null });
  };

  return (
    <>
      {spaceBackground && <LowPolySpace />}
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 3, 5]} intensity={2.5} />
      <directionalLight position={[-4, -1, -3]} intensity={0.6} />
      <Suspense fallback={<LoadingSignal onChange={onLoadingChange} />}>
        <Bounds fit={!selection} observe={!selection} margin={1.05} maxDuration={reducedMotion ? 0.001 : 0.85} interpolateFunc={easeCamera}>
          <group onClick={selectSurface}>
            <PlanetModel planetId={planetId} onLoad={onLoad} />
            {enableAnalysis && planetId === 'earth' && <EarthAnalysisZones selectedZoneId={selection?.zoneId} />}
          </group>
          {enableAnalysis && <AnalysisFocus selection={selection} />}
        </Bounds>
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        enableRotate={!selection}
        enableDamping={!selection && !reducedMotion}
        minDistance={selection ? 1.25 : 1.8}
        maxDistance={12}
        autoRotate={autoRotate && !selection}
        autoRotateSpeed={autoRotateSpeed}
      />
    </>
  );
}

export default function PlanetViewer({
  planetId = 'earth',
  className,
  style,
  autoRotate = false,
  autoRotateSpeed = 0.5,
  spaceBackground = false,
  enableAnalysis = false,
  selection = null,
  onRegionSelect,
  onLoad,
  onError,
  loadingFallback = <span role="status">Loading 3D model…</span>,
  renderError,
}) {
  const reducedMotion = useReducedMotion();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const knownModel = PLANET_MODELS.find(({ id }) => id === planetId);

  const retry = () => {
    if (knownModel) useGLTF.clear(getPlanetUrl(planetId));
    setAttempt((value) => value + 1);
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 240,
        ...(spaceBackground && { background: '#0c1426' }),
        ...style,
      }}
      role="region"
      aria-label={`${knownModel?.label ?? planetId} 3D viewer`}
    >
      <ViewerBoundary key={`${planetId}:${attempt}`} onError={onError} onRetry={retry} renderError={renderError}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.6, 4], fov: 45, near: 0.1, far: 250 }}
          gl={{ antialias: true, alpha: true }}
          fallback={<p role="alert">WebGL is not available in this browser.</p>}
        >
          <Scene
            planetId={planetId}
            autoRotate={autoRotate && !reducedMotion}
            autoRotateSpeed={autoRotateSpeed}
            spaceBackground={spaceBackground}
            reducedMotion={reducedMotion}
            enableAnalysis={enableAnalysis}
            selection={enableAnalysis && selection?.planetId === planetId ? selection : null}
            onRegionSelect={onRegionSelect}
            onLoad={onLoad}
            onLoadingChange={setLoading}
          />
        </Canvas>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            {loadingFallback}
          </div>
        )}
      </ViewerBoundary>
    </div>
  );
}
