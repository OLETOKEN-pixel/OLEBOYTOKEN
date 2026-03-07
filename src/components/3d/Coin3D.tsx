import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

interface CoinMeshProps {
  size: number;
  autoRotate: boolean;
  interactive: boolean;
  hovered: boolean;
}

function CoinMesh({ size, autoRotate, interactive, hovered }: CoinMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer, clock } = useThree();

  const goldMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFC805'),
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.5,
        clearcoatRoughness: 0.15,
        envMapIntensity: 1.2,
      }),
    []
  );

  const edgeMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#B8912A'),
        metalness: 0.95,
        roughness: 0.25,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2,
      }),
    []
  );

  const faceMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFC805'),
        metalness: 0.92,
        roughness: 0.15,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
      }),
    []
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (autoRotate) {
      const speed = hovered ? 0.8 : 0.4;
      groupRef.current.rotation.y += delta * speed;
    }

    if (interactive) {
      const targetTiltX = pointer.y * 0.1;
      const targetTiltZ = -pointer.x * 0.1;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        targetTiltX,
        0.03
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        targetTiltZ,
        0.03
      );
    }

    const t = clock.getElapsedTime();
    groupRef.current.position.y = Math.sin(t * 0.6) * 0.06;
  });

  const thickness = size * 0.14;
  const bevel = size * 0.035;

  return (
    <group ref={groupRef}>
      <mesh material={goldMaterial}>
        <cylinderGeometry args={[size - bevel, size - bevel, thickness, 64]} />
      </mesh>

      <mesh material={edgeMaterial} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size - bevel, bevel, 12, 64]} />
      </mesh>

      <mesh position={[0, thickness / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} material={faceMaterial}>
        <ringGeometry args={[size * 0.4, size * 0.52, 64]} />
      </mesh>
      <mesh position={[0, thickness / 2 + 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={faceMaterial}>
        <ringGeometry args={[size * 0.18, size * 0.23, 64]} />
      </mesh>
      <mesh position={[0, -(thickness / 2 + 0.005), 0]} rotation={[Math.PI / 2, 0, 0]} material={faceMaterial}>
        <ringGeometry args={[size * 0.4, size * 0.52, 64]} />
      </mesh>
    </group>
  );
}

interface Coin3DProps {
  size?: number;
  autoRotate?: boolean;
  interactive?: boolean;
  className?: string;
}

export default function Coin3D({
  size = 2,
  autoRotate = true,
  interactive = true,
  className,
}: Coin3DProps) {
  if (typeof window === 'undefined') return null;

  const [hovered, setHovered] = useState(false);

  const handlePointerOver = useCallback(() => setHovered(true), []);
  const handlePointerOut = useCallback(() => setHovered(false), []);

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', cursor: hovered ? 'pointer' : 'default' }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
      >
        <directionalLight position={[3, 4, 5]} intensity={1.5} color="#FFF5E0" />
        <directionalLight position={[-2, -1, 3]} intensity={0.4} color="#B0C4DE" />
        <directionalLight position={[0, -2, -3]} intensity={0.3} color="#FFC805" />
        <ambientLight intensity={0.25} color="#FFF8F0" />

        <CoinMesh size={size} autoRotate={autoRotate} interactive={interactive} hovered={hovered} />

        <Environment preset="sunset" />
      </Canvas>
    </div>
  );
}
