import React, { useEffect, useRef, useState, useCallback } from "react";
import InfoPanel from "../components/InfoPanel.jsx";

// Enum for simulation phases
const AttackPhase = {
  INACTIVE: 'INACTIVE',
  NORMAL_FLIGHT: 'NORMAL_FLIGHT',
  REDIRECTING: 'REDIRECTING',
  SECURED: 'SECURED'
};

// Enum for drone status
const DroneStatus = {
  NORMAL: 'NORMAL',
  REDIRECTED: 'REDIRECTED',
  SAFE: 'SAFE'
};

const SIMULATION_SPEED = 50; // ms per tick
const DRONE_SPEED = 1.5;

// Helper to generate random starting positions
const createDrone = (id, world) => {
  const y = Math.random() * world.height;
  const x = Math.random() * 100; // Start on the left side
  return {
    id,
    x,
    y,
    status: DroneStatus.NORMAL,
    path: [{ x, y }]
  };
};

export default function MassRedirectionSimulation() {
  const world = { width: 1000, height: 650 };

  // --- ENTITIES ---
  const [drones, setDrones] = useState([]);
  const [droneCount, setDroneCount] = useState(10);
  // *** MODIFICATION: Added two radii. Inner (solid) and Outer (dotted fence) ***
  const [antiDroneTower] = useState({ 
    x: 500, 
    y: 325, 
    radius: 150, // Smaller inner circle
    detectionFenceRadius: 300 // New outer dotted fence
  });
  const [targetZone] = useState({ x: 850, y: 325, size: 100 });
  const [safeZone] = useState({ x: 500, y: 600, size: 120 });

  // --- SIMULATION STATE ---
  const [attackPhase, setAttackPhase] = useState(AttackPhase.INACTIVE);
  const [status, setStatus] = useState("Adjust drone count and press 'Activate System' to begin.");
  const [digitalFootprints, setDigitalFootprints] = useState([]);

  const simulationRef = useRef(null);

  const formatCoords = (x, y) => `(${Math.round(x)}, ${Math.round(y)})`;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const addFootprint = useCallback((type, message) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setDigitalFootprints(prev => [...prev, { type, message, timestamp }]);
  }, []);

  const moveTowards = (from, to, speed) => {
    const d = dist(from, to);
    if (d < speed) return to; // Snap to target if close
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return { x: from.x + (dx / d) * speed, y: from.y + (dy / d) * speed };
  };

  // --- SIMULATION CONTROLS ---

  // Initialize drones based on the slider count
  const initializeDrones = () => {
    if (attackPhase !== AttackPhase.INACTIVE) return;
    setDigitalFootprints([]);
    addFootprint('AUTH', `System armed. Preparing for ${droneCount} potential targets.`);
    const newDrones = [];
    for (let i = 0; i < droneCount; i++) {
      newDrones.push(createDrone(i, world));
    }
    setDrones(newDrones);
    setStatus("Drones initialized. Press 'Activate System' to start redirection.");
  };
  
  // Call this when the slider changes
  useEffect(() => {
    if (attackPhase === AttackPhase.INACTIVE) {
      initializeDrones();
    }
  }, [droneCount, attackPhase]); // Re-init if count changes *while inactive*

  const startSimulation = () => {
    if (attackPhase !== AttackPhase.INACTIVE) return;
    
    initializeDrones(); // Ensure drones are set
    setAttackPhase(AttackPhase.NORMAL_FLIGHT);
    setStatus("Phase 1: Hostile drones are en route to the target zone.");
    addFootprint('WARN', `${droneCount} drones detected, proceeding to target.`);

    simulationRef.current = setInterval(runSimulationTick, SIMULATION_SPEED);
  };

  const resetSimulation = () => {
    clearInterval(simulationRef.current);
    setAttackPhase(AttackPhase.INACTIVE);
    setDrones([]);
    setDigitalFootprints([]);
    setStatus("System reset. Adjust drone count and press 'Activate System' to begin.");
  };
  
  // Stop the simulation loop when component unmounts
  useEffect(() => {
    return () => clearInterval(simulationRef.current);
  }, []);


  // --- MAIN SIMULATION TICK ---
  const runSimulationTick = () => {
    let nextPhase = attackPhase;
    let allSecured = true;

    setDrones(prevDrones => {
      const newDrones = prevDrones.map(drone => {
        let newPos = { x: drone.x, y: drone.y };
        let newStatus = drone.status;

        // 1. Check for detection and redirection
        if (drone.status === DroneStatus.NORMAL) {
          allSecured = false;
          // *** MODIFICATION: Check against the new outer detectionFenceRadius ***
          const distanceToTower = dist(drone, antiDroneTower);
          
          if (distanceToTower <= antiDroneTower.detectionFenceRadius) {
            // Drone is detected and redirected
            newStatus = DroneStatus.REDIRECTED;
            if (attackPhase !== AttackPhase.REDIRECTING) {
                nextPhase = AttackPhase.REDIRECTING;
            }
            // Log only once on detection
            if (drone.status !== DroneStatus.REDIRECTED) {
                 addFootprint('ATTACK', `Target ${drone.id}: Hostile intent detected at fence. Rerouting to safe zone.`);
            }
          }
        }
        
        // 2. Determine target based on status
        let target;
        if (newStatus === DroneStatus.NORMAL) {
          target = { x: targetZone.x, y: targetZone.y };
        } else {
          target = { x: safeZone.x, y: safeZone.y };
        }

        // 3. Move the drone
        newPos = moveTowards(drone, target, DRONE_SPEED);
        
        // 4. Check if in safe zone
        if (newStatus === DroneStatus.REDIRECTED) {
            allSecured = false; // Still en route
            const distanceToSafe = dist(newPos, safeZone);
            if(distanceToSafe < safeZone.size / 2) {
                newStatus = DroneStatus.SAFE;
                addFootprint('SPOOF', `Target ${drone.id} has been secured in the safe zone.`);
            }
        }
        
        // Return updated drone state
        return {
          ...drone,
          x: newPos.x,
          y: newPos.y,
          status: newStatus,
          path: [...drone.path, newPos]
        };
      });
      return newDrones;
    });
    
    // Update simulation phase
    if(nextPhase === AttackPhase.REDIRECTING && attackPhase !== AttackPhase.REDIRECTING) {
        setAttackPhase(AttackPhase.REDIRECTING);
        setStatus("Phase 2: Anti-drone system activated. Redirecting all hostile targets at the fence.");
    }
    
    if (allSecured && attackPhase !== AttackPhase.INACTIVE) {
        setAttackPhase(AttackPhase.SECURED);
        setStatus("Phase 3: All hostile drones have been successfully neutralized in the safe zone.");
        addFootprint('AUTH', `All ${droneCount} threats secured. System standing by.`);
        clearInterval(simulationRef.current);
    }
  };

  return (
    <div className="gnss-layout">
      <div className="stage-card large">
        <div className="stage-head">
          <div className="title">🛡️ Mass Redirection Simulation</div>
          <div className="playback-controls">
            <div className="slider-control">
              <label htmlFor="droneCount">Drone Count: {droneCount}</label>
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

        <div className="world" style={{ width: world.width, height: world.height }}>
          <div className="grid" />
          
          {/* Zones */}
          <div className="target-location" style={{ left: targetZone.x, top: targetZone.y, width: targetZone.size, height: targetZone.size }}>
            <span>TARGET</span>
          </div>
          <div className="safe-zone-location" style={{ left: safeZone.x, top: safeZone.y, width: safeZone.size, height: safeZone.size }}>
            <span>SAFE ZONE</span>
          </div>
          
          {/* Anti-Drone Tower */}
          <div className="anti-drone-tower" style={{ left: antiDroneTower.x, top: antiDroneTower.y }}>
            <div className="tower-icon">🛡️</div>
            <span>Anti-Drone C2</span>
            {/* *** MODIFICATION: Inner solid circle *** */}
            <div 
                className="tower-radius" 
                style={{
                    width: antiDroneTower.radius * 2, 
                    height: antiDroneTower.radius * 2
                }}
            />
            {/* *** NEW: Outer dotted fence *** */}
            <div
                className="detection-fence"
                style={{
                    width: antiDroneTower.detectionFenceRadius * 1.5,
                    height: antiDroneTower.detectionFenceRadius * 1.5
                }}
            />
          </div>

          {/* Drones */}
          {drones.map(drone => (
            <div
              key={drone.id}
              className={`drone ${drone.status.toLowerCase()}`}
              style={{ left: drone.x, top: drone.y }}
            >
              <div className="body">🚁</div>
              {drone.status === DroneStatus.NORMAL && <div className="shadow" />}
            </div>
          ))}

          {/* Paths */}
          <svg className="path-svg">
            {drones.map(drone => (
              <polyline
                key={drone.id}
                points={drone.path.map(p => `${p.x + 14},${p.y + 14}`).join(' ')}
                className={drone.status === DroneStatus.NORMAL ? 'actual-path' : 'spoofed-path'}
              />
            ))}
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