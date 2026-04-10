import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import InfoPanel from "../components/InfoPanel.jsx";
import WireframeDrone from "../components/WireframeDrone.jsx";
import useSirenSound from "../hooks/useSirenSound.js";

/* ═══════════════════════════════════════════
   COORDINATE SYSTEM & CONSTANTS
   ═══════════════════════════════════════════ */
const SCALE = 0.02;
const toWorld = (x, y) => [(x - 500) * SCALE, 0, (y - 325) * SCALE];

const AttackPhase = {
  INACTIVE: 'INACTIVE',
  NORMAL_FLIGHT: 'NORMAL_FLIGHT',
  ATTACK_INJECT: 'ATTACK_INJECT',
  HIJACKED: 'HIJACKED',
  COMPLETED: 'COMPLETED'
};

const SIMULATION_SPEED = 50;
const DRONE_SPEED = 2;
const DRONE_SIZE_OFFSET = 14;

/* ═══════════════════════════════════════════
   3D SCENE COMPONENTS
   ═══════════════════════════════════════════ */

function GroundPlane() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
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

/* ── Drone Entity ── */
function Drone3D({ x, y, color, label, glitching = false, shieldActive = false }) {
  const ref = useRef();
  const targetPos = useMemo(() => toWorld(x + DRONE_SIZE_OFFSET, y + DRONE_SIZE_OFFSET), [x, y]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x += (targetPos[0] - ref.current.position.x) * Math.min(1, delta * 10);
    ref.current.position.z += (targetPos[2] - ref.current.position.z) * Math.min(1, delta * 10);
    // Glitch effect
    if (glitching) {
      ref.current.position.x += (Math.random() - 0.5) * 0.03;
      ref.current.position.z += (Math.random() - 0.5) * 0.03;
    }
    ref.current.position.y = 0.3 + Math.sin(Date.now() * 0.003) * 0.04;
  });

  return (
    <group ref={ref} position={[targetPos[0], 0.3, targetPos[2]]}>
      <WireframeDrone scale={0.5} color={color} />
      {label && (
        <Text position={[0, 0.45, 0]} fontSize={0.13} color={color} anchorX="center">
          {label}
        </Text>
      )}
      {shieldActive && (
        <mesh>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshBasicMaterial color="#00ff88" wireframe transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}

/* ── Waypoint Marker ── */
function WaypointMarker({ x, y, index }) {
  const [pos] = useState(() => toWorld(x, y));
  return (
    <group position={pos}>
      <mesh position={[0, 0.2, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial color="#00ff88" wireframe transparent opacity={0.8} />
      </mesh>
      <Text position={[0, 0.45, 0]} fontSize={0.12} color="#00ff88" anchorX="center">
        {`WP${index + 1}`}
      </Text>
    </group>
  );
}

/* ── Radio Tower (Attacker C2) ── */
function AttackerTower({ x, y }) {
  const [pos] = useState(() => toWorld(x, y));
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.3;
  });

  return (
    <group position={pos}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.08, 0.15, 0.6, 6]} />
        <meshBasicMaterial color="#ff3344" wireframe />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <coneGeometry args={[0.2, 0.3, 6]} />
        <meshBasicMaterial color="#ff3344" wireframe />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#ff3344" transparent opacity={0.9} />
      </mesh>
      <group ref={ref} position={[0, 0.02, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.62, 32]} />
          <meshBasicMaterial color="#ff3344" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <Text position={[0, 1.3, 0]} fontSize={0.16} color="#ff3344" anchorX="center">
        ATTACKER C2
      </Text>
    </group>
  );
}

/* ── Malicious Target Marker ── */
function MaliciousTarget({ x, y }) {
  const [pos] = useState(() => toWorld(x, y));
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.08;
      ref.current.scale.set(s, 1, s);
    }
  });

  return (
    <group ref={ref} position={pos}>
      <mesh>
        <cylinderGeometry args={[0.4, 0.4, 0.1, 32]} />
        <meshBasicMaterial color="#ff3344" transparent opacity={0.1} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <torusGeometry args={[0.4, 0.02, 8, 32]} />
        <meshBasicMaterial color="#ff3344" transparent opacity={0.5} />
      </mesh>
      <Text position={[0, 0.35, 0]} fontSize={0.16} color="#ff3344" anchorX="center">
        INJECTED
      </Text>
    </group>
  );
}

/* ── Data Packets flying in 3D ── */
function DataPackets3D({ packets, towerPos }) {
  return (
    <group>
      {packets.map(packet => {
        const from = toWorld(towerPos.x, towerPos.y);
        const to = toWorld(packet.targetX + DRONE_SIZE_OFFSET, packet.targetY + DRONE_SIZE_OFFSET);
        const progress = ((Date.now() - (packet.startTime || Date.now())) % 1000) / 1000;
        const x = from[0] + (to[0] - from[0]) * progress;
        const z = from[2] + (to[2] - from[2]) * progress;
        const y = 0.4 + Math.sin(progress * Math.PI) * 0.5;

        return (
          <mesh key={packet.id} position={[x, y, z]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#00f2ff" transparent opacity={1 - progress * 0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Signal beam between points ── */
function SignalBeam3D({ from, to, color }) {
  const fromPos = useMemo(() => {
    const [x, , z] = toWorld(from.x + DRONE_SIZE_OFFSET, from.y + DRONE_SIZE_OFFSET);
    return [x, 0.3, z];
  }, [from.x, from.y]);
  const toPos = useMemo(() => {
    const [x, , z] = toWorld(to.x, to.y);
    return [x, 0.5, z];
  }, [to.x, to.y]);

  return <Line points={[fromPos, toPos]} color={color} lineWidth={1.5} transparent opacity={0.6} />;
}

/* ── Footprints ── */
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
            <Text position={[px, 0.3, pz]} fontSize={0.1} color={color} anchorX="center">
              {pos.status === 'actual' ? 'ACTUAL' : 'REPORTED'}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════
   COMPLETE 3D SCENE
   ═══════════════════════════════════════════ */
function InjectionScene({ drone, reportedDrone, dronePath, reportedPath, waypoints,
  radioTower, maliciousTarget, attackPhase, dataPackets, finalPositions, trustNeutralized }) {

  const actualPathPts = useMemo(() => {
    if (dronePath.length < 2) return null;
    return dronePath.map(p => { const [x,,z] = toWorld(p.x + DRONE_SIZE_OFFSET, p.y + DRONE_SIZE_OFFSET); return [x, 0.12, z]; });
  }, [dronePath]);

  const reportedPathPts = useMemo(() => {
    if (reportedPath.length < 2) return null;
    return reportedPath.map(p => { const [x,,z] = toWorld(p.x + DRONE_SIZE_OFFSET, p.y + DRONE_SIZE_OFFSET); return [x, 0.08, z]; });
  }, [reportedPath]);

  const waypointLinePts = useMemo(() => {
    return waypoints.map(wp => { const [x,,z] = toWorld(wp.x, wp.y); return [x, 0.05, z]; });
  }, [waypoints]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 8, 5]} intensity={0.4} color="#00f2ff" />
      <OrbitControls enablePan maxPolarAngle={Math.PI / 2.2} minDistance={4} maxDistance={25} />

      <GroundPlane />

      {/* Waypoints */}
      {waypoints.map((wp, idx) => (
        <WaypointMarker key={idx} x={wp.x} y={wp.y} index={idx} />
      ))}
      {waypointLinePts.length >= 2 && (
        <Line points={waypointLinePts} color="#00ff88" lineWidth={1.5} dashed dashSize={0.1} gapSize={0.05} transparent opacity={0.4} />
      )}

      {/* Attacker Tower */}
      <AttackerTower x={radioTower.x} y={radioTower.y} />

      {/* Malicious Target */}
      <MaliciousTarget x={maliciousTarget.x} y={maliciousTarget.y} />

      {/* Data Packets */}
      <DataPackets3D packets={dataPackets} towerPos={radioTower} />

      {/* Signal beam when hijacked */}
      {attackPhase >= AttackPhase.HIJACKED && !trustNeutralized && (
        <SignalBeam3D from={drone} to={radioTower} color="#ff3344" />
      )}

      {/* Ghost (Reported) Drone */}
      <Drone3D
        x={reportedDrone.x}
        y={reportedDrone.y}
        color="#8888bb"
        label={trustNeutralized ? "VALIDATED" : "PERCEIVED"}
      />

      {/* Real Drone */}
      <Drone3D
        x={drone.x}
        y={drone.y}
        color={trustNeutralized ? "#00ff88" : "#00f2ff"}
        label="ACTUAL"
        glitching={attackPhase >= AttackPhase.HIJACKED && !trustNeutralized}
        shieldActive={trustNeutralized}
      />

      {/* Paths */}
      {reportedPathPts && <Line points={reportedPathPts} color="#8888bb" lineWidth={1.2} transparent opacity={0.4} />}
      {actualPathPts && <Line points={actualPathPts} color="#ff3344" lineWidth={2} dashed dashSize={0.08} gapSize={0.04} />}

      {/* Footprints */}
      <Footprints3D positions={finalPositions} />
    </>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT (simulation logic 100% preserved)
   ═══════════════════════════════════════════ */
export default function DataInjectionSimulation() {
  const world = { width: 1000, height: 650 };

  const initialDroneState = { x: 50, y: 100 };
  const [drone, setDrone] = useState(initialDroneState);
  const [reportedDrone, setReportedDrone] = useState(initialDroneState);
  const [radioTower] = useState({ x: 850, y: 325 });

  const [waypoints] = useState([
    { x: 300, y: 100 },
    { x: 500, y: 300 },
    { x: 300, y: 500 },
    { x: 50, y: 500 },
    { x: 50, y: 100 },
  ]);
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0);
  const [reportedWaypointIdx, setReportedWaypointIdx] = useState(0);

  const [maliciousTarget] = useState({ x: 800, y: 500 });

  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [attackPhase, setAttackPhase] = useState(AttackPhase.INACTIVE);
  const [status, setStatus] = useState("Use the playback controls to begin the simulation.");

  const [dronePath, setDronePath] = useState([]);
  const [reportedPath, setReportedPath] = useState([]);
  const [dataPackets, setDataPackets] = useState([]);
  const [finalPositions, setFinalPositions] = useState([]);
  const [digitalFootprints, setDigitalFootprints] = useState([]);

  /* ── Trust Metric ── */
  const [trustMetric, setTrustMetric] = useState(false);
  const [trustNeutralized, setTrustNeutralized] = useState(false);

  const simulationRef = useRef(null);
  const latestDronePos = useRef(initialDroneState);
  const latestReportedPos = useRef(initialDroneState);

  // --- SIREN SOUND ---
  const siren = useSirenSound();

  const formatCoords = (x, y) => `(${Math.round(x)}, ${Math.round(y)})`;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const addFootprint = useCallback((type, message) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setDigitalFootprints(prev => [...prev, { type, message, timestamp }]);
  }, []);

  const resetSimulation = useCallback(() => {
    setIsPlaying(false);
    clearInterval(simulationRef.current);
    setSimulationTime(0);
    setDrone(initialDroneState);
    setReportedDrone(initialDroneState);
    setDronePath([initialDroneState]);
    setReportedPath([initialDroneState]);
    latestDronePos.current = initialDroneState;
    latestReportedPos.current = initialDroneState;
    setCurrentWaypointIdx(0);
    setReportedWaypointIdx(0);
    setDigitalFootprints([]);
    setDataPackets([]);
    setFinalPositions([]);
    setAttackPhase(AttackPhase.INACTIVE);
    setTrustNeutralized(false);
    setStatus("Simulation reset. Press play to start.");
    siren.stop();
  }, [siren]);

  const togglePlayPause = () => {
    if (attackPhase === AttackPhase.COMPLETED) return;
    if (attackPhase === AttackPhase.INACTIVE && !isPlaying) {
      addFootprint('AUTH', 'Simulation initiated. Drone systems nominal.');
      addFootprint('AUTH', `Loaded mission plan with ${waypoints.length} waypoints.`);
    }
    setIsPlaying(!isPlaying);
  };

  const moveTowards = (from, to, speed) => {
    const d = dist(from, to);
    if (d < speed) return to;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return { ...from, x: from.x + (dx / d) * speed, y: from.y + (dy / d) * speed };
  };

  const spawnDataPacket = () => {
    const id = Math.random();
    const newPacket = {
      id,
      x: radioTower.x,
      y: radioTower.y,
      targetX: latestDronePos.current.x,
      targetY: latestDronePos.current.y,
      startTime: Date.now(),
    };
    setDataPackets(prev => [...prev, newPacket]);
    setTimeout(() => {
      setDataPackets(prev => prev.filter(p => p.id !== id));
    }, 1000);
  };

  const runSimulationTick = useCallback(() => {
    const newTime = simulationTime + SIMULATION_SPEED;
    setSimulationTime(newTime);

    let nextPhase = attackPhase;
    if (newTime > 12000) { nextPhase = AttackPhase.COMPLETED; }
    else if (newTime > 7000) { nextPhase = AttackPhase.HIJACKED; }
    else if (newTime > 4000) { nextPhase = AttackPhase.ATTACK_INJECT; }
    else if (newTime > 500) { nextPhase = AttackPhase.NORMAL_FLIGHT; }

    /* ── Trust Metric Neutralization ── */
    if (trustMetric && nextPhase >= AttackPhase.HIJACKED && !trustNeutralized) {
      setTrustNeutralized(true);
      addFootprint('AUTH', '🛡️ TRUST METRIC: Cross-validating delayed data against real-time kinematics...');
      addFootprint('AUTH', '🛡️ ATTACK NEUTRALIZED: Inconsistency detected. Reverting to validated state.');
      setStatus("Defense Active: Trust Metric has neutralized the attack. Drone returning to mission.");
      siren.stop();
    }

    if (nextPhase !== attackPhase) {
      setAttackPhase(nextPhase);
      switch (nextPhase) {
        case AttackPhase.ATTACK_INJECT:
          setStatus("Phase 2: Attacker is injecting malicious MAVLink commands.");
          addFootprint('ATTACK', 'Network intrusion detected. Injecting CMD_OVERRIDE...');
          siren.play();
          break;
        case AttackPhase.HIJACKED:
          if (!trustMetric) {
            setStatus("Phase 3: Drone is following malicious commands. Attacker is spoofing telemetry.");
            addFootprint('SPOOF', 'CMD_OVERRIDE ACK. Drone path diverted. Initiating telemetry spoof.');
          }
          setDataPackets([]);
          break;
        case AttackPhase.COMPLETED:
          if (trustNeutralized || trustMetric) {
            setStatus("Mission Complete: Trust Metric successfully defended against the attack.");
            addFootprint('AUTH', '✅ Drone completed mission under Trust Metric protection.');
          } else {
            setStatus("Attack Complete: The drone is at the attacker's location.");
            addFootprint('ATTACK', `ACTUAL DRONE LOCATION: ${formatCoords(latestDronePos.current.x, latestDronePos.current.y)}`);
            addFootprint('SPOOF', `[FAKE TELEMETRY] Arrived at Waypoint #${reportedWaypointIdx}.`);
          }
          setIsPlaying(false);
          siren.stop();
          setFinalPositions([
            { id: 'actual', x: latestDronePos.current.x, y: latestDronePos.current.y, status: 'actual' },
            { id: 'reported', x: latestReportedPos.current.x, y: latestReportedPos.current.y, status: 'reported' }
          ]);
          break;
        default: break;
      }
    }

    if (nextPhase === AttackPhase.COMPLETED) return;

    // Reported (Ghost) Drone
    setReportedDrone(prev => {
      if (reportedWaypointIdx >= waypoints.length) return prev;
      const targetWp = waypoints[reportedWaypointIdx];
      let newPos = moveTowards(prev, targetWp, DRONE_SPEED);
      if (nextPhase >= AttackPhase.HIJACKED && !trustNeutralized) {
        newPos.x += (Math.random() - 0.5) * 4;
        newPos.y += (Math.random() - 0.5) * 4;
      }
      if (dist(newPos, targetWp) < DRONE_SPEED) {
        const newIndex = reportedWaypointIdx + 1;
        setReportedWaypointIdx(newIndex);
      }
      setReportedPath(path => [...path, newPos]);
      latestReportedPos.current = newPos;
      return newPos;
    });

    // Actual Drone
    setDrone(prev => {
      let newPos;
      const isNeutralized = trustMetric && (trustNeutralized || nextPhase >= AttackPhase.HIJACKED);
      if (nextPhase < AttackPhase.HIJACKED || isNeutralized) {
        if (currentWaypointIdx >= waypoints.length) return prev;
        const targetWp = waypoints[currentWaypointIdx];
        newPos = moveTowards(prev, targetWp, DRONE_SPEED);
        if (dist(newPos, targetWp) < DRONE_SPEED) {
          setCurrentWaypointIdx(i => i + 1);
        }
      } else {
        newPos = moveTowards(prev, maliciousTarget, DRONE_SPEED);
      }
      setDronePath(path => [...path, newPos]);
      latestDronePos.current = newPos;
      return newPos;
    });

    // Logging
    if (newTime % 1000 < SIMULATION_SPEED) {
      if (nextPhase === AttackPhase.NORMAL_FLIGHT) {
        addFootprint('AUTH', `Telemetry: POS=${formatCoords(latestDronePos.current.x, latestDronePos.current.y)}, WP_TGT=${currentWaypointIdx + 1}`);
      } else if (nextPhase >= AttackPhase.HIJACKED && !trustNeutralized) {
        addFootprint('SPOOF', `[FAKE TELEMETRY] POS=${formatCoords(latestReportedPos.current.x, latestReportedPos.current.y)}, WP_TGT=${reportedWaypointIdx + 1}`);
      }
    }

    // Data packets
    if (nextPhase === AttackPhase.ATTACK_INJECT && newTime % 200 < SIMULATION_SPEED) {
      spawnDataPacket();
    }
  }, [simulationTime, attackPhase, addFootprint, waypoints, currentWaypointIdx, reportedWaypointIdx, maliciousTarget, trustMetric, trustNeutralized, siren]);

  useEffect(() => {
    if (isPlaying && attackPhase !== AttackPhase.COMPLETED) {
      simulationRef.current = setInterval(runSimulationTick, SIMULATION_SPEED);
    } else {
      clearInterval(simulationRef.current);
    }
    return () => clearInterval(simulationRef.current);
  }, [isPlaying, runSimulationTick, attackPhase]);

  useEffect(() => {
    return () => siren.stop();
  }, []);

  return (
    <div className="gnss-layout">
      <div className="stage-card large">
        <div className="stage-head">
          <div className="title">📦 DATA & COMMAND INJECTION — 3D</div>
          <div className="playback-controls">
            {/* Trust Metric Toggle */}
            <div className={`trust-toggle ${trustMetric ? 'active' : ''}`}>
              <button
                className={`trust-switch ${trustMetric ? 'on' : ''}`}
                onClick={() => setTrustMetric(!trustMetric)}
                aria-label="Toggle Trust Metric"
              />
              <span className="trust-label">
                {trustMetric ? '🛡️ TRUST METRIC: ON' : 'TRUST METRIC: OFF'}
              </span>
            </div>
            <button onClick={togglePlayPause} className="control-button" disabled={attackPhase === AttackPhase.COMPLETED}>
              {isPlaying ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button onClick={resetSimulation} className="control-button reset">
              ↻ Reset
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <div className="sim-canvas-container" style={{ height: "600px", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <Canvas camera={{ position: [0, 10, 12], fov: 50 }} style={{ width: "100%", height: "100%" }} gl={{ antialias: true }}>
            <Suspense fallback={null}>
              <InjectionScene
                drone={drone}
                reportedDrone={reportedDrone}
                dronePath={dronePath}
                reportedPath={reportedPath}
                waypoints={waypoints}
                radioTower={radioTower}
                maliciousTarget={maliciousTarget}
                attackPhase={attackPhase}
                dataPackets={dataPackets}
                finalPositions={finalPositions}
                trustNeutralized={trustNeutralized}
              />
            </Suspense>
          </Canvas>
        </div>
      </div>

      <InfoPanel
        attackPhase={attackPhase}
        status={status}
        digitalFootprints={digitalFootprints}
        liveCoords={{
          actual: formatCoords(latestDronePos.current.x, latestDronePos.current.y),
          perceived: formatCoords(latestReportedPos.current.x, latestReportedPos.current.y),
        }}
        signalStrengths={{
          satellite: (attackPhase < AttackPhase.ATTACK_INJECT ? 100 : 95),
          spoofing: (attackPhase >= AttackPhase.ATTACK_INJECT ? (trustNeutralized ? 0 : 100) : 0),
        }}
      />
    </div>
  );
}