import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import DroneSimulation from "./pages/DroneSimulation.jsx";
import SpoofingInfo from "./pages/SpoofingInfo.jsx";
import GnssSpoofingSimulation from "./pages/GnssSpoofingSimulation.jsx";
import DataInjectionSimulation from "./pages/DataInjectionSimulation.jsx";
// 1. IMPORT THE NEW SIMULATION
import MassRedirectionSimulation from "./pages/MassRedirectionSimulation.jsx"; 
import "./styles.css";

export default function App() {
  return (
    <Router>
      <header className="app-header">
        <div className="brand">🛡️ Anti-Drone Control</div>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/simulate">Simulation</Link>
          <Link to="/gnss-spoofing">GNSS Attack Sim</Link>
          <Link to="/data-injection">Data Injection Sim</Link>
          {/* 2. ADD THE NEW LINK */}
          <Link to="/mass-redirection">Mass Redirection Sim</Link>
          <Link to="/spoofing-info">Spoofing Types</Link>
     
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/simulate" element={<DroneSimulation />} />
          <Route path="/gnss-spoofing" element={<GnssSpoofingSimulation />} />
          <Route path="/data-injection" element={<DataInjectionSimulation />} />
          {/* 3. ADD THE NEW ROUTE */}
          <Route path="/mass-redirection" element={<MassRedirectionSimulation />} />
          <Route path="/spoofing-info" element={<SpoofingInfo />} />
        </Routes>
      </main>
    </Router>
  );
}