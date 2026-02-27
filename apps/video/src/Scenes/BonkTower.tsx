import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";
import { VideoTower } from "../Tower/VideoTower";
import { artOrbit } from "../Camera/paths";
import { generateBonkBlocks } from "../Tower/generateBonkBlocks";
import { BonkSkybox } from "../Environment/BonkSkybox";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

// ─── Toggle: set to true to show BONK logo overlay for demo recording ────────
const SHOW_BONK_LOGO = true;

// 15s orbit + 3s end card = 18s total
const ORBIT_SECONDS = 15;
const CARD_SECONDS = 3;

/**
 * BonkTower — The Monolith in BONK. All orange, all blazing, all fire.
 * BONK shiba on block windows, warm skybox, title end card.
 */
export const BonkTower: React.FC = () => {
  const blocks = useMemo(() => generateBonkBlocks(69), []);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load BONK logo as Three.js texture for the block image atlas
  const [bonkAtlas, setBonkAtlas] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender("Loading BONK atlas"));

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      staticFile("bonk-logo.webp"),
      (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        setBonkAtlas(texture);
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle),
    );
  }, [handle]);

  const orbitFrames = ORBIT_SECONDS * fps;
  const cardStartFrame = orbitFrames;

  // Darken overlay during end card transition (last 1s of orbit fades to dark)
  const fadeStart = orbitFrames - fps;
  const darkenOpacity =
    frame < fadeStart
      ? 0
      : Math.min((frame - fadeStart) / (fps * 1), 0.75);

  // Title card text opacity (fades in over 0.5s)
  const cardProgress = Math.max(0, frame - cardStartFrame) / fps;
  const textOpacity = Math.min(cardProgress / 0.5, 1);

  // Logo float animation (only during orbit portion)
  const logoOpacity = Math.min(frame / (fps * 1), 0.6) * (1 - darkenOpacity);
  const floatY = Math.sin((frame / fps) * Math.PI * 0.8) * 4;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a0e05" }}>
      <VideoTower
        cameraPath={artOrbit}
        blocks={blocks}
        SkyboxComponent={BonkSkybox}
        fogDensity={0.008}
        fogColor="#1a0e05"
        atlasTexture={bonkAtlas ?? undefined}
        atlasLayout={{ cols: 1, rows: 1 }}
      />

      {/* BONK logo overlay during orbit */}
      {SHOW_BONK_LOGO && logoOpacity > 0.01 && (
        <Img
          src={staticFile("bonk-logo.webp")}
          style={{
            position: "absolute",
            bottom: 80 + floatY,
            right: 40,
            width: 120,
            height: 120,
            opacity: logoOpacity,
            filter: "drop-shadow(0 0 20px rgba(255, 102, 0, 0.5))",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Darken overlay for end card */}
      {darkenOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(26, 14, 5, ${darkenOpacity})`,
          }}
        />
      )}

      {/* End card: "The Monolith" + "Bonk Edition" + logo */}
      <Sequence from={cardStartFrame} durationInFrames={CARD_SECONDS * fps}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 96,
              fontWeight: 700,
              color: "white",
              opacity: textOpacity,
              letterSpacing: "0.08em",
              textShadow: "0 0 60px rgba(255, 140, 0, 0.5)",
            }}
          >
            The Monolith
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 42,
              fontWeight: 400,
              color: "#FFAA00",
              opacity: textOpacity,
              letterSpacing: "0.12em",
              textShadow: "0 0 30px rgba(255, 140, 0, 0.3)",
            }}
          >
            Bonk Edition
          </div>
          <Img
            src={staticFile("bonk-logo.webp")}
            style={{
              width: 100,
              height: 100,
              marginTop: 16,
              opacity: textOpacity,
              filter: "drop-shadow(0 0 30px rgba(255, 102, 0, 0.6))",
            }}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
