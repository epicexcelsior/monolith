import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber/native";
import * as THREE from "three";
import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_SIZE,
  LAYER_HEIGHT,
  BASE_RADIUS,
  TOP_RADIUS,
  BLOCK_COLORS,
} from "@monolith/common";
import { createBlockMaterial } from "./BlockShader";
import { useTowerStore } from "@/stores/tower-store";

export interface BlockMeta {
  id: string;
  position: THREE.Vector3;
  layer: number;
  index: number;
  energy: number;
  ownerColor: string;
  owner: string | null;
  stakedAmount: number;
}

/**
 * TowerGrid — Renders 1000+ blocks using InstancedMesh with custom shader.
 *
 * Uses per-instance attributes (aEnergy, aOwnerColor) to drive
 * energy glow, fresnel rim, and pulse animation in the shader.
 */
export default function TowerGrid() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const blockMetaRef = useRef<BlockMeta[]>([]);
  const config = DEFAULT_TOWER_CONFIG;

  const selectBlock = useTowerStore((s) => s.selectBlock);
  const setDemoBlocks = useTowerStore((s) => s.setDemoBlocks);

  // Stable custom material (created once)
  const material = useMemo(() => {
    const mat = createBlockMaterial();
    materialRef.current = mat;
    return mat;
  }, []);

  // Pre-compute block positions and generate demo data
  const blockData = useMemo(() => {
    const data: BlockMeta[] = [];

    for (let layer = 0; layer < config.layerCount; layer++) {
      const count = config.blocksPerLayer[layer];
      const t = layer / (config.layerCount - 1);
      const radius = BASE_RADIUS - t * (BASE_RADIUS - TOP_RADIUS);
      const y = layer * LAYER_HEIGHT;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Demo data: random energy, random owner color
        const energy = Math.random() * 100;
        const ownerColor =
          BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
        const hasOwner = energy > 5; // Dead blocks are unclaimed

        data.push({
          id: `block-${layer}-${i}`,
          position: new THREE.Vector3(x, y, z),
          layer,
          index: i,
          energy,
          ownerColor,
          owner: hasOwner
            ? `Demo${Math.random().toString(36).slice(2, 8)}`
            : null,
          stakedAmount: hasOwner
            ? Math.floor(10 + Math.random() * 990) * 1_000_000
            : 0,
        });
      }
    }

    return data;
  }, [config]);

  // Push demo blocks to store for BlockInspector
  useEffect(() => {
    blockMetaRef.current = blockData;
    setDemoBlocks(
      blockData.map((b) => ({
        id: b.id,
        layer: b.layer,
        index: b.index,
        energy: b.energy,
        ownerColor: b.ownerColor,
        owner: b.owner,
        stakedAmount: b.stakedAmount,
        position: { x: b.position.x, y: b.position.y, z: b.position.z },
      })),
    );
  }, [blockData, setDemoBlocks]);

  // Apply transforms and per-instance attributes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const count = blockData.length;
    const energyArray = new Float32Array(count);
    const colorArray = new Float32Array(count * 3);
    const tempObj = new THREE.Object3D();
    const tempColor = new THREE.Color();

    blockData.forEach((block, i) => {
      // Position
      tempObj.position.copy(block.position);

      // Slight scale variation
      const scale = 0.85 + Math.random() * 0.15;
      tempObj.scale.setScalar(scale * BLOCK_SIZE);

      // Slight random rotation
      tempObj.rotation.y = Math.random() * 0.1;

      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);

      // Per-instance energy (normalized 0-1)
      energyArray[i] = block.energy / 100;

      // Per-instance owner color
      tempColor.set(block.ownerColor);
      colorArray[i * 3] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    });

    mesh.instanceMatrix.needsUpdate = true;

    // Attach per-instance attributes to geometry
    const geo = mesh.geometry;
    geo.setAttribute(
      "aEnergy",
      new THREE.InstancedBufferAttribute(energyArray, 1),
    );
    geo.setAttribute(
      "aOwnerColor",
      new THREE.InstancedBufferAttribute(colorArray, 3),
    );
  }, [blockData]);

  // Update shader time uniform every frame
  useFrame((_state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  // Handle tap on block instance
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.instanceId !== undefined && event.instanceId !== null) {
      const meta = blockMetaRef.current[event.instanceId];
      if (meta) {
        selectBlock(meta.id);
      }
    }
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, blockData.length]}
      frustumCulled={true}
      material={material}
      onClick={handleClick}
    >
      <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
    </instancedMesh>
  );
}
