import React, { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber/native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_SIZE,
  BLOCK_GAP,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  BLOCK_COLORS,
  getLayerScale,
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";
import { createBlockMaterial, createGlowMaterial } from "./BlockShader";
import { useTowerStore, type DemoBlock } from "@/stores/tower-store";
import { getImageAtlasTexture } from "@/utils/image-atlas";
import { CAMERA_CONFIG } from "@/constants/CameraConfig";

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

// ─── TowerGrid ──────────────────────────────────────────────

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
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const recentlyClaimedId = useTowerStore((s) => s.recentlyClaimedId);
  const clearRecentlyClaimed = useTowerStore((s) => s.clearRecentlyClaimed);

  // Track claim flash animation
  const claimFlashRef = useRef<{ blockIndex: number; time: number } | null>(null);
  // Reusable Color objects to avoid per-frame GC pressure
  const tmpColorRef = useRef(new THREE.Color());
  const goldColorRef = useRef(new THREE.Color(1.0, 0.85, 0.2));

  // Inspect focus animation state
  const fadeTargetsRef = useRef<Float32Array | null>(null);
  const fadeCurrentRef = useRef<Float32Array | null>(null);
  const highlightTargetsRef = useRef<Float32Array | null>(null);
  const highlightCurrentRef = useRef<Float32Array | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);

  // Pop-out animation state
  const popOutTargetRef = useRef<Float32Array | null>(null);
  const popOutCurrentRef = useRef<Float32Array | null>(null);
  // Reusable Object3D for per-frame matrix updates (avoids GC)
  const tempObjRef = useRef(new THREE.Object3D());

  const material = useMemo(() => {
    const mat = createBlockMaterial();
    materialRef.current = mat;
    // Load pre-encoded image atlas (100% reliable in React Native — no DOM Image)
    try {
      const atlasTex = getImageAtlasTexture();
      mat.uniforms.uImageAtlas.value = atlasTex;
      if (__DEV__) console.log(`[TowerGrid] Atlas loaded: ${atlasTex.image.width}x${atlasTex.image.height}`);
    } catch (e) {
      console.error("[TowerGrid] Atlas load failed:", e);
    }
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
    return new RoundedBoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE, 1, BLOCK_SIZE * 0.04);
  }, []);

  const HIT_SCALE = 1.15; // Modest enlargement for easier tapping without wrong-block selection

  // Build position layout (stable, config-based) — uses shared layout functions
  const layoutData = useMemo(() => {
    const layout: { x: number; y: number; z: number; rotY: number; tileScale: number; layer: number; index: number }[] = [];

    for (let layer = 0; layer < config.layerCount; layer++) {
      const count = config.blocksPerLayer[layer];
      const isSpire = layer >= SPIRE_START_LAYER;

      const positions = isSpire
        ? computeSpireLayerPositions(layer, count, config.layerCount)
        : computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D, config.layerCount);

      const usable = positions.slice(0, count);
      for (let i = 0; i < usable.length; i++) {
        layout.push({ ...usable[i], layer, index: i });
      }
    }

    return layout;
  }, [config]);

  // Fast lookup map for demoBlocks by layer+index (avoids O(n²) find)
  const demoBlockMap = useMemo(() => {
    const map = new Map<number, typeof demoBlocks[0]>();
    for (const b of demoBlocks) {
      map.set(b.layer * 1000 + b.index, b);
    }
    return map;
  }, [demoBlocks]);

  // Build block meta from store data + layout positions
  const blockData = useMemo(() => {
    if (demoBlocks.length === 0) return [];

    const data: BlockMeta[] = [];
    for (let i = 0; i < layoutData.length; i++) {
      const layout = layoutData[i];
      const storeBlock = demoBlockMap.get(layout.layer * 1000 + layout.index);

      data.push({
        id: storeBlock?.id ?? `block-${layout.layer}-${layout.index}`,
        position: new THREE.Vector3(layout.x, layout.y, layout.z),
        layer: layout.layer,
        index: layout.index,
        energy: storeBlock?.energy ?? 0,
        ownerColor: storeBlock?.ownerColor ?? BLOCK_COLORS[0],
        owner: storeBlock?.owner ?? null,
        stakedAmount: storeBlock?.stakedAmount ?? 0,
      });
    }

    return data;
  }, [layoutData, demoBlocks, demoBlockMap]);

  // Update blockMetaRef for click handler
  useEffect(() => {
    blockMetaRef.current = blockData;
  }, [blockData]);

  // Apply transforms once when layout is ready.
  // Matrices only depend on layoutData (positions/rotations), NOT on blockData (energy/color).
  // Do NOT reset transformsApplied when blockData changes — positions never change at runtime.
  const transformsApplied = useRef(false);
  const prevLayoutRef = useRef(layoutData);
  if (prevLayoutRef.current !== layoutData) {
    // Layout changed — need to recompute matrices
    transformsApplied.current = false;
    prevLayoutRef.current = layoutData;
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

      const GLOW_SCALE = 1.08;

      for (let i = 0; i < blockData.length; i++) {
        const block = blockData[i];
        const layoutItem = layoutData[i];
        const layerScale = getLayerScale(block.layer, config.layerCount);

        tempObj.position.copy(block.position);

        // Scale: tileScale stretches the block's local X so blocks tile the face perfectly.
        // rotY aligns block face with tower face tangent, so local X = face direction.
        const ts = layoutItem.tileScale;
        tempObj.scale.set(layerScale * ts, layerScale, layerScale);

        // Exact rotation from layout — no noise
        tempObj.rotation.set(0, layoutItem.rotY, 0);

        tempObj.updateMatrix();
        mesh.setMatrixAt(i, tempObj.matrix);

        if (hitMesh) {
          tempObj.scale.multiplyScalar(HIT_SCALE);
          tempObj.updateMatrix();
          hitMesh.setMatrixAt(i, tempObj.matrix);
        }

        // Glow mesh: same position, slightly larger for subtle halo
        if (glowMesh) {
          glowObj.position.copy(block.position);
          glowObj.scale.set(GLOW_SCALE * layerScale * ts, GLOW_SCALE * layerScale, GLOW_SCALE * layerScale);
          glowObj.rotation.set(0, layoutItem.rotY, 0);
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

    // Style, texture, and image attributes
    const styleArray = new Float32Array(count);
    const textureArray = new Float32Array(count);
    const imageIndexArray = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const block = blockData[i];
      const storeBlock = demoBlockMap.get(block.layer * 1000 + block.index);
      styleArray[i] = storeBlock?.style ?? 0;
      textureArray[i] = storeBlock?.textureId ?? 0;

      // Image index: use store value if available, otherwise compute
      // deterministically from block position so images always show
      let imgIdx = storeBlock?.imageIndex ?? 0;
      if (imgIdx === 0 && block.owner) {
        // 75% of owned blocks get a demo image (deterministic hash)
        const hash = ((block.layer * 31 + block.index * 7 + 137) & 0xffff);
        if (hash % 4 < 3) { // 75%
          imgIdx = (hash % 5) + 1; // 1-5
        }
      }
      imageIndexArray[i] = imgIdx;
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

    // Image index attribute (0=None, 1-5=atlas slot)
    const existingImage = geo.getAttribute("aImageIndex") as THREE.InstancedBufferAttribute | null;
    if (existingImage && existingImage.count === count) {
      existingImage.set(imageIndexArray);
      existingImage.needsUpdate = true;
    } else {
      geo.setAttribute("aImageIndex", new THREE.InstancedBufferAttribute(imageIndexArray, 1));
    }

    // ─── Inspect mode attributes (fade + highlight + pop-out) ──
    if (!fadeCurrentRef.current || fadeCurrentRef.current.length !== count) {
      fadeCurrentRef.current = new Float32Array(count).fill(1.0);
      fadeTargetsRef.current = new Float32Array(count).fill(1.0);
      highlightCurrentRef.current = new Float32Array(count).fill(0.0);
      highlightTargetsRef.current = new Float32Array(count).fill(0.0);
      popOutCurrentRef.current = new Float32Array(count).fill(0.0);
      popOutTargetRef.current = new Float32Array(count).fill(0.0);
    }
    const existingFade = geo.getAttribute("aFade") as THREE.InstancedBufferAttribute | null;
    if (!existingFade || existingFade.count !== count) {
      geo.setAttribute("aFade", new THREE.InstancedBufferAttribute(fadeCurrentRef.current!, 1));
    }
    const existingHighlight = geo.getAttribute("aHighlight") as THREE.InstancedBufferAttribute | null;
    if (!existingHighlight || existingHighlight.count !== count) {
      geo.setAttribute("aHighlight", new THREE.InstancedBufferAttribute(highlightCurrentRef.current!, 1));
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

      // Glow inspect mode attributes
      if (fadeCurrentRef.current) {
        const existingGlowFade = glowGeo.getAttribute("aFade") as THREE.InstancedBufferAttribute | null;
        if (!existingGlowFade || existingGlowFade.count !== count) {
          glowGeo.setAttribute("aFade", new THREE.InstancedBufferAttribute(new Float32Array(fadeCurrentRef.current), 1));
        }
      }
      if (highlightCurrentRef.current) {
        const existingGlowHL = glowGeo.getAttribute("aHighlight") as THREE.InstancedBufferAttribute | null;
        if (!existingGlowHL || existingGlowHL.count !== count) {
          glowGeo.setAttribute("aHighlight", new THREE.InstancedBufferAttribute(new Float32Array(highlightCurrentRef.current), 1));
        }
      }
    }
  }, [blockData, config, layoutData, demoBlockMap]);

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

  // Per-frame: update time uniform + camera pos + claim flash
  // Cap delta to prevent visual jumps after frame stalls
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += dt;
      materialRef.current.uniforms.uCameraPos.value.copy(state.camera.position);
    }
    if (glowMaterialRef.current) {
      glowMaterialRef.current.uniforms.uTime.value += dt;
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
            const tempColor = tmpColorRef.current.set(block.ownerColor);
            const gold = goldColorRef.current.set(1.0, 0.85, 0.2);
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

            const tempColor = tmpColorRef.current.set(block.ownerColor);
            colorAttr.array[flash.blockIndex * 3] = tempColor.r;
            colorAttr.array[flash.blockIndex * 3 + 1] = tempColor.g;
            colorAttr.array[flash.blockIndex * 3 + 2] = tempColor.b;
            colorAttr.needsUpdate = true;
          }
          claimFlashRef.current = null;
        }
      }
    }

    // ─── Inspect mode: fade + highlight + pop-out animation ──
    if (selectedBlockId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedBlockId;
      const count = blockData.length;
      if (fadeTargetsRef.current && highlightTargetsRef.current && popOutTargetRef.current && count > 0) {
        if (selectedBlockId) {
          const selectedIdx = blockData.findIndex((b) => b.id === selectedBlockId);
          for (let i = 0; i < count; i++) {
            fadeTargetsRef.current[i] = i === selectedIdx ? 1.0 : 0.6;
            highlightTargetsRef.current[i] = i === selectedIdx ? 1.0 : 0.0;
            popOutTargetRef.current[i] = i === selectedIdx ? 1.0 : 0.0;
          }
        } else {
          // No selection — restore all blocks to normal
          for (let i = 0; i < count; i++) {
            fadeTargetsRef.current[i] = 1.0;
            highlightTargetsRef.current[i] = 0.0;
            popOutTargetRef.current[i] = 0.0;
          }
        }
      }
    }

    // Animate fade/highlight values toward targets
    const fadeCur = fadeCurrentRef.current;
    const fadeTgt = fadeTargetsRef.current;
    const hlCur = highlightCurrentRef.current;
    const hlTgt = highlightTargetsRef.current;
    if (fadeCur && fadeTgt && hlCur && hlTgt && meshRef.current) {
      let needsFadeUpdate = false;
      const FADE_LERP = 0.14;
      for (let i = 0; i < fadeCur.length; i++) {
        const fd = fadeTgt[i] - fadeCur[i];
        if (Math.abs(fd) > 0.001) {
          fadeCur[i] += fd * FADE_LERP;
          needsFadeUpdate = true;
        }
        const hd = hlTgt[i] - hlCur[i];
        if (Math.abs(hd) > 0.001) {
          hlCur[i] += hd * FADE_LERP;
          needsFadeUpdate = true;
        }
      }
      if (needsFadeUpdate) {
        const geo = meshRef.current.geometry;
        const fadeAttr = geo.getAttribute("aFade") as THREE.InstancedBufferAttribute | null;
        if (fadeAttr) fadeAttr.needsUpdate = true;
        const hlAttr = geo.getAttribute("aHighlight") as THREE.InstancedBufferAttribute | null;
        if (hlAttr) hlAttr.needsUpdate = true;
        // Sync glow mesh attributes
        if (glowMeshRef.current) {
          const glowGeo = glowMeshRef.current.geometry;
          const gFade = glowGeo.getAttribute("aFade") as THREE.InstancedBufferAttribute | null;
          if (gFade) {
            (gFade.array as Float32Array).set(fadeCur);
            gFade.needsUpdate = true;
          }
          const gHL = glowGeo.getAttribute("aHighlight") as THREE.InstancedBufferAttribute | null;
          if (gHL) {
            (gHL.array as Float32Array).set(hlCur);
            gHL.needsUpdate = true;
          }
        }
      }
    }

    // ─── Pop-out animation: lerp + recompute matrices ────────
    const popCur = popOutCurrentRef.current;
    const popTgt = popOutTargetRef.current;
    if (popCur && popTgt && meshRef.current) {
      let needsMatrixUpdate = false;
      const POP_LERP = 0.12;
      const POP_DISTANCE = CAMERA_CONFIG.inspect.popDistance;

      for (let i = 0; i < popCur.length; i++) {
        const pd = popTgt[i] - popCur[i];
        if (Math.abs(pd) > 0.001) {
          popCur[i] += pd * POP_LERP;
          needsMatrixUpdate = true;
        }
      }

      if (needsMatrixUpdate) {
        const tempObj = tempObjRef.current;
        const GLOW_SCALE = 1.08;

        for (let i = 0; i < popCur.length; i++) {
          if (popCur[i] < 0.001) continue; // skip blocks not popping

          const block = blockData[i];
          const layoutItem = layoutData[i];
          if (!block || !layoutItem) continue;

          const layerScale = getLayerScale(block.layer, config.layerCount);
          const popOffset = popCur[i] * POP_DISTANCE;

          // Pop direction: perpendicular to face (derived from rotY)
          const px = block.position.x;
          const pz = block.position.z;
          const len = Math.sqrt(px * px + pz * pz);
          const nx = Math.sin(layoutItem.rotY);
          const nz = Math.cos(layoutItem.rotY);
          const dot = nx * px + nz * pz;

          let offX: number, offY: number, offZ: number;
          if (len < 0.01) {
            // Pinnacle block at origin — pop upward
            offX = 0; offY = popOffset; offZ = 0;
          } else if (dot > 0.01) {
            // Face normal points outward — use it (perpendicular to face)
            offX = nx * popOffset;
            offY = 0;
            offZ = nz * popOffset;
          } else {
            // Corner where normal points inward — fall back to radial
            offX = (px / len) * popOffset;
            offY = 0;
            offZ = (pz / len) * popOffset;
          }

          tempObj.position.set(
            block.position.x + offX,
            block.position.y + offY,
            block.position.z + offZ,
          );
          const ts = layoutItem.tileScale;
          tempObj.scale.set(layerScale * ts, layerScale, layerScale);
          tempObj.rotation.set(0, layoutItem.rotY, 0);
          tempObj.updateMatrix();
          meshRef.current!.setMatrixAt(i, tempObj.matrix);

          // Sync hit mesh
          if (hitMeshRef.current) {
            tempObj.scale.multiplyScalar(HIT_SCALE);
            tempObj.updateMatrix();
            hitMeshRef.current.setMatrixAt(i, tempObj.matrix);
          }

          // Sync glow mesh
          if (glowMeshRef.current) {
            tempObj.position.set(
              block.position.x + offX,
              block.position.y + offY,
              block.position.z + offZ,
            );
            tempObj.scale.set(GLOW_SCALE * layerScale * ts, GLOW_SCALE * layerScale, GLOW_SCALE * layerScale);
            tempObj.rotation.set(0, layoutItem.rotY, 0);
            tempObj.updateMatrix();
            glowMeshRef.current.setMatrixAt(i, tempObj.matrix);
          }
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (hitMeshRef.current) hitMeshRef.current.instanceMatrix.needsUpdate = true;
        if (glowMeshRef.current) glowMeshRef.current.instanceMatrix.needsUpdate = true;

        // When all pops return to zero, restore base matrices directly
        const allZero = popCur.every((v) => v < 0.001);
        if (allZero) {
          const restoreObj = tempObjRef.current;
          const GLOW_SCALE = 1.08;

          for (let i = 0; i < blockData.length; i++) {
            const block = blockData[i];
            const layoutItem = layoutData[i];
            if (!block || !layoutItem) continue;

            const layerScale = getLayerScale(block.layer, config.layerCount);

            const rts = layoutItem.tileScale;
            restoreObj.position.copy(block.position);
            restoreObj.scale.set(layerScale * rts, layerScale, layerScale);
            restoreObj.rotation.set(0, layoutItem.rotY, 0);
            restoreObj.updateMatrix();
            meshRef.current!.setMatrixAt(i, restoreObj.matrix);

            if (hitMeshRef.current) {
              restoreObj.scale.multiplyScalar(HIT_SCALE);
              restoreObj.updateMatrix();
              hitMeshRef.current.setMatrixAt(i, restoreObj.matrix);
            }

            if (glowMeshRef.current) {
              restoreObj.position.copy(block.position);
              restoreObj.scale.set(GLOW_SCALE * layerScale * rts, GLOW_SCALE * layerScale, GLOW_SCALE * layerScale);
              restoreObj.rotation.set(0, layoutItem.rotY, 0);
              restoreObj.updateMatrix();
              glowMeshRef.current.setMatrixAt(i, restoreObj.matrix);
            }
          }

          meshRef.current!.instanceMatrix.needsUpdate = true;
          if (hitMeshRef.current) hitMeshRef.current.instanceMatrix.needsUpdate = true;
          if (glowMeshRef.current) glowMeshRef.current.instanceMatrix.needsUpdate = true;
        }
      }
    }
  });

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const gestureActive = useTowerStore.getState().isGestureActive;
    if (gestureActive) return;

    if (event.instanceId == null) return;
    const meta = blockMetaRef.current[event.instanceId];
    if (!meta) return;

    selectBlock(meta.id);
  }, [selectBlock]);

  const instanceCount = blockData.length;

  // Don't render anything while waiting for blocks (avoids phantom black block)
  if (blockData.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[roundedGeometry, undefined, instanceCount]}
        frustumCulled={false}
        material={material}
      />

      {/* Glow pass: additive halo around high-energy blocks */}
      <instancedMesh
        ref={glowMeshRef}
        args={[undefined, undefined, instanceCount]}
        frustumCulled={false}
        material={glowMaterial}
      >
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      </instancedMesh>

      <instancedMesh
        ref={hitMeshRef}
        args={[undefined, undefined, instanceCount]}
        frustumCulled={false}
        material={hitMaterial}
        onClick={handleClick}
      >
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      </instancedMesh>
    </group>
  );
}
