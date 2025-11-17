import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// Updated SPOOFING array with more detailed descriptions
const SPOOFING = [
  {
    key: "gnss",
    name: "GNSS/GPS Spoofing",
    desc:
      "An attacker broadcasts counterfeit, high-power satellite signals to trick the drone's navigation receiver into calculating a false position, altitude, or time. " +
      "Defenses: Multi-constellation/multi-frequency receivers (L1/L2/L5), signal authentication (e.g., Galileo OSNMA), and Receiver Autonomous Integrity Monitoring (RAIM).",
    deepDesc:
      "This is a 'power-gaining' attack. The spoofer first synchronizes its fake signal with the authentic, weaker satellite signals. It then gradually increases its signal power until the drone's receiver 'locks on' to the malicious signal as the dominant source. Once captured, the attacker can slowly introduce a positional 'delta', causing the drone to drift off-course towards an unintended target. Because the drone *believes* it is following its flight plan (and reports this to the operator), it will not issue an error. Advanced defenses like RAIM cross-check the signals from all visible satellites; if one signal (the spoofer) presents data inconsistent with the others, it can be flagged and rejected. Signal authentication, like Galileo's Open Service Navigation Message Authentication (OSNMA), provides a cryptographic way to verify the signal is from a real satellite."
  },
  {
    key: "c2",
    name: "Command & Control Spoofing",
    desc:
      "The attacker intercepts or overpowers the operator's control link to inject malicious commands, such as 'land' or 'change waypoint'. " +
      "Defenses: Strong link-layer encryption (AES-256), authenticated message protocols, and Frequency-Hopping Spread Spectrum (FHSS) radios.",
    deepDesc:
      "This attack targets the radio frequency (RF) link between the pilot and the drone. If the link is unencrypted, an attacker can simply 'sniff' the packets, reverse-engineer the command structure, and transmit their own commands. In a more advanced 'man-in-the-middle' attack, the attacker uses directional antennas to overpower the signals from both the operator and the drone, placing themselves as an invisible relay. They can then selectively read, block, or modify commands. Robust defenses use strong, authenticated encryption for all C2 traffic and employ FHSS, where the radio rapidly changes frequencies, making it extremely difficult for an attacker to predict the next channel and intercept the link."
  },
  {
    key: "protocol",
    name: "Protocol Exploits",
    desc:
      "Targets software vulnerabilities in the drone's communication protocol stack (e.g., MAVLink, DroneCAN) to cause a system crash or execute arbitrary code. " +
      "Defenses: Secure coding practices, firmware signing, input validation/fuzzing, and network-based intrusion detection systems (IDS).",
    deepDesc:
      "This is a digital-layer attack that doesn't rely on RF signal strength. It assumes the attacker has already gained access to the network (e.g., a compromised ground station or an open Wi-Fi link). The attacker sends a perfectly-formed but malicious packet that exploits a software flaw. A common example is a buffer overflow, where a data field is filled with more data than the program expects, overwriting adjacent memory to execute the attacker's code. If the protocol lacks message signing, an attacker can also send fake (but valid) telemetry packets that trick the operator or autonomous systems, such as spoofing a low battery status to force a landing."
  },
  {
    key: "sensor",
    name: "Sensor Spoofing",
    desc:
      "Uses external physical stimuli (lasers, acoustic waves, magnetic fields) to confuse non-GNSS sensors like IMUs, LiDAR, magnetometers, or optical flow cameras. " +
      "Defenses: Robust sensor fusion algorithms (e.g., Extended Kalman Filters), physical sensor shielding, and anomaly detection.",
    deepDesc:
      "This attack targets the drone's 'senses' directly. An Inertial Measurement Unit (IMU), which contains gyroscopes and accelerometers, operates using tiny vibrating structures. A precisely-timed acoustic (sound) wave can match the resonant frequency of these structures, introducing massive errors and causing the drone to lose stability. Similarly, a high-power laser can 'blind' optical flow or LiDAR sensors, and a strong electromagnet can render the magnetometer (compass) useless. The primary defense is **sensor fusion**. The flight controller's algorithm (often an Extended Kalman Filter) constantly compares data from *all* sensors. If the IMU suddenly reports a 90-degree flip, but the GPS, barometer, and vision sensors all report stable flight, the algorithm can 'vote' to reject the faulty IMU data, maintaining control."
  },
  {
    key: "injection",
    name: "Data Injection Attacks",
    desc:
      "A subtle 'low and slow' attack that corrupts high-precision correction streams (like RTK or DGPS) to cause a slow, controlled, and imperceptible drift in navigation. " +
      "Defenses: Cryptographic signing and authentication of all correction data streams, and cross-validation between multiple independent base stations.",
    deepDesc:
      "This advanced attack targets high-precision drones that rely on Real-Time Kinematic (RTK) or Differential GPS (DGPS) for centimeter-level accuracy. This correction data is often sent over a separate, unauthenticated radio or internet link. An attacker can intercept this stream and inject their own, slightly modified correction packets. The drone's navigation system, believing the data is valid, will 'correctly' calculate a position that is slowly drifting away from its true location. Because there is no sudden jump in position, standard anomaly detection (like RAIM) will not be triggered. The drone and operator believe the flight is perfectly accurate, while the drone is actually several meters (or even kilometers) off-course. The only robust defense is to require all correction data to be cryptographically signed by a trusted source."
  },
];

export default function Landing() {
  const nav = useNavigate();
  const [selKey, setSelKey] = useState(SPOOFING[0].key);

  const selected = useMemo(() => SPOOFING.find(s => s.key === selKey), [selKey]);

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">Anti-Drone Technology</h1>
          <p className="hero-sub">
            Explore how spoofing affects UAV navigation and how defenses respond.
            Choose a technique to learn more, then launch the live simulation.
          </p>

          {/* Controls */}
          <div className="hero-controls">
            <label className="select-label" htmlFor="spoofing-type">
              Spoofing Type
            </label>
            <select
              id="spoofing-type"
              className="select"
              value={selKey}
              onChange={(e) => setSelKey(e.target.value)}
            >
              {SPOOFING.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>

            <button className="btn btn-primary" onClick={() => nav("/simulate")}>
              ▶ Start Simulation
            </button>
          </div>

          {/* Info + Media */}
          <div className="info-grid">
            <article className="card info">
              <h3 className="info-title">{selected?.name}</h3>
              <p className="info-text">{selected?.desc}</p>
              <div className="info-meta">
                <span className="tag">Attack Vector</span>
                <span className="sep">•</span>
                <span className="muted">Learn more on the Spoofing Types page</span>
              </div>
            </article>

            {/* Replaced video player with a new info card for the deep dive */}
            <article className="card info" aria-label="Technical Deep Dive">
              <h3 className="info-title">Technical Deep Dive</h3>
              <p className="info-text">{selected?.deepDesc}</p>
              
              {/* Added Contributors List */}
              <div className="info-meta" style={{ marginTop: '16px' }}>
                <span className="tag">Contributors</span>
                <span className="sep">•</span>
                <span className="muted">
                  Yug Baid, Zenith Gupta, Arpit Kumar, Lovenish, Yuvraj Singh
                </span>
              </div>
            </article>
            
          </div>
        </div>
      </section>
    </div>
  );
}