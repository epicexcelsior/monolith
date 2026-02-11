import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_SIZE,
  LAYER_HEIGHT,
  BASE_RADIUS,
  TOP_RADIUS,
} from "@monolith/common";

/**
 * TowerGrid — Renders 1000+ blocks using InstancedMesh.
 *
 * ARCHITECTURE DECISION: Why InstancedMesh?
 * ──────────────────────────────────────────
 * Without instancing, 1000 blocks = 1000 draw calls = ~5 FPS.
 * With InstancedMesh, 1000 blocks = 1 draw call = 60 FPS.
 *
 * Each block is an "instance" that shares geometry and material,
 * but has its own transform (position/rotation/scale) and color.
 *
 * LOD STRATEGY (to implement):
 * ──────────────────────────────
 * Tier 1 (< 50u):  Full cubes with custom materials
 * Tier 2 (50-200u): Simple colored cubes
 * Tier 3 (> 200u):  Point cloud / billboards
 *
 * For MVP, we use a single InstancedMesh for all blocks.
 * This is already very performant for 1000 blocks on Seeker.
 */
export default function TowerGrid() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const config = DEFAULT_TOWER_CONFIG;

  // Pre-compute block positions for the cylindrical tower
  const blockData = useMemo(() => {
    const data: Array<{
      position: THREE.Vector3;
      color: THREE.Color;
      layer: number;
      index: number;
    }> = [];

    for (let layer = 0; layer < config.layerCount; layer++) {
      const count = config.blocksPerLayer[layer];
      const t = layer / (config.layerCount - 1); // 0 = base, 1 = top
      const radius = BASE_RADIUS - t * (BASE_RADIUS - TOP_RADIUS);
      const y = layer * LAYER_HEIGHT;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Assign a color based on energy state (randomized for demo)
        const energySimulated = Math.random();
        let color: string;
        if (energySimulated > 0.8) {
          color = "#00ffff"; // Blazing — cyan glow
        } else if (energySimulated > 0.5) {
          color = "#0066ff"; // Thriving — blue
        } else if (energySimulated > 0.2) {
          color = "#6600ff"; // Fading — purple
        } else if (energySimulated > 0.05) {
          color = "#ff0066"; // Dying — red
        } else {
          color = "#1a1a2e"; // Dead — dark
        }

        data.push({
          position: new THREE.Vector3(x, y, z),
          color: new THREE.Color(color),
          layer,
          index: i,
        });
      }
    }

    return data;
  }, [config]);

  // Apply transforms and colors to the InstancedMesh
  useEffect(() => {
    if (!meshRef.current) return;

    const tempObj = new THREE.Object3D();

    blockData.forEach((block, i) => {
      // Position
      tempObj.position.copy(block.position);

      // Slight scale variation for visual interest
      const scale = 0.85 + Math.random() * 0.15;
      tempObj.scale.setScalar(scale * BLOCK_SIZE);

      // Slight random rotation for organic feel
      tempObj.rotation.y = Math.random() * 0.1;

      tempObj.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObj.matrix);

      // Color
      meshRef.current!.setColorAt(i, block.color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [blockData]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, blockData.length]}
      frustumCulled={true}
    >
      {/* Box geometry for each block */}
      <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />

      {/* Material with emissive glow */}
      <meshStandardMaterial
        roughness={0.3}
        metalness={0.6}
        emissive="#000000"
        emissiveIntensity={0.5}
        toneMapped={false} // Allows colors > 1.0 for glow effect
      />
    </instancedMesh>
  );
}
