import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { createBlockMaterial } from "../tower/BlockShader";
import type { DemoBlock } from "@/stores/tower-store";

interface Props {
  block: DemoBlock;
  previewColor?: string;
  previewStyle?: number;
  previewName?: string;
}

export function ConfiguratorScene({ block, previewColor, previewStyle }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Pre-allocate (no new in useFrame!)
  const tmpColor = useRef(new THREE.Color());
  const scaleRef = useRef(0.01);
  const matrixRef = useRef(new THREE.Matrix4());
  const flashRef = useRef(0);
  const scaleTarget = 2.0;

  const cameraState = useRef({
    azimuth: 0,
    autoRotating: true,
    lastInteraction: 0,
    AUTO_RESUME_DELAY: 2000,
  }).current;

  const ORBIT_DISTANCE = 4.0;
  const ORBIT_HEIGHT = 0.6;
  const AUTO_SPEED = 0.3;

  const { geometry, material } = useMemo(() => {
    const geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.04);
    const mat = createBlockMaterial();

    const floatAttr = (name: string, itemSize: number) => {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(itemSize), itemSize);
      geo.setAttribute(name, attr);
      return attr;
    };

    // All the attributes the shader expects
    floatAttr("aEnergy", 1);
    floatAttr("aOwnerColor", 3);
    floatAttr("aLayerNorm", 1);
    floatAttr("aStyle", 1);
    floatAttr("aTextureId", 1);
    floatAttr("aFade", 1);
    floatAttr("aHighlight", 1);
    floatAttr("aImageIndex", 1);
    floatAttr("aEvolutionTier", 1);
    floatAttr("aPersonality", 1);
    floatAttr("aIsBot", 1);
    floatAttr("aHasOwner", 1);
    floatAttr("aChargeReaction", 1);

    return { geometry: geo, material: mat };
  }, []);

  // Set initial attribute values from block data
  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;

    const color = tmpColor.current.set(block.ownerColor || "#4488ff");
    const ownerColorAttr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute;
    ownerColorAttr.array[0] = color.r;
    ownerColorAttr.array[1] = color.g;
    ownerColorAttr.array[2] = color.b;
    ownerColorAttr.needsUpdate = true;

    const styleAttr = geo.getAttribute("aStyle") as THREE.InstancedBufferAttribute;
    styleAttr.array[0] = block.style ?? 0;
    styleAttr.needsUpdate = true;

    const energyAttr = geo.getAttribute("aEnergy") as THREE.InstancedBufferAttribute;
    energyAttr.array[0] = 0.85;
    energyAttr.needsUpdate = true;

    const hasOwnerAttr = geo.getAttribute("aHasOwner") as THREE.InstancedBufferAttribute;
    hasOwnerAttr.array[0] = 1.0;
    hasOwnerAttr.needsUpdate = true;

    const evoAttr = geo.getAttribute("aEvolutionTier") as THREE.InstancedBufferAttribute;
    evoAttr.array[0] = block.evolutionTier ?? 0;
    evoAttr.needsUpdate = true;

    const persAttr = geo.getAttribute("aPersonality") as THREE.InstancedBufferAttribute;
    persAttr.array[0] = block.personality ?? -1;
    persAttr.needsUpdate = true;

    const fadeAttr = geo.getAttribute("aFade") as THREE.InstancedBufferAttribute;
    fadeAttr.array[0] = 1.0;
    fadeAttr.needsUpdate = true;

    const layerNormAttr = geo.getAttribute("aLayerNorm") as THREE.InstancedBufferAttribute;
    layerNormAttr.array[0] = 0.5;
    layerNormAttr.needsUpdate = true;

    // Set initial matrix
    matrixRef.current.makeScale(0.01, 0.01, 0.01);
    meshRef.current.setMatrixAt(0, matrixRef.current);
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [block]);

  // Live preview updates when color/style change
  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;

    if (previewColor) {
      const c = tmpColor.current.set(previewColor);
      const attr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute;
      attr.array[0] = c.r;
      attr.array[1] = c.g;
      attr.array[2] = c.b;
      attr.needsUpdate = true;
    }

    if (previewStyle !== undefined) {
      const attr = geo.getAttribute("aStyle") as THREE.InstancedBufferAttribute;
      attr.array[0] = previewStyle;
      attr.needsUpdate = true;
    }
  }, [previewColor, previewStyle]);

  // Style change flash
  useEffect(() => {
    if (previewStyle !== undefined) {
      flashRef.current = 0.4;
    }
  }, [previewStyle]);

  useFrame((state, delta) => {
    const cam = state.camera;

    // Auto-rotate or idle
    if (cameraState.autoRotating) {
      cameraState.azimuth += AUTO_SPEED * delta;
    } else {
      const now = Date.now();
      if (now - cameraState.lastInteraction > cameraState.AUTO_RESUME_DELAY) {
        cameraState.autoRotating = true;
      }
    }

    cam.position.x = Math.sin(cameraState.azimuth) * ORBIT_DISTANCE;
    cam.position.y = ORBIT_HEIGHT;
    cam.position.z = Math.cos(cameraState.azimuth) * ORBIT_DISTANCE;
    cam.lookAt(0, 0, 0);

    // Update shader uniforms
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (material.uniforms.uCameraPos) {
      material.uniforms.uCameraPos.value.copy(cam.position);
    }

    // Spring scale animation
    scaleRef.current += (scaleTarget - scaleRef.current) * Math.min(delta * 8, 1);
    matrixRef.current.makeScale(scaleRef.current, scaleRef.current, scaleRef.current);
    if (meshRef.current) {
      meshRef.current.setMatrixAt(0, matrixRef.current);
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Decay flash
    if (flashRef.current > 0) {
      flashRef.current = Math.max(0, flashRef.current - delta * 2.0);
      const attr = geometry.getAttribute("aHighlight") as THREE.InstancedBufferAttribute;
      attr.array[0] = flashRef.current;
      attr.needsUpdate = true;
    }
  });

  // Expose cameraState for drag gesture from parent
  (ConfiguratorScene as any)._cameraState = cameraState;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, 1]}
      frustumCulled={false}
    />
  );
}

// Allow parent to control orbit via drag
ConfiguratorScene.getCameraState = () => (ConfiguratorScene as any)._cameraState;
