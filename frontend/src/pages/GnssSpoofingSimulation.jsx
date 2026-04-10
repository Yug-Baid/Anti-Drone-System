import React, { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import InfoPanel from "../components/InfoPanel.jsx";
import WireframeDrone from "../components/WireframeDrone.jsx";
import useSirenSound from "../hooks/useSirenSound.js";

/* ═══════════════════════════════════════════
   COORDINATE SYSTEM
   2D sim: 1000×650, origin top-left
   3D: centered, Y-up
   ═══════════════════════════════════════════ */
const SCALE = 0.02;
const toWorld = (x, y) => [(x - 500) * SCALE, 0, (y - 325) * SCALE];

/* ── Attack Phases (preserved exactly) ── */
const AttackPhase = {
  INACTIVE: 'INACTIVE',
  NORMAL_FLIGHT: 'NORMAL_FLIGHT',
  JAMMING: 'JAMMING',
  SPOOFING: 'SPOOFING',
  HIJACKED: 'HIJACKED',
  COMPLETED: 'COMPLETED'
};

const DRONE_SIZE_OFFSET = 14;

/* ═══════════════════════════════════════════
   3D SCENE COMPONENTS
   ═══════════════════════════════════════════ */

/* ── Ground Plane with Grid ── */
function GroundPlane() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[22, 15]} />
        <meshBasicMaterial color="#060a14" transparent opacity={0.6} />
      </mesh>
      <gridHelper args={[22, 44, "#0a1530", "#0a1530"]} position={[0, -0.04, 0]} />
      <lineSegments position={[0, 0.5, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(20, 1, 13)]} />
        <lineBasicMaterial color="#00f2ff" transparent opacity={0.06} />
      </lineSegments>
    </group>
  );
}

/* ── 3D Drone Entity ── */
function Drone3D({ x, y, color, ghost = false, label }) {
  const ref = useRef();
  const targetPos = useMemo(() => toWorld(x + DRONE_SIZE_OFFSET, y + DRONE_SIZE_OFFSET), [x, y]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x += (targetPos[0] - ref.current.position.x) * Math.min(1, delta * 10);
    ref.current.position.z += (targetPos[2] - ref.current.position.z) * Math.min(1, delta * 10);
    ref.current.position.y = 0.3 + Math.sin(Date.now() * 0.003) * 0.04;
  });

  return (
    <group ref={ref} position={[targetPos[0], 0.3, targetPos[2]]}>
      <WireframeDrone scale={0.5} color={color} />
      {label && (
        <Text position={[0, 0.45, 0]} fontSize={0.15} color={color} anchorX="center">
          {label}
        </Text>
      )}
    </group>
  );
}

/* ── Target Marker ── */
function TargetMarker({ x, y, label, color }) {
  const [pos] = useState(() => toWorld(x, y));
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.06;
      ref.current.scale.set(s, 1, s);
    }
  });

  return (
    <group ref={ref} position={pos}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <torusGeometry args={[0.5, 0.02, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      <Text position={[0, 0.4, 0]} fontSize={0.2} color={color} anchorX="center">
        {label}
      </Text>
    </group>
  );
}

/* ── Radio Tower (Spoofing Source) ── */
function SpoofingTower({ x, y }) {
  const [pos] = useState(() => toWorld(x, y));
  const ringRef = useRef();

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.04;
      ringRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={pos}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.08, 0.15, 0.7, 6]} />
        <meshBasicMaterial color="#ff3344" wireframe />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <coneGeometry args={[0.22, 0.35, 6]} />
        <meshBasicMaterial color="#ff3344" wireframe />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.25, 4]} />
        <meshBasicMaterial color="#ff3344" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ff3344" transparent opacity={0.9} />
      </mesh>
      <group ref={ringRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.5, 0.52, 48]} />
          <meshBasicMaterial color="#ff3344" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <Text position={[0, 1.5, 0]} fontSize={0.18} color="#ff3344" anchorX="center">
        SPOOFING SOURCE
      </Text>
    </group>
  );
}

/* ── Satellite Source ── */
function SatelliteSource() {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 5 + Math.sin(clock.elapsedTime * 0.5) * 0.3;
    }
  });

  return (
    <group ref={ref} position={[0, 5, -5]}>
      <mesh>
        <boxGeometry args={[0.3, 0.1, 0.3]} />
        <meshBasicMaterial color="#00f2ff" wireframe />
      </mesh>
      {/* Solar panels */}
      <mesh position={[0.35, 0, 0]}>
        <boxGeometry args={[0.4, 0.02, 0.2]} />
        <meshBasicMaterial color="#00f2ff" transparent opacity={0.4} />
      </mesh>
      <mesh position={[-0.35, 0, 0]}>
        <boxGeometry args={[0.4, 0.02, 0.2]} />
        <meshBasicMaterial color="#00f2ff" transparent opacity={0.4} />
      </mesh>
      <Text position={[0, 0.3, 0]} fontSize={0.15} color="#00f2ff" anchorX="center">
        SATELLITES
      </Text>
    </group>
  );
}

/* ── Jamming Sphere ── */
function JammingSphere({ radius, towerPos }) {
  const [pos] = useState(() => toWorld(towerPos.x, towerPos.y));
  const r = radius * SCALE;
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.2;
    }
  });

  if (r <= 0) return null;

  return (
    <group ref={ref} position={pos}>
      <mesh>
        <sphereGeometry args={[r, 16, 16]} />
        <meshBasicMaterial color="#ff3344" wireframe transparent opacity={0.08} />
      </mesh>
      <mesh>
        <sphereGeometry args={[r * 0.97, 8, 8]} />
        <meshBasicMaterial color="#ff3344" transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

/* ── Signal Beam ── */
function SignalBeam({ from, to, color, dashed = false }) {
  const fromPos = useMemo(() => toWorld(from.x + DRONE_SIZE_OFFSET, from.y + DRONE_SIZE_OFFSET), [from.x, from.y]);
  const toPos = useMemo(() => toWorld(to.x, to.y), [to.x, to.y]);

  // Elevate endpoints
  const pts = [
    [fromPos[0], 0.3, fromPos[2]],
    [toPos[0], toPos[1] === undefined ? 0.5 : 0.5, toPos[2]],
  ];

  return (
    <Line
      points={pts}
      color={color}
      lineWidth={2}
      dashed={dashed}
      dashSize={dashed ? 0.1 : undefined}
      gapSize={dashed ? 0.05 : undefined}
      transparent
      opacity={0.7}
    />
  );
}

/* ── Final Position Footprints ── */
function Footprints3D({ positions }) {
  return (
    <group>
      {positions.map((pos) => {
        const [px, , pz] = toWorld(pos.x + DRONE_SIZE_OFFSET, pos.y + DRONE_SIZE_OFFSET);
        const color = pos.status === 'actual' ? '#ff3344' : '#bb88ff';
        return (
          <group key={pos.id}>
            <mesh position={[px, 0.05, pz]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshBasicMaterial color={color} transparent opacity={0.7} />
            </mesh>
            <Text position={[px, 0.3, pz]} fontSize={0.12} color={color} anchorX="center">
              {pos.status === 'actual' ? 'ACTUAL' : 'REPORTED'}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════
   MAIN 3D SCENE
   ═══════════════════════════════════════════ */
function GnssScene({ drone, spoofedDrone, dronePath, radioTower, target, spoofedTarget,
  attackPhase, jammingRadius, finalPositions }) {

  const dronePathPts = useMemo(() => {
    if (dronePath.length < 2) return null;
    return dronePath.map((p) => toWorld(p.x + DRONE_SIZE_OFFSET, p.y + DRONE_SIZE_OFFSET)).map(([x, , z]) => [x, 0.15, z]);
  }, [dronePath]);

  const spoofedPathPts = useMemo(() => {
    if (!spoofedDrone.path || spoofedDrone.path.length < 2) return null;
    return spoofedDrone.path.map((p) => toWorld(p.x + DRONE_SIZE_OFFSET, p.y + DRONE_SIZE_OFFSET)).map(([x, , z]) => [x, 0.1, z]);
  }, [spoofedDrone.path]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 8, 5]} intensity={0.4} color="#00f2ff" />
      <pointLight position={[-3, 5, -3]} intensity={0.2} color="#ff3344" />
      <OrbitControls enablePan maxPolarAngle={Math.PI / 2.2} minDistance={4} maxDistance={25} />

      <GroundPlane />
      <SatelliteSource />

      {/* Targets */}
      <TargetMarker x={target.x} y={target.y} label="TARGET" color="#00ff88" />
      <TargetMarker x={spoofedTarget.x} y={spoofedTarget.y} label="SPOOFED" color="#ff3344" />

      {/* Spoofing Tower */}
      <SpoofingTower x={radioTower.x} y={radioTower.y} />

      {/* Jamming Sphere */}
      <JammingSphere radius={jammingRadius} towerPos={radioTower} />

      {/* Signal beams */}
      {attackPhase === AttackPhase.NORMAL_FLIGHT && (
        <SignalBeam from={drone} to={{ x: 500, y: -200 }} color="#00ff88" dashed />
      )}
      {(attackPhase >= AttackPhase.JAMMING && attackPhase !== AttackPhase.COMPLETED) && (
        <SignalBeam from={drone} to={radioTower} color="#ff3344" />
      )}

      {/* Ghost (Spoofed) Drone */}
      <Drone3D x={spoofedDrone.x} y={spoofedDrone.y} color="#8888bb" ghost label="PERCEIVED" />

      {/* Real Drone */}
      <Drone3D x={drone.x} y={drone.y} color="#00f2ff" label="ACTUAL" />

      {/* Paths */}
      {spoofedPathPts && <Line points={spoofedPathPts} color="#00f2ff" lineWidth={1.5} transparent opacity={0.5} />}
      {dronePathPts && <Line points={dronePathPts} color="#ff3344" lineWidth={2} dashed dashSize={0.08} gapSize={0.04} />}

      {/* Footprints */}
      <Footprints3D positions={finalPositions} />
    </>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT (simulation logic 100% preserved)
   ═══════════════════════════════════════════ */
export default function GnssSpoofingSimulation() {
  const world = { width: 1000, height: 650 };

  // --- ENTITIES ---
  const [drone, setDrone] = useState({ x: 50, y: 325, width: 28, height: 28 });
  const [spoofedDrone, setSpoofedDrone] = useState({ x: 50, y: 325, path: [] });
  const [radioTower] = useState({ x: 500, y: 620 });
  const [target] = useState({ x: 920, y: 80 });
  const [spoofedTarget] = useState({ x: 920, y: 550 });

  // --- SIMULATION STATE ---
  const [attackPhase, setAttackPhase] = useState(AttackPhase.INACTIVE);
  const [status, setStatus] = useState("Start the simulation to begin the GNSS spoofing attack sequence.");
  const [dronePath, setDronePath] = useState([]);
  const [jammingRadius, setJammingRadius] = useState(0);
  const [digitalFootprints, setDigitalFootprints] = useState([]);
  const [finalPositions, setFinalPositions] = useState([]);

  const simulationRef = useRef(null);
  const logCounterRef = useRef(0);
  const latestPositionsRef = useRef({});

  // --- SIREN SOUND ---
  const siren = useSirenSound();

  // --- UTILITY FUNCTIONS ---
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const formatCoords = (x, y) => `(${Math.round(x)}, ${Math.round(y)})`;

  const addFootprint = (type, message) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setDigitalFootprints(prev => [...prev, { type, message, timestamp }]);
  };

  const moveTowards = (from, to, speed) => {
    const d = dist(from, to);
    if (d < speed) return from;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return { ...from, x: from.x + (dx / d) * speed, y: from.y + (dy / d) * speed };
  };

  // --- SIMULATION LOGIC (100% preserved) ---
  const startSimulation = () => {
    const startPoint = { x: 50, y: 325 };
    setDrone({ ...startPoint, width: 28, height: 28 });
    setSpoofedDrone({ ...startPoint, path: [startPoint] });
    setDronePath([startPoint]);
    setJammingRadius(0);
    setDigitalFootprints([]);
    setFinalPositions([]);
    logCounterRef.current = 0;
    latestPositionsRef.current = { drone: startPoint, spoofed: startPoint };

    addFootprint('AUTH', 'Simulation initiated. Drone systems nominal.');
    addFootprint('AUTH', `Flight plan loaded. Target destination: ${formatCoords(target.x, target.y)}`);

    setAttackPhase(AttackPhase.NORMAL_FLIGHT);
    setStatus("Phase 1: Drone is flying normally, following authentic satellite signals.");

    if (simulationRef.current) clearInterval(simulationRef.current);

    const startTime = Date.now();

    simulationRef.current = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const droneSpeed = 2;

      setDrone(prevDrone => {
        let nextPos;
        if (attackPhase === AttackPhase.COMPLETED) return prevDrone;
        if (elapsedTime < 8000) {
          nextPos = moveTowards(prevDrone, target, droneSpeed);
        } else {
          nextPos = moveTowards(prevDrone, spoofedTarget, droneSpeed);
        }
        latestPositionsRef.current.drone = { x: nextPos.x, y: nextPos.y };
        setDronePath(path => [...path, { x: nextPos.x, y: nextPos.y }]);
        return nextPos;
      });

      setSpoofedDrone(prevSpoofed => {
        if (attackPhase === AttackPhase.COMPLETED) return prevSpoofed;
        const nextPos = moveTowards(prevSpoofed, target, droneSpeed);
        latestPositionsRef.current.spoofed = { x: nextPos.x, y: nextPos.y };
        return {
          x: nextPos.x,
          y: nextPos.y,
          path: [...prevSpoofed.path, { x: nextPos.x, y: nextPos.y }]
        };
      });

      setAttackPhase(prevPhase => {
        if (prevPhase === AttackPhase.COMPLETED) return AttackPhase.COMPLETED;

        let nextPhase = prevPhase;
        if (elapsedTime > 8000) {
          nextPhase = AttackPhase.HIJACKED;
        } else if (elapsedTime > 6000) {
          nextPhase = AttackPhase.SPOOFING;
        } else if (elapsedTime > 3000) {
          nextPhase = AttackPhase.JAMMING;
        } else {
          nextPhase = AttackPhase.NORMAL_FLIGHT;
        }

        if (nextPhase !== prevPhase) {
          switch (nextPhase) {
            case AttackPhase.JAMMING:
              setStatus("Phase 2: Attacker is overpowering satellite signals with a stronger radio signal.");
              addFootprint('WARN', 'Multiple satellite signals lost. Searching for signal...');
              break;
            case AttackPhase.SPOOFING:
              setStatus("Phase 3: Drone's navigation is compromised. Fake GPS data is being injected.");
              addFootprint('ATTACK', 'Strong signal lock acquired from terrestrial source. Re-calibrating...');
              siren.play();
              break;
            case AttackPhase.HIJACKED:
              setStatus("Phase 4: Drone is now fully hijacked, its path diverging towards a new target.");
              addFootprint('SPOOF', 'Navigation re-established. Resuming flight to target.');
              break;
            default: break;
          }
        }

        if (nextPhase === AttackPhase.JAMMING || nextPhase === AttackPhase.SPOOFING) {
          setJammingRadius(r => Math.min(r + 4, 300));
        }

        logCounterRef.current++;
        if (logCounterRef.current % 20 === 0) {
          if (nextPhase === AttackPhase.NORMAL_FLIGHT) {
            addFootprint('AUTH', `Position Verified: ${formatCoords(latestPositionsRef.current.drone.x, latestPositionsRef.current.drone.y)}`);
          } else if (nextPhase >= AttackPhase.SPOOFING) {
            addFootprint('SPOOF', `[FAKE TELEMETRY] Position: ${formatCoords(latestPositionsRef.current.spoofed.x, latestPositionsRef.current.spoofed.y)}`);
          }
        }

        if (dist(latestPositionsRef.current.spoofed, target) < 10) {
          nextPhase = AttackPhase.COMPLETED;
          setStatus("Attack Complete: The drone believes it has arrived at the target, but it has been successfully diverted.");
          addFootprint('SPOOF', `Spoofed Destination Reached: ${formatCoords(latestPositionsRef.current.spoofed.x, latestPositionsRef.current.spoofed.y)}`);
          addFootprint('ATTACK', `ACTUAL DRONE LOCATION: ${formatCoords(latestPositionsRef.current.drone.x, latestPositionsRef.current.drone.y)}`);
          clearInterval(simulationRef.current);
          siren.stop();

          setFinalPositions([
            { id: 'actual', x: latestPositionsRef.current.drone.x, y: latestPositionsRef.current.drone.y, status: 'actual' },
            { id: 'reported', x: latestPositionsRef.current.spoofed.x, y: latestPositionsRef.current.spoofed.y, status: 'reported' }
          ]);
        }

        return nextPhase;
      });
    }, 50);
  };

  useEffect(() => {
    return () => {
      clearInterval(simulationRef.current);
      siren.stop();
    };
  }, []);

  return (
    <div className="gnss-layout">
      <div className="stage-card large">
        <div className="stage-head">
          <div className="title">🛰️ GNSS SPOOFING ATTACK — 3D SIMULATION</div>
          <button
            onClick={startSimulation}
            disabled={attackPhase !== AttackPhase.INACTIVE && attackPhase !== AttackPhase.COMPLETED}
            className="spoof-button"
          >
            {attackPhase === AttackPhase.INACTIVE || attackPhase === AttackPhase.COMPLETED ? "Start Simulation" : "Simulation in Progress..."}
          </button>
        </div>

        {/* 3D Canvas */}
        <div className="sim-canvas-container" style={{ height: "600px", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <Canvas camera={{ position: [0, 10, 12], fov: 50 }} style={{ width: "100%", height: "100%" }} gl={{ antialias: true }}>
            <Suspense fallback={null}>
              <GnssScene
                drone={drone}
                spoofedDrone={spoofedDrone}
                dronePath={dronePath}
                radioTower={radioTower}
                target={target}
                spoofedTarget={spoofedTarget}
                attackPhase={attackPhase}
                jammingRadius={jammingRadius}
                finalPositions={finalPositions}
              />
            </Suspense>
          </Canvas>
        </div>
      </div>

      <InfoPanel
        attackPhase={attackPhase}
        status={status}
        digitalFootprints={digitalFootprints}
      />
    </div>
  );
}