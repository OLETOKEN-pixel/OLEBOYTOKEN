import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

interface MascotMeshProps {
  hovered: boolean;
  clicked: boolean;
  scale: number;
}

function MascotMesh({ hovered, clicked, scale: baseScale }: MascotMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const bounceRef = useRef(0);
  const blinkTimer = useRef(0);
  const isBlinking = useRef(false);
  const nextBlink = useRef(3 + Math.random() * 2);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#3A3A3A'),
        metalness: 0.1,
        roughness: 0.6,
        clearcoat: 0.3,
      }),
    []
  );

  const goldMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFC805'),
        metalness: 0.8,
        roughness: 0.25,
        clearcoat: 0.5,
      }),
    []
  );

  const eyeWhiteMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFFFFF'),
        metalness: 0.0,
        roughness: 0.3,
      }),
    []
  );

  const pupilMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#1A1A1A'),
        metalness: 0.0,
        roughness: 0.4,
      }),
    []
  );

  const smileMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#2A2A2A'),
        metalness: 0.0,
        roughness: 0.5,
      }),
    []
  );

  const smileGeom = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.18, -0.15, 0.42),
      new THREE.Vector3(0, -0.25, 0.45),
      new THREE.Vector3(0.18, -0.15, 0.42)
    );
    const points = curve.getPoints(12);
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      8,
      0.015,
      6,
      false
    );
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !headRef.current) return;

    const t = performance.now() * 0.001;

    const breathScale = 1.0 + Math.sin(t * 1.2) * 0.02;
    groupRef.current.scale.setScalar(baseScale * breathScale);

    headRef.current.rotation.y = Math.sin(t * 0.7) * 0.1;

    if (hovered) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0.08,
        0.05
      );
    } else {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0,
        0.03
      );
    }

    if (clicked) {
      bounceRef.current = Math.min(bounceRef.current + delta * 8, 1);
    } else {
      bounceRef.current = Math.max(bounceRef.current - delta * 3, 0);
    }
    const bounceY = Math.sin(bounceRef.current * Math.PI) * 0.3;
    groupRef.current.position.y = Math.sin(t * 0.6) * 0.04 + bounceY;

    blinkTimer.current += delta;
    if (blinkTimer.current >= nextBlink.current && !isBlinking.current) {
      isBlinking.current = true;
      blinkTimer.current = 0;
      nextBlink.current = 3 + Math.random() * 2;
    }

    if (isBlinking.current) {
      const blinkProgress = blinkTimer.current / 0.15;
      if (blinkProgress < 1) {
        const squish = 1 - Math.sin(blinkProgress * Math.PI) * 0.8;
        if (leftEyeRef.current) leftEyeRef.current.scale.y = squish;
        if (rightEyeRef.current) rightEyeRef.current.scale.y = squish;
      } else {
        isBlinking.current = false;
        if (leftEyeRef.current) leftEyeRef.current.scale.y = 1;
        if (rightEyeRef.current) rightEyeRef.current.scale.y = 1;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <mesh material={bodyMat} position={[0, -0.55, 0]}>
        <capsuleGeometry args={[0.3, 0.5, 8, 16]} />
      </mesh>

      <group ref={headRef} position={[0, 0.3, 0]}>
        <mesh material={bodyMat}>
          <sphereGeometry args={[0.45, 24, 24]} />
        </mesh>

        <group position={[-0.15, 0.05, 0.35]}>
          <mesh ref={leftEyeRef} material={eyeWhiteMat}>
            <sphereGeometry args={[0.1, 16, 16]} />
          </mesh>
          <mesh material={pupilMat} position={[0, 0, 0.07]}>
            <sphereGeometry args={[0.05, 12, 12]} />
          </mesh>
        </group>

        <group position={[0.15, 0.05, 0.35]}>
          <mesh ref={rightEyeRef} material={eyeWhiteMat}>
            <sphereGeometry args={[0.1, 16, 16]} />
          </mesh>
          <mesh material={pupilMat} position={[0, 0, 0.07]}>
            <sphereGeometry args={[0.05, 12, 12]} />
          </mesh>
        </group>

        <mesh geometry={smileGeom} material={smileMat} />

        <mesh material={goldMat} position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.38, 0.035, 8, 32, Math.PI]} />
        </mesh>

        <mesh material={bodyMat} position={[-0.46, 0.1, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.12, 0.04, 8, 16]} />
        </mesh>
        <mesh material={bodyMat} position={[0.46, 0.1, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.12, 0.04, 8, 16]} />
        </mesh>

        <mesh material={goldMat} position={[-0.46, 0.1, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
        </mesh>
        <mesh material={goldMat} position={[0.46, 0.1, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
        </mesh>
      </group>

      <mesh material={bodyMat} position={[-0.2, -0.95, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
      </mesh>
      <mesh material={bodyMat} position={[0.2, -0.95, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
      </mesh>

      <mesh material={bodyMat} position={[-0.35, -0.45, 0]}>
        <capsuleGeometry args={[0.06, 0.2, 4, 8]} />
      </mesh>
      <mesh material={bodyMat} position={[0.35, -0.45, 0]}>
        <capsuleGeometry args={[0.06, 0.2, 4, 8]} />
      </mesh>
    </group>
  );
}

interface Mascot3DProps {
  scale?: number;
  className?: string;
  width?: number | string;
  height?: number | string;
}

export default function Mascot3D({
  scale = 1,
  className,
  width = 300,
  height = 300,
}: Mascot3DProps) {
  if (typeof window === 'undefined') return null;

  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  const handlePointerOver = useCallback(() => setHovered(true), []);
  const handlePointerOut = useCallback(() => {
    setHovered(false);
    setClicked(false);
  }, []);
  const handlePointerDown = useCallback(() => setClicked(true), []);
  const handlePointerUp = useCallback(() => setClicked(false), []);

  return (
    <div
      className={className}
      style={{
        width,
        height,
        cursor: hovered ? 'pointer' : 'default',
      }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 40 }}
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <directionalLight position={[2, 3, 4]} intensity={1.2} color="#FFF5E0" />
        <directionalLight position={[-2, -1, 2]} intensity={0.3} color="#B0C4DE" />
        <ambientLight intensity={0.4} color="#FFF8F0" />

        <MascotMesh hovered={hovered} clicked={clicked} scale={scale} />

        <Environment preset="sunset" />
      </Canvas>
    </div>
  );
}
