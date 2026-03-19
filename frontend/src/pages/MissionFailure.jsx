import React, { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import GlassCard from "../components/GlassCard.jsx";
import WireframeDrone from "../components/WireframeDrone.jsx";

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
  const refs = useRef([]);

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

export default function MissionFailure() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const animRef = useRef(null);

  const startPlayback = () => {
    if (playing) {
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
      return;
    }
    setPlaying(true);
    setProgress(0);
    const startTime = Date.now();
    const duration = 8000; // 8 seconds

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

      <div className="stats-section" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <DivergenceMetric progress={progress} corrupted={true} />
        <GlassCard style={{ textAlign: "center" }}>
          <span className="stat-value" style={{ fontSize: "32px" }}>
            {Math.round(progress * 100)}%
          </span>
          <span className="stat-label">Mission Progress</span>
        </GlassCard>
        <GlassCard style={{ textAlign: "center" }}>
          <span className="stat-value" style={{ fontSize: "32px", color: progress > 0.6 ? "var(--danger)" : "var(--ok)" }}>
            {progress > 0.6 ? "CRITICAL" : progress > 0.3 ? "WARNING" : "NOMINAL"}
          </span>
          <span className="stat-label">Mission Status</span>
        </GlassCard>
      </div>

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
