import React, { useState, useEffect, useRef, useCallback } from "react";
import Dashboard from "../components/Dashboard.jsx";
import "../DroneSimulation.css"; // Make sure to import the CSS

const world = { width: 800, height: 600 };
const droneSize = { width: 40, height: 40 };

// --- Main Game State ---
const initialState = {
  drone: {
    x: world.width / 2 - droneSize.width / 2,
    y: world.height - droneSize.height - 20,
    width: droneSize.width,
    height: droneSize.height,
    speed: 5,
    isSpoofed: false,
    isRedirecting: false,
  },
  // *** MODIFICATION: Added two radii. Inner (solid) and Outer (dotted fence) ***
  dangerZone: {
    x: world.width / 2,
    y: 120,
    radius: 100, // The inner solid red circle
    fenceRadius: 150, // The new outer dotted fence
  },
  safeZone: {
    x: 60,
    y: 60,
    size: 100,
  },
  statusMessage: "Use WASD or Arrow Keys to fly the drone.",
};

// --- Pure Helper Functions ---
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const checkBounds = (rect, bounds) => {
  rect.x = Math.max(0, Math.min(rect.x, bounds.width - rect.width));
  rect.y = Math.max(0, Math.min(rect.y, bounds.height - rect.height));
  return rect;
};

// --- Custom Hook: Keyboard Input ---
function useKeyboardInput() {
  const [keys, setKeys] = useState(new Set());
  useEffect(() => {
    const handleDown = (e) => setKeys((prev) => new Set(prev).add(e.key));
    const handleUp = (e) => {
      setKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.key);
        return next;
      });
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, []);
  return keys;
}

// --- Custom Hook: Main Game Loop ---
function useGameLoop(onLog) {
  const [state, setState] = useState(initialState);
  const keys = useKeyboardInput();
  const gameRef = useRef(null);

  const { drone, dangerZone, safeZone } = state;

  const moveDrone = (drone, keys) => {
    let { x, y, speed } = drone;
    if (keys.has("w") || keys.has("ArrowUp")) y -= speed;
    if (keys.has("s") || keys.has("ArrowDown")) y += speed;
    if (keys.has("a") || keys.has("ArrowLeft")) x -= speed;
    if (keys.has("d") || keys.has("ArrowRight")) x += speed;
    return checkBounds({ ...drone, x, y }, world);
  };

  const updateGame = useCallback(() => {
    setState((prevState) => {
      let { drone, statusMessage } = { ...prevState };

      if (drone.isRedirecting) {
        // --- REDIRECTION LOGIC ---
        const target = { x: safeZone.x + 20, y: safeZone.y + 20 };
        const distToSafe = distance(drone, target);

        if (distToSafe < drone.speed) {
          // Arrived at safe zone
          drone.x = target.x;
          drone.y = target.y;
          drone.isRedirecting = false;
          drone.isSpoofed = true; // Stays spoofed
          statusMessage = "System Breach! Drone landed in Safe Zone.";
          onLog("System Breach! Drone landed in Safe Zone.");
        } else {
          // Move towards safe zone
          const dx = target.x - drone.x;
          const dy = target.y - drone.y;
          const angle = Math.atan2(dy, dx);
          drone.x += Math.cos(angle) * drone.speed;
          drone.y += Math.sin(angle) * drone.speed;
        }
      } else if (!drone.isSpoofed) {
        // --- NORMAL FLIGHT LOGIC ---
        drone = moveDrone(drone, keys);
        
        // *** MODIFICATION: Check against the outer fenceRadius ***
        const distToDanger = distance(drone, dangerZone);
        
        if (distToDanger < dangerZone.fenceRadius) {
          // Breached the outer fence!
          drone.isSpoofed = true;
          drone.isRedirecting = true;
          statusMessage = "DANGER! Geofence breached. Spoofing signal...";
          onLog("DANGER! Geofence breached. Initiating redirection.");
        }
      }

      return { ...prevState, drone, statusMessage };
    });
  }, [keys, onLog]);

  useEffect(() => {
    gameRef.current = setInterval(updateGame, 1000 / 60); // 60 FPS
    return () => clearInterval(gameRef.current);
  }, [updateGame]);

  const resetGame = () => {
    setState(initialState);
    onLog("Simulation Reset.");
  };

  // --- Calculate derived state for the Dashboard ---
  const droneCenter = {
    x: drone.x + drone.width / 2,
    y: drone.y + drone.height / 2,
  };
  
  // *** MODIFICATION: Check both radii ***
  const isInsideDangerZone = distance(droneCenter, dangerZone) < dangerZone.radius;
  const isInsideFence = distance(droneCenter, dangerZone) < dangerZone.fenceRadius;

  const isInsideSafeZone =
    drone.x > safeZone.x &&
    drone.x < safeZone.x + safeZone.size - drone.width &&
    drone.y > safeZone.y &&
    drone.y < safeZone.y + safeZone.size - drone.height;

  const dashboardState = {
    x: drone.x,
    y: drone.y,
    width: drone.width,
    height: drone.height,
    speed: drone.speed,
    spoofed: drone.isSpoofed,
    redirecting: drone.isRedirecting,
    status: state.statusMessage,
    danger: {
      x: dangerZone.x,
      y: dangerZone.y,
      size: dangerZone.radius * 2,
    },
    safe: {
      x: safeZone.x,
      y: safeZone.y,
      size: safeZone.size,
    },
    // *** MODIFICATION: Use the outer fence for the "In Danger" chip ***
    inDanger: isInsideFence, 
    inSafe: isInsideSafeZone,
  };

  return { state, dashboardState, resetGame };
}

// --- Main Component ---
export default function DroneSimulation() {
  const [logs, setLogs] = useState([]);

  const handleLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 5));
  };

  const { state, dashboardState, resetGame } = useGameLoop(handleLog);
  const { drone, dangerZone, safeZone } = state;

  return (
    <div className="simulation-layout">
      {/* Simulation World */}
      <div className="simulation-world-container">
        <button onClick={resetGame} className="reset-button">
          Reset Simulation
        </button>

        <div
          className="simulation-world"
          style={{ width: world.width, height: world.height }}
        >
          {/* Safe Zone */}
          <div
            className="safe-zone"
            style={{
              left: safeZone.x,
              top: safeZone.y,
              width: safeZone.size,
              height: safeZone.size,
            }}
          >
            SAFE ZONE
          </div>

          {/* Danger Zone (Inner Solid) */}
          <div
            className="danger-zone"
            style={{
              left: dangerZone.x - dangerZone.radius,
              top: dangerZone.y - dangerZone.radius,
              width: dangerZone.radius * 2,
              height: dangerZone.radius * 2,
            }}
          >
            NO FLY ZONE
          </div>

          {/* *** NEW: Danger Zone (Outer Dotted Fence) *** */}
          <div
            className="danger-fence"
            style={{
              left: dangerZone.x - dangerZone.fenceRadius,
              top: dangerZone.y - dangerZone.fenceRadius,
              width: dangerZone.fenceRadius * 2,
              height: dangerZone.fenceRadius * 2,
            }}
          />

          {/* Drone */}
          <div
            className={`drone ${drone.isSpoofed ? "spoofed" : ""}`}
            style={{
              left: drone.x,
              top: drone.y,
              width: drone.width,
              height: drone.height,
            }}
          >
            <div className="drone-body">🚁</div>
            <div className="drone-shadow" />
          </div>
        </div>
      </div>

      {/* Dashboard Panel */}
      <Dashboard state={dashboardState} />

      {/* Log Panel */}
      <div className="log-panel">
        <h3 className="panel-title">📡 System Logs</h3>
        <div className="logs">
          {logs.length === 0 && <p className="empty-log">No events yet...</p>}
          {logs.map((log, i) => (
            <p key={i} className={log.includes("DANGER") ? "log-danger" : ""}>
              {log}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}