import React, { useRef, useState, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import GlassCard from "../components/GlassCard.jsx";
import WireframeDrone from "../components/WireframeDrone.jsx";
import useSirenSound from "../hooks/useSirenSound.js";

/* ── Trajectory Drone ── */
function TrajectoryDrone({ path, progress, color }) {
  const ref = useRef();

  useFrame(() => {
    if (!ref.current || path.length < 2) return;
    const idx = Math.min(Math.floor(progress * (path.length - 1)), path.length - 1);
    const pt = path[idx];
    ref.current.position.set(pt[0], pt[1], pt[2]);
  });

  return (
    <group ref={ref}>
      <WireframeDrone scale={0.8} color={color} />
    </group>
  );
}

/* ── Velocity Arrows ── */
function VelocityArrows({ path, progress, color }) {
  const arrows = useMemo(() => {
    const items = [];
    const step = Math.max(1, Math.floor(path.length / 12));
    for (let i = 0; i < path.length - 1; i += step) {
      const from = path[i];
      const to = path[Math.min(i + step, path.length - 1)];
      const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
      const origin = new THREE.Vector3(from[0], from[1], from[2]);
      items.push({ dir, origin, idx: i });
    }
    return items;
  }, [path]);

  return (
    <group>
      {arrows.map((a, i) => {
        const visible = (a.idx / path.length) <= progress;
        return visible ? (
          <arrowHelper
            key={i}
            args={[a.dir, a.origin, 0.4, color, 0.1, 0.06]}
          />
        ) : null;
      })}
    </group>
  );
}

/* ── Grid ── */
function SceneGrid() {
  return (
    <gridHelper args={[12, 24, "#0a1530", "#0a1530"]} position={[0, -1.5, 0]} />
  );
}

/* ── Path Generators ── */
function generateCommandedPath(count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = i * 0.04;
    pts.push([
      t * 3 - 3,
      Math.sin(t * 2) * 0.5 + 0.2,
      Math.cos(t * 1.5) * 0.8,
    ]);
  }
  return pts;
}

function generateCorruptedPath(commandedPath, divergence) {
  return commandedPath.map((pt, i) => {
    const t = i * 0.04;
    const drift = Math.pow(i / commandedPath.length, 1.5) * divergence;
    return [
      pt[0] + Math.sin(t * 3) * drift * 0.5 + drift * 0.3,
      pt[1] + Math.cos(t * 2.5) * drift * 0.3 + drift * 0.2,
      pt[2] + Math.sin(t * 1.8) * drift * 0.4 - drift * 0.15,
    ];
  });
}

/* ── Scene ── */
function MissionScene({ corrupted, progress }) {
  const pathLen = 150;
  const cmdPath = useMemo(() => generateCommandedPath(pathLen), []);
  const corrPath = useMemo(() => generateCorruptedPath(cmdPath, corrupted ? 2.5 : 0), [cmdPath, corrupted]);

  const displayedCmdPts = useMemo(() => {
    const end = Math.max(2, Math.floor(progress * cmdPath.length));
    return cmdPath.slice(0, end);
  }, [progress, cmdPath]);

  const displayedCorrPts = useMemo(() => {
    const end = Math.max(2, Math.floor(progress * corrPath.length));
    return corrPath.slice(0, end);
  }, [progress, corrPath]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 5, 5]} intensity={0.4} color="#00f2ff" />
      <OrbitControls enablePan={false} maxDistance={10} minDistance={3} />
      <SceneGrid />

      {/* Commanded trajectory (cyan) */}
      {displayedCmdPts.length >= 2 && (
        <Line points={displayedCmdPts} color="#00f2ff" lineWidth={2.5} />
      )}
      <TrajectoryDrone path={cmdPath} progress={progress} color="#00f2ff" />
      <VelocityArrows path={cmdPath} progress={progress} color="#00f2ff" />

      {/* Corrupted trajectory (red-orange) */}
      {corrupted && displayedCorrPts.length >= 2 && (
        <Line points={displayedCorrPts} color="#ff3344" lineWidth={2} dashed dashSize={0.08} gapSize={0.04} />
      )}
      {corrupted && (
        <TrajectoryDrone path={corrPath} progress={progress} color="#ff3344" />
      )}
      {corrupted && (
        <VelocityArrows path={corrPath} progress={progress} color="#ff3344" />
      )}

      {/* Labels */}
      <Text position={[-3, 2, 0]} fontSize={0.18} color="#00f2ff" anchorX="left">
        COMMANDED v_cmd
      </Text>
      {corrupted && (
        <Text position={[-3, 1.7, 0]} fontSize={0.18} color="#ff3344" anchorX="left">
          CORRUPTED DKF PREDICTION
        </Text>
      )}
    </>
  );
}

/* ── Divergence Metric ── */
function DivergenceMetric({ progress, corrupted }) {
  const divergence = corrupted ? (progress * 4.2).toFixed(2) : "0.00";
  return (
    <GlassCard style={{ textAlign: "center" }}>
      <span className="stat-value" style={{ fontSize: "32px", color: corrupted && progress > 0.3 ? "var(--danger)" : "var(--accent)" }}>
        {divergence}m
      </span>
      <span className="stat-label">Trajectory Divergence</span>
    </GlassCard>
  );
}

/* ── Severity Gauge ── */
function SeverityGauge({ progress }) {
  const severity = Math.min(progress * 100, 100);
  const getColor = () => {
    if (severity > 60) return "var(--danger)";
    if (severity > 30) return "var(--warn)";
    return "var(--ok)";
  };

  return (
    <GlassCard style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
      {/* Background bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0,
        width: "100%", height: `${severity}%`,
        background: `linear-gradient(to top, ${getColor()}22, transparent)`,
        transition: "height 0.3s ease, background 0.3s ease",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <span className="stat-value" style={{ fontSize: "32px", color: getColor() }}>
          {severity.toFixed(0)}%
        </span>
        <span className="stat-label">Attack Severity</span>
      </div>
    </GlassCard>
  );
}

/* ── Mission Timeline Log ── */
function MissionTimeline({ progress }) {
  const logRef = useRef(null);

  const events = useMemo(() => {
    const items = [
      { time: 0, label: "Mission initiated", type: "auth", threshold: 0 },
      { time: 0.8, label: "Flight plan loaded — 150 waypoints", type: "auth", threshold: 0.01 },
      { time: 1.2, label: "IMU calibration complete (200Hz)", type: "auth", threshold: 0.05 },
      { time: 1.6, label: "VIO pipeline active (30Hz)", type: "auth", threshold: 0.08 },
      { time: 2.0, label: "DKF prediction horizon initialized", type: "auth", threshold: 0.10 },
      { time: 2.4, label: "Normal trajectory tracking established", type: "auth", threshold: 0.15 },
      { time: 3.0, label: "⚠️ Anomaly in delayed visual channel", type: "warn", threshold: 0.20 },
      { time: 3.4, label: "⚠️ False position data injected via VIO", type: "warn", threshold: 0.25 },
      { time: 3.8, label: "🔴 Velocity correction bias introduced", type: "attack", threshold: 0.30 },
      { time: 4.2, label: "🔴 Chi-squared test: within acceptance (stealthy)", type: "attack", threshold: 0.35 },
      { time: 4.6, label: "Trajectory divergence: 0.15m", type: "warn", threshold: 0.40 },
      { time: 5.0, label: "🔴 Prediction horizon exploited at fusion time", type: "attack", threshold: 0.45 },
      { time: 5.5, label: "⚠️ Divergence exceeds 0.332m CRITICAL THRESHOLD", type: "attack", threshold: 0.50 },
      { time: 6.0, label: "🚨 Failure cascade initiated", type: "attack", threshold: 0.55 },
      { time: 6.5, label: "🚨 Position error feeding into velocity controller", type: "attack", threshold: 0.60 },
      { time: 7.0, label: "🚨 Corrections amplifying corrupted state", type: "attack", threshold: 0.65 },
      { time: 7.5, label: "💀 Drone deviated beyond recovery margins", type: "attack", threshold: 0.75 },
      { time: 8.0, label: "💀 MISSION FAILURE — Total trajectory loss", type: "attack", threshold: 0.90 },
    ];
    return items;
  }, []);

  const visibleEvents = events.filter(e => progress >= e.threshold);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleEvents.length]);

  const getLogClass = (type) => {
    switch (type) {
      case 'auth': return 'log-auth';
      case 'warn': return 'log-warn';
      case 'attack': return 'log-attack';
      default: return '';
    }
  };

  return (
    <GlassCard>
      <h3 className="info-title">📋 Mission Timeline</h3>
      <div className="footprints-log" ref={logRef} style={{ height: "240px" }}>
        {visibleEvents.map((event, i) => (
          <div key={i} className={`log-entry ${getLogClass(event.type)}`}>
            <span className="log-timestamp">T+{event.time.toFixed(1)}s</span>
            <span className="log-message">{event.label}</span>
          </div>
        ))}
        {visibleEvents.length === 0 && (
          <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Press PLAY to begin mission timeline...
          </div>
        )}
      </div>
    </GlassCard>
  );
}

/* ── Telemetry Panel ── */
function TelemetryPanel({ progress }) {
  const velocityError = (progress * 2.8).toFixed(2);
  const positionError = (progress * 4.2).toFixed(2);
  const filterConfidence = Math.max(0, (100 - progress * 85)).toFixed(1);
  const imuRate = 200;
  const vioRate = progress > 0.3 ? Math.max(5, 30 - Math.round(progress * 25)) : 30;
  const predHorizon = progress > 0.2 ? (100 + progress * 120).toFixed(0) : "100";

  return (
    <GlassCard>
      <h3 className="info-title">📊 Real-Time Telemetry</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="telemetry-readout">
          <div className="telemetry-item">
            <span style={{ color: "var(--text-dim)" }}>Velocity Error</span>
            <span style={{ color: progress > 0.5 ? "var(--danger)" : "var(--accent)", fontWeight: 700 }}>
              {velocityError} m/s
            </span>
          </div>
          <div className="telemetry-item">
            <span style={{ color: "var(--text-dim)" }}>Position Error</span>
            <span style={{ color: progress > 0.4 ? "var(--danger)" : "var(--accent)", fontWeight: 700 }}>
              {positionError} m
            </span>
          </div>
          <div className="telemetry-item">
            <span style={{ color: "var(--text-dim)" }}>Filter Confidence</span>
            <span style={{ color: filterConfidence < 40 ? "var(--danger)" : "var(--ok)", fontWeight: 700 }}>
              {filterConfidence}%
            </span>
          </div>
        </div>
        <div className="telemetry-readout">
          <div className="telemetry-item">
            <span style={{ color: "var(--text-dim)" }}>IMU Rate</span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{imuRate} Hz</span>
          </div>
          <div className="telemetry-item">
            <span style={{ color: "var(--text-dim)" }}>VIO Rate</span>
            <span style={{ color: vioRate < 15 ? "var(--warn)" : "var(--ok)", fontWeight: 700 }}>
              {vioRate} Hz
            </span>
          </div>
          <div className="telemetry-item">
            <span style={{ color: "var(--text-dim)" }}>Pred. Horizon</span>
            <span style={{ color: predHorizon > 150 ? "var(--warn)" : "var(--accent)", fontWeight: 700 }}>
              {predHorizon} ms
            </span>
          </div>
        </div>
      </div>

      {/* Signal bar for filter confidence */}
      <div style={{ marginTop: 12 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", marginBottom: 4,
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)",
        }}>
          <span>FILTER CONFIDENCE</span>
          <span style={{ color: filterConfidence < 40 ? "var(--danger)" : "var(--ok)" }}>{filterConfidence}%</span>
        </div>
        <div className="signal-bar-container">
          <div
            className="signal-bar-fill"
            style={{
              width: `${filterConfidence}%`,
              background: filterConfidence < 40
                ? "linear-gradient(90deg, var(--danger), #ff6b44)"
                : filterConfidence < 70
                ? "linear-gradient(90deg, var(--warn), #ffcc00)"
                : "linear-gradient(90deg, var(--ok), var(--accent))",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </GlassCard>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function MissionFailure() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const animRef = useRef(null);
  const sirenTriggered = useRef(false);

  // --- SIREN SOUND ---
  const siren = useSirenSound();

  // Trigger siren when critical threshold exceeded
  useEffect(() => {
    if (progress > 0.6 && !sirenTriggered.current) {
      siren.play();
      sirenTriggered.current = true;
    }
    if (progress <= 0.01 && sirenTriggered.current) {
      siren.stop();
      sirenTriggered.current = false;
    }
  }, [progress, siren]);

  // Stop siren on unmount
  useEffect(() => {
    return () => siren.stop();
  }, []);

  const startPlayback = () => {
    if (playing) {
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
      return;
    }
    setPlaying(true);
    setProgress(0);
    sirenTriggered.current = false;
    siren.stop();
    const startTime = Date.now();
    const duration = 8000;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  // Computed values for stats
  const divergence = (progress * 4.2).toFixed(2);
  const maxVelError = (progress * 2.8).toFixed(2);
  const timeToCritical = progress > 0.5 ? ((progress * 8 * 0.5).toFixed(1) + "s") : "—";
  const riskLevel = progress > 0.75 ? "MISSION FAILURE" : progress > 0.6 ? "CRITICAL" : progress > 0.3 ? "WARNING" : "NOMINAL";
  const riskColor = progress > 0.6 ? "var(--danger)" : progress > 0.3 ? "var(--warn)" : "var(--ok)";

  return (
    <div className="sim-page">
      <div className="sim-page-header">
        <div>
          <h1 className="sim-page-title">MISSION FAILURE ANALYSIS</h1>
          <p className="sim-page-subtitle">
            Split-screen visualization showing how corrupted velocity commands (v_cmd)
            from the DKF prediction horizon cause progressive trajectory divergence,
            leading to mission failure.
          </p>
        </div>
      </div>

      {/* Siren alert banner */}
      {progress > 0.6 && (
        <div className="siren-banner" style={{ position: "relative", width: "100%", justifyContent: "center" }}>
          <div className="siren-icon" />
          <span>🚨 CRITICAL DIVERGENCE — MISSION FAILURE IMMINENT</span>
          <div className="siren-icon" />
        </div>
      )}

      <div className="split-view">
        <div>
          <div className="split-panel-title">COMMANDED VELOCITY (v_cmd)</div>
          <GlassCard className="sim-canvas-container" style={{ padding: 0, height: "420px" }}>
            <Canvas camera={{ position: [2, 2, 5], fov: 50 }} style={{ width: "100%", height: "100%" }}>
              <Suspense fallback={null}>
                <MissionScene corrupted={false} progress={progress} />
              </Suspense>
            </Canvas>
          </GlassCard>
        </div>

        <div>
          <div className="split-panel-title">CORRUPTED DKF PREDICTION</div>
          <GlassCard className="sim-canvas-container" style={{ padding: 0, height: "420px" }}>
            <Canvas camera={{ position: [2, 2, 5], fov: 50 }} style={{ width: "100%", height: "100%" }}>
              <Suspense fallback={null}>
                <MissionScene corrupted={true} progress={progress} />
              </Suspense>
            </Canvas>
          </GlassCard>
        </div>
      </div>

      <div className="sim-controls">
        <button
          className={`control-button ${playing ? "" : "btn-primary"}`}
          onClick={startPlayback}
        >
          {playing ? "❚❚ PAUSE" : "▶ PLAY TIMELINE"}
        </button>

        <div className="sim-toggle">
          <label>Progress: {Math.round(progress * 100)}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(progress * 100)}
            onChange={(e) => {
              setProgress(Number(e.target.value) / 100);
              setPlaying(false);
              cancelAnimationFrame(animRef.current);
            }}
            style={{ width: "200px" }}
          />
        </div>
      </div>

      {/* Enhanced Stats — 6 cards */}
      <div className="stats-section" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        <DivergenceMetric progress={progress} corrupted={true} />
        <GlassCard style={{ textAlign: "center" }}>
          <span className="stat-value" style={{ fontSize: "28px" }}>
            {Math.round(progress * 100)}%
          </span>
          <span className="stat-label">Mission Progress</span>
        </GlassCard>
        <GlassCard style={{ textAlign: "center" }}>
          <span className="stat-value" style={{ fontSize: "28px", color: riskColor }}>
            {riskLevel}
          </span>
          <span className="stat-label">Risk Assessment</span>
        </GlassCard>
        <SeverityGauge progress={progress} />
        <GlassCard style={{ textAlign: "center" }}>
          <span className="stat-value" style={{ fontSize: "28px", color: progress > 0.5 ? "var(--danger)" : "var(--accent)" }}>
            {maxVelError} m/s
          </span>
          <span className="stat-label">Max Velocity Error</span>
        </GlassCard>
        <GlassCard style={{ textAlign: "center" }}>
          <span className="stat-value" style={{ fontSize: "28px", color: progress > 0.5 ? "var(--warn)" : "var(--muted)" }}>
            {timeToCritical}
          </span>
          <span className="stat-label">Time to Critical</span>
        </GlassCard>
      </div>

      {/* Real-time Telemetry + Mission Timeline */}
      <div className="info-grid">
        <TelemetryPanel progress={progress} />
        <MissionTimeline progress={progress} />
      </div>

      {/* Info Cards — Preserved */}
      <div className="info-grid">
        <GlassCard>
          <h3 className="info-title">Velocity Command Corruption</h3>
          <p className="info-text">
            The DKF prediction horizon introduces a window where velocity commands
            are computed using only IMU integration. When the delayed visual channel
            is corrupted with fake position data, the filter's velocity correction
            at fusion time introduces a systematic bias. Over multiple prediction
            cycles, this bias compounds, creating a growing divergence between the
            commanded and actual trajectories.
          </p>
        </GlassCard>
        <GlassCard>
          <h3 className="info-title">Failure Cascade</h3>
          <p className="info-text">
            As trajectory divergence exceeds the critical miss distance (0.332m),
            the drone enters a failure cascade: position errors feed back into the
            velocity controller, which requests larger corrections that further
            amplify the corrupted state estimate. By the time divergence is
            externally observable, the drone has already deviated beyond recovery
            margins, resulting in mission failure.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
