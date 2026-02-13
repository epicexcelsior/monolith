import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber/native";
import * as THREE from "three";
import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_SIZE,
  BLOCK_GAP,
  LAYER_HEIGHT,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  BLOCK_SCALE_PER_LAYER,
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

// ─── Monolith Geometry Helpers ────────────────────────────

/**
 * Positions blocks on the 4 rectangular faces of the monolith body.
 * Returns world positions for a single body layer.
 *
 * Face layout (top-down view):
 *   Front (Z+): blocks along X axis
 *   Back  (Z-): blocks along X axis
 *   Left  (X-): blocks along Z axis
 *   Right (X+): blocks along Z axis
 */
function computeBodyLayerPositions(
  layer: number,
  blockCount: number,
  halfW: number,
  halfD: number,
): { pos: THREE.Vector3; rotY: number }[] {
  const results: { pos: THREE.Vector3; rotY: number }[] = [];
  const y = layer * LAYER_HEIGHT;
  const step = BLOCK_SIZE + BLOCK_GAP;
  const layerScale = 1 + layer * BLOCK_SCALE_PER_LAYER;

  // How many blocks fit on each face (split evenly)
  const perimeterUnits = 2 * halfW + 2 * halfD;
  const frontBack = Math.round((halfW / perimeterUnits) * blockCount);
  const leftRight = Math.round((halfD / perimeterUnits) * blockCount);

  // Adjust so total matches blockCount
  const totalCalc = 2 * frontBack + 2 * leftRight;
  let fCount = frontBack;
  let sCount = leftRight;
  if (totalCalc !== blockCount) {
    fCount = frontBack + Math.round((blockCount - totalCalc) / 4);
  }

  // Front face (Z = +halfD, facing +Z)
  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(x, y, halfD + BLOCK_SIZE * 0.5),
      rotY: 0,
    });
  }

  // Back face (Z = -halfD, facing -Z)
  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(x, y, -halfD - BLOCK_SIZE * 0.5),
      rotY: Math.PI,
    });
  }

  // Right face (X = +halfW, facing +X)
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(halfW + BLOCK_SIZE * 0.5, y, z),
      rotY: Math.PI / 2,
    });
  }

  // Left face (X = -halfW, facing -X)
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(-halfW - BLOCK_SIZE * 0.5, y, z),
      rotY: -Math.PI / 2,
    });
  }

  return results;
}

/**
 * Positions blocks for a spire layer — same 4-face approach but
 * width and depth shrink as we approach the peak.
 */
function computeSpireLayerPositions(
  layer: number,
  blockCount: number,
  totalLayers: number,
): { pos: THREE.Vector3; rotY: number }[] {
  const spireProgress =
    (layer - SPIRE_START_LAYER) / (totalLayers - 1 - SPIRE_START_LAYER);
  // Lerp from full size to near-zero
  const shrink = 1 - spireProgress * 0.9;
  const hw = MONOLITH_HALF_W * shrink;
  const hd = MONOLITH_HALF_D * shrink;

  if (blockCount <= 1) {
    // Penthouse — single block at the apex
    const y = layer * LAYER_HEIGHT;
    return [{ pos: new THREE.Vector3(0, y, 0), rotY: 0 }];
  }

  return computeBodyLayerPositions(layer, blockCount, hw, hd);
}

/**
 * TowerGrid — Renders 600+ blocks using a single InstancedMesh.
 *
 * PERFORMANCE NOTES (Seeker / Dimensity 7300):
 * - Single InstancedMesh = 1 draw call for ALL blocks
 * - Per-instance attributes (aEnergy, aOwnerColor, aLayerNorm) baked at init
 * - No per-frame JS updates to instance matrices (static tower)
 * - useFrame only updates the single uTime uniform
 * - boxGeometry shared across all instances (no geometry duplication)
 * - frustumCulled=true lets Three.js skip off-screen instances
 */
export default function TowerGrid() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const blockMetaRef = useRef<BlockMeta[]>([]);
  const config = DEFAULT_TOWER_CONFIG;

  const selectBlock = useTowerStore((s) => s.selectBlock);
  const setDemoBlocks = useTowerStore((s) => s.setDemoBlocks);

  // Stable custom material (created once, never recreated)
  const material = useMemo(() => {
    const mat = createBlockMaterial();
    materialRef.current = mat;
    return mat;
  }, []);

  // Pre-compute all block positions (runs once, memoized)
  const blockData = useMemo(() => {
    const data: BlockMeta[] = [];

    for (let layer = 0; layer < config.layerCount; layer++) {
      const count = config.blocksPerLayer[layer];
      const isSpire = layer >= SPIRE_START_LAYER;

      const positions = isSpire
        ? computeSpireLayerPositions(layer, count, config.layerCount)
        : computeBodyLayerPositions(
          layer,
          count,
          MONOLITH_HALF_W,
          MONOLITH_HALF_D,
        );

      // Only use as many positions as config says
      const usable = positions.slice(0, count);

      for (let i = 0; i < usable.length; i++) {
        const energy = Math.random() * 100;
        const ownerColor =
          BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
        const hasOwner = energy > 5;

        data.push({
          id: `block-${layer}-${i}`,
          position: usable[i].pos,
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

  // Apply transforms and per-instance attributes (runs once after mount)
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const count = blockData.length;
    const energyArray = new Float32Array(count);
    const colorArray = new Float32Array(count * 3);
    const layerNormArray = new Float32Array(count);
    const tempObj = new THREE.Object3D();
    const tempColor = new THREE.Color();

    // Pre-compute all face rotation data for reuse
    const allPositions = (() => {
      const posMap: { rotY: number }[][] = [];
      for (let layer = 0; layer < config.layerCount; layer++) {
        const cnt = config.blocksPerLayer[layer];
        const isSpire = layer >= SPIRE_START_LAYER;
        const positions = isSpire
          ? computeSpireLayerPositions(layer, cnt, config.layerCount)
          : computeBodyLayerPositions(
            layer,
            cnt,
            MONOLITH_HALF_W,
            MONOLITH_HALF_D,
          );
        posMap.push(positions.slice(0, cnt));
      }
      return posMap;
    })();

    let globalIdx = 0;
    for (let layer = 0; layer < config.layerCount; layer++) {
      const layerPositions = allPositions[layer];
      const layerScale = 1 + layer * BLOCK_SCALE_PER_LAYER;
      const isSpire = layer >= SPIRE_START_LAYER;

      for (let i = 0; i < layerPositions.length; i++) {
        const block = blockData[globalIdx];
        if (!block) break;

        // Position
        tempObj.position.copy(block.position);

        // Scale: base size × layer scaling × slight random variation
        const baseScale = BLOCK_SIZE * layerScale;
        const randomJitter = 0.92 + Math.random() * 0.12;
        tempObj.scale.set(
          baseScale * randomJitter,
          baseScale * (0.85 + Math.random() * 0.3), // height variation
          baseScale * randomJitter,
        );

        // Rotation: face outward + tiny random jitter for organic feel
        tempObj.rotation.set(0, layerPositions[i].rotY + (Math.random() - 0.5) * 0.04, 0);

        tempObj.updateMatrix();
        mesh.setMatrixAt(globalIdx, tempObj.matrix);

        // Per-instance energy (normalized 0-1)
        energyArray[globalIdx] = block.energy / 100;

        // Per-instance owner color
        tempColor.set(block.ownerColor);
        colorArray[globalIdx * 3] = tempColor.r;
        colorArray[globalIdx * 3 + 1] = tempColor.g;
        colorArray[globalIdx * 3 + 2] = tempColor.b;

        // Normalized layer position (0 = base, 1 = top) for height gradient
        layerNormArray[globalIdx] = layer / (config.layerCount - 1);

        globalIdx++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;

    // Attach per-instance attributes
    const geo = mesh.geometry;
    geo.setAttribute(
      "aEnergy",
      new THREE.InstancedBufferAttribute(energyArray, 1),
    );
    geo.setAttribute(
      "aOwnerColor",
      new THREE.InstancedBufferAttribute(colorArray, 3),
    );
    geo.setAttribute(
      "aLayerNorm",
      new THREE.InstancedBufferAttribute(layerNormArray, 1),
    );
  }, [blockData, config]);

  // Minimal per-frame work: just bump the time uniform
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
