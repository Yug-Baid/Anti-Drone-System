import React, { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import GlassCard from "../components/GlassCard.jsx";

/* ── Real-Time IMU Path (cyan) ── */
function IMUPath({ points }) {
  if (points.length < 2) return null;
  return <Line points={points} color="#00f2ff" lineWidth={2.5} />;
}

/* ── Delayed Visual Path (orange) ── */
function DelayedPath({ points }) {
  if (points.length < 2) return null;
  return <Line points={points} color="#ff8800" lineWidth={2} dashed dashSize={0.1} gapSize={0.05} />;
}

/* ── Chi-Squared Acceptance Ellipsoid ── */
function AcceptanceEllipsoid() {
  return (
    <mesh scale={[1.8, 1.2, 1.5]}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial color="#00f2ff" wireframe transparent opacity={0.08} />
    </mesh>
  );
}

/* ── Innovation Vector Arrow ── */
function InnovationVector({ stealthy, time }) {
  const ref = useRef();

  useFrame(() => {
    if (!ref.current) return;
    const t = time * 0.5;
    if (stealthy) {
      // Stay inside ellipsoid — small oscillation
      ref.current.position.set(
        Math.sin(t * 1.3) * 0.8,
        Math.cos(t * 0.9) * 0.5,
        Math.sin(t * 0.7) * 0.6
      );
    } else {
      // Break outside ellipsoid — larger magnitude
      ref.current.position.set(
        Math.sin(t * 1.3) * 2.5,
        Math.cos(t * 0.9) * 1.8,
        Math.sin(t * 0.7) * 2.0
      );
    }
  });

  const dir = useMemo(() => new THREE.Vector3(0.5, 0.8, 0.3).normalize(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);

  return (
    <group ref={ref}>
      <arrowHelper args={[dir, origin, 0.8, stealthy ? "#00ff88" : "#ff3344", 0.15, 0.08]} />
      <mesh>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={stealthy ? "#00ff88" : "#ff3344"} />
      </mesh>
    </group>
  );
}

/* ── Grid Floor ── */
function GridFloor() {
  return (
    <gridHelper args={[16, 32, "#0a1530", "#0a1530"]} position={[0, -2, 0]}>
    </gridHelper>
  );
}

/* ── Path Generator ── */
function generatePath(offset, noiseScale, count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = i * 0.05;
    pts.push([
      t * 2 - 4 + Math.sin(t * 2 + offset) * noiseScale,
      Math.cos(t * 1.5 + offset) * 0.5 * noiseScale + Math.sin(t * 0.7) * 0.3,
      Math.sin(t * 3 + offset) * noiseScale * 0.8,
    ]);
  }
  return pts;
}

/* ── Main 3D Scene ── */
function DKFScene({ stealthy, latency, playing }) {
  const timeRef = useRef(0);
  const [pathLen, setPathLen] = useState(20);

  useFrame((_, delta) => {
    if (!playing) return;
    timeRef.current += delta;
    if (timeRef.current % 0.1 < delta) {
      setPathLen((prev) => Math.min(prev + 1, 200));
    }
  });

  const imuPath = useMemo(() => generatePath(0, 0.4, pathLen), [pathLen]);
  const delayedPath = useMemo(() => {
    const delayOffset = latency / 500;
    return generatePath(delayOffset, 0.6, Math.max(2, pathLen - Math.floor(latency / 20)));
  }, [pathLen, latency]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.4} color="#00f2ff" />
      <OrbitControls enablePan={false} maxDistance={12} minDistance={3} />

      <GridFloor />
      <AcceptanceEllipsoid />
      <InnovationVector stealthy={stealthy} time={timeRef.current} />
      <IMUPath points={imuPath} />
      <DelayedPath points={delayedPath} />

      {/* Labels */}
      <Text position={[-4, 2, 0]} fontSize={0.2} color="#00f2ff" anchorX="left">
        REAL-TIME IMU PATH
      </Text>
      <Text position={[-4, 1.7, 0]} fontSize={0.2} color="#ff8800" anchorX="left">
        DELAYED VISUAL PATH
      </Text>
      <Text position={[0, 1.7, 0]} fontSize={0.15} color="#555">
        CHI-SQUARED ACCEPTANCE REGION
      </Text>
    </>
  );
}

export default function DKFSimulation() {
  const [stealthy, setStealthy] = useState(true);
  const [latency, setLatency] = useState(100);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="sim-page">
      <div className="sim-page-header">
        <div>
          <h1 className="sim-page-title">DKF-FDI SIMULATION</h1>
          <p className="sim-page-subtitle">
            Visualize how False Data Injection attacks exploit the temporal buffer of
            a Delayed Kalman Filter. The chi-squared acceptance ellipsoid shows the
            anomaly detection boundary — stealthy attacks keep the innovation vector
            inside to bypass detection.
          </p>
        </div>
      </div>

      <GlassCard className="sim-canvas-container" style={{ padding: 0, height: '500px' }}>
        <Canvas camera={{ position: [3, 2.5, 5], fov: 55 }} style={{ width: "100%", height: "100%" }}>
          <Suspense fallback={null}>
            <DKFScene stealthy={stealthy} latency={latency} playing={playing} />
          </Suspense>
        </Canvas>
      </GlassCard>

      <div className="sim-controls">
        <button
          className={`control-button ${playing ? "" : "btn-primary"}`}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "❚❚ PAUSE" : "▶ PLAY"}
        </button>

        <div className="sim-toggle">
          <input
            type="checkbox"
            id="stealthy-toggle"
            checked={stealthy}
            onChange={(e) => setStealthy(e.target.checked)}
          />
          <label htmlFor="stealthy-toggle" className="sim-toggle-label">
            Stealthy Attack (aₖ inside ellipsoid)
          </label>
        </div>

        <div className="sim-toggle">
          <label>Latency: {latency}ms</label>
          <input
            type="range"
            min={50}
            max={200}
            value={latency}
            onChange={(e) => setLatency(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="info-grid">
        <GlassCard>
          <h3 className="info-title">Innovation Vector (γ)</h3>
          <p className="info-text">
            The innovation vector represents the difference between the predicted
            measurement and the actual measurement. In normal operation, γ stays
            within the chi-squared acceptance ellipsoid. During a{" "}
            <strong>stealthy FDI attack</strong>, the attacker crafts the injection
            vector aₖ so that γ remains inside the boundary, making the attack
            undetectable by the built-in anomaly detector.
          </p>
          <div className="info-meta">
            <span className="tag">
              {stealthy ? "STEALTH MODE" : "DETECTABLE ATTACK"}
            </span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span className="muted">
              {stealthy
                ? "Attack bypasses anomaly detection"
                : "Attack exceeds chi-squared threshold — would trigger alarm"}
            </span>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="info-title">Temporal Buffer Exploitation</h3>
          <p className="info-text">
            The DKF maintains a buffer of IMU measurements between delayed visual
            updates. With a <strong>{latency}ms latency window</strong>, the filter
            must propagate {Math.round(latency / 5)} IMU samples before the next
            visual correction arrives. This prediction horizon is the vulnerability
            — corrupted delayed data gets fused with accumulated IMU uncertainty,
            amplifying the attack's effect.
          </p>
          <div className="info-meta">
            <span className="tag">LATENCY: {latency}ms</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span className="muted">~{Math.round(latency / 5)} IMU samples in buffer</span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
