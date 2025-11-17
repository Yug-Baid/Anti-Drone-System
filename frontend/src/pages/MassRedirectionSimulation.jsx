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
const DRONE_SIZE_OFFSET = 14; // Half of drone size for path center

// Helper to generate random starting positions
const createDrone = (id, world) => {
  const y = Math.random() * world.height;
  const x = Math.random() * 100; // Start on the left side
  return {
    id,
    x,
    y,
    status: DroneStatus.NORMAL,
    path: [{ x, y }],
    navTarget: null, // NEW: For pathfinding
  };
};

// --- NEW HELPER: Check for Line-Circle Intersection ---
/**
 * Checks if a line segment (from -> to) intersects a circle.
 */
function isPathBlocked(from, to, circle) {
  const f = { x: from.x + DRONE_SIZE_OFFSET, y: from.y + DRONE_SIZE_OFFSET };
  const t = { x: to.x, y: to.y }; // Target is already a center point
  const c = { x: circle.x, y: circle.y };
  const r = circle.radius + 15; // Add a 15px buffer

  const a = (t.x - f.x) * (t.x - f.x) + (t.y - f.y) * (t.y - f.y);
  const b = 2 * ((t.x - f.x) * (f.x - c.x) + (t.y - f.y) * (f.y - c.y));
  const cc = (f.x - c.x) * (f.x - c.x) + (f.y - c.y) * (f.y - c.y) - r * r;
  
  let det = b * b - 4 * a * cc;
  if (det < 0) {
    return false; // No intersection
  }
  
  det = Math.sqrt(det);
  const t1 = (-b - det) / (2 * a);
  const t2 = (-b + det) / (2 * a);

  // Check if intersection is within the line segment (0 <= t <= 1)
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}


export default function MassRedirectionSimulation() {
  const world = { width: 1000, height: 650 };

  // --- ENTITIES ---
  const [drones, setDrones] = useState([]);
  const [droneCount, setDroneCount] = useState(10);
  const [antiDroneTower] = useState({ 
    x: 500, 
    y: 325, 
    radius: 150, // Smaller inner circle
    detectionFenceRadius: 300 // New outer dotted fence
  });
  const [targetZone] = useState({ x: 850, y: 325, size: 100 });
  const [safeZone] = useState({ x: 500, y: 600, size: 120 });
  
  // --- NEW: Navigation waypoints to fly around tower ---
  const navNodes = [
    { x: antiDroneTower.x - antiDroneTower.radius - 50, y: antiDroneTower.y }, // Left node
    { x: antiDroneTower.x + antiDroneTower.radius + 50, y: antiDroneTower.y }  // Right node
  ];
  const safeZoneTarget = { x: safeZone.x, y: safeZone.y };


  // --- SIMULATION STATE ---
  const [attackPhase, setAttackPhase] = useState(AttackPhase.INACTIVE);
  const [status, setStatus] = useState("Adjust drone count and press 'Activate System' to begin.");
  const [digitalFootprints, setDigitalFootprints] = useState([]);
  const [finalPositions, setFinalPositions] = useState([]); // NEW: For footprints

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

  const initializeDrones = () => {
    if (attackPhase !== AttackPhase.INACTIVE) return;
    setDigitalFootprints([]);
    setFinalPositions([]); // NEW: Clear footprints
    addFootprint('AUTH', `System armed. Preparing for ${droneCount} potential targets.`);
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
    addFootprint('WARN', `${droneCount} drones detected, proceeding to target.`);

    simulationRef.current = setInterval(runSimulationTick, SIMULATION_SPEED);
  };

  const resetSimulation = () => {
    clearInterval(simulationRef.current);
    setAttackPhase(AttackPhase.INACTIVE);
    setDrones([]);
    setDigitalFootprints([]);
    setFinalPositions([]); // NEW: Clear footprints
    setStatus("System reset. Adjust drone count and press 'Activate System' to begin.");
  };
  
  useEffect(() => {
    return () => clearInterval(simulationRef.current);
  }, []);


  // --- MAIN SIMULATION TICK ---
  const runSimulationTick = () => {
    let nextPhase = attackPhase;
    let allSecured = true;
    let newDronesList = []; // To store drones for final position logging

    setDrones(prevDrones => {
      newDronesList = prevDrones.map(drone => {
        let newPos = { x: drone.x, y: drone.y };
        let newStatus = drone.status;
        let newNavTarget = drone.navTarget;

        // 1. Check for detection and redirection
        if (drone.status === DroneStatus.NORMAL) {
          allSecured = false;
          const distanceToTower = dist(drone, antiDroneTower);
          
          if (distanceToTower <= antiDroneTower.detectionFenceRadius) {
            // Drone is detected and redirected
            newStatus = DroneStatus.REDIRECTED;
            if (attackPhase !== AttackPhase.REDIRECTING) {
                nextPhase = AttackPhase.REDIRECTING;
            }
            if (drone.status !== DroneStatus.REDIRECTED) {
                 addFootprint('ATTACK', `Target ${drone.id}: Hostile intent detected at fence. Rerouting to safe zone.`);
                 
                 // --- NEW: PATHFINDING LOGIC ---
                 if (isPathBlocked(drone, safeZoneTarget, antiDroneTower)) {
                    // Path is blocked, find closest nav node
                    const distToNode0 = dist(drone, navNodes[0]);
                    const distToNode1 = dist(drone, navNodes[1]);
                    newNavTarget = (distToNode0 < distToNode1) ? navNodes[0] : navNodes[1];
                    addFootprint('AUTH', `Target ${drone.id}: Path blocked. Rerouting via NavNode.`);
                 } else {
                    // Path is clear
                    newNavTarget = safeZoneTarget;
                 }
                 // --- END NEW PATHFINDING ---
            }
          }
        }
        
        // 2. Determine target based on status
        let target;
        if (newStatus === DroneStatus.NORMAL) {
          target = { x: targetZone.x, y: targetZone.y };
        } else {
          target = newNavTarget || safeZoneTarget; // Use navTarget if it exists
        }

        // 3. Move the drone
        newPos = moveTowards(drone, target, DRONE_SPEED);
        
        // --- NEW: Check if intermediate navTarget is reached ---
        if (newStatus === DroneStatus.REDIRECTED && newNavTarget && newNavTarget !== safeZoneTarget) {
            if (dist(newPos, newNavTarget) < DRONE_SPEED * 2) {
                newNavTarget = safeZoneTarget; // Now head to the final safe zone
            }
        }
        // --- END NEW CHECK ---

        // 4. Check if in safe zone
        if (newStatus === DroneStatus.REDIRECTED) {
            allSecured = false; // Still en route
            const distanceToSafe = dist(newPos, safeZoneTarget);
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
          path: [...drone.path, newPos],
          navTarget: newNavTarget, // NEW: Persist navTarget
        };
      });
      return newDronesList;
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
        
        // --- NEW: Set final positions for footprints ---
        setFinalPositions(newDronesList.map(d => ({ id: d.id, x: d.x, y: d.y, status: 'safe' })));
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
            <div 
                className="tower-radius" 
                style={{
                    width: antiDroneTower.radius * 2, 
                    height: antiDroneTower.radius * 2
                }}
            />
            <div
                className="detection-fence"
                style={{
                    width: antiDroneTower.detectionFenceRadius * 2,
                    height: antiDroneTower.detectionFenceRadius * 2
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

          {/* --- NEW: Final Position Footprints --- */}
          {finalPositions.map(pos => (
            <div
              key={pos.id}
              className="footprint-marker safe"
              style={{ left: pos.x + DRONE_SIZE_OFFSET, top: pos.y + DRONE_SIZE_OFFSET }}
            />
          ))}

          {/* Paths */}
          <svg className="path-svg">
            {drones.map(drone => (
              <polyline
                key={drone.id}
                points={drone.path.map(p => `${p.x + DRONE_SIZE_OFFSET},${p.y + DRONE_SIZE_OFFSET}`).join(' ')}
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