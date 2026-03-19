import React, { useEffect, useRef } from 'react';

// A simple component to render log entries with different colors based on type
const LogEntry = ({ log }) => {
  const getLogClass = (type) => {
    switch (type) {
      case 'AUTH': return 'log-auth';
      case 'WARN': return 'log-warn';
      case 'ATTACK': return 'log-attack';
      case 'SPOOF': return 'log-spoof';
      default: return '';
    }
  };

  return (
    <div className={`log-entry ${getLogClass(log.type)}`}>
      <span className="log-timestamp">{log.timestamp}</span>
      <span className="log-message">{log.message}</span>
    </div>
  );
};


export default function InfoPanel({ attackPhase, status, digitalFootprints }) {
  const logContainerRef = useRef(null);

  // Auto-scroll only the log container, not the page
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [digitalFootprints]);

  // Descriptions for each phase of the attack
  const phaseDescriptions = {
    INACTIVE: 'Simulation is idle. Press "Start Simulation" to begin.',
    NORMAL_FLIGHT: 'The drone is receiving authentic GPS signals from satellites and navigating to the intended target coordinates.',
    JAMMING: 'The attacker is broadcasting a powerful radio signal to overwhelm the drone\'s receiver, drowning out the weak satellite signals.',
    SPOOFING: 'With the authentic signals blocked, the attacker begins transmitting counterfeit GPS data. The drone\'s receiver locks onto the fake signals.',
    HIJACKED: 'The drone is now fully controlled by the counterfeit signals. It believes it is still on the correct path, but its actual physical location is being diverted.',
    COMPLETED: 'The attack is successful. The drone\'s internal navigation system reports that it has arrived at the target, while its real-world position is at the attacker\'s chosen location.',
  };

  return (
    <div className="info-panel">
      <div className="info-section">
        <h3>Attack Phase: <span className="phase-text">{attackPhase.replace('_', ' ')}</span></h3>
        <p className="phase-description">{phaseDescriptions[attackPhase]}</p>
      </div>

      <div className="info-section">
        <h3>Status Message</h3>
        <p className="status-message">{status}</p>
      </div>

      <div className="info-section">
        <h3>Digital Footprints & Telemetry</h3>
        <div className="footprints-log" ref={logContainerRef}>
          {digitalFootprints.map((log, index) => (
            <LogEntry key={index} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}