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
import { CLAIM_PHASES, CLAIM_LIGHT, CLAIM_CAMERA, CLAIM_IMPACT_OFFSET_SECS } from "@/constants/ClaimEffectConfig";

export interface BlockMeta {
  id: string;
  /** Plain {x,y,z} — NOT THREE.Vector3. Avoids 650 constructor calls per rebuild. */
  position: { x: number; y: number; z: number };
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
  const revealProgress = useTowerStore((s) => s.revealProgress);
  const revealComplete = useTowerStore((s) => s.revealComplete);
  const recentlyClaimedId = useTowerStore((s) => s.recentlyClaimedId);
  const clearRecentlyClaimed = useTowerStore((s) => s.clearRecentlyClaimed);
  const recentlyChargedId = useTowerStore((s) => s.recentlyChargedId);
  const clearRecentlyCharged = useTowerStore((s) => s.clearRecentlyCharged);
  const claimCelebrationRef = useTowerStore((s) => s.claimCelebrationRef);
  const recentlyPokedId = useTowerStore((s) => s.recentlyPokedId);
  const clearRecentlyPoked = useTowerStore((s) => s.clearRecentlyPoked);
  const glowUpBlockId = useTowerStore((s) => s.glowUpBlockId);
  const clearGlowUpBlock = useTowerStore((s) => s.clearGlowUpBlock);

  // Track claim flash animation
  const claimFlashRef = useRef<{ blockIndex: number; time: number } | null>(null);
  // Track charge flash animation (multiple can be active) — quality affects intensity
  const chargeFlashQueueRef = useRef<Array<{ blockIndex: number; time: number; quality: number }>>([]);
  // Track glow-up animation (gold→owner color after zoom-back)
  const glowUpRef = useRef<{ blockIndex: number; time: number; ownerColor: string } | null>(null);
  // Reusable Color objects to avoid per-frame GC pressure
  const tmpColorRef = useRef(new THREE.Color());
  const goldColorRef = useRef(new THREE.Color(1.0, 0.85, 0.2));
  // Track poke flash animation (shake + orange-red flash)
  const pokeFlashRef = useRef<{ blockIndex: number; time: number } | null>(null);
  // Reusable Color for charge flash — avoids `new THREE.Color()` every frame
  const chargeFlashColorRef = useRef(new THREE.Color(0.8, 0.9, 1.0));
  // Reusable Color for poke flash
  const pokeFlashColorRef = useRef(new THREE.Color(1.0, 0.5, 0.2));

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

  // PERF: Skip 650-element loops when idle (no active animation)
  const fadeAnimatingRef = useRef(false);
  const popAnimatingRef = useRef(false);
  // Track last popped index for single-block matrix restore
  const lastPoppedIndexRef = useRef<number>(-1);
  // Track celebration state changes (so we update targets when celebration ends)
  const prevCelActiveRef = useRef(false);
  // Safety timeout: force-stop pop animation if stuck > 2s with no meaningful delta
  const popAnimStartRef = useRef(0);

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
        position: { x: layout.x, y: layout.y, z: layout.z },
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

  // Apply transforms once when layout is ready (re-applied during reveal for scale gating).
  // Matrices only depend on layoutData (positions/rotations), NOT on blockData (energy/color).
  const transformsApplied = useRef(false);
  const prevLayoutRef = useRef(layoutData);
  const prevRevealCompleteRef = useRef(revealComplete);
  if (prevLayoutRef.current !== layoutData) {
    transformsApplied.current = false;
    prevLayoutRef.current = layoutData;
  }
  // Once reveal completes, re-apply transforms one final time (to remove scale gating)
  if (revealComplete && !prevRevealCompleteRef.current) {
    transformsApplied.current = false;
    prevRevealCompleteRef.current = true;
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

        tempObj.position.set(block.position.x, block.position.y, block.position.z);

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
          glowObj.position.set(block.position.x, block.position.y, block.position.z);
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

    // Update per-instance attributes (energy, color, layerNorm, style, texture, image)
    // PERF: Write directly into existing attribute arrays — zero temp Float32Array allocations.
    // On first run (no existing attrs), we create the buffers. After that, we reuse them.
    const count = blockData.length;
    const geo = mesh.geometry;
    const tempColor = tmpColorRef.current;

    // ─── Ensure attribute buffers exist (first mount only) ──
    let energyAttr = geo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
    if (!energyAttr || energyAttr.count !== count) {
      energyAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      geo.setAttribute("aEnergy", energyAttr);
    }
    let colorAttr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;
    if (!colorAttr || colorAttr.count !== count) {
      colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      geo.setAttribute("aOwnerColor", colorAttr);
    }
    let layerAttr = geo.getAttribute("aLayerNorm") as THREE.InstancedBufferAttribute | null;
    if (!layerAttr || layerAttr.count !== count) {
      layerAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      geo.setAttribute("aLayerNorm", layerAttr);
    }
    let styleAttr = geo.getAttribute("aStyle") as THREE.InstancedBufferAttribute | null;
    if (!styleAttr || styleAttr.count !== count) {
      styleAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      geo.setAttribute("aStyle", styleAttr);
    }
    let textureAttr = geo.getAttribute("aTextureId") as THREE.InstancedBufferAttribute | null;
    if (!textureAttr || textureAttr.count !== count) {
      textureAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      geo.setAttribute("aTextureId", textureAttr);
    }
    let imageAttr = geo.getAttribute("aImageIndex") as THREE.InstancedBufferAttribute | null;
    if (!imageAttr || imageAttr.count !== count) {
      imageAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      geo.setAttribute("aImageIndex", imageAttr);
    }
    let evoAttr = geo.getAttribute("aEvolutionTier") as THREE.InstancedBufferAttribute | null;
    if (!evoAttr || evoAttr.count !== count) {
      evoAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      geo.setAttribute("aEvolutionTier", evoAttr);
    }

    // ─── Write values directly into existing arrays ──
    const eArr = energyAttr.array as Float32Array;
    const cArr = colorAttr.array as Float32Array;
    const lArr = layerAttr.array as Float32Array;
    const sArr = styleAttr.array as Float32Array;
    const tArr = textureAttr.array as Float32Array;
    const iArr = imageAttr.array as Float32Array;
    const evArr = evoAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const block = blockData[i];
      const storeBlock = demoBlockMap.get(block.layer * 1000 + block.index);

      eArr[i] = block.energy / 100;
      lArr[i] = block.layer / (config.layerCount - 1);
      sArr[i] = storeBlock?.style ?? 0;
      tArr[i] = storeBlock?.textureId ?? 0;

      tempColor.set(block.ownerColor);
      cArr[i * 3] = tempColor.r;
      cArr[i * 3 + 1] = tempColor.g;
      cArr[i * 3 + 2] = tempColor.b;

      // Image index
      let imgIdx = storeBlock?.imageIndex ?? 0;
      if (imgIdx === 0 && block.owner) {
        const hash = ((block.layer * 31 + block.index * 7 + 137) & 0xffff);
        if (hash % 4 < 3) { imgIdx = (hash % 5) + 1; }
      }
      iArr[i] = imgIdx;

      // Evolution tier
      evArr[i] = storeBlock?.evolutionTier ?? 0;
    }

    energyAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    layerAttr.needsUpdate = true;
    styleAttr.needsUpdate = true;
    textureAttr.needsUpdate = true;
    imageAttr.needsUpdate = true;
    evoAttr.needsUpdate = true;

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

      // Reuse main mesh attribute data (eArr, cArr already populated above)
      let glowEnergy = glowGeo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
      if (!glowEnergy || glowEnergy.count !== count) {
        glowEnergy = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
        glowGeo.setAttribute("aEnergy", glowEnergy);
      }
      (glowEnergy.array as Float32Array).set(eArr);
      glowEnergy.needsUpdate = true;

      let glowColor = glowGeo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;
      if (!glowColor || glowColor.count !== count) {
        glowColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        glowGeo.setAttribute("aOwnerColor", glowColor);
      }
      (glowColor.array as Float32Array).set(cArr);
      glowColor.needsUpdate = true;

      // Glow inspect mode attributes
      if (fadeCurrentRef.current) {
        let glowFade = glowGeo.getAttribute("aFade") as THREE.InstancedBufferAttribute | null;
        if (!glowFade || glowFade.count !== count) {
          glowGeo.setAttribute("aFade", new THREE.InstancedBufferAttribute(new Float32Array(fadeCurrentRef.current), 1));
        }
      }
      if (highlightCurrentRef.current) {
        let glowHL = glowGeo.getAttribute("aHighlight") as THREE.InstancedBufferAttribute | null;
        if (!glowHL || glowHL.count !== count) {
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

  // Handle charge flash trigger — quality from tower store determines flash intensity
  const recentlyChargedQuality = useTowerStore((s) => s.recentlyChargedQuality);
  useEffect(() => {
    if (recentlyChargedId) {
      const idx = blockData.findIndex((b) => b.id === recentlyChargedId);
      if (idx >= 0) {
        // Map quality string to numeric: 0=normal, 1=good, 2=great
        const quality = recentlyChargedQuality === "great" ? 2 : recentlyChargedQuality === "good" ? 1 : 0;
        chargeFlashQueueRef.current.push({ blockIndex: idx, time: 0, quality });
      }
      const timer = setTimeout(() => clearRecentlyCharged(), 100);
      return () => clearTimeout(timer);
    }
  }, [recentlyChargedId, recentlyChargedQuality, blockData, clearRecentlyCharged]);

  // Handle glow-up trigger (gold→owner color after zoom-back)
  useEffect(() => {
    if (glowUpBlockId) {
      const idx = blockData.findIndex((b) => b.id === glowUpBlockId);
      if (idx >= 0) {
        const block = blockData[idx];
        glowUpRef.current = { blockIndex: idx, time: 0, ownerColor: block.ownerColor };
      }
      // Clear store immediately to allow re-triggering
      const timer = setTimeout(() => clearGlowUpBlock(), 100);
      return () => clearTimeout(timer);
    }
  }, [glowUpBlockId, blockData, clearGlowUpBlock]);

  // Handle poke flash trigger (shake + orange-red flash)
  useEffect(() => {
    if (recentlyPokedId) {
      const idx = blockData.findIndex((b) => b.id === recentlyPokedId);
      if (idx >= 0) {
        pokeFlashRef.current = { blockIndex: idx, time: 0 };
      }
      const timer = setTimeout(() => clearRecentlyPoked(), 100);
      return () => clearTimeout(timer);
    }
  }, [recentlyPokedId, blockData, clearRecentlyPoked]);

  // ─── Reveal animation: scale blocks by layer during reveal ──
  // Tracked separately from transforms since it changes every frame during reveal
  const revealAppliedRef = useRef(false);
  useFrame(() => {
    if (revealComplete) {
      // Once complete, restore all matrices if not done yet
      if (!revealAppliedRef.current) {
        revealAppliedRef.current = true;
        // Matrices will be re-applied by the transformsApplied reset above
      }
      return;
    }
    if (revealProgress <= 0) return;
    if (!meshRef.current || blockData.length === 0) return;

    const tempObj = tempObjRef.current;
    const GLOW_SCALE = 1.08;
    const layerCount = config.layerCount;
    let anyUpdate = false;

    for (let i = 0; i < blockData.length; i++) {
      const block = blockData[i];
      const layoutItem = layoutData[i];
      if (!block || !layoutItem) continue;

      const layerNorm = block.layer / layerCount;
      // Blocks near the reveal front get a quick scale-up (0→1)
      let scale: number;
      if (layerNorm > revealProgress) {
        scale = 0; // above reveal front
      } else if (layerNorm > revealProgress - 0.08) {
        // In the build front — interpolate 0→1
        scale = (revealProgress - layerNorm) / 0.08;
        scale = Math.min(1, Math.max(0, scale));
      } else {
        scale = 1; // fully revealed
      }

      const layerScale = getLayerScale(block.layer, layerCount);
      const ts = layoutItem.tileScale;

      tempObj.position.set(block.position.x, block.position.y, block.position.z);
      tempObj.scale.set(layerScale * ts * scale, layerScale * scale, layerScale * scale);
      tempObj.rotation.set(0, layoutItem.rotY, 0);
      tempObj.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObj.matrix);

      if (glowMeshRef.current) {
        tempObj.scale.set(GLOW_SCALE * layerScale * ts * scale, GLOW_SCALE * layerScale * scale, GLOW_SCALE * layerScale * scale);
        tempObj.updateMatrix();
        glowMeshRef.current.setMatrixAt(i, tempObj.matrix);
      }
      anyUpdate = true;
    }

    if (anyUpdate) {
      meshRef.current!.instanceMatrix.needsUpdate = true;
      if (glowMeshRef.current) glowMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

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

    // ─── Claim celebration: drive shockwave + light uniforms ──
    if (claimCelebrationRef?.current && materialRef.current) {
      const cel = claimCelebrationRef.current;
      if (cel.active) {
        const now = performance.now() / 1000;
        const elapsed = now - cel.startTime;
        const progress = Math.min(elapsed / cel.duration, 1.0);
        const mat = materialRef.current;

        // Shockwave: active during impact + celebration phases
        if (progress >= CLAIM_PHASES.impact.start && progress <= CLAIM_PHASES.celebration.end) {
          const waveElapsed = elapsed - CLAIM_PHASES.impact.start * cel.duration;
          const waveFade = progress < CLAIM_PHASES.settle.start
            ? 1.0
            : 1.0 - (progress - CLAIM_PHASES.settle.start) / (1.0 - CLAIM_PHASES.settle.start);
          mat.uniforms.uClaimWaveOrigin.value.set(cel.blockPosition.x, cel.blockPosition.y, cel.blockPosition.z);
          mat.uniforms.uClaimWaveTime.value = waveElapsed;
          mat.uniforms.uClaimWaveIntensity.value = Math.max(0, waveFade);
        } else {
          mat.uniforms.uClaimWaveIntensity.value = 0;
        }

        // Fake point light: peaks at impact, fades during celebration
        if (progress >= CLAIM_PHASES.impact.start && progress < CLAIM_PHASES.settle.end) {
          let lightI = 0;
          if (progress < CLAIM_PHASES.impact.end) {
            // Ramp up during impact
            const t = (progress - CLAIM_PHASES.impact.start) / (CLAIM_PHASES.impact.end - CLAIM_PHASES.impact.start);
            lightI = t;
          } else if (progress < CLAIM_PHASES.celebration.end) {
            // Hold + slow fade during celebration
            const t = (progress - CLAIM_PHASES.impact.end) / (CLAIM_PHASES.celebration.end - CLAIM_PHASES.impact.end);
            lightI = 1.0 - t * 0.6;
          } else {
            // Fade out during settle
            const t = (progress - CLAIM_PHASES.celebration.end) / (CLAIM_PHASES.settle.end - CLAIM_PHASES.celebration.end);
            lightI = 0.4 * (1.0 - t);
          }
          mat.uniforms.uClaimLightPos.value.set(cel.blockPosition.x, cel.blockPosition.y, cel.blockPosition.z);
          mat.uniforms.uClaimLightIntensity.value = lightI * CLAIM_LIGHT.peakIntensity;
        } else {
          mat.uniforms.uClaimLightIntensity.value = 0;
        }

        // Clean up when done
        if (progress >= 1.0) {
          mat.uniforms.uClaimWaveIntensity.value = 0;
          mat.uniforms.uClaimLightIntensity.value = 0;
          cel.active = false;
        }
      }
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

    // Charge flash: quick pulse — intensity & color vary with roll quality
    // quality 0 = normal (blue-white), 1 = good (gold), 2 = great (bright gold + longer)
    if (chargeFlashQueueRef.current.length > 0 && meshRef.current) {
      const geo = meshRef.current.geometry;
      const energyAttr = geo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
      const colorAttr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;

      if (energyAttr && colorAttr) {
        const completed: number[] = [];
        for (let fi = 0; fi < chargeFlashQueueRef.current.length; fi++) {
          const cf = chargeFlashQueueRef.current[fi];
          cf.time += delta;
          const t = cf.time;
          const q = cf.quality; // 0=normal, 1=good, 2=great
          const flashDuration = q === 2 ? 1.6 : q === 1 ? 1.4 : 1.2;

          if (t < flashDuration) {
            const block = blockData[cf.blockIndex];
            if (block) {
              let intensity: number;
              const flashPhase = 0.3;
              const pulseEnd = flashDuration * 0.65;
              if (t < flashPhase) {
                intensity = 1.0;
                energyAttr.array[cf.blockIndex] = 1.0;
              } else if (t < pulseEnd) {
                intensity = 0.6 * (1 - (t - flashPhase) / (pulseEnd - flashPhase));
                energyAttr.array[cf.blockIndex] = block.energy / 100 + (1 - block.energy / 100) * intensity;
              } else {
                intensity = Math.max(0, 0.2 * (1 - (t - pulseEnd) / (flashDuration - pulseEnd)));
                energyAttr.array[cf.blockIndex] = block.energy / 100;
              }
              energyAttr.needsUpdate = true;

              // Flash color by quality: normal=white-blue, good=warm gold, great=bright gold
              const tempColor = tmpColorRef.current.set(block.ownerColor);
              if (q >= 2) {
                chargeFlashColorRef.current.set(1.0, 0.85, 0.2); // bright gold
              } else if (q === 1) {
                chargeFlashColorRef.current.set(1.0, 0.9, 0.5); // warm gold
              } else {
                chargeFlashColorRef.current.set(0.8, 0.9, 1.0); // white-blue
              }
              const blended = chargeFlashColorRef.current.lerp(tempColor, 1 - intensity);
              colorAttr.array[cf.blockIndex * 3] = blended.r;
              colorAttr.array[cf.blockIndex * 3 + 1] = blended.g;
              colorAttr.array[cf.blockIndex * 3 + 2] = blended.b;
              colorAttr.needsUpdate = true;
            }
          } else {
            // Complete — restore
            const block = blockData[cf.blockIndex];
            if (block) {
              energyAttr.array[cf.blockIndex] = block.energy / 100;
              energyAttr.needsUpdate = true;
              const tempColor = tmpColorRef.current.set(block.ownerColor);
              colorAttr.array[cf.blockIndex * 3] = tempColor.r;
              colorAttr.array[cf.blockIndex * 3 + 1] = tempColor.g;
              colorAttr.array[cf.blockIndex * 3 + 2] = tempColor.b;
              colorAttr.needsUpdate = true;
            }
            completed.push(fi);
          }
        }
        // Remove completed flashes — single filter pass instead of O(n) splices
        if (completed.length > 0) {
          const completedSet = new Set(completed);
          chargeFlashQueueRef.current = chargeFlashQueueRef.current.filter((_, i) => !completedSet.has(i));
        }
      }
    }

    // ─── Glow-up animation: gold → owner color lerp after zoom-back ──
    const glowUp = glowUpRef.current;
    if (glowUp && meshRef.current) {
      glowUp.time += delta;
      const geo = meshRef.current.geometry;
      const energyAttr = geo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
      const colorAttr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;

      if (energyAttr && colorAttr) {
        const GLOW_DURATION = CLAIM_CAMERA.glowUpDuration;
        if (glowUp.time < GLOW_DURATION) {
          const t = glowUp.time / GLOW_DURATION;
          // Ease-out: fast start, gentle settle
          const eased = 1 - (1 - t) * (1 - t);

          // Keep energy at max during glow-up
          energyAttr.array[glowUp.blockIndex] = 1.0;
          energyAttr.needsUpdate = true;

          // Lerp from gold → owner color
          const gold = goldColorRef.current.set(1.0, 0.85, 0.2);
          const ownerCol = tmpColorRef.current.set(glowUp.ownerColor);
          const blended = gold.lerp(ownerCol, eased);
          colorAttr.array[glowUp.blockIndex * 3] = blended.r;
          colorAttr.array[glowUp.blockIndex * 3 + 1] = blended.g;
          colorAttr.array[glowUp.blockIndex * 3 + 2] = blended.b;
          colorAttr.needsUpdate = true;
        } else {
          // Animation complete — restore actual values
          const block = blockData[glowUp.blockIndex];
          if (block) {
            energyAttr.array[glowUp.blockIndex] = block.energy / 100;
            energyAttr.needsUpdate = true;
            const tempColor = tmpColorRef.current.set(block.ownerColor);
            colorAttr.array[glowUp.blockIndex * 3] = tempColor.r;
            colorAttr.array[glowUp.blockIndex * 3 + 1] = tempColor.g;
            colorAttr.array[glowUp.blockIndex * 3 + 2] = tempColor.b;
            colorAttr.needsUpdate = true;
          }
          glowUpRef.current = null;
        }
      }
    }

    // ─── Poke flash: orange-red shake pulse for 1.0 seconds ──
    const pokeFlash = pokeFlashRef.current;
    if (pokeFlash && meshRef.current) {
      pokeFlash.time += delta;
      const geo = meshRef.current.geometry;
      const energyAttr = geo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute | null;
      const colorAttr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute | null;

      if (energyAttr && colorAttr) {
        const POKE_DURATION = 1.4;
        if (pokeFlash.time < POKE_DURATION) {
          const t = pokeFlash.time;
          const block = blockData[pokeFlash.blockIndex];
          if (block) {
            // Intensity: quick flash, hold, then fade with bounce
            let intensity: number;
            if (t < 0.1) {
              intensity = t / 0.1; // fast ramp up
            } else if (t < 0.35) {
              intensity = 1.0; // hold at peak
            } else if (t < 0.7) {
              intensity = 1.0 - (t - 0.35) * 1.5; // fade
              intensity = Math.max(0.4, intensity);
            } else {
              // Secondary gentle pulse then settle
              const tail = (t - 0.7) / 0.7;
              intensity = 0.4 * (1 - tail) * (1 + 0.3 * Math.sin(tail * Math.PI * 3));
              intensity = Math.max(0, intensity);
            }

            energyAttr.array[pokeFlash.blockIndex] = Math.max(block.energy / 100, intensity);
            energyAttr.needsUpdate = true;

            // Blend orange-red poke color with owner color
            const ownerCol = tmpColorRef.current.set(block.ownerColor);
            const flashCol = pokeFlashColorRef.current.set(1.0, 0.5, 0.2);
            const blended = flashCol.lerp(ownerCol, 1 - intensity);
            colorAttr.array[pokeFlash.blockIndex * 3] = blended.r;
            colorAttr.array[pokeFlash.blockIndex * 3 + 1] = blended.g;
            colorAttr.array[pokeFlash.blockIndex * 3 + 2] = blended.b;
            colorAttr.needsUpdate = true;

            // Shake: offset the block's matrix with oscillating displacement
            const layoutItem = layoutData[pokeFlash.blockIndex];
            if (layoutItem) {
              const shakeAmp = 0.18 * (1 - t / POKE_DURATION);
              const shakeX = Math.sin(t * 45) * shakeAmp;
              const shakeZ = Math.cos(t * 40) * shakeAmp;
              // Pop-up bounce: quick rise then settle
              const bounceT = Math.min(t / 0.3, 1);
              const bounceY = 0.12 * Math.sin(bounceT * Math.PI) * (1 - t / POKE_DURATION);
              const layerScale = getLayerScale(block.layer, config.layerCount);
              const ts = layoutItem.tileScale;
              const tempObj = tempObjRef.current;
              tempObj.position.set(
                block.position.x + shakeX,
                block.position.y + bounceY,
                block.position.z + shakeZ,
              );
              tempObj.scale.set(layerScale * ts, layerScale, layerScale);
              tempObj.rotation.set(0, layoutItem.rotY, 0);
              tempObj.updateMatrix();
              meshRef.current!.setMatrixAt(pokeFlash.blockIndex, tempObj.matrix);
              meshRef.current!.instanceMatrix.needsUpdate = true;
            }
          }
        } else {
          // Flash complete — restore actual values + matrix
          const block = blockData[pokeFlash.blockIndex];
          if (block) {
            energyAttr.array[pokeFlash.blockIndex] = block.energy / 100;
            energyAttr.needsUpdate = true;
            const tempColor = tmpColorRef.current.set(block.ownerColor);
            colorAttr.array[pokeFlash.blockIndex * 3] = tempColor.r;
            colorAttr.array[pokeFlash.blockIndex * 3 + 1] = tempColor.g;
            colorAttr.array[pokeFlash.blockIndex * 3 + 2] = tempColor.b;
            colorAttr.needsUpdate = true;

            // Restore matrix to base position
            const layoutItem = layoutData[pokeFlash.blockIndex];
            if (layoutItem) {
              const layerScale = getLayerScale(block.layer, config.layerCount);
              const ts = layoutItem.tileScale;
              const tempObj = tempObjRef.current;
              tempObj.position.set(block.position.x, block.position.y, block.position.z);
              tempObj.scale.set(layerScale * ts, layerScale, layerScale);
              tempObj.rotation.set(0, layoutItem.rotY, 0);
              tempObj.updateMatrix();
              meshRef.current!.setMatrixAt(pokeFlash.blockIndex, tempObj.matrix);
              meshRef.current!.instanceMatrix.needsUpdate = true;
            }
          }
          pokeFlashRef.current = null;
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
          lastPoppedIndexRef.current = selectedIdx;
        } else {
          // No selection — restore all blocks to normal
          // BUT during claim celebration, keep the claimed block popped out + highlighted
          const isCelActive = claimCelebrationRef?.current?.active ?? false;
          const celBlockId = claimCelebrationRef?.current?.blockId;
          for (let i = 0; i < count; i++) {
            if (isCelActive && celBlockId && blockData[i]?.id === celBlockId) {
              // Keep claimed block popped out and highlighted during celebration
              fadeTargetsRef.current[i] = 1.0;
              highlightTargetsRef.current[i] = 1.0;
              popOutTargetRef.current[i] = 1.0;
            } else {
              fadeTargetsRef.current[i] = 1.0;
              highlightTargetsRef.current[i] = 0.0;
              popOutTargetRef.current[i] = 0.0;
            }
          }
        }
        // New targets set — enable animation loops
        fadeAnimatingRef.current = true;
        popAnimatingRef.current = true;
        popAnimStartRef.current = performance.now();
      }
    }

    // Detect celebration END — targets must be re-set even if selectedBlockId didn't change
    const isCelActiveNow = claimCelebrationRef?.current?.active ?? false;
    if (prevCelActiveRef.current && !isCelActiveNow) {
      // Celebration just ended — reset all targets to default (no selection, no celebration)
      const count = blockData.length;
      if (fadeTargetsRef.current && highlightTargetsRef.current && popOutTargetRef.current && count > 0) {
        if (!selectedBlockId) {
          for (let i = 0; i < count; i++) {
            fadeTargetsRef.current[i] = 1.0;
            highlightTargetsRef.current[i] = 0.0;
            popOutTargetRef.current[i] = 0.0;
          }
          fadeAnimatingRef.current = true;
          popAnimatingRef.current = true;
          popAnimStartRef.current = performance.now();
        }
      }
    }
    prevCelActiveRef.current = isCelActiveNow;

    // Animate fade/highlight values toward targets
    // PERF: Skip entire 650-element loop when no animation is active
    const fadeCur = fadeCurrentRef.current;
    const fadeTgt = fadeTargetsRef.current;
    const hlCur = highlightCurrentRef.current;
    const hlTgt = highlightTargetsRef.current;
    if (fadeAnimatingRef.current && fadeCur && fadeTgt && hlCur && hlTgt && meshRef.current) {
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
      } else {
        // All deltas < 0.001 — animation complete, skip loop next frame
        fadeAnimatingRef.current = false;
      }
    }

    // ─── Pop-out animation: lerp + recompute matrices ────────
    // PERF: Skip entire loop when no pop animation is active
    const popCur = popOutCurrentRef.current;
    const popTgt = popOutTargetRef.current;
    if (popAnimatingRef.current && popCur && popTgt && meshRef.current) {
      // Safety timeout: force-stop if stuck animating > 3 seconds
      if (performance.now() - popAnimStartRef.current > 3000) {
        // Snap all values to targets and stop
        for (let i = 0; i < popCur.length; i++) popCur[i] = popTgt[i];
        popAnimatingRef.current = false;
      }

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
      } else {
        // Animation converged — only restore base matrix when deselecting (targets are 0)
        const hasActiveTarget = selectedBlockId !== null;
        const restoreIdx = lastPoppedIndexRef.current;
        if (!hasActiveTarget && restoreIdx >= 0 && restoreIdx < blockData.length) {
          const restoreObj = tempObjRef.current;
          const GLOW_SCALE = 1.08;
          const block = blockData[restoreIdx];
          const layoutItem = layoutData[restoreIdx];

          if (block && layoutItem) {
            const layerScale = getLayerScale(block.layer, config.layerCount);
            const rts = layoutItem.tileScale;

            restoreObj.position.set(block.position.x, block.position.y, block.position.z);
            restoreObj.scale.set(layerScale * rts, layerScale, layerScale);
            restoreObj.rotation.set(0, layoutItem.rotY, 0);
            restoreObj.updateMatrix();
            meshRef.current!.setMatrixAt(restoreIdx, restoreObj.matrix);

            if (hitMeshRef.current) {
              restoreObj.scale.multiplyScalar(HIT_SCALE);
              restoreObj.updateMatrix();
              hitMeshRef.current.setMatrixAt(restoreIdx, restoreObj.matrix);
            }

            if (glowMeshRef.current) {
              restoreObj.position.set(block.position.x, block.position.y, block.position.z);
              restoreObj.scale.set(GLOW_SCALE * layerScale * rts, GLOW_SCALE * layerScale, GLOW_SCALE * layerScale);
              restoreObj.rotation.set(0, layoutItem.rotY, 0);
              restoreObj.updateMatrix();
              glowMeshRef.current.setMatrixAt(restoreIdx, restoreObj.matrix);
            }

            meshRef.current!.instanceMatrix.needsUpdate = true;
            if (hitMeshRef.current) hitMeshRef.current.instanceMatrix.needsUpdate = true;
            if (glowMeshRef.current) glowMeshRef.current.instanceMatrix.needsUpdate = true;
          }

          lastPoppedIndexRef.current = -1;
        }

        // Animation complete — skip loop next frame
        popAnimatingRef.current = false;
      }
    }

    // ─── Celebration block jitter: vibrate the claimed block during buildup ──
    // Only 1 block matrix update per frame — essentially free.
    if (claimCelebrationRef?.current?.active && meshRef.current) {
      const cel = claimCelebrationRef.current;
      const elapsed = performance.now() / 1000 - cel.startTime;

      if (elapsed > 0 && elapsed < CLAIM_IMPACT_OFFSET_SECS && cel.blockId) {
        const celIdx = blockData.findIndex((b) => b.id === cel.blockId);
        if (celIdx >= 0) {
          const block = blockData[celIdx];
          const layoutItem = layoutData[celIdx];
          if (block && layoutItem) {
            const t = elapsed / CLAIM_IMPACT_OFFSET_SECS; // 0→1
            // Cubic escalation: barely perceptible → violent shake in last 0.5s
            const mag = 0.02 + t * t * t * 0.15;
            // High-frequency oscillation with prime multipliers for organic feel
            const jx = Math.sin(elapsed * 47.0) * mag;
            const jy = Math.sin(elapsed * 53.0) * mag * 0.5;
            const jz = Math.sin(elapsed * 59.0) * mag;

            const layerScale = getLayerScale(block.layer, config.layerCount);
            const ts = layoutItem.tileScale;
            const POP_DISTANCE = CAMERA_CONFIG.inspect.popDistance;
            const popVal = popOutCurrentRef.current?.[celIdx] ?? 0;

            // Compute pop-out offset (same as pop-out loop)
            const px = block.position.x;
            const pz = block.position.z;
            const len = Math.sqrt(px * px + pz * pz);
            const nx = Math.sin(layoutItem.rotY);
            const nz = Math.cos(layoutItem.rotY);
            const dot = nx * px + nz * pz;
            let offX = 0, offY = 0, offZ = 0;
            if (len < 0.01) { offY = popVal * POP_DISTANCE; }
            else if (dot > 0.01) { offX = nx * popVal * POP_DISTANCE; offZ = nz * popVal * POP_DISTANCE; }
            else { offX = (px / len) * popVal * POP_DISTANCE; offZ = (pz / len) * popVal * POP_DISTANCE; }

            const tempObj = tempObjRef.current;
            tempObj.position.set(
              block.position.x + offX + jx,
              block.position.y + offY + jy,
              block.position.z + offZ + jz,
            );
            tempObj.scale.set(layerScale * ts, layerScale, layerScale);
            tempObj.rotation.set(0, layoutItem.rotY, 0);
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(celIdx, tempObj.matrix);
            meshRef.current.instanceMatrix.needsUpdate = true;

            if (glowMeshRef.current) {
              const GLOW_SCALE = 1.08;
              tempObj.position.set(
                block.position.x + offX + jx,
                block.position.y + offY + jy,
                block.position.z + offZ + jz,
              );
              tempObj.scale.set(GLOW_SCALE * layerScale * ts, GLOW_SCALE * layerScale, GLOW_SCALE * layerScale);
              tempObj.rotation.set(0, layoutItem.rotY, 0);
              tempObj.updateMatrix();
              glowMeshRef.current.setMatrixAt(celIdx, tempObj.matrix);
              glowMeshRef.current.instanceMatrix.needsUpdate = true;
            }
          }
        }
      }
    }
  });

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const gestureActive = useTowerStore.getState().isGestureActive;
    if (gestureActive) {
      if (__DEV__) console.log("[TowerGrid] Click blocked by gesture active");
      return;
    }

    if (event.instanceId == null) return;
    const meta = blockMetaRef.current[event.instanceId];
    if (!meta) return;

    if (__DEV__) console.log("[TowerGrid] Block tapped:", meta.id, "layer:", meta.layer, "index:", meta.index);
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
