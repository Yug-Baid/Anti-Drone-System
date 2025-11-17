import React, { useEffect, useRef, useState, useCallback } from "react";
import InfoPanel from "../components/InfoPanel.jsx";

const AttackPhase = {
  INACTIVE: 'INACTIVE',
  NORMAL_FLIGHT: 'NORMAL_FLIGHT',
  ATTACK_INJECT: 'ATTACK_INJECT', // Attack starts, packets are sent
  HIJACKED: 'HIJACKED',         // Drone follows new commands, operator sees jitter
  COMPLETED: 'COMPLETED'
};

const SIMULATION_SPEED = 50; // ms per tick
const DRONE_SPEED = 2;
const JITTER_AMOUNT = 4; // How much the spoofed drone will jitter
const DRONE_SIZE_OFFSET = 14; // Half of drone size for path center

export default function DataInjectionSimulation() {
  const world = { width: 1000, height: 650 };

  // --- ENTITIES & MISSION ---
  const initialDroneState = { x: 50, y: 100 };
  const [drone, setDrone] = useState(initialDroneState); // Actual drone position
  const [reportedDrone, setReportedDrone] = useState(initialDroneState); // "Ghost" drone, what the operator sees
  const [radioTower] = useState({ x: 850, y: 325 });
  
  const [waypoints, setWaypoints] = useState([
    { x: 300, y: 100 },
    { x: 500, y: 300 },
    { x: 300, y: 500 },
    { x: 50, y: 500 },
    { x: 50, y: 100 },
  ]);
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0);
  const [reportedWaypointIdx, setReportedWaypointIdx] = useState(0);

  const [maliciousTarget] = useState({ x: 800, y: 500 }); // Attacker's goal

  // --- SIMULATION STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [attackPhase, setAttackPhase] = useState(AttackPhase.INACTIVE);
  const [status, setStatus] = useState("Use the playback controls to begin the simulation.");
  
  const [dronePath, setDronePath] = useState([]);
  const [reportedPath, setReportedPath] = useState([]);
  
  const [dataPackets, setDataPackets] = useState([]);
  const [finalPositions, setFinalPositions] = useState([]); // NEW: For footprints
  
  const [digitalFootprints, setDigitalFootprints] = useState([]);
  const simulationRef = useRef(null);
  
  const latestDronePos = useRef(initialDroneState);
  const latestReportedPos = useRef(initialDroneState);

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
    setFinalPositions([]); // NEW: Clear footprints
    setAttackPhase(AttackPhase.INACTIVE);
    setStatus("Simulation reset. Press play to start.");
  }, []);

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
    if (d < speed) return to; // Snap to target if close
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
      targetY: latestDronePos.current.y
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
    // Shorten total time for demo purposes
    if (newTime > 12000) { nextPhase = AttackPhase.COMPLETED; }
    else if (newTime > 7000) { nextPhase = AttackPhase.HIJACKED; }
    else if (newTime > 4000) { nextPhase = AttackPhase.ATTACK_INJECT; }
    else if (newTime > 500) { nextPhase = AttackPhase.NORMAL_FLIGHT; }

    // --- PHASE TRANSITIONS ---
    if (nextPhase !== attackPhase) {
      setAttackPhase(nextPhase);
      switch (nextPhase) {
        case AttackPhase.ATTACK_INJECT:
          setStatus("Phase 2: Attacker is injecting malicious MAVLink commands.");
          addFootprint('ATTACK', 'Network intrusion detected. Injecting CMD_OVERRIDE...');
          break;
        case AttackPhase.HIJACKED:
          setStatus("Phase 3: Drone is following malicious commands. Attacker is spoofing telemetry.");
          addFootprint('SPOOF', 'CMD_OVERRIDE ACK. Drone path diverted. Initiating telemetry spoof.');
          setDataPackets([]); // Stop the packet storm
          break;
        case AttackPhase.COMPLETED:
           setStatus("Attack Complete: The drone is at the attacker's location, but the operator believes the mission is nominal.");
           addFootprint('ATTACK', `ACTUAL DRONE LOCATION: ${formatCoords(latestDronePos.current.x, latestDronePos.current.y)}`);
           addFootprint('SPOOF', `[FAKE TELEMETRY] Arrived at Waypoint #${reportedWaypointIdx}.`);
           setIsPlaying(false);
           // --- NEW: Set final positions ---
           setFinalPositions([
             { id: 'actual', x: latestDronePos.current.x, y: latestDronePos.current.y, status: 'actual' },
             { id: 'reported', x: latestReportedPos.current.x, y: latestReportedPos.current.y, status: 'reported' }
           ]);
           break;
        default: break;
      }
    }

    // --- MOVEMENT & LOGIC ---
    if (nextPhase === AttackPhase.COMPLETED) return; // Stop moving when completed

    // 1. Reported (Ghost) Drone
    setReportedDrone(prev => {
      if (reportedWaypointIdx >= waypoints.length) return prev;
      const targetWp = waypoints[reportedWaypointIdx];
      let newPos = moveTowards(prev, targetWp, DRONE_SPEED);
      
      if (nextPhase >= AttackPhase.HIJACKED) {
        newPos.x += (Math.random() - 0.5) * JITTER_AMOUNT;
        newPos.y += (Math.random() - 0.5) * JITTER_AMOUNT;
      }
      
      if (dist(newPos, targetWp) < DRONE_SPEED) {
        const newIndex = reportedWaypointIdx + 1;
        setReportedWaypointIdx(newIndex);
        if(nextPhase >= AttackPhase.HIJACKED && newIndex < waypoints.length) {
            addFootprint('SPOOF', `[FAKE TELEMETRY] Arrived at Waypoint #${newIndex}. Proceeding to next.`);
        }
      }
      setReportedPath(path => [...path, newPos]);
      latestReportedPos.current = newPos; 
      return newPos;
    });

    // 2. Actual Drone
    setDrone(prev => {
      let newPos;
      if (nextPhase < AttackPhase.HIJACKED) {
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

    // 3. Log Telemetry
    if (newTime % 1000 < SIMULATION_SPEED) { 
      if (nextPhase === AttackPhase.NORMAL_FLIGHT) {
        addFootprint('AUTH', `Telemetry: POS=${formatCoords(latestDronePos.current.x, latestDronePos.current.y)}, WP_TGT=${currentWaypointIdx + 1}`);
      } else if (nextPhase >= AttackPhase.HIJACKED) {
         addFootprint('SPOOF', `[FAKE TELEMETRY] POS=${formatCoords(latestReportedPos.current.x, latestReportedPos.current.y)}, WP_TGT=${reportedWaypointIdx + 1} (Signal Jitter)`);
      }
    }
    
    // 4. Spawn data packets
    if (nextPhase === AttackPhase.ATTACK_INJECT && newTime % 200 < SIMULATION_SPEED) {
        spawnDataPacket();
    }

  }, [simulationTime, attackPhase, addFootprint, waypoints, currentWaypointIdx, reportedWaypointIdx, maliciousTarget]);

  useEffect(() => {
    if (isPlaying && attackPhase !== AttackPhase.COMPLETED) {
      simulationRef.current = setInterval(runSimulationTick, SIMULATION_SPEED);
    } else {
      clearInterval(simulationRef.current);
    }
    return () => clearInterval(simulationRef.current);
  }, [isPlaying, runSimulationTick, attackPhase]);


  return (
    <div className="gnss-layout">
      <div className="stage-card large">
        <div className="stage-head">
          <div className="title">📦 Data & Command Injection</div>
          <div className="playback-controls">
            <button onClick={togglePlayPause} className="control-button" disabled={attackPhase === AttackPhase.COMPLETED}>
              {isPlaying ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button onClick={resetSimulation} className="control-button reset">
              ↻ Reset
            </button>
          </div>
        </div>

        <div className="world" style={{ width: world.width, height: world.height }}>
          <div className="grid" />
          
          <div className="radio-tower" style={{ left: radioTower.x, top: radioTower.y }}>
            <div className="tower-icon">📡</div><span>Attacker C2</span>
          </div>

          <div className="spoofed-target-location" style={{ left: maliciousTarget.x, top: maliciousTarget.y }}><span>INJECTED</span></div>
          
          <svg className="path-svg">
            <polyline 
                points={waypoints.map(p => `${p.x},${p.y}`).join(' ')} 
                className="waypoint-path" 
            />
          </svg>
          {waypoints.map((wp, idx) => (
            <div 
              key={idx} 
              className="waypoint-marker" 
              style={{ left: wp.x, top: wp.y }}
            >
              <span>{idx + 1}</span>
            </div>
          ))}
          
          {dataPackets.map(packet => (
            <div 
                key={packet.id}
                className="data-packet"
                style={{
                    left: packet.x,
                    top: packet.y,
                    '--target-x': `${packet.targetX}px`, 
                    '--target-y': `${packet.targetY}px`
                }}
            />
          ))}

          {/* Drones */}
          <div className="drone spoofed-ghost" style={{ left: reportedDrone.x, top: reportedDrone.y }}>
            <div className="body">🚁</div>
          </div>
          {/* --- MODIFIED: Added 'glitching' class --- */}
          <div 
            className={`drone ${attackPhase >= AttackPhase.HIJACKED ? 'glitching' : ''}`} 
            style={{ left: drone.x, top: drone.y }}
          >
            <div className="body">🚁</div>
            <div className="shadow" />
          </div>

          {/* --- NEW: Final Position Footprints --- */}
          {finalPositions.map(pos => (
            <div
              key={pos.id}
              className={`footprint-marker ${pos.status}`}
              style={{ left: pos.x + DRONE_SIZE_OFFSET, top: pos.y + DRONE_SIZE_OFFSET }}
            />
          ))}

          {/* Paths */}
          <svg className="path-svg">
            {attackPhase >= AttackPhase.HIJACKED && (
                <line 
                  x1={drone.x + DRONE_SIZE_OFFSET} 
                  y1={drone.y + DRONE_SIZE_OFFSET} 
                  x2={radioTower.x} 
                  y2={radioTower.y} 
                  className="spoofing-signal" 
                />
            )}
            <polyline points={reportedPath.map(p => `${p.x + DRONE_SIZE_OFFSET},${p.y + DRONE_SIZE_OFFSET}`).join(' ')} className="spoofed-path" />
            <polyline points={dronePath.map(p => `${p.x + DRONE_SIZE_OFFSET},${p.y + DRONE_SIZE_OFFSET}`).join(' ')} className="actual-path" />
          </svg>
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
          spoofing: (attackPhase >= AttackPhase.ATTACK_INJECT ? 100 : 0),
        }}
      />
    </div>
  );
}