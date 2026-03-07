import React, { useRef, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

function LogoMesh({ hovered }: { hovered: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { pointer, clock } = useThree();

  const texture = useTexture('/logo-oleboy.png');

  useFrame(() => {
    if (!meshRef.current) return;

    const t = clock.getElapsedTime();
    meshRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    meshRef.current.position.y = Math.sin(t * 0.6) * 0.04;

    if (hovered) {
      const targetTiltX = pointer.y * 0.08;
      const targetTiltZ = -pointer.x * 0.08;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        targetTiltX,
        0.04
      );
      meshRef.current.rotation.z = THREE.MathUtils.lerp(
        meshRef.current.rotation.z,
        targetTiltZ,
        0.04
      );
    } else {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.03);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, 0, 0.03);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface Logo3DProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function Logo3D({
  width = 120,
  height = 120,
  className,
}: Logo3DProps) {
  if (typeof window === 'undefined') return null;

  const [hovered, setHovered] = useState(false);

  const handlePointerOver = useCallback(() => setHovered(true), []);
  const handlePointerOut = useCallback(() => setHovered(false), []);

  return (
    <div
      className={className}
      style={{ width, height, cursor: 'pointer' }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 40 }}
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.7} color="#FFF8F0" />
        <Suspense fallback={null}>
          <LogoMesh hovered={hovered} />
        </Suspense>
      </Canvas>
    </div>
  );
}
