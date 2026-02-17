import React, { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber/native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
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
import { createBlockMaterial, createGlowMaterial } from "./BlockShader";
import { useTowerStore, type DemoBlock } from "@/stores/tower-store";

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

  const perimeterUnits = 2 * halfW + 2 * halfD;
  const frontBack = Math.round((halfW / perimeterUnits) * blockCount);
  const leftRight = Math.round((halfD / perimeterUnits) * blockCount);

  const totalCalc = 2 * frontBack + 2 * leftRight;
  let fCount = frontBack;
  if (totalCalc !== blockCount) {
    fCount = frontBack + Math.round((blockCount - totalCalc) / 4);
  }
  const sCount = leftRight;

  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(x, y, halfD + BLOCK_SIZE * 0.5),
      rotY: 0,
    });
  }
  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(x, y, -halfD - BLOCK_SIZE * 0.5),
      rotY: Math.PI,
    });
  }
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(halfW + BLOCK_SIZE * 0.5, y, z),
      rotY: Math.PI / 2,
    });
  }
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({
      pos: new THREE.Vector3(-halfW - BLOCK_SIZE * 0.5, y, z),
      rotY: -Math.PI / 2,
    });
  }

  return results;
}

function computeSpireLayerPositions(
  layer: number,
  blockCount: number,
  totalLayers: number,
): { pos: THREE.Vector3; rotY: number }[] {
  const spireProgress =
    (layer - SPIRE_START_LAYER) / (totalLayers - 1 - SPIRE_START_LAYER);
  const shrink = 1 - spireProgress * 0.9;
  const hw = MONOLITH_HALF_W * shrink;
  const hd = MONOLITH_HALF_D * shrink;

  if (blockCount <= 1) {
    const y = layer * LAYER_HEIGHT;
    return [{ pos: new THREE.Vector3(0, y, 0), rotY: 0 }];
  }

  return computeBodyLayerPositions(layer, blockCount, hw, hd);
}

/**
 * TowerGrid — Renders 600+ blocks using a single InstancedMesh.
 *
 * Now loads block data from the tower store (seeded/persisted)
 * instead of generating random data. Supports dynamic attribute
 * updates when blocks change (claim, charge, customize).
 */
export default function TowerGrid() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hitMeshRef = useRef<THREE.InstancedMesh>(null);
  const glowMeshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const glowMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const blockMetaRef = useRef<BlockMeta[]>([]);
  const config = DEFAULT_TOWER_CONFIG;

  const selectBlock = useTowerStore((s) => s.selectBlock);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const recentlyClaimedId = useTowerStore((s) => s.recentlyClaimedId);
  const clearRecentlyClaimed = useTowerStore((s) => s.clearRecentlyClaimed);

  // Track claim flash animation
  const claimFlashRef = useRef<{ blockIndex: number; time: number } | null>(null);

  const material = useMemo(() => {
    const mat = createBlockMaterial();
    materialRef.current = mat;
    return mat;
  }, []);

  const glowMaterial = useMemo(() => {
    const mat = createGlowMaterial();
    glowMaterialRef.current = mat;
    return mat;
  }, []);

  const hitMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ visible: false }),
    [],
  );

  // Rounded block geometry — 1 segment keeps rounded look with minimal tris
  const roundedGeometry = useMemo(() => {
    return new RoundedBoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE, 1, BLOCK_SIZE * 0.1);
  }, []);

  const HIT_SCALE = 1.8;

  // Build position layout (stable, config-based)
  const layoutData = useMemo(() => {
    const layout: { pos: THREE.Vector3; rotY: number; layer: number; index: number }[] = [];

    for (let layer = 0; layer < config.layerCount; layer++) {
      const count = config.blocksPerLayer[layer];
      const isSpire = layer >= SPIRE_START_LAYER;

      const positions = isSpire
        ? computeSpireLayerPositions(layer, count, config.layerCount)
        : computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D);

      const usable = positions.slice(0, count);
      for (let i = 0; i < usable.length; i++) {
        layout.push({ ...usable[i], layer, index: i });
      }
    }

    return layout;
  }, [config]);

  // Build block meta from store data + layout positions
  const blockData = useMemo(() => {
    if (demoBlocks.length === 0) return [];

    const data: BlockMeta[] = [];
    for (let i = 0; i < layoutData.length; i++) {
      const layout = layoutData[i];
      const storeBlock = demoBlocks.find(
        (b) => b.layer === layout.layer && b.index === layout.index,
      );

      data.push({
        id: storeBlock?.id ?? `block-${layout.layer}-${layout.index}`,
        position: layout.pos,
        layer: layout.layer,
        index: layout.index,
        energy: storeBlock?.energy ?? 0,
        ownerColor: storeBlock?.ownerColor ?? BLOCK_COLORS[0],
        owner: storeBlock?.owner ?? null,
        stakedAmount: storeBlock?.stakedAmount ?? 0,
      });
    }

    return data;
  }, [layoutData, demoBlocks]);

  // Update blockMetaRef for click handler
  useEffect(() => {
    blockMetaRef.current = blockData;
  }, [blockData]);

  // Apply transforms (runs once when layout is ready, resets on blockData identity change)
  const transformsApplied = useRef(false);
  const prevBlockDataRef = useRef(blockData);
  if (prevBlockDataRef.current !== blockData) {
    // blockData reference changed — need to re-apply transforms
    transformsApplied.current = false;
    prevBlockDataRef.current = blockData;
  }

  useEffect(() => {
    const mesh = meshRef.current;
    const hitMesh = hitMeshRef.current;
    const glowMesh = glowMeshRef.current;
    if (!mesh || blockData.length === 0) return;

    // Only apply transforms once (positions don't change)
    if (!transformsApplied.current) {
      const tempObj = new THREE.Object3D();
      const glowObj = new THREE.Object3D();
      // Stable seeded random for jitter
      let jitterSeed = 12345;
      const nextJitter = () => {
        jitterSeed = (jitterSeed * 16807 + 0) % 2147483647;
        return (jitterSeed & 0x7fffffff) / 2147483647;
      };

      const GLOW_SCALE = 1.6;

      for (let i = 0; i < blockData.length; i++) {
        const block = blockData[i];
        const layoutItem = layoutData[i];
        const layerScale = 1 + block.layer * BLOCK_SCALE_PER_LAYER;

        tempObj.position.copy(block.position);

        const baseScale = BLOCK_SIZE * layerScale;
        const randomJitter = 0.92 + nextJitter() * 0.12;
        tempObj.scale.set(
          baseScale * randomJitter,
          baseScale * (0.85 + nextJitter() * 0.3),
          baseScale * randomJitter,
        );

        tempObj.rotation.set(
          0,
          layoutItem.rotY + (nextJitter() - 0.5) * 0.04,
          0,
        );

        tempObj.updateMatrix();
        mesh.setMatrixAt(i, tempObj.matrix);

        if (hitMesh) {
          tempObj.scale.multiplyScalar(HIT_SCALE);
          tempObj.updateMatrix();
          hitMesh.setMatrixAt(i, tempObj.matrix);
        }

        // Glow mesh: same position, scaled up for halo
        if (glowMesh) {
          glowObj.position.copy(block.position);
          glowObj.scale.set(
            BLOCK_SIZE * GLOW_SCALE * layerScale,
            BLOCK_SIZE * GLOW_SCALE * layerScale,
            BLOCK_SIZE * GLOW_SCALE * layerScale,
          );
          glowObj.rotation.copy(tempObj.rotation);
          glowObj.updateMatrix();
          glowMesh.setMatrixAt(i, glowObj.matrix);
        }
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (hitMesh) hitMesh.instanceMatrix.needsUpdate = true;
      if (glowMesh) glowMesh.instanceMatrix.needsUpdate = true;
      transformsApplied.current = true;
    }

    // Update per-instance attributes (energy, color, layerNorm)
    const count = blockData.length;
    const energyArray = new Float32Array(count);
    const colorArray = new Float32Array(count * 3);
    const layerNormArray = new Float32Array(count);
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const block = blockData[i];
      energyArray[i] = block.energy / 100;

      tempColor.set(block.ownerColor);
      colorArray[i * 3] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;

      layerNormArray[i] = block.layer / (config.layerCount - 1);
    }

    const geo = mesh.geometry;
    const existingEnergy = geo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
    if (existingEnergy && existingEnergy.count === count) {
      existingEnergy.set(energyArray);
      existingEnergy.needsUpdate = true;
    } else {
      geo.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(energyArray, 1));
    }

    const existingColor = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;
    if (existingColor && existingColor.count === count) {
      existingColor.set(colorArray);
      existingColor.needsUpdate = true;
    } else {
      geo.setAttribute("aOwnerColor", new THREE.InstancedBufferAttribute(colorArray, 3));
    }

    const existingLayer = geo.getAttribute("aLayerNorm") as THREE.InstancedBufferAttribute | null;
    if (existingLayer && existingLayer.count === count) {
      existingLayer.set(layerNormArray);
      existingLayer.needsUpdate = true;
    } else {
      geo.setAttribute("aLayerNorm", new THREE.InstancedBufferAttribute(layerNormArray, 1));
    }

    // Style attribute (0=Default, 1-6 for custom styles)
    const styleArray = new Float32Array(count);
    const textureArray = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const storeBlock = demoBlocks.find(
        (b) => b.layer === blockData[i].layer && b.index === blockData[i].index,
      );
      styleArray[i] = storeBlock?.style ?? 0;
      textureArray[i] = storeBlock?.textureId ?? 0;
    }
    const existingStyle = geo.getAttribute("aStyle") as THREE.InstancedBufferAttribute | null;
    if (existingStyle && existingStyle.count === count) {
      existingStyle.set(styleArray);
      existingStyle.needsUpdate = true;
    } else {
      geo.setAttribute("aStyle", new THREE.InstancedBufferAttribute(styleArray, 1));
    }

    // Texture attribute (0=None, 1-6 for procedural patterns)
    const existingTexture = geo.getAttribute("aTextureId") as THREE.InstancedBufferAttribute | null;
    if (existingTexture && existingTexture.count === count) {
      existingTexture.set(textureArray);
      existingTexture.needsUpdate = true;
    } else {
      geo.setAttribute("aTextureId", new THREE.InstancedBufferAttribute(textureArray, 1));
    }

    // ─── Glow mesh attributes (shared data, separate geometry) ──
    if (glowMeshRef.current) {
      const glowGeo = glowMeshRef.current.geometry;

      const existingGlowEnergy = glowGeo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
      if (existingGlowEnergy && existingGlowEnergy.count === count) {
        existingGlowEnergy.set(energyArray);
        existingGlowEnergy.needsUpdate = true;
      } else {
        glowGeo.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(new Float32Array(energyArray), 1));
      }

      const existingGlowColor = glowGeo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;
      if (existingGlowColor && existingGlowColor.count === count) {
        existingGlowColor.set(colorArray);
        existingGlowColor.needsUpdate = true;
      } else {
        glowGeo.setAttribute("aOwnerColor", new THREE.InstancedBufferAttribute(new Float32Array(colorArray), 3));
      }
    }
  }, [blockData, config, layoutData, demoBlocks]);

  // Handle claim flash trigger
  useEffect(() => {
    if (recentlyClaimedId) {
      const idx = blockData.findIndex((b) => b.id === recentlyClaimedId);
      if (idx >= 0) {
        claimFlashRef.current = { blockIndex: idx, time: 0 };
      }
      // Clear after a short delay to allow re-triggering
      const timer = setTimeout(() => clearRecentlyClaimed(), 100);
      return () => clearTimeout(timer);
    }
  }, [recentlyClaimedId, blockData, clearRecentlyClaimed]);

  // Per-frame: update time uniform + claim flash animation
  useFrame((_state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
    if (glowMaterialRef.current) {
      glowMaterialRef.current.uniforms.uTime.value += delta;
    }

    // Claim flash: golden celebration burst for 2 seconds
    const flash = claimFlashRef.current;
    if (flash && meshRef.current) {
      flash.time += delta;
      const geo = meshRef.current.geometry;
      const energyAttr = geo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
      const colorAttr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;

      if (energyAttr && colorAttr) {
        if (flash.time < 2.0) {
          const t = flash.time;

          // Phase 1: Bright gold ignition (0-0.5s)
          // Phase 2: Golden pulse (0.5-1.5s) 
          // Phase 3: Settle to owner color (1.5-2.0s)
          let flashIntensity: number;
          if (t < 0.15) {
            // Instant bright
            flashIntensity = 1.0;
          } else if (t < 0.5) {
            // Hold bright gold
            flashIntensity = 0.9 + 0.1 * Math.sin(t * 20);
          } else if (t < 1.5) {
            // Golden pulse - breathing effect
            const pulseT = (t - 0.5) / 1.0;
            flashIntensity = 0.6 * (1 - pulseT) * (0.7 + 0.3 * Math.sin(t * 8));
          } else {
            // Settle to owner color
            flashIntensity = Math.max(0, 0.3 * (1 - (t - 1.5) / 0.5));
          }

          // Keep energy at max throughout
          energyAttr.array[flash.blockIndex] = 1.0;
          energyAttr.needsUpdate = true;

          // Blend between brilliant gold and owner color
          const block = blockData[flash.blockIndex];
          if (block) {
            const tempColor = new THREE.Color(block.ownerColor);
            const gold = new THREE.Color(1.0, 0.85, 0.2); // brilliant gold
            const blended = gold.lerp(tempColor, 1 - flashIntensity);
            colorAttr.array[flash.blockIndex * 3] = blended.r;
            colorAttr.array[flash.blockIndex * 3 + 1] = blended.g;
            colorAttr.array[flash.blockIndex * 3 + 2] = blended.b;
            colorAttr.needsUpdate = true;
          }
        } else {
          // Flash complete — restore actual values
          const block = blockData[flash.blockIndex];
          if (block) {
            energyAttr.array[flash.blockIndex] = block.energy / 100;
            energyAttr.needsUpdate = true;

            const tempColor = new THREE.Color(block.ownerColor);
            colorAttr.array[flash.blockIndex * 3] = tempColor.r;
            colorAttr.array[flash.blockIndex * 3 + 1] = tempColor.g;
            colorAttr.array[flash.blockIndex * 3 + 2] = tempColor.b;
            colorAttr.needsUpdate = true;
          }
          claimFlashRef.current = null;
        }
      }
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (useTowerStore.getState().isGestureActive) return;
    if (event.instanceId !== undefined && event.instanceId !== null) {
      const meta = blockMetaRef.current[event.instanceId];
      if (meta) {
        selectBlock(meta.id);
      }
    }
  };

  // Don't unmount on empty blockData — keep mesh mounted to avoid losing instance state
  const instanceCount = blockData.length || 1; // minimum 1 to avoid Three.js warnings

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[roundedGeometry, undefined, instanceCount]}
        frustumCulled={true}
        material={material}
      />

      {/* Glow pass: additive halo around high-energy blocks */}
      <instancedMesh
        ref={glowMeshRef}
        args={[undefined, undefined, instanceCount]}
        frustumCulled={true}
        material={glowMaterial}
      >
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      </instancedMesh>

      <instancedMesh
        ref={hitMeshRef}
        args={[undefined, undefined, instanceCount]}
        frustumCulled={true}
        material={hitMaterial}
        onClick={handleClick}
      >
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      </instancedMesh>
    </group>
  );
}
