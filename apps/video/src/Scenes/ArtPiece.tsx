import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";
import { VideoTower } from "../Tower/VideoTower";
import { artOrbit } from "../Camera/paths";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

// 15s orbit + 3s end card = 18s total
const ORBIT_SECONDS = 15;
const CARD_SECONDS = 3;

/**
 * ArtPiece — Pure visual art. Slow orbit with speed curve, title end card.
 */
export const ArtPiece: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const orbitFrames = ORBIT_SECONDS * fps;
  const cardStartFrame = orbitFrames;

  // Darken the tower during the end card transition (last 1s of orbit fades to dark)
  const fadeStart = orbitFrames - fps; // 1s before card
  const darkenOpacity =
    frame < fadeStart
      ? 0
      : Math.min((frame - fadeStart) / (fps * 1), 0.75);

  // Title card text opacity (fades in over 0.5s)
  const cardProgress = Math.max(0, frame - cardStartFrame) / fps;
  const textOpacity = Math.min(cardProgress / 0.5, 1);

  return (
    <AbsoluteFill style={{ backgroundColor: "#120e18" }}>
      <VideoTower cameraPath={artOrbit} fogDensity={0.010} />

      {/* Darken overlay for end card */}
      {darkenOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(18, 14, 24, ${darkenOpacity})`,
          }}
        />
      )}

      {/* End card: "The Monolith" */}
      <Sequence from={cardStartFrame} durationInFrames={CARD_SECONDS * fps}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
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
              textShadow: "0 0 60px rgba(200, 160, 80, 0.4)",
            }}
          >
            The Monolith
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
