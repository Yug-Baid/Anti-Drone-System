import React, { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import WireframeDrone from "../components/WireframeDrone.jsx";
import GlassCard from "../components/GlassCard.jsx";

/* ── Slowly orbiting drone ── */
function OrbitingDrone() {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime * 0.3;
    groupRef.current.position.x = Math.cos(t) * 2;
    groupRef.current.position.z = Math.sin(t) * 2;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.2;
    groupRef.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <group ref={groupRef}>
      <WireframeDrone scale={1.5} color="#00f2ff" />
    </group>
  );
}

/* ── Floating Particles ── */
function Particles() {
  const ref = useRef();
  const count = 80;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += Math.sin(clock.elapsedTime + i) * 0.001;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#00f2ff" size={0.03} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

/* ── Grid Floor ── */
function GridFloor() {
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(16, 32, "#00f2ff", "#0a1530");
    grid.material.transparent = true;
    grid.material.opacity = 0.12;
    return grid;
  }, []);

  return <primitive object={gridHelper} position={[0, -2, 0]} />;
}

/* ── Background Scene ── */
function BackgroundScene() {
  return (
    <Canvas
      camera={{ position: [0, 1, 5], fov: 50 }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={0.3} color="#00f2ff" />
      <Suspense fallback={null}>
        <OrbitingDrone />
        <Particles />
        <GridFloor />
      </Suspense>
    </Canvas>
  );
}

/* ── Spoofing Type Card ── */
function SpoofingCard({ number, title, description, examples, countermeasures, icon }) {
  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(0, 242, 255, 0.1)", border: "1px solid rgba(0, 242, 255, 0.3)",
          fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--accent)",
        }}>{number}</span>
        <h3 className="info-title" style={{ margin: 0 }}>{icon} {title}</h3>
      </div>
      <p className="info-text">{description}</p>
      <div style={{ marginTop: 12 }}>
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8,
          fontFamily: "var(--font-mono)", fontSize: 12,
        }}>
          <span className="tag">EXAMPLE</span>
          <span style={{ color: "var(--text-dim)" }}>{examples}</span>
        </div>
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6,
          fontFamily: "var(--font-mono)", fontSize: 12,
        }}>
          <span className="tag" style={{
            background: "rgba(0, 255, 136, 0.1)", borderColor: "rgba(0, 255, 136, 0.3)", color: "var(--ok)"
          }}>DEFENSE</span>
          <span style={{ color: "var(--text-dim)" }}>{countermeasures}</span>
        </div>
      </div>
    </GlassCard>
  );
}

export default function SpoofingInfo() {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* 3D Background */}
      <BackgroundScene />

      {/* Content Overlay */}
      <div style={{ position: "relative", zIndex: 1 }} className="sim-page">
        <div className="sim-page-header">
          <div>
            <h1 className="sim-page-title">🔍 SPOOFING ATTACK VECTORS</h1>
            <p className="sim-page-subtitle">
              Comprehensive analysis of spoofing techniques used against autonomous drone systems,
              including attack methodologies, real-world examples, and defense countermeasures.
            </p>
          </div>
        </div>

        <div className="info-grid">
          <SpoofingCard
            number="1"
            icon="🛰️"
            title="GNSS/GPS Spoofing"
            description="The attacker transmits counterfeit satellite signals that appear genuine. The drone locks onto the fake signals, miscalculating its position, altitude, or time."
            examples="Redirecting a delivery drone away from its path."
            countermeasures="Multi-GNSS (GPS, Galileo, GLONASS), signal authentication, anomaly detection."
          />
          <SpoofingCard
            number="2"
            icon="📡"
            title="Command & Control Spoofing"
            description="Exploits weak or unencrypted links between the drone and its operator. The attacker injects fake commands (e.g., 'return to home' or 'land now')."
            examples="Forcing an unauthorized drone to land at attacker's location."
            countermeasures="Encrypted communication protocols, strong authentication."
          />
        </div>

        <div className="info-grid">
          <SpoofingCard
            number="3"
            icon="🔓"
            title="Protocol Exploits"
            description="Attacks target weaknesses in telemetry or navigation protocols, inserting manipulated data streams that look legitimate."
            examples="False altitude data leading the drone to crash or evade detection radar."
            countermeasures="Firmware patching, intrusion detection on control links."
          />
          <SpoofingCard
            number="4"
            icon="🔬"
            title="Sensor Spoofing"
            description="Instead of attacking navigation signals, adversaries spoof onboard sensors such as IMU, magnetometer, or vision. Subtle manipulations bias the drone's flight control."
            examples="High-intensity lights or electromagnetic interference trick optical flow sensors."
            countermeasures="Sensor fusion (cross-validating multiple sensors), shielding, anomaly detection."
          />
        </div>

        <div className="info-grid">
          <SpoofingCard
            number="5"
            icon="💉"
            title="Data Injection Attacks"
            description="Malicious actors insert false correction data (e.g., fake RTK/GBAS base station messages) so that navigation solutions drift over time."
            examples="Slowly steering surveillance drones away from restricted zones."
            countermeasures="Signed correction messages, cross-checking multiple base stations."
          />
          <GlassCard>
            <h3 className="info-title">⚠️ Impact of Spoofing</h3>
            <p className="info-text">
              Spoofing attacks can cause drones to <strong>lose mission accuracy</strong>,{" "}
              <strong>violate airspace</strong>, or even <strong>be hijacked</strong>. For
              security-critical sites (airports, military bases, power plants), spoofing
              represents a major threat.
            </p>
            <div style={{ marginTop: 16 }}>
              <h3 className="info-title">🛡️ Detection & Defense</h3>
              <ul className="list" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                <li>Use multi-constellation and multi-frequency GNSS receivers.</li>
                <li>Cross-validate position with inertial, vision, and barometric sensors.</li>
                <li>Deploy spoofing detection algorithms for anomalies in signal power, Doppler, or timing.</li>
                <li>Use encrypted & authenticated control channels.</li>
                <li>Employ external monitoring systems (radar, RF sensors) to validate drone behavior.</li>
              </ul>
            </div>
          </GlassCard>
        </div>

        <GlassCard>
          <p className="info-text" style={{ textAlign: "center" }}>
            👉 In this simulation: entering the <strong>Danger Zone</strong> triggers a spoofing event.
            The drone's manual control is frozen, and it is automatically redirected to the <strong>Safe Zone</strong>.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
