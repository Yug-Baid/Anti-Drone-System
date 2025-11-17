import React, { useEffect, useRef, useState } from "react";
import InfoPanel from "../components/InfoPanel.jsx";

// Enum for attack phases
const AttackPhase = {
  INACTIVE: 'INACTIVE',
  NORMAL_FLIGHT: 'NORMAL_FLIGHT',
  JAMMING: 'JAMMING',
  SPOOFING: 'SPOOFING',
  HIJACKED: 'HIJACKED',
  COMPLETED: 'COMPLETED'
};

const DRONE_SIZE_OFFSET = 14; // Half of drone size (28/2)

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
  const [finalPositions, setFinalPositions] = useState([]); // NEW: For footprints

  const simulationRef = useRef(null);
  const logCounterRef = useRef(0);
  const latestPositionsRef = useRef({});

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

  // --- SIMULATION LOGIC ---
  const startSimulation = () => {
    // Reset all states to initial values
    const startPoint = { x: 50, y: 325 };
    setDrone({ ...startPoint, width: 28, height: 28 });
    setSpoofedDrone({ ...startPoint, path: [startPoint] });
    setDronePath([startPoint]);
    setJammingRadius(0);
    setDigitalFootprints([]);
    setFinalPositions([]); // NEW: Clear footprints
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

      // --- MOVEMENT LOGIC ---
      
      // Update REAL drone position
      setDrone(prevDrone => {
        let nextPos;
        if (attackPhase === AttackPhase.COMPLETED) return prevDrone; // Stop moving
        if (elapsedTime < 8000) { 
          nextPos = moveTowards(prevDrone, target, droneSpeed);
        } else { // HIJACKED phase
          nextPos = moveTowards(prevDrone, spoofedTarget, droneSpeed);
        }
        
        latestPositionsRef.current.drone = { x: nextPos.x, y: nextPos.y };
        setDronePath(path => [...path, { x: nextPos.x, y: nextPos.y }]);
        return nextPos;
      });

      // Update SPOOFED (ghost) drone position
      setSpoofedDrone(prevSpoofed => {
        if (attackPhase === AttackPhase.COMPLETED) return prevSpoofed; // Stop moving
        const nextPos = moveTowards(prevSpoofed, target, droneSpeed);
        latestPositionsRef.current.spoofed = { x: nextPos.x, y: nextPos.y };
        
        return { 
            x: nextPos.x, 
            y: nextPos.y, 
            path: [...prevSpoofed.path, { x: nextPos.x, y: nextPos.y }] 
        };
      });

      // --- PHASE & LOGGING LOGIC ---
      setAttackPhase(prevPhase => {
        // Don't update phase if already completed
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
        
        // Check for simulation completion (using spoofed drone)
        if (dist(latestPositionsRef.current.spoofed, target) < 10) {
          nextPhase = AttackPhase.COMPLETED;
          setStatus("Attack Complete: The drone believes it has arrived at the target, but it has been successfully diverted.");
          addFootprint('SPOOF', `Spoofed Destination Reached: ${formatCoords(latestPositionsRef.current.spoofed.x, latestPositionsRef.current.spoofed.y)}`);
          addFootprint('ATTACK', `ACTUAL DRONE LOCATION: ${formatCoords(latestPositionsRef.current.drone.x, latestPositionsRef.current.drone.y)}`);
          clearInterval(simulationRef.current);

          // --- NEW: Set final positions ---
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
    return () => clearInterval(simulationRef.current);
  }, []);

  return (
    <div className="gnss-layout">
        <div className="stage-card large">
            <div className="stage-head">
            <div className="title">🛰️ GNSS Spoofing Attack Vector</div>
            <button
                onClick={startSimulation}
                disabled={attackPhase !== AttackPhase.INACTIVE && attackPhase !== AttackPhase.COMPLETED}
                className="spoof-button"
            >
                {attackPhase === AttackPhase.INACTIVE || attackPhase === AttackPhase.COMPLETED ? "Start Simulation" : "Simulation in Progress..."}
            </button>
            </div>
            <div className="world" style={{ width: world.width, height: world.height }}>
                <div className="grid" />

                <div className="satellite-source" />
                <div className="radio-tower" style={{ left: radioTower.x, top: radioTower.y }}>
                    <div className="tower-icon">📡</div>
                    <span>Spoofing Source</span>
                </div>
                <div className="target-location" style={{ left: target.x, top: target.y }}><span>TARGET</span></div>
                <div className="spoofed-target-location" style={{ left: spoofedTarget.x, top: spoofedTarget.y }}><span>SPOOFED</span></div>
                
                {/* Spoofed (Ghost) Drone */}
                <div className="drone spoofed-ghost" style={{ left: spoofedDrone.x, top: spoofedDrone.y, width: drone.width, height: drone.height }}>
                    <div className="body">🚁</div>
                </div>

                {/* Real Drone */}
                <div className="drone" style={{ left: drone.x, top: drone.y, width: drone.width, height: drone.height }}>
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

                <svg className="path-svg">
                    {attackPhase === AttackPhase.NORMAL_FLIGHT && (
                    <line x1={drone.x + DRONE_SIZE_OFFSET} y1={drone.y + DRONE_SIZE_OFFSET} x2={world.width / 2} y2="0" className="satellite-signal" />
                    )}
                    {attackPhase >= AttackPhase.JAMMING && (
                    <g>
                        <circle cx={radioTower.x} cy={radioTower.y} r={jammingRadius} className="jamming-circle" />
                        <line x1={drone.x + DRONE_SIZE_OFFSET} y1={drone.y + DRONE_SIZE_OFFSET} x2={radioTower.x} y2={radioTower.y} className="spoofing-signal" />
                    </g>
                    )}
                    <polyline points={spoofedDrone.path.map(p => `${p.x + DRONE_SIZE_OFFSET},${p.y + DRONE_SIZE_OFFSET}`).join(' ')} className="spoofed-path" />
                    <polyline points={dronePath.map(p => `${p.x + DRONE_SIZE_OFFSET},${p.y + DRONE_SIZE_OFFSET}`).join(' ')} className="actual-path" />
                </svg>
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