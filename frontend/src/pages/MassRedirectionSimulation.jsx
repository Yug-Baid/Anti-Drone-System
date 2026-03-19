import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import InfoPanel from "../components/InfoPanel.jsx";
import WireframeDrone from "../components/WireframeDrone.jsx";

/* ═══════════════════════════════════════════════════
   SIMULATION LOGIC (100% preserved from original)
   ═══════════════════════════════════════════════════ */

const AttackPhase = {
  INACTIVE: "INACTIVE",
  NORMAL_FLIGHT: "NORMAL_FLIGHT",
  REDIRECTING: "REDIRECTING",
  SECURED: "SECURED",
};

const DroneStatus = {
  NORMAL: "NORMAL",
  REDIRECTED: "REDIRECTED",
  SAFE: "SAFE",
};

const SIMULATION_SPEED = 50;
const DRONE_SPEED = 1.5;
const DRONE_SIZE_OFFSET = 14;

const createDrone = (id, world) => {
  const y = Math.random() * world.height;
  const x = Math.random() * 100;
  return { id, x, y, status: DroneStatus.NORMAL, path: [{ x, y }], navTarget: null };
};

function isPathBlocked(from, to, circle) {
  const f = { x: from.x + DRONE_SIZE_OFFSET, y: from.y + DRONE_SIZE_OFFSET };
  const t = { x: to.x, y: to.y };
  const c = { x: circle.x, y: circle.y };
  const r = circle.radius + 15;
  const a = (t.x - f.x) ** 2 + (t.y - f.y) ** 2;
  const b = 2 * ((t.x - f.x) * (f.x - c.x) + (t.y - f.y) * (f.y - c.y));
  const cc = (f.x - c.x) ** 2 + (f.y - c.y) ** 2 - r * r;
  let det = b * b - 4 * a * cc;
  if (det < 0) return false;
  det = Math.sqrt(det);
  const t1 = (-b - det) / (2 * a);
  const t2 = (-b + det) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

/* ═══════════════════════════════════════════════════
   3D SCENE COMPONENTS
   ═══════════════════════════════════════════════════ */

// Coordinate transform: 2D sim (1000×650, origin top-left) → 3D centered
const SCALE = 0.02; // 1000px → 20 units
const toWorld = (x, y) => [(x - 500) * SCALE, 0, (y - 325) * SCALE];

/* ── Ground Plane with Grid ── */
function GroundPlane() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[22, 15]} />
        <meshBasicMaterial color="#060a14" transparent opacity={0.6} />
      </mesh>
      <gridHelper args={[22, 44, "#0a1530", "#0a1530"]} position={[0, -0.04, 0]} />
      {/* World boundary wireframe */}
      <lineSegments position={[0, 0.5, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(20, 1, 13)]} />
        <lineBasicMaterial color="#00f2ff" transparent opacity={0.06} />
      </lineSegments>
    </group>
  );
}

/* ── Zone (Target or Safe) ── */
function Zone3D({ x, y, size, label, color, pulse = false }) {
  const ref = useRef();
  const [pos] = useState(() => toWorld(x, y));
  const radius = (size / 2) * SCALE;

  useFrame(({ clock }) => {
    if (ref.current && pulse) {
      const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.05;
      ref.current.scale.set(s, 1, s);
    }
  });

  return (
    <group ref={ref} position={pos}>
      {/* Glowing cylinder */}
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.15, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>
      {/* Edge ring */}
      <mesh rotation={[0, 0, 0]} position={[0, 0.08, 0]}>
        <torusGeometry args={[radius, 0.02, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      {/* Label */}
      <Text
        position={[0, 0.4, 0]}
        fontSize={0.22}
        color={color}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {label}
      </Text>
    </group>
  );
}

/* ── Anti-Drone Tower ── */
function Tower3D({ tower }) {
  const [pos] = useState(() => toWorld(tower.x, tower.y));
  const innerR = tower.radius * SCALE;
  const outerR = tower.detectionFenceRadius * SCALE;
  const ringRef = useRef();
  const fenceRef = useRef();

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.03;
      ringRef.current.scale.set(s, 1, s);
    }
    if (fenceRef.current) {
      fenceRef.current.rotation.y = clock.elapsedTime * 0.15;
    }
  });

  return (
    <group position={pos}>
      {/* Tower body — base */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.08, 0.15, 0.6, 6]} />
        <meshBasicMaterial color="#00f2ff" wireframe />
      </mesh>
      {/* Tower top — cone */}
      <mesh position={[0, 0.7, 0]}>
        <coneGeometry args={[0.2, 0.3, 6]} />
        <meshBasicMaterial color="#00f2ff" wireframe />
      </mesh>
      {/* Antenna */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 4]} />
        <meshBasicMaterial color="#00f2ff" transparent opacity={0.8} />
      </mesh>
      {/* Antenna tip glow */}
      <mesh position={[0, 1.08, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#00f2ff" transparent opacity={0.9} />
      </mesh>

      {/* Inner radius ring */}
      <group ref={ringRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[innerR - 0.02, innerR, 48]} />
          <meshBasicMaterial color="#00f2ff" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Outer detection fence — wireframe cylinder */}
      <group ref={fenceRef}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[outerR, outerR, 1, 24]} />
          <meshBasicMaterial color="#00f2ff" wireframe transparent opacity={0.07} />
        </mesh>
      </group>

      {/* Label */}
      <Text position={[0, 1.3, 0]} fontSize={0.18} color="#00f2ff" anchorX="center">
        ANTI-DRONE C2
      </Text>
    </group>
  );
}

/* ── Single 3D Drone Entity ── */
function Drone3D({ drone }) {
  const ref = useRef();
  const targetPos = useMemo(() => toWorld(drone.x, drone.y), [drone.x, drone.y]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    // Smooth interpolation to target position
    ref.current.position.x += (targetPos[0] - ref.current.position.x) * Math.min(1, delta * 12);
    ref.current.position.z += (targetPos[2] - ref.current.position.z) * Math.min(1, delta * 12);
    // Bobbing
    ref.current.position.y = 0.3 + Math.sin(Date.now() * 0.003 + drone.id * 1.5) * 0.05;
  });

  const color =
    drone.status === DroneStatus.NORMAL
      ? "#ff3344"
      : drone.status === DroneStatus.REDIRECTED
      ? "#ffaa00"
      : "#00ff88";

  return (
    <group ref={ref} position={[targetPos[0], 0.3, targetPos[2]]}>
      <WireframeDrone scale={0.35} color={color} spinning={drone.status !== DroneStatus.SAFE} />
      {/* ID label */}
      <Text position={[0, 0.35, 0]} fontSize={0.12} color={color} anchorX="center">
        {`T-${drone.id}`}
      </Text>
    </group>
  );
}

/* ── Drone Path Lines ── */
function DronePaths({ drones }) {
  return (
    <group>
      {drones.map((drone) => {
        if (drone.path.length < 2) return null;
        const pts = drone.path.map((p) => toWorld(p.x + DRONE_SIZE_OFFSET, p.y + DRONE_SIZE_OFFSET));
        const color =
          drone.status === DroneStatus.NORMAL
            ? "#ff3344"
            : drone.status === DroneStatus.REDIRECTED
            ? "#ffaa00"
            : "#00ff88";
        return (
          <Line
            key={drone.id}
            points={pts}
            color={color}
            lineWidth={1.5}
            transparent
            opacity={0.5}
          />
        );
      })}
    </group>
  );
}

/* ── Final Position Footprints ── */
function Footprints3D({ positions }) {
  return (
    <group>
      {positions.map((pos) => {
        const [px, , pz] = toWorld(pos.x + DRONE_SIZE_OFFSET, pos.y + DRONE_SIZE_OFFSET);
        return (
          <mesh key={pos.id} position={[px, 0.05, pz]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshBasicMaterial color="#00ff88" transparent opacity={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Complete 3D Scene ── */
function SimulationScene({ drones, antiDroneTower, targetZone, safeZone, finalPositions }) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 8, 5]} intensity={0.4} color="#00f2ff" />
      <OrbitControls
        enablePan
        maxPolarAngle={Math.PI / 2.2}
        minDistance={4}
        maxDistance={25}
        target={[0, 0, 0]}
      />

      <GroundPlane />

      {/* Zones */}
      <Zone3D
        x={targetZone.x}
        y={targetZone.y}
        size={targetZone.size}
        label="TARGET"
        color="#ff3344"
        pulse
      />
      <Zone3D
        x={safeZone.x}
        y={safeZone.y}
        size={safeZone.size}
        label="SAFE ZONE"
        color="#00ff88"
      />

      {/* Tower */}
      <Tower3D tower={antiDroneTower} />

      {/* Drones */}
      {drones.map((drone) => (
        <Drone3D key={drone.id} drone={drone} />
      ))}

      {/* Paths */}
      <DronePaths drones={drones} />

      {/* Footprints */}
      <Footprints3D positions={finalPositions} />

      {/* Orientation Helper */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.8} />
      </GizmoHelper>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT (simulation logic preserved exactly)
   ═══════════════════════════════════════════════════ */

export default function MassRedirectionSimulation() {
  const world = { width: 1000, height: 650 };

  // --- ENTITIES ---
  const [drones, setDrones] = useState([]);
  const [droneCount, setDroneCount] = useState(10);
  const [antiDroneTower] = useState({
    x: 500,
    y: 325,
    radius: 150,
    detectionFenceRadius: 300,
  });
  const [targetZone] = useState({ x: 850, y: 325, size: 100 });
  const [safeZone] = useState({ x: 500, y: 600, size: 120 });

  // --- Navigation waypoints ---
  const navNodes = [
    { x: antiDroneTower.x - antiDroneTower.radius - 50, y: antiDroneTower.y },
    { x: antiDroneTower.x + antiDroneTower.radius + 50, y: antiDroneTower.y },
  ];
  const safeZoneTarget = { x: safeZone.x, y: safeZone.y };

  // --- SIMULATION STATE ---
  const [attackPhase, setAttackPhase] = useState(AttackPhase.INACTIVE);
  const [status, setStatus] = useState("Adjust drone count and press 'Activate System' to begin.");
  const [digitalFootprints, setDigitalFootprints] = useState([]);
  const [finalPositions, setFinalPositions] = useState([]);

  const simulationRef = useRef(null);

  const formatCoords = (x, y) => `(${Math.round(x)}, ${Math.round(y)})`;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const addFootprint = useCallback((type, message) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    setDigitalFootprints((prev) => [...prev, { type, message, timestamp }]);
  }, []);

  const moveTowards = (from, to, speed) => {
    const d = dist(from, to);
    if (d < speed) return to;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return { x: from.x + (dx / d) * speed, y: from.y + (dy / d) * speed };
  };

  // --- SIMULATION CONTROLS ---
  const initializeDrones = () => {
    if (attackPhase !== AttackPhase.INACTIVE) return;
    setDigitalFootprints([]);
    setFinalPositions([]);
    addFootprint("AUTH", `System armed. Preparing for ${droneCount} potential targets.`);
    const newDrones = [];
    for (let i = 0; i < droneCount; i++) {
      newDrones.push(createDrone(i, world));
    }
    setDrones(newDrones);
    setStatus("Drones initialized. Press 'Activate System' to start redirection.");
  };

  useEffect(() => {
    if (attackPhase === AttackPhase.INACTIVE) {
      initializeDrones();
    }
  }, [droneCount, attackPhase]);

  const startSimulation = () => {
    if (attackPhase !== AttackPhase.INACTIVE) return;
    initializeDrones();
    setAttackPhase(AttackPhase.NORMAL_FLIGHT);
    setStatus("Phase 1: Hostile drones are en route to the target zone.");
    addFootprint("WARN", `${droneCount} drones detected, proceeding to target.`);
    simulationRef.current = setInterval(runSimulationTick, SIMULATION_SPEED);
  };

  const resetSimulation = () => {
    clearInterval(simulationRef.current);
    setAttackPhase(AttackPhase.INACTIVE);
    setDrones([]);
    setDigitalFootprints([]);
    setFinalPositions([]);
    setStatus("System reset. Adjust drone count and press 'Activate System' to begin.");
  };

  useEffect(() => {
    return () => clearInterval(simulationRef.current);
  }, []);

  // --- MAIN SIMULATION TICK (100% preserved) ---
  const runSimulationTick = () => {
    let nextPhase = attackPhase;
    let allSecured = true;
    let newDronesList = [];

    setDrones((prevDrones) => {
      newDronesList = prevDrones.map((drone) => {
        let newPos = { x: drone.x, y: drone.y };
        let newStatus = drone.status;
        let newNavTarget = drone.navTarget;

        if (drone.status === DroneStatus.NORMAL) {
          allSecured = false;
          const distanceToTower = dist(drone, antiDroneTower);
          if (distanceToTower <= antiDroneTower.detectionFenceRadius) {
            newStatus = DroneStatus.REDIRECTED;
            if (attackPhase !== AttackPhase.REDIRECTING) {
              nextPhase = AttackPhase.REDIRECTING;
            }
            if (drone.status !== DroneStatus.REDIRECTED) {
              addFootprint("ATTACK", `Target ${drone.id}: Hostile intent detected at fence. Rerouting to safe zone.`);
              if (isPathBlocked(drone, safeZoneTarget, antiDroneTower)) {
                const distToNode0 = dist(drone, navNodes[0]);
                const distToNode1 = dist(drone, navNodes[1]);
                newNavTarget = distToNode0 < distToNode1 ? navNodes[0] : navNodes[1];
                addFootprint("AUTH", `Target ${drone.id}: Path blocked. Rerouting via NavNode.`);
              } else {
                newNavTarget = safeZoneTarget;
              }
            }
          }
        }

        let target;
        if (newStatus === DroneStatus.NORMAL) {
          target = { x: targetZone.x, y: targetZone.y };
        } else {
          target = newNavTarget || safeZoneTarget;
        }

        newPos = moveTowards(drone, target, DRONE_SPEED);

        if (newStatus === DroneStatus.REDIRECTED && newNavTarget && newNavTarget !== safeZoneTarget) {
          if (dist(newPos, newNavTarget) < DRONE_SPEED * 2) {
            newNavTarget = safeZoneTarget;
          }
        }

        if (newStatus === DroneStatus.REDIRECTED) {
          allSecured = false;
          const distanceToSafe = dist(newPos, safeZoneTarget);
          if (distanceToSafe < safeZone.size / 2) {
            newStatus = DroneStatus.SAFE;
            addFootprint("SPOOF", `Target ${drone.id} has been secured in the safe zone.`);
          }
        }

        return {
          ...drone,
          x: newPos.x,
          y: newPos.y,
          status: newStatus,
          path: [...drone.path, newPos],
          navTarget: newNavTarget,
        };
      });
      return newDronesList;
    });

    if (nextPhase === AttackPhase.REDIRECTING && attackPhase !== AttackPhase.REDIRECTING) {
      setAttackPhase(AttackPhase.REDIRECTING);
      setStatus("Phase 2: Anti-drone system activated. Redirecting all hostile targets at the fence.");
    }

    if (allSecured && attackPhase !== AttackPhase.INACTIVE) {
      setAttackPhase(AttackPhase.SECURED);
      setStatus("Phase 3: All hostile drones have been successfully neutralized in the safe zone.");
      addFootprint("AUTH", `All ${droneCount} threats secured. System standing by.`);
      clearInterval(simulationRef.current);
      setFinalPositions(newDronesList.map((d) => ({ id: d.id, x: d.x, y: d.y, status: "safe" })));
    }
  };

  /* ═══════════════════════════════════════════════════
     RENDER — R3F Canvas + DOM Overlay
     ═══════════════════════════════════════════════════ */

  return (
    <div className="gnss-layout">
      <div className="stage-card large">
        <div className="stage-head">
          <div className="title">🛡️ MASS REDIRECTION — 3D SIMULATION</div>
          <div className="playback-controls">
            <div className="slider-control">
              <label htmlFor="droneCount">Targets: {droneCount}</label>
              <input
                type="range"
                id="droneCount"
                min="1"
                max="20"
                value={droneCount}
                onChange={(e) => setDroneCount(Number(e.target.value))}
                disabled={attackPhase !== AttackPhase.INACTIVE}
              />
            </div>
            <button
              onClick={startSimulation}
              className="control-button"
              disabled={attackPhase !== AttackPhase.INACTIVE}
            >
              ▶ Activate System
            </button>
            <button onClick={resetSimulation} className="control-button reset">
              ↻ Reset
            </button>
          </div>
        </div>

        {/* 3D Canvas replaces the old div.world */}
        <div
          className="sim-canvas-container"
          style={{ height: "600px", borderRadius: "var(--radius)", overflow: "hidden" }}
        >
          <Canvas
            camera={{ position: [0, 10, 12], fov: 50 }}
            style={{ width: "100%", height: "100%" }}
            gl={{ antialias: true }}
          >
            <Suspense fallback={null}>
              <SimulationScene
                drones={drones}
                antiDroneTower={antiDroneTower}
                targetZone={targetZone}
                safeZone={safeZone}
                finalPositions={finalPositions}
              />
            </Suspense>
          </Canvas>
        </div>
      </div>

      {/* InfoPanel remains as DOM overlay */}
      <InfoPanel
        attackPhase={attackPhase}
        status={status}
        digitalFootprints={digitalFootprints}
      />
    </div>
  );
}