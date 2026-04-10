import React, { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import Dashboard from "../components/Dashboard.jsx";
import WireframeDrone from "../components/WireframeDrone.jsx";
import useSirenSound from "../hooks/useSirenSound.js";

/* ═══════════════════════════════════════════
   COORDINATE SYSTEM
   2D sim: 720×520, origin top-left
   3D: centered, Y-up
   ═══════════════════════════════════════════ */
const SCALE = 0.025;
const toWorld = (x, y) => [(x - 360) * SCALE, 0, (y - 260) * SCALE];

/* ── Ground Plane ── */
function GroundPlane() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[20, 15]} />
        <meshBasicMaterial color="#060a14" transparent opacity={0.6} />
      </mesh>
      <gridHelper args={[20, 40, "#0a1530", "#0a1530"]} position={[0, -0.04, 0]} />
      <lineSegments position={[0, 0.5, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(18, 1, 13)]} />
        <lineBasicMaterial color="#00f2ff" transparent opacity={0.06} />
      </lineSegments>
    </group>
  );
}

/* ── Zone (Danger / Safe) ── */
function Zone3D({ x, y, radius, label, color, pulse = false }) {
  const ref = useRef();
  const [pos] = useState(() => toWorld(x, y));
  const r = radius * SCALE;

  useFrame(({ clock }) => {
    if (ref.current && pulse) {
      const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.06;
      ref.current.scale.set(s, 1, s);
    }
  });

  return (
    <group ref={ref} position={pos}>
      <mesh>
        <cylinderGeometry args={[r, r, 0.15, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <torusGeometry args={[r, 0.02, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <Text position={[0, 0.4, 0]} fontSize={0.22} color={color} anchorX="center">
        {label}
      </Text>
    </group>
  );
}

/* ── Warning Ring ── */
function WarningRing({ x, y, innerRadius, outerRadius }) {
  const [pos] = useState(() => toWorld(x, y));
  const innerR = innerRadius * SCALE;
  const outerR = outerRadius * SCALE;

  return (
    <group position={[pos[0], 0.02, pos[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerR, outerR, 48]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[outerR - 0.02, outerR, 48]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── Interactive Drone ── */
function InteractiveDrone({ x, y, spoofed, destroyed, color }) {
  const ref = useRef();
  const targetPos = useMemo(() => toWorld(x, y), [x, y]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x += (targetPos[0] - ref.current.position.x) * Math.min(1, delta * 12);
    ref.current.position.z += (targetPos[2] - ref.current.position.z) * Math.min(1, delta * 12);

    if (spoofed && !destroyed) {
      ref.current.position.x += (Math.random() - 0.5) * 0.02;
      ref.current.position.z += (Math.random() - 0.5) * 0.02;
    }

    ref.current.position.y = destroyed ? Math.max(ref.current.position.y - delta * 2, 0) : 0.3 + Math.sin(Date.now() * 0.003) * 0.04;
  });

  const droneColor = destroyed ? "#ff3344" : spoofed ? "#ffaa00" : color;

  return (
    <group ref={ref} position={[targetPos[0], 0.3, targetPos[2]]}>
      {!destroyed && <WireframeDrone scale={0.6} color={droneColor} spinning={!destroyed} />}
      {destroyed && (
        <mesh>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshBasicMaterial color="#ff3344" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

/* ── Destruction FX ── */
function DestructionFX({ active, x, y }) {
  const ref = useRef();
  const [pos] = useState(() => toWorld(x, y));
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (active) startTime.current = Date.now();
  }, [active]);

  useFrame(() => {
    if (!ref.current || !active) return;
    const elapsed = (Date.now() - startTime.current) / 1000;
    const s = Math.min(elapsed * 3, 2);
    ref.current.scale.set(s, s, s);
    ref.current.children.forEach(child => {
      if (child.material) {
        child.material.opacity = Math.max(0, 1 - elapsed * 0.8);
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={ref} position={[pos[0], 0.3, pos[2]]}>
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#ff6b6b" transparent opacity={1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshBasicMaterial color="#00f2ff" wireframe transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/* ── Siren Banner Overlay (DOM) ── */
function SirenBanner({ warning, spoofed, destroyed }) {
  if (!warning || spoofed || destroyed) return null;
  return (
    <div className="siren-banner" role="alert" aria-live="assertive" style={{
      position: 'absolute', right: 16, top: 16, zIndex: 20
    }}>
      <div className="siren-icon" />
      <span>Approaching restricted airspace</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT (all game logic preserved)
   ═══════════════════════════════════════════ */
export default function DroneSimulation() {
  const world = { width: 720, height: 520 };

  const danger = { x: 420, y: 200, radius: 70 };
  const safe   = { x: 100, y: 380, radius: 48 };

  const warningBuffer = 90;
  const warningRadius = danger.radius + warningBuffer;

  const [drone, setDrone] = useState({ x: 40, y: 40, width: 28, height: 28 });
  const [speed] = useState(10);
  const [spoofed, setSpoofed] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [warning, setWarning] = useState(false);
  const [destroyed, setDestroyed] = useState(false);
  const [status, setStatus] = useState("Use arrow keys or WASD to move the drone.");

  const moveRef = useRef(null);
  const lastWarnRef = useRef(false);

  // --- SIREN SOUND ---
  const siren = useSirenSound();

  // utils
  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
  const centerOf = (d) => ({ x: d.x + d.width / 2, y: d.y + d.height / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleOf = (C, P) => Math.atan2(P.y - C.y, P.x - C.x);
  const pointOnCircle = (C, r, ang) => ({ x: C.x + r * Math.cos(ang), y: C.y + r * Math.sin(ang) });

  const insideDanger = (pt) => dist(pt, { x: danger.x, y: danger.y }) <= danger.radius;
  const insideWarningOnly = (pt) => {
    const d = dist(pt, { x: danger.x, y: danger.y });
    return d > danger.radius && d <= warningRadius;
  };
  const insideSafe = (pt) => dist(pt, { x: safe.x, y: safe.y }) <= safe.radius;

  function segHitsCircle(A, B, C, r) {
    const vx = B.x - A.x, vy = B.y - A.y;
    const wx = C.x - A.x, wy = C.y - A.y;
    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    const t = c2 === 0 ? 0 : c1 / c2;
    const tt = Math.max(0, Math.min(1, t));
    const Closest = { x: A.x + vx * tt, y: A.y + vy * tt };
    return dist(Closest, C) <= r - 0.0001;
  }

  function animateTo(targetTL, step = 6, onStep, onDone) {
    if (typeof onStep !== "function") onStep = () => {};
    if (typeof onDone !== "function") onDone = () => {};
    clearInterval(moveRef.current);
    moveRef.current = setInterval(() => {
      setDrone((prev) => {
        const dx = targetTL.x - prev.x;
        const dy = targetTL.y - prev.y;
        const d = Math.hypot(dx, dy);
        if (d <= step) {
          clearInterval(moveRef.current);
          onStep(targetTL);
          onDone();
          return { ...prev, x: targetTL.x, y: targetTL.y };
        }
        const nx = prev.x + (dx / d) * step;
        const ny = prev.y + (dy / d) * step;
        onStep({ x: nx, y: ny });
        return { ...prev, x: nx, y: ny };
      });
    }, 16);
  }

  function buildArcThenSafePath(exitCenter, C, r, S, rs, droneWH) {
    const bufferR = r + 10;
    const a0 = angleOf(C, exitCenter);
    const aTarget = angleOf(C, S);

    let delta = aTarget - a0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    const stepLen = 12;
    const arcLen = Math.abs(delta) * bufferR;
    const steps = Math.max(8, Math.ceil(arcLen / stepLen));

    const pointsTL = [];
    let lastAng = a0;

    for (let i = 1; i <= steps; i++) {
      const ang = a0 + (i / steps) * delta;
      const p = pointOnCircle(C, bufferR, ang);
      pointsTL.push({ x: p.x - droneWH.w / 2, y: p.y - droneWH.h / 2 });
      lastAng = ang;
    }

    const lastArcCenter = pointsTL.length
      ? { x: pointsTL[pointsTL.length - 1].x + droneWH.w / 2, y: pointsTL[pointsTL.length - 1].y + droneWH.h / 2 }
      : exitCenter;

    const safeEdgeFrom = (P) => {
      const dir = { x: P.x - S.x, y: P.y - S.y };
      const d = Math.hypot(dir.x, dir.y) || 1;
      return { x: S.x + (dir.x / d) * rs, y: S.y + (dir.y / d) * rs };
    };

    let edge = safeEdgeFrom(lastArcCenter);
    let attempts = 0;
    while (segHitsCircle(lastArcCenter, edge, C, r) && attempts < 24) {
      const bump = (delta >= 0 ? 1 : -1) * (Math.PI / 36);
      lastAng += bump;
      const p = pointOnCircle(C, bufferR, lastAng);
      pointsTL.push({ x: p.x - droneWH.w / 2, y: p.y - droneWH.h / 2 });
      const newCenter = { x: p.x, y: p.y };
      edge = safeEdgeFrom(newCenter);
      attempts++;
    }

    const edgeTL = { x: edge.x - droneWH.w / 2, y: edge.y - droneWH.h / 2 };
    const centerTL = { x: S.x - droneWH.w / 2, y: S.y - droneWH.h / 2 };

    pointsTL.push(edgeTL);
    pointsTL.push(centerTL);

    return pointsTL;
  }

  const triggerDestruction = () => {
    clearInterval(moveRef.current);
    setDestroyed(true);
    setStatus("🛡️ Drone neutralized by defense system.");
    siren.stop();
    setTimeout(() => {
      setDrone({ x: 40, y: 40, width: 28, height: 28 });
      setSpoofed(false);
      setRedirecting(false);
      setWarning(false);
      setDestroyed(false);
      setStatus("Use arrow keys or WASD to move the drone.");
    }, 1400);
  };

  const startSpoofSequence = (currentCenter) => {
    setSpoofed(true);
    setStatus("🚨 Spoof detected — moving out of danger zone...");
    siren.play();

    const C = { x: danger.x, y: danger.y };
    const v = { x: currentCenter.x - C.x, y: currentCenter.y - C.y };
    const d0 = Math.hypot(v.x, v.y) || 1;
    const outward = { x: v.x / d0, y: v.y / d0 };

    const exitCenter = {
      x: C.x + outward.x * (danger.radius + 10),
      y: C.y + outward.y * (danger.radius + 10),
    };
    const exitTL = { x: exitCenter.x - drone.width / 2, y: exitCenter.y - drone.height / 2 };

    const S = { x: safe.x, y: safe.y };
    const pathTL = buildArcThenSafePath(exitCenter, C, danger.radius, S, safe.radius, {
      w: drone.width, h: drone.height,
    });

    const sequence = [exitTL, ...pathTL];
    let i = 0;

    const stepNext = () => {
      if (i >= sequence.length) {
        triggerDestruction();
        return;
      }
      const target = sequence[i++];
      setRedirecting(true);
      animateTo(target, 6, undefined, stepNext);
    };

    animateTo(exitTL, 6, undefined, stepNext);
  };

  // keyboard control + warning ring
  useEffect(() => {
    const handler = (e) => {
      if (spoofed || destroyed) return;
      const k = e.key.toLowerCase();
      let dx = 0, dy = 0;
      if (k === "arrowup" || k === "w") dy = -speed;
      if (k === "arrowdown" || k === "s") dy = speed;
      if (k === "arrowleft" || k === "a") dx = -speed;
      if (k === "arrowright" || k === "d") dx = speed;
      if (dx === 0 && dy === 0) return;

      setDrone((prev) => {
        const nx = clamp(prev.x + dx, 0, world.width - prev.width);
        const ny = clamp(prev.y + dy, 0, world.height - prev.height);
        const centerPt = { x: nx + prev.width / 2, y: ny + prev.height / 2 };

        const warn = insideWarningOnly(centerPt);
        setWarning(warn);
        if (warn && !lastWarnRef.current) {
          setStatus("⚠️ Approaching restricted airspace...");
          lastWarnRef.current = true;
        }
        if (!warn && lastWarnRef.current) {
          if (!spoofed) setStatus("Use arrow keys or WASD to move the drone.");
          lastWarnRef.current = false;
        }

        if (insideDanger(centerPt)) {
          startSpoofSequence(centerPt);
          return { ...prev };
        }

        if (insideSafe(centerPt)) {
          triggerDestruction();
          return { ...prev, x: nx, y: ny };
        }

        return { ...prev, x: nx, y: ny };
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [spoofed, destroyed, speed]);

  // cleanup
  useEffect(() => () => {
    clearInterval(moveRef.current);
    siren.stop();
  }, []);

  // derived flags for dashboard
  const droneCenter = centerOf(drone);
  const inDanger = insideDanger(droneCenter);
  const inSafe = insideSafe(droneCenter);

  return (
    <div className="layout">
      <div className="stage-card">
        <div className="stage-head">
          <div className="title">🎮 3D SIMULATION</div>
          <div className={`badge ${spoofed ? "bad" : destroyed ? "bad" : warning ? "bad" : "good"}`}>
            {spoofed ? "SPOOFED" : destroyed ? "NEUTRALIZED" : warning ? "WARNING" : "LIVE"}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div className="sim-canvas-container" style={{ height: "520px", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <Canvas camera={{ position: [0, 10, 10], fov: 50 }} style={{ width: "100%", height: "100%" }} gl={{ antialias: true }}>
              <Suspense fallback={null}>
                <ambientLight intensity={0.25} />
                <pointLight position={[5, 8, 5]} intensity={0.4} color="#00f2ff" />
                <OrbitControls enablePan maxPolarAngle={Math.PI / 2.2} minDistance={4} maxDistance={20} />

                <GroundPlane />

                {/* Danger Zone */}
                <Zone3D x={danger.x} y={danger.y} radius={danger.radius} label="DANGER" color="#ff3344" pulse />
                {/* Safe Zone */}
                <Zone3D x={safe.x} y={safe.y} radius={safe.radius} label="SAFE" color="#00ff88" />
                {/* Warning Ring */}
                <WarningRing x={danger.x} y={danger.y} innerRadius={danger.radius} outerRadius={warningRadius} />

                {/* Drone */}
                <InteractiveDrone
                  x={drone.x + drone.width / 2}
                  y={drone.y + drone.height / 2}
                  spoofed={spoofed}
                  destroyed={destroyed}
                  color="#00f2ff"
                />

                {/* Destruction FX */}
                <DestructionFX active={destroyed} x={safe.x} y={safe.y} />
              </Suspense>
            </Canvas>
          </div>

          {/* Status Toast */}
          <div className="toast" aria-live="polite" style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 10 }}>
            {status}
          </div>

          {/* Siren Banner */}
          <SirenBanner warning={warning} spoofed={spoofed} destroyed={destroyed} />
        </div>
      </div>

      <Dashboard
        state={{
          x: drone.x,
          y: drone.y,
          width: drone.width,
          height: drone.height,
          speed,
          spoofed,
          redirecting,
          status,
          danger: { x: danger.x, y: danger.y, size: danger.radius * 2 },
          safe:   { x: safe.x,   y: safe.y,   size: safe.radius * 2 },
          inDanger,
          inSafe,
        }}
      />
    </div>
  );
}