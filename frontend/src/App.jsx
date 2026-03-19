import React, { useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { gsap } from "gsap";
import Landing from "./pages/Landing.jsx";
import DroneSimulation from "./pages/DroneSimulation.jsx";
import SpoofingInfo from "./pages/SpoofingInfo.jsx";
import GnssSpoofingSimulation from "./pages/GnssSpoofingSimulation.jsx";
import DataInjectionSimulation from "./pages/DataInjectionSimulation.jsx";
import MassRedirectionSimulation from "./pages/MassRedirectionSimulation.jsx";
import DKFSimulation from "./pages/DKFSimulation.jsx";
import MissionFailure from "./pages/MissionFailure.jsx";
import "./styles.css";

function PageTransition({ children }) {
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [location.pathname]);

  return <div ref={ref}>{children}</div>;
}

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`nav-link ${isActive ? "nav-link--active" : ""}`}>
      {children}
    </Link>
  );
}

export default function App() {
  return (
    <Router>
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-icon">⬡</span>
          <span className="brand-text">CYBER-PHYSICAL DEFENSE</span>
        </Link>
        <nav className="nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/simulate">Drone Sim</NavLink>
          <NavLink to="/gnss-spoofing">GNSS Attack</NavLink>
          <NavLink to="/data-injection">Data Injection</NavLink>
          <NavLink to="/mass-redirection">Mass Redirect</NavLink>
          <NavLink to="/dkf-simulation">DKF-FDI</NavLink>
          <NavLink to="/mission-failure">Mission Failure</NavLink>
          <NavLink to="/spoofing-info">Research</NavLink>
        </nav>
      </header>

      <main className="app-main">
        <PageTransition>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/simulate" element={<DroneSimulation />} />
            <Route path="/gnss-spoofing" element={<GnssSpoofingSimulation />} />
            <Route path="/data-injection" element={<DataInjectionSimulation />} />
            <Route path="/mass-redirection" element={<MassRedirectionSimulation />} />
            <Route path="/dkf-simulation" element={<DKFSimulation />} />
            <Route path="/mission-failure" element={<MissionFailure />} />
            <Route path="/spoofing-info" element={<SpoofingInfo />} />
          </Routes>
        </PageTransition>
      </main>
    </Router>
  );
}