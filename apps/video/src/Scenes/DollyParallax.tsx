import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { VideoTower } from "../Tower/VideoTower";
import { dollyParallax } from "../Camera/paths";
import { TitleCard } from "../Overlays/TitleCard";
import { CTA } from "../Overlays/CTA";

/**
 * Dolly Parallax — Slow lateral slide revealing tower depth + CTA end card.
 * 12 seconds at 30fps. Skybox is now rendered in-canvas via VideoTower.
 */
export const DollyParallax: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#120e18" }}>
      <AbsoluteFill>
        <VideoTower cameraPath={dollyParallax} />
      </AbsoluteFill>
      <Sequence from={60} durationInFrames={120}>
        <TitleCard text="MONOLITH" />
      </Sequence>
      <Sequence from={270} durationInFrames={90}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
