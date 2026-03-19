import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import * as THREE from "three";
import GlassCard from "../components/GlassCard.jsx";
import AnimatedCounter from "../components/AnimatedCounter.jsx";
import WireframeDrone from "../components/WireframeDrone.jsx";

/* ── 3D Hero Drone that follows mouse ── */
function HeroDrone() {
  const groupRef = useRef();
  const mouse = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  useEffect(() => {
    const handler = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 3 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 3 + 1;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetX = mouse.current.x * 2;
    const targetY = mouse.current.y * 1.5;
    groupRef.current.rotation.y += (targetX * 0.3 - groupRef.current.rotation.y) * 2 * delta;
    groupRef.current.rotation.x += (-targetY * 0.2 - groupRef.current.rotation.x) * 2 * delta;
    groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.1;
  });

  return (
    <group ref={groupRef}>
      <WireframeDrone scale={2.5} color="#00f2ff" />
    </group>
  );
}

function GridFloor() {
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(20, 40, "#00f2ff", "#0a1530");
    grid.material.transparent = true;
    grid.material.opacity = 0.15;
    return grid;
  }, []);

  return <primitive object={gridHelper} position={[0, -1.5, 0]} />;
}

function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 1, 4], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#00f2ff" />
      <Suspense fallback={null}>
        <HeroDrone />
        <GridFloor />
      </Suspense>
    </Canvas>
  );
}

/* ── Spoofing Data ── */
const SPOOFING = [
  {
    key: "gnss",
    name: "GNSS/GPS Spoofing",
    desc:
      "An attacker broadcasts counterfeit, high-power satellite signals to trick the drone's navigation receiver into calculating a false position, altitude, or time. " +
      "Defenses: Multi-constellation/multi-frequency receivers (L1/L2/L5), signal authentication (e.g., Galileo OSNMA), and Receiver Autonomous Integrity Monitoring (RAIM).",
    deepDesc:
      "This is a 'power-gaining' attack. The spoofer first synchronizes its fake signal with the authentic, weaker satellite signals. It then gradually increases its signal power until the drone's receiver 'locks on' to the malicious signal as the dominant source. Once captured, the attacker can slowly introduce a positional 'delta', causing the drone to drift off-course towards an unintended target. Because the drone *believes* it is following its flight plan (and reports this to the operator), it will not issue an error. Advanced defenses like RAIM cross-check the signals from all visible satellites; if one signal (the spoofer) presents data inconsistent with the others, it can be flagged and rejected.",
  },
  {
    key: "c2",
    name: "Command & Control Spoofing",
    desc:
      "The attacker intercepts or overpowers the operator's control link to inject malicious commands, such as 'land' or 'change waypoint'. " +
      "Defenses: Strong link-layer encryption (AES-256), authenticated message protocols, and Frequency-Hopping Spread Spectrum (FHSS) radios.",
    deepDesc:
      "This attack targets the radio frequency (RF) link between the pilot and the drone. If the link is unencrypted, an attacker can simply 'sniff' the packets, reverse-engineer the command structure, and transmit their own commands. Robust defenses use strong, authenticated encryption for all C2 traffic and employ FHSS, where the radio rapidly changes frequencies.",
  },
  {
    key: "protocol",
    name: "Protocol Exploits",
    desc:
      "Targets software vulnerabilities in the drone's communication protocol stack (e.g., MAVLink, DroneCAN) to cause a system crash or execute arbitrary code. " +
      "Defenses: Secure coding practices, firmware signing, input validation/fuzzing, and network-based intrusion detection systems (IDS).",
    deepDesc:
      "This is a digital-layer attack that doesn't rely on RF signal strength. The attacker sends a perfectly-formed but malicious packet that exploits a software flaw, such as a buffer overflow, overwriting adjacent memory to execute the attacker's code.",
  },
  {
    key: "sensor",
    name: "Sensor Spoofing",
    desc:
      "Uses external physical stimuli (lasers, acoustic waves, magnetic fields) to confuse non-GNSS sensors like IMUs, LiDAR, magnetometers, or optical flow cameras. " +
      "Defenses: Robust sensor fusion algorithms (e.g., Extended Kalman Filters), physical sensor shielding, and anomaly detection.",
    deepDesc:
      "This attack targets the drone's 'senses' directly. An IMU's tiny vibrating structures can be disrupted by precisely-timed acoustic waves. The primary defense is sensor fusion — the flight controller's algorithm constantly compares data from all sensors and can 'vote' to reject faulty data.",
  },
  {
    key: "injection",
    name: "Data Injection Attacks",
    desc:
      "A subtle 'low and slow' attack that corrupts high-precision correction streams (like RTK or DGPS) to cause a slow, controlled, and imperceptible drift in navigation. " +
      "Defenses: Cryptographic signing and authentication of all correction data streams, and cross-validation between multiple independent base stations.",
    deepDesc:
      "This advanced attack targets high-precision drones that rely on Real-Time Kinematic (RTK) or Differential GPS (DGPS) for centimeter-level accuracy. An attacker intercepts the correction stream and injects slightly modified packets. The only robust defense is cryptographic signing by a trusted source.",
  },
];

/* ── Stagger animation hook ── */
function useStaggerAnimation(ref, selector) {
  useEffect(() => {
    if (!ref.current) return;
    const elements = ref.current.querySelectorAll(selector);
    gsap.fromTo(
      elements,
      { opacity: 0, y: 40, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
        delay: 0.3,
      }
    );
  }, []);
}

export default function Landing() {
  const nav = useNavigate();
  const [selKey, setSelKey] = useState(SPOOFING[0].key);
  const selected = useMemo(() => SPOOFING.find((s) => s.key === selKey), [selKey]);
  const cardsRef = useRef(null);

  useStaggerAnimation(cardsRef, ".glass-card");

  return (
    <div className="landing">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-tag">
              <span>⬡</span> RESEARCH PLATFORM v2.0
            </div>
            <h1 className="hero-title">
              Cyber-Physical <span className="accent">Defense</span> Dashboard
            </h1>
            <p className="hero-sub">
              Research-grade visualization of UAV spoofing attack vectors,
              Delayed Kalman Filter vulnerabilities, and False Data Injection
              countermeasures for autonomous drone navigation systems.
            </p>

            <div className="hero-controls">
              <label className="select-label" htmlFor="spoofing-type">
                ATTACK VECTOR
              </label>
              <select
                id="spoofing-type"
                className="select"
                value={selKey}
                onChange={(e) => setSelKey(e.target.value)}
              >
                {SPOOFING.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={() => nav("/simulate")}>
                ▶ LAUNCH SIMULATION
              </button>
            </div>
          </div>

          <div className="hero-3d">
            <HeroScene />
          </div>
        </div>
      </section>

      {/* ── Research Statistics ── */}
      <section className="stats-section" ref={cardsRef}>
        <GlassCard className="stat-card" delay={0}>
          <span className="stat-value">
            <AnimatedCounter end={0.332} suffix="m" decimals={3} />
          </span>
          <span className="stat-label">Critical Miss Distance</span>
        </GlassCard>
        <GlassCard className="stat-card" delay={0.1}>
          <span className="stat-value">
            <AnimatedCounter end={100} suffix="ms" decimals={0} />
          </span>
          <span className="stat-label">Latency Window</span>
        </GlassCard>
        <GlassCard className="stat-card" delay={0.2}>
          <span className="stat-value">
            <AnimatedCounter end={97.8} suffix="%" decimals={1} />
          </span>
          <span className="stat-label">Spoofing Success Rate</span>
        </GlassCard>
        <GlassCard className="stat-card" delay={0.3}>
          <span className="stat-value">
            <AnimatedCounter end={5} decimals={0} />
          </span>
          <span className="stat-label">Attack Vectors Simulated</span>
        </GlassCard>
      </section>

      {/* ── Research Description ── */}
      <GlassCard>
        <h2 className="info-title" style={{ fontSize: '18px' }}>
          Vulnerabilities of Delayed Kalman Filters (DKF) to False Data Injection
        </h2>
        <p className="info-text">
          Modern autonomous drones rely on a <strong>Delayed Kalman Filter (DKF)</strong> to fuse 
          high-rate inertial measurements (IMU at 200–400Hz) with delayed visual-inertial odometry 
          (VIO at 15–30Hz). This temporal mismatch creates a <em>prediction horizon</em> — a window 
          where the filter must propagate state estimates using only IMU data. Our research demonstrates 
          that an attacker who can inject false data into the delayed visual channel can exploit this 
          horizon to craft attack vectors that remain within the filter's chi-squared acceptance 
          region, effectively bypassing the built-in anomaly detection while causing controlled 
          trajectory divergence.
        </p>
        <div className="info-meta" style={{ marginTop: '16px' }}>
          <span className="tag">RESEARCH PAPER</span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span className="muted">
            Contributors: Yug Baid, Zenith Gupta, Arpit Kumar, Lovenish, Yuvraj Singh
          </span>
        </div>
      </GlassCard>

      {/* ── Attack Info Grid ── */}
      <div className="info-grid">
        <GlassCard>
          <h3 className="info-title">{selected?.name}</h3>
          <p className="info-text">{selected?.desc}</p>
          <div className="info-meta">
            <span className="tag">ATTACK VECTOR</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span className="muted">See the Research page for in-depth analysis</span>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="info-title">Technical Deep Dive</h3>
          <p className="info-text">{selected?.deepDesc}</p>
          <div className="info-meta" style={{ marginTop: "16px" }}>
            <span className="tag">CONTRIBUTORS</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span className="muted">
              Yug Baid, Zenith Gupta, Arpit Kumar, Lovenish, Yuvraj Singh
            </span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}