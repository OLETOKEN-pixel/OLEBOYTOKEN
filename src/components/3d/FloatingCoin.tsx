import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function MiniCoin() {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFC805'),
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.5,
      }),
    []
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <mesh ref={meshRef} material={material}>
      <cylinderGeometry args={[0.8, 0.8, 0.1, 32]} />
    </mesh>
  );
}

interface FloatingCoinProps {
  className?: string;
  width?: number;
  height?: number;
}

export default function FloatingCoin({
  className,
  width = 60,
  height = 60,
}: FloatingCoinProps) {
  if (typeof window === 'undefined') return null;

  return (
    <div className={className} style={{ width, height }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 40 }}
        gl={{ antialias: false, alpha: true, failIfMajorPerformanceCaveat: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.5} color="#FFF8F0" />
        <directionalLight position={[2, 2, 3]} intensity={1.0} color="#FFF5E0" />
        <MiniCoin />
      </Canvas>
    </div>
  );
}
