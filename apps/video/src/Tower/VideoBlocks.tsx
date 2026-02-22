import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { BLOCK_SIZE, getLayerScale, DEFAULT_TOWER_CONFIG } from "@monolith/common";
import type { VideoBlock } from "./generateBlocks";
import { createBlockMaterial, createGlowMaterial } from "./VideoBlockShader";
import { generateAtlasTexture } from "./generateAtlas";

interface VideoBlocksProps {
  blocks: VideoBlock[];
  frame: number;
  fps: number;
  /** 0 = no inspect, 1 = fully inspecting */
  inspectProgress?: number;
  /** Y position of the inspected layer */
  inspectY?: number;
  /** Camera position for interior mapping */
  cameraPosition?: [number, number, number];
}

/**
 * InstancedMesh block rendering with real GLSL shaders.
 * Matches the in-game rendering pipeline with all per-instance attributes.
 */
export const VideoBlocks: React.FC<VideoBlocksProps> = ({
  blocks,
  frame,
  fps,
  inspectProgress = 0,
  inspectY = 0,
  cameraPosition,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const totalLayers = DEFAULT_TOWER_CONFIG.layerCount;

  const blockMaterial = useMemo(() => {
    const mat = createBlockMaterial();
    const atlas = generateAtlasTexture();
    mat.uniforms.uImageAtlas.value = atlas;
    // Fog for mystery — blocks dissolve into darkness at distance
    mat.uniforms.uFogDensity.value = 0.022;
    mat.uniforms.uFogColor.value = new THREE.Color(0x080510);
    return mat;
  }, []);

  const glowMaterial = useMemo(() => createGlowMaterial(), []);

  // Per-instance attribute arrays
  const { attrs } = useMemo(() => {
    const count = blocks.length;
    const aEnergy = new Float32Array(count);
    const aOwnerColor = new Float32Array(count * 3);
    const aLayerNorm = new Float32Array(count);
    const aStyle = new Float32Array(count);
    const aTextureId = new Float32Array(count);
    const aFade = new Float32Array(count);
    const aHighlight = new Float32Array(count);
    const aImageIndex = new Float32Array(count);

    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const block = blocks[i];
      aEnergy[i] = block.energy / 100;
      tempColor.set(block.color);
      aOwnerColor[i * 3] = tempColor.r;
      aOwnerColor[i * 3 + 1] = tempColor.g;
      aOwnerColor[i * 3 + 2] = tempColor.b;
      aLayerNorm[i] = block.layer / (totalLayers - 1);
      aStyle[i] = block.style;
      aTextureId[i] = block.textureId;
      aFade[i] = 1.0; // default: fully visible
      aHighlight[i] = 0.0;
      aImageIndex[i] = block.imageIndex;
    }

    return {
      attrs: {
        aEnergy,
        aOwnerColor,
        aLayerNorm,
        aStyle,
        aTextureId,
        aFade,
        aHighlight,
        aImageIndex,
      },
    };
  }, [blocks, totalLayers]);

  // Set instance matrices and attributes
  useEffect(() => {
    const mesh = meshRef.current;
    const glow = glowRef.current;
    if (!mesh) return;

    const tempObj = new THREE.Object3D();

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const pos = block.position;
      const scale = getLayerScale(block.layer, totalLayers);
      const blockSize = BLOCK_SIZE * scale;

      tempObj.position.set(pos.x, pos.y, pos.z);
      tempObj.rotation.set(0, pos.rotY, 0);
      tempObj.scale.set(
        blockSize * pos.tileScale,
        blockSize,
        blockSize,
      );
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
      if (glow) glow.setMatrixAt(i, tempObj.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (glow) glow.instanceMatrix.needsUpdate = true;

    // Set per-instance attributes on both meshes
    const setAttrs = (m: THREE.InstancedMesh) => {
      m.geometry.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(attrs.aEnergy, 1));
      m.geometry.setAttribute("aOwnerColor", new THREE.InstancedBufferAttribute(attrs.aOwnerColor, 3));
      m.geometry.setAttribute("aLayerNorm", new THREE.InstancedBufferAttribute(attrs.aLayerNorm, 1));
      m.geometry.setAttribute("aStyle", new THREE.InstancedBufferAttribute(attrs.aStyle, 1));
      m.geometry.setAttribute("aTextureId", new THREE.InstancedBufferAttribute(attrs.aTextureId, 1));
      m.geometry.setAttribute("aFade", new THREE.InstancedBufferAttribute(attrs.aFade, 1));
      m.geometry.setAttribute("aHighlight", new THREE.InstancedBufferAttribute(attrs.aHighlight, 1));
      m.geometry.setAttribute("aImageIndex", new THREE.InstancedBufferAttribute(attrs.aImageIndex, 1));
    };

    setAttrs(mesh);
    if (glow) setAttrs(glow);
  }, [blocks, attrs, totalLayers]);

  // Update uniforms each frame (deterministic time)
  const time = frame / fps;
  blockMaterial.uniforms.uTime.value = time;
  glowMaterial.uniforms.uTime.value = time;

  if (cameraPosition) {
    blockMaterial.uniforms.uCameraPos.value.set(...cameraPosition);
  }

  // Update inspect-mode attributes per frame
  useEffect(() => {
    const mesh = meshRef.current;
    const glow = glowRef.current;
    if (!mesh) return;

    const fadeAttr = mesh.geometry.getAttribute("aFade") as THREE.InstancedBufferAttribute;
    const hlAttr = mesh.geometry.getAttribute("aHighlight") as THREE.InstancedBufferAttribute;
    if (!fadeAttr || !hlAttr) return;

    // Target block: find the block nearest to inspect position (layer 8, front face)
    let targetIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.layer === 8) {
        const dx = b.position.x - 3.0;
        const dz = b.position.z - 4.5;
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          targetIdx = i;
        }
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      if (inspectProgress > 0.01) {
        if (i === targetIdx) {
          hlAttr.array[i] = inspectProgress;
          fadeAttr.array[i] = 1.0;
        } else {
          hlAttr.array[i] = 0;
          // Dim surrounding blocks based on inspect progress
          fadeAttr.array[i] = 1.0 - inspectProgress * 0.7;
        }
      } else {
        hlAttr.array[i] = 0;
        fadeAttr.array[i] = 1.0;
      }
    }

    fadeAttr.needsUpdate = true;
    hlAttr.needsUpdate = true;

    // Also update glow mesh attributes
    if (glow) {
      const glowFade = glow.geometry.getAttribute("aFade") as THREE.InstancedBufferAttribute;
      const glowHl = glow.geometry.getAttribute("aHighlight") as THREE.InstancedBufferAttribute;
      if (glowFade && glowHl) {
        for (let i = 0; i < blocks.length; i++) {
          glowFade.array[i] = fadeAttr.array[i];
          glowHl.array[i] = hlAttr.array[i];
        }
        glowFade.needsUpdate = true;
        glowHl.needsUpdate = true;
      }
    }
  }, [blocks, inspectProgress]);

  return (
    <group>
      {/* Main block mesh */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, blocks.length]}
        frustumCulled={false}
        material={blockMaterial}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Glow pass — additive bloom halo */}
      <instancedMesh
        ref={glowRef}
        args={[undefined, undefined, blocks.length]}
        frustumCulled={false}
        material={glowMaterial}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
};
