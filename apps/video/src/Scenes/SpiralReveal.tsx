import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { VideoTower } from "../Tower/VideoTower";
import { spiralAscend } from "../Camera/paths";
import { TitleCard } from "../Overlays/TitleCard";

/**
 * Spiral Reveal — Tower reveal with ascending spiral camera + title card fade-in.
 * 12 seconds at 30fps. Skybox is now rendered in-canvas via VideoTower.
 */
export const SpiralReveal: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#120e18" }}>
      <AbsoluteFill>
        <VideoTower cameraPath={spiralAscend} />
      </AbsoluteFill>
      <Sequence from={30} durationInFrames={120}>
        <TitleCard text="MONOLITH" subtitle="Build. Stake. Rise." />
      </Sequence>
    </AbsoluteFill>
  );
};
