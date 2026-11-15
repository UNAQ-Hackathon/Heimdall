import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import F1TelemetryDeck from '../components/charts/F1TelemetryDeck.jsx';
import { api } from '../services/api.js';
import { INVESTIGATIONS } from '../services/mockData.js';
import {
  CATALOG_CATEGORIES,
  CATALOG_FUEL_TYPES,
  CATALOG_HARDWARE_FILTERS,
} from '../services/psi-catalog.js';
import {
  FLEX_FUEL_FILTERS,
  FLEX_MIX_FILTERS,
  OXYGEN_REGIME_FILTERS,
  TELEMETRY_CHANNELS,
  buildStudyEnvelopeSeries,
  computeTelemetryKPIs,
  deriveTelemetryTheme,
  filterTelemetryRuns,
  filterTelemetryStudies,
  getAllFlexRuns,
  isDropletTelemetryStudy,
  normalizeMongoExperiments,
} from '../services/telemetry-f1.js';
import '../styles/telemetry-f1.css';

function findInitialStudy(id, list = INVESTIGATIONS) {
  if (!id) return list[0] ?? null;
  const lower = String(id).toLowerCase();
  const normalized = lower
    .replace(/^psi-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return (
    list.find(
      (item) =>
        item.id === lower ||
        item.id === normalized ||
        String(item.slug ?? '').toLowerCase() === lower ||
        String(item.psiId ?? '').toLowerCase() === lower ||
        String(item.acronym ?? '').toLowerCase() === lower ||
        String(item.name ?? '').toLowerCase() === lower
    ) ?? null
  );
}

function formatDelta(val, unit) {
  if (val == null) return 'N/A vs 1g';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val}${unit} vs 1g`;
}

function RpmBar({ ratio, total = 12 }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const lit = Math.round(clamped * total);
  return (
    <div className="f1-rpm-bar" aria-hidden="true">
      {Array.from({ length: total }, (_, idx) => (
        <span
          key={idx}
          className={`f1-rpm-seg${idx < lit ? ' f1-rpm-seg--on' : ''}`}
        />
      ))}
    </div>
  );
}

export default function StudyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [allStudies, setAllStudies] = useState(INVESTIGATIONS);
  const [study, setStudy] = useState(() => findInitialStudy(id, INVESTIGATIONS));
  const [mongoExperiments, setMongoExperiments] = useState([]);
  const [mongoMeasurements, setMongoMeasurements] = useState([]);
  const [telemetrySource, setTelemetrySource] = useState('verified-psi');
  const [loadError, setLoadError] = useState('');

  // Study-level filters
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [fuelType, setFuelType] = useState('all');
  const [hardware, setHardware] = useState('all');
  const [oxygenRegime, setOxygenRegime] = useState('all');

  // Run-level F1 telemetry filters
  const [showFlexStream, setShowFlexStream] = useState(() =>
    isDropletTelemetryStudy(findInitialStudy(id, INVESTIGATIONS))
  );
  const [runFuel, setRunFuel] = useState('all');
  const [runMix, setRunMix] = useState('all');
  const [runO2Band, setRunO2Band] = useState('all');
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [baselineOverlay, setBaselineOverlay] = useState(true);
  const [channels, setChannels] = useState({
    o2: true,
    pressure: true,
    secondary: true,
    diluent: true,
  });

  // Load full catalog once so filters & tabs always reflect live API/MongoDB + local fallback
  useEffect(() => {
    let cancelled = false;
    api.listInvestigations().then((res) => {
      if (!cancelled && Array.isArray(res?.items) && res.items.length > 0) {
        setAllStudies(res.items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync active study & fetch study telemetry (MongoDB experiments/measurements + PSI metadata)
  useEffect(() => {
    let cancelled = false;
    setLoadError('');

    const targetId = id || allStudies[0]?.id || 'bass';
    const localMatch = findInitialStudy(targetId, allStudies);
    if (localMatch) setStudy(localMatch);

    api
      .getStudyTelemetry(targetId)
      .then((payload) => {
        if (cancelled) return;
        if (payload?.investigation) {
          setStudy(payload.investigation);
          if (isDropletTelemetryStudy(payload.investigation)) {
            setShowFlexStream(true);
          }
        }
        setMongoExperiments(
          Array.isArray(payload?.experiments)
            ? normalizeMongoExperiments(payload.experiments)
            : []
        );
        setMongoMeasurements(
          Array.isArray(payload?.measurements) ? payload.measurements : []
        );
        setTelemetrySource(payload?.source ?? 'verified-psi');
      })
      .catch((err) => {
        if (!cancelled) {
          if (localMatch) {
            setStudy(localMatch);
          } else if (!id && allStudies[0]) {
            setStudy(allStudies[0]);
          } else {
            setLoadError(err.message);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, allStudies]);

  const filteredStudies = useMemo(
    () =>
      filterTelemetryStudies(allStudies, {
        query,
        category,
        fuelType,
        hardware,
        oxygenRegime,
      }),
    [allStudies, query, category, fuelType, hardware, oxygenRegime]
  );

  // If filters exclude the currently inspected study, pick the first matching study automatically
  const activeStudy = useMemo(() => {
    if (!filteredStudies.length) return study;
    if (study && filteredStudies.some((s) => s.id === study.id)) return study;
    return filteredStudies[0];
  }, [filteredStudies, study]);

  const allFlexRuns = useMemo(() => getAllFlexRuns(), []);
  const dropletStudy = isDropletTelemetryStudy(activeStudy);
  const runStreamEnabled =
    mongoExperiments.length > 0 || dropletStudy || showFlexStream;

  const baseRuns = useMemo(() => {
    if (mongoExperiments.length > 0) return mongoExperiments;
    if (runStreamEnabled) return allFlexRuns;
    return [];
  }, [mongoExperiments, runStreamEnabled, allFlexRuns]);

  const o2Bounds = useMemo(() => {
    if (runO2Band === 'hypoxic') return { o2Min: 0, o2Max: 18 };
    if (runO2Band === 'nominal') return { o2Min: 18.1, o2Max: 22.9 };
    if (runO2Band === 'enriched') return { o2Min: 23, o2Max: 100 };
    return { o2Min: 0, o2Max: 100 };
  }, [runO2Band]);

  const filteredRuns = useMemo(
    () =>
      filterTelemetryRuns(baseRuns, {
        fuel: runFuel,
        mix: runMix,
        ...o2Bounds,
        query,
      }),
    [baseRuns, runFuel, runMix, o2Bounds, query]
  );

  const activeRun = useMemo(() => {
    if (!filteredRuns.length) return null;
    if (selectedRunId) {
      const match = filteredRuns.find((r) => r.runId === selectedRunId);
      if (match) return match;
    }
    return null;
  }, [filteredRuns, selectedRunId]);

  // Pit-wall playback stepper through filtered runs
  useEffect(() => {
    if (!playing || !filteredRuns.length) return undefined;
    const timer = window.setInterval(() => {
      setSelectedRunId((prev) => {
        const idx = filteredRuns.findIndex((r) => r.runId === prev);
        const nextIdx = idx < 0 || idx + 1 >= filteredRuns.length ? 0 : idx + 1;
        return filteredRuns[nextIdx].runId;
      });
    }, 950);
    return () => window.clearInterval(timer);
  }, [playing, filteredRuns]);

  const theme = useMemo(
    () =>
      deriveTelemetryTheme({
        study: activeStudy,
        activeRun,
        filteredRuns,
        filteredStudies,
      }),
    [activeStudy, activeRun, filteredRuns, filteredStudies]
  );

  const envelopeSeries = useMemo(
    () => buildStudyEnvelopeSeries(filteredStudies, activeStudy?.id),
    [filteredStudies, activeStudy?.id]
  );

  const kpis = useMemo(
    () =>
      computeTelemetryKPIs({
        study: activeStudy,
        runs: filteredRuns,
        activeRun,
      }),
    [activeStudy, filteredRuns, activeRun]
  );

  const hasStudyFilters = Boolean(
    query.trim() ||
      category !== 'all' ||
      fuelType !== 'all' ||
      hardware !== 'all' ||
      oxygenRegime !== 'all'
  );

  const hasRunFilters = Boolean(
    runFuel !== 'all' || runMix !== 'all' || runO2Band !== 'all' || selectedRunId
  );

  const resetAllFilters = () => {
    setQuery('');
    setCategory('all');
    setFuelType('all');
    setHardware('all');
    setOxygenRegime('all');
    setRunFuel('all');
    setRunMix('all');
    setRunO2Band('all');
    setSelectedRunId(null);
    setPlaying(false);
  };

  const selectStudy = (nextId) => {
    if (!nextId) return;
    setSelectedRunId(null);
    setPlaying(false);
    const nextPath = `/study/${encodeURIComponent(nextId)}`;
    navigate(nextPath);
  };

  const toggleChannel = (chId) => {
    setChannels((prev) => ({ ...prev, [chId]: !prev[chId] }));
  };

  if (loadError && !activeStudy) {
    return (
      <div className="f1-telemetry" style={theme.cssVars}>
        <div className="f1-panel f1-panel--accent">
          <div className="f1-panel__title">TELEMETRY RECOVERY // STUDY NOT FOUND</div>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px' }}>
            Unable to resolve study identifier <code>{id}</code> ({loadError}). Select any verified NASA PSI investigation below.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="f1-btn f1-btn--primary" onClick={() => navigate('/study/bass')}>
              Load BASS Telemetry →
            </button>
            <button type="button" className="f1-btn" onClick={() => navigate('/studies')}>
              ← Back to PSI Catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeStudy) {
    return (
      <div className="f1-telemetry" style={theme.cssVars}>
        <div className="f1-panel">Loading F1 Pit-Wall Telemetry…</div>
      </div>
    );
  }

  const o2PctDisplay = kpis.o2Value != null ? `${kpis.o2Value}%` : 'N/A';
  const o2RangeText =
    kpis.o2Min != null && kpis.o2Max != null && kpis.o2Min !== kpis.o2Max
      ? `${kpis.o2Min}% – ${kpis.o2Max}% envelope`
      : formatDelta(kpis.o2DeltaEarth, '%');

  const n2Seg = Math.max(0, kpis.n2Pct ?? 0);
  const o2Seg = Math.max(0, kpis.o2Value ?? 0);
  const co2Seg = Math.max(0, kpis.co2Pct ?? 0);
  const heSeg = Math.max(0, kpis.hePct ?? 0);
  const gasSum = o2Seg + n2Seg + co2Seg + heSeg || 100;

  return (
    <div className="f1-telemetry" style={theme.cssVars}>
      {/* ── F1 Pit-Wall Header ── */}
      <header className="f1-header">
        <div style={{ minWidth: 0 }}>
          <div className="f1-eyebrow">
            <span className="f1-live-dot" aria-hidden="true" />
            <span>
              F1 PIT-WALL TELEMETRY // {activeStudy.psiId ?? activeStudy.archiveCode} //{' '}
              {telemetrySource === 'mongodb'
                ? 'MONGODB LIVE'
                : runStreamEnabled
                  ? `NASA PSI (${filteredRuns.length} RUNS)`
                  : 'VERIFIED PSI ARCHIVE'}
            </span>
          </div>
          <h1 className="f1-title">
            {activeStudy.acronym ?? activeStudy.name}: {activeStudy.title ?? activeStudy.subtitle}
          </h1>
          <p className="f1-subtitle">
            {activeStudy.hardware} · {String(activeStudy.category ?? 'combustion').toUpperCase()} ·{' '}
            {String(activeStudy.fuelType ?? 'mixed').toUpperCase()} FUEL
            {activeRun ? ` · LOCKED RUN ${activeRun.runId} (${activeRun.date})` : ''}
          </p>
        </div>

        <div className="f1-header__actions">
          <div
            className="f1-livery-chip"
            title={`Interface palette adapts automatically to fetched telemetry: ${theme.liveryReason}`}
          >
            <span className="f1-livery-swatch" aria-hidden="true" />
            <span>{theme.liveryName}</span>
          </div>

          <button type="button" className="f1-btn" onClick={() => navigate('/studies')}>
            ← PSI Catalog
          </button>

          <select
            aria-label="Select PSI Investigation"
            className="tri-select"
            value={activeStudy.id}
            onChange={(event) => selectStudy(event.target.value)}
            style={{ fontSize: '11.5px', padding: '7px 28px 7px 10px' }}
          >
            {allStudies.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.acronym} — {inv.title}
              </option>
            ))}
          </select>

          <a
            href={activeStudy.sourceUrl ?? 'https://psi.nasa.gov/'}
            target="_blank"
            rel="noreferrer"
            className="f1-btn f1-btn--primary"
          >
            NASA PSI ↗
          </a>
        </div>
      </header>

      {/* ── Multi-Dimensional Telemetry Filter Bar ── */}
      <section className="f1-filters" aria-label="Telemetry Filters">
        <div className="f1-filters__top">
          <input
            type="search"
            className="f1-search"
            aria-label="Search telemetry studies, sensors, fuels, or run IDs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by study (Saffire, FLEX, CFI-G, E-FIELD), sensor (radiometer, thermocouple), fuel, or run ID…"
          />

          <button
            type="button"
            className={`f1-btn${runStreamEnabled ? ' f1-btn--primary' : ''}`}
            aria-pressed={runStreamEnabled}
            onClick={() => setShowFlexStream((prev) => !prev)}
          >
            {runStreamEnabled ? '✓ FLEX 258-Run Telemetry' : '+ Overlay FLEX 258 Runs'}
          </button>

          <button
            type="button"
            className={`f1-btn${baselineOverlay ? ' f1-btn--primary' : ''}`}
            aria-pressed={baselineOverlay}
            onClick={() => setBaselineOverlay((prev) => !prev)}
          >
            {baselineOverlay ? '✓ 1g Baseline (21% O₂)' : '1g Baseline'}
          </button>

          {(hasStudyFilters || hasRunFilters) && (
            <button type="button" className="f1-btn" onClick={resetAllFilters}>
              Reset All
            </button>
          )}
        </div>

        <div className="f1-filter-row">
          <span className="f1-filter-label">PILLAR</span>
          <div className="f1-pill-group">
            {CATALOG_CATEGORIES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="f1-pill"
                aria-pressed={category === opt.id}
                onClick={() => setCategory(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="f1-filter-row">
          <span className="f1-filter-label">FUEL STATE</span>
          <div className="f1-pill-group">
            {CATALOG_FUEL_TYPES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="f1-pill"
                aria-pressed={fuelType === opt.id}
                onClick={() => setFuelType(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="f1-filter-row">
          <span className="f1-filter-label">HARDWARE</span>
          <div className="f1-pill-group">
            {CATALOG_HARDWARE_FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="f1-pill"
                aria-pressed={hardware === opt.id}
                onClick={() => setHardware(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="f1-filter-row">
          <span className="f1-filter-label">O₂ REGIME</span>
          <div className="f1-pill-group">
            {OXYGEN_REGIME_FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="f1-pill"
                aria-pressed={oxygenRegime === opt.id}
                onClick={() => setOxygenRegime(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {runStreamEnabled && (
          <div
            style={{
              borderTop: '1px solid #182238',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div className="f1-filter-row">
              <span className="f1-filter-label">RUN FUEL</span>
              <div className="f1-pill-group">
                {FLEX_FUEL_FILTERS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="f1-pill"
                    aria-pressed={runFuel === opt.id}
                    onClick={() => {
                      setRunFuel(opt.id);
                      setSelectedRunId(null);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="f1-filter-label" style={{ marginLeft: '8px' }}>GAS MIX</span>
              <div className="f1-pill-group">
                {FLEX_MIX_FILTERS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="f1-pill"
                    aria-pressed={runMix === opt.id}
                    onClick={() => {
                      setRunMix(opt.id);
                      setSelectedRunId(null);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="f1-filter-row">
              <span className="f1-filter-label">CHANNELS</span>
              <div className="f1-pill-group">
                {TELEMETRY_CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className="f1-pill"
                    aria-pressed={channels[ch.id]}
                    onClick={() => toggleChannel(ch.id)}
                  >
                    {channels[ch.id] ? '● ' : '○ '}
                    {ch.label}
                  </button>
                ))}
              </div>
              <span className="f1-filter-label" style={{ marginLeft: '8px' }}>RUN O₂</span>
              <div className="f1-pill-group">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'hypoxic', label: '≤18%' },
                  { id: 'nominal', label: '19–22%' },
                  { id: 'enriched', label: '≥23%' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="f1-pill"
                    aria-pressed={runO2Band === b.id}
                    onClick={() => {
                      setRunO2Band(b.id);
                      setSelectedRunId(null);
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── F1 Driver/Study Selector Strip ── */}
      {filteredStudies.length === 0 ? (
        <div className="f1-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
              No PSI investigations match these filters.
            </span>
            <button type="button" className="f1-btn f1-btn--primary" onClick={resetAllFilters}>
              Show all {allStudies.length} studies
            </button>
          </div>
        </div>
      ) : (
        <div className="f1-study-strip" role="tablist" aria-label="Filtered PSI investigations">
          {filteredStudies.map((inv) => {
            const active = inv.id === activeStudy.id;
            const o2Peak = inv.conditions?.oxygenMaxPct ?? inv.conditions?.oxygenPct;
            return (
              <button
                key={inv.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`f1-study-tab${active ? ' f1-study-tab--active' : ''}`}
                onClick={() => selectStudy(inv.id)}
              >
                <div className="f1-study-tab__top">
                  <span>{inv.acronym}</span>
                  <span className="f1-study-tab__o2">
                    {o2Peak != null ? `${o2Peak}% O₂` : 'PSI'}
                  </span>
                </div>
                <div className="f1-study-tab__meta">
                  {inv.fuelType?.toUpperCase()} · {inv.hardware}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Pit-Wall Telemetry Split Grid ── */}
      <div className="f1-grid">
        {/* Left Column: Timing Tower, Digital Gauges, Gas Mix & ECU Sensors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <section className="f1-panel f1-panel--accent" aria-label="Live Telemetry Readout">
            <div className="f1-panel__head">
              <span className="f1-panel__title">LIVE TELEMETRY HUD</span>
              <span className="f1-panel__tag">{theme.liveryReason}</span>
            </div>

            <div className="f1-gauge-grid">
              <div className="f1-gauge">
                <span className="f1-gauge__label">O₂ CONCENTRATION</span>
                <span className="f1-gauge__value" style={{ color: theme.primary }}>
                  {o2PctDisplay}
                </span>
                <RpmBar ratio={(kpis.o2Value ?? 0) / 85} />
                <span className="f1-gauge__sub">{o2RangeText}</span>
              </div>

              <div className="f1-gauge">
                <span className="f1-gauge__label">CHAMBER PRESSURE</span>
                <span className="f1-gauge__value">
                  {kpis.pressurePsi != null ? `${kpis.pressurePsi} psi` : 'N/R'}
                </span>
                <RpmBar ratio={(kpis.pressurePsi ?? 0) / 45} />
                <span className="f1-gauge__sub">
                  {kpis.pressureMmhg != null ? `${kpis.pressureMmhg} mmHg · ` : ''}
                  {formatDelta(kpis.pressureDeltaEarth, ' psi')}
                </span>
              </div>

              <div className="f1-gauge">
                <span className="f1-gauge__label">
                  {kpis.diameterMm != null ? 'DROPLET Ø (MDCA)' : 'FORCED FLOW'}
                </span>
                <span className="f1-gauge__value" style={{ color: theme.channels.flow }}>
                  {kpis.diameterMm != null
                    ? `${kpis.diameterMm} mm`
                    : kpis.flowVelocity != null
                      ? `${kpis.flowVelocity} m/s`
                      : 'Quiescent'}
                </span>
                <RpmBar
                  ratio={
                    kpis.diameterMm != null
                      ? kpis.diameterMm / 5
                      : (kpis.flowVelocity ?? 0) / 0.55
                  }
                />
                <span className="f1-gauge__sub">
                  {kpis.diameterMm != null ? 'Tethered / free droplet' : 'Ventilation duct'}
                </span>
              </div>

              <div className="f1-gauge">
                <span className="f1-gauge__label">GRAVITY REGIME</span>
                <span className="f1-gauge__value" style={{ fontSize: '15px' }}>
                  {String(activeStudy.gravityLevel ?? 'microgravity').toUpperCase()}
                </span>
                <RpmBar ratio={activeStudy.tags?.includes('partial-gravity-proxy') ? 0.65 : 0.25} />
                <span className="f1-gauge__sub">
                  {activeStudy.tags?.includes('partial-gravity-proxy')
                    ? 'E-FIELD body-force proxy'
                    : 'Free-fall ISS / Cygnus'}
                </span>
              </div>
            </div>

            {/* Gas Mixture Composition Bar */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  color: '#64748b',
                  marginBottom: '5px',
                }}
              >
                <span>ATMOSPHERE MIX COMPOSITION</span>
                <span>{activeRun ? activeRun.mix : activeStudy.conditions?.ambient ?? 'O₂/N₂'}</span>
              </div>
              <div className="f1-mix-bar" role="img" aria-label="Gas mixture composition bar">
                <div style={{ width: `${(o2Seg / gasSum) * 100}%`, background: theme.primary }} />
                <div style={{ width: `${(n2Seg / gasSum) * 100}%`, background: '#334155' }} />
                {co2Seg > 0 && (
                  <div style={{ width: `${(co2Seg / gasSum) * 100}%`, background: '#34d399' }} />
                )}
                {heSeg > 0 && (
                  <div style={{ width: `${(heSeg / gasSum) * 100}%`, background: '#a78bfa' }} />
                )}
              </div>
              <div className="f1-mix-legend" style={{ marginTop: '6px' }}>
                <span style={{ color: theme.primary }}>■ O₂ {o2Seg}%</span>
                <span style={{ color: '#94a3b8' }}>■ N₂ {n2Seg}%</span>
                {co2Seg > 0 && <span style={{ color: '#34d399' }}>■ CO₂ {co2Seg}%</span>}
                {heSeg > 0 && <span style={{ color: '#a78bfa' }}>■ He {heSeg}%</span>}
              </div>
            </div>
          </section>

          {/* Onboard Sensor ECU Status */}
          <section className="f1-panel" aria-label="Onboard Sensor Instrumentation">
            <div className="f1-panel__head">
              <span className="f1-panel__title">ONBOARD ECU &amp; SENSORS</span>
              <span className="f1-panel__tag">{activeStudy.sensors?.length ?? 0} CHANNELS</span>
            </div>
            <div className="f1-sensor-list">
              {(activeStudy.sensors ?? []).map((sensor) => (
                <div key={sensor} className="f1-sensor-chip">
                  <span className="f1-sensor-led" aria-hidden="true" />
                  <span>{sensor}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Run Timing Tower (when FLEX 258 runs or MongoDB experiments are active) */}
          {runStreamEnabled && (
            <section className="f1-panel" aria-label="Run Timing Tower">
              <div className="f1-panel__head">
                <span className="f1-panel__title">RUN TIMING TOWER ({filteredRuns.length})</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`f1-btn${playing ? ' f1-btn--primary' : ''}`}
                    style={{ padding: '4px 8px', fontSize: '10px' }}
                    onClick={() => setPlaying((p) => !p)}
                    disabled={!filteredRuns.length}
                  >
                    {playing ? '❚❚ Pause' : '▶ Play Cursor'}
                  </button>
                  {activeRun && (
                    <button
                      type="button"
                      className="f1-btn"
                      style={{ padding: '4px 8px', fontSize: '10px' }}
                      onClick={() => {
                        setSelectedRunId(null);
                        setPlaying(false);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {filteredRuns.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', padding: '10px 4px' }}>
                  No runs match the current run filters.
                </div>
              ) : (
                <div className="f1-timing-table" role="listbox" aria-label="Experimental runs">
                  <div className="f1-timing-row f1-timing-head">
                    <span>RUN ID</span>
                    <span>FUEL / MIX</span>
                    <span>O₂</span>
                    <span>PRESS</span>
                    <span>Ø</span>
                  </div>
                  {filteredRuns.map((run) => {
                    const selected = activeRun?.runId === run.runId;
                    return (
                      <button
                        key={run.runId}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`f1-timing-row${selected ? ' f1-timing-row--active' : ''}`}
                        onClick={() => {
                          setPlaying(false);
                          setSelectedRunId(selected ? null : run.runId);
                        }}
                      >
                        <strong style={{ color: selected ? theme.primary : '#f8fafc' }}>
                          {run.runId}
                        </strong>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {run.fuel} · {run.mix}
                        </span>
                        <span style={{ color: theme.primary }}>{run.o2Pct}%</span>
                        <span>{run.pressurePsi}p</span>
                        <span>{run.diameterMm ?? run.flowVelocity ?? '—'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Synchronized Multi-Channel F1 Telemetry Charts */}
        <F1TelemetryDeck
          study={activeStudy}
          theme={theme}
          runSeries={filteredRuns}
          envelopeSeries={envelopeSeries}
          activeRun={activeRun}
          onSelectRun={(run) => {
            setPlaying(false);
            setSelectedRunId(run.runId);
          }}
          onSelectStudy={selectStudy}
          channels={channels}
          baselineOverlay={baselineOverlay}
          measurements={mongoMeasurements}
          showRunTelemetry={runStreamEnabled}
        />
      </div>

      {/* ── Study Specifications & Engineering Brief ── */}
      <section className="f1-panel" aria-label="Study specifications">
        <div className="f1-panel__head">
          <span className="f1-panel__title">PSI RECORD SPECIFICATIONS // VERIFIED ENVELOPE</span>
          <span className="f1-panel__tag">{activeStudy.psiId}</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: '10px',
          }}
        >
          <div className="f1-gauge">
            <span className="f1-gauge__label">MISSION OBJECTIVE</span>
            <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
              {activeStudy.objective ?? 'Not reported in PSI record.'}
            </span>
          </div>
          <div className="f1-gauge">
            <span className="f1-gauge__label">FUEL &amp; GEOMETRY</span>
            <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
              {activeStudy.fuel ?? 'Not reported in PSI record.'}
            </span>
          </div>
          <div className="f1-gauge">
            <span className="f1-gauge__label">MEASURED VARIABLES</span>
            <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
              {activeStudy.variables?.length
                ? activeStudy.variables.join(' · ')
                : 'Not reported in PSI record.'}
            </span>
          </div>
          {activeStudy.earthApplications?.length > 0 && (
            <div className="f1-gauge">
              <span className="f1-gauge__label">EARTH SPIN-OFF APPLICATIONS</span>
              <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                {activeStudy.earthApplications.join(' · ')}
              </span>
            </div>
          )}
        </div>

        {activeStudy.aiInsight && (
          <div
            style={{
              background: 'var(--tel-tint)',
              border: '1px solid var(--tel-border)',
              borderRadius: '8px',
              padding: '10px 14px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--tel-primary)',
                marginBottom: '4px',
              }}
            >
              HEIMDALL TELEMETRY BRIEF
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.45 }}>
              {activeStudy.aiInsight}
            </div>
          </div>
        )}
      </section>

      {/* ── Scientific Partial-Gravity Guardrail ── */}
      <section
        className="f1-panel"
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ color: '#f59e0b', fontSize: '15px' }}>⚠</span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#f59e0b',
              }}
            >
              SCIENTIFIC NOTICE // PARTIAL-GRAVITY BOUNDARIES (0G ↔ 1G)
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
            PSI contains no direct partial-gravity (0.165g Moon or 0.38g Mars) data. Habitat results
            are bounded between microgravity and 1g baselines; E-FIELD Flames is an experimental
            body-force proxy.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="f1-btn f1-btn--primary"
            onClick={() => navigate('/firehazr')}
          >
            Open FireHazR Lab →
          </button>
          <button type="button" className="f1-btn" onClick={() => navigate('/flame-3d')}>
            Flame 3D Testbench →
          </button>
        </div>
      </section>
    </div>
  );
}
