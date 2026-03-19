import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * A more accurate wireframe quadcopter:
 *   - Central body (flattened octahedron hull)
 *   - 4 diagonal arms extending outward
 *   - Motor mounts (cylinders) at each arm tip
 *   - Spinning rotor discs (torus) on each motor
 *   - Landing skids underneath
 *   - Camera/sensor pod on the belly
 *   - LED indicators at front
 */
export default function WireframeDrone({ scale = 1, color = "#00f2ff", spinning = true }) {
  const groupRef = useRef();
  const rotorsRef = useRef([]);

  useFrame((_, delta) => {
    if (spinning && rotorsRef.current.length > 0) {
      rotorsRef.current.forEach((rotor) => {
        if (rotor) rotor.rotation.y += delta * 15;
      });
    }
  });

  const s = scale;

  const edgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }),
    [color]
  );
  const dimEdgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }),
    [color]
  );
  const glowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    [color]
  );
  const frontLedMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ff3344", transparent: true, opacity: 0.9 }),
    []
  );

  // Geometries
  const bodyTopGeo = useMemo(() => {
    // Flattened octahedron-like shape for body
    const geo = new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.12 * s, 8, 1);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const bodyBottomGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.28 * s, 0.18 * s, 0.08 * s, 8, 1);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const armGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.06 * s, 0.035 * s, 0.55 * s);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const motorGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.07 * s, 8);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const rotorGeo = useMemo(() => {
    return new THREE.EdgesGeometry(new THREE.TorusGeometry(0.2 * s, 0.012 * s, 4, 20));
  }, [s]);

  const rotorBladeGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.18 * s, 0.02 * s);
    shape.lineTo(0.19 * s, 0);
    shape.lineTo(0.18 * s, -0.02 * s);
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const skidGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.03 * s, 0.15 * s, 0.4 * s);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const skidFootGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.03 * s, 0.02 * s, 0.5 * s);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const cameraGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.06 * s, 6, 6);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  const cameraMountGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.02 * s, 0.03 * s, 0.06 * s, 6);
    return new THREE.EdgesGeometry(geo);
  }, [s]);

  // Arm angle positions (diagonal corners)
  const armAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
  const armLength = 0.3 * s;

  const motorPositions = armAngles.map((angle) => [
    Math.cos(angle) * armLength,
    0.04 * s,
    Math.sin(angle) * armLength,
  ]);

  return (
    <group ref={groupRef}>
      {/* Central Body — top shell */}
      <lineSegments geometry={bodyTopGeo} material={edgeMat} position={[0, 0.04 * s, 0]} />
      {/* Central Body — bottom shell */}
      <lineSegments geometry={bodyBottomGeo} material={edgeMat} position={[0, -0.02 * s, 0]} />

      {/* Arms — 4 diagonal */}
      {armAngles.map((angle, i) => (
        <lineSegments
          key={`arm-${i}`}
          geometry={armGeo}
          material={edgeMat}
          position={[
            Math.cos(angle) * armLength * 0.5,
            0.01 * s,
            Math.sin(angle) * armLength * 0.5,
          ]}
          rotation={[0, -angle + Math.PI / 2, 0]}
        />
      ))}

      {/* Motors + Rotors */}
      {motorPositions.map((pos, i) => (
        <group key={`motor-${i}`}>
          {/* Motor cylinder */}
          <lineSegments geometry={motorGeo} material={edgeMat} position={pos} />

          {/* Rotor assembly (spinning) */}
          <group
            position={[pos[0], pos[1] + 0.06 * s, pos[2]]}
            ref={(el) => (rotorsRef.current[i] = el)}
          >
            {/* Rotor ring */}
            <lineSegments geometry={rotorGeo} material={dimEdgeMat} rotation={[Math.PI / 2, 0, 0]} />
            {/* Blade 1 */}
            <lineSegments geometry={rotorBladeGeo} material={edgeMat} rotation={[Math.PI / 2, 0, 0]} />
            {/* Blade 2 (opposite) */}
            <lineSegments geometry={rotorBladeGeo} material={edgeMat} rotation={[Math.PI / 2, Math.PI, 0]} />
          </group>
        </group>
      ))}

      {/* Landing Skids */}
      <lineSegments geometry={skidGeo} material={dimEdgeMat} position={[0.12 * s, -0.14 * s, 0]} />
      <lineSegments geometry={skidGeo} material={dimEdgeMat} position={[-0.12 * s, -0.14 * s, 0]} />
      {/* Skid feet (horizontal bars) */}
      <lineSegments geometry={skidFootGeo} material={dimEdgeMat} position={[0.12 * s, -0.21 * s, 0]} />
      <lineSegments geometry={skidFootGeo} material={dimEdgeMat} position={[-0.12 * s, -0.21 * s, 0]} />

      {/* Camera/Sensor pod */}
      <lineSegments geometry={cameraMountGeo} material={edgeMat} position={[0, -0.08 * s, 0]} />
      <lineSegments geometry={cameraGeo} material={edgeMat} position={[0, -0.14 * s, 0]} />
      <mesh position={[0, -0.14 * s, 0.04 * s]}>
        <sphereGeometry args={[0.02 * s, 6, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>

      {/* Front LED indicators (red = front orientation marker) */}
      <mesh position={[0, 0.02 * s, 0.28 * s]}>
        <sphereGeometry args={[0.02 * s, 6, 6]} />
        {frontLedMat && <primitive object={frontLedMat} attach="material" />}
      </mesh>
      <mesh position={[0, 0.02 * s, -0.28 * s]}>
        <sphereGeometry args={[0.015 * s, 6, 6]} />
        {glowMat && <primitive object={glowMat} attach="material" />}
      </mesh>

      {/* Center glow core */}
      <mesh position={[0, 0.01 * s, 0]}>
        <sphereGeometry args={[0.04 * s, 8, 8]} />
        {glowMat && <primitive object={glowMat} attach="material" />}
      </mesh>
    </group>
  );
}
