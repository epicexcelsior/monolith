import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { VideoTower } from "../Tower/VideoTower";
import { orbitPunch } from "../Camera/paths";
import { TitleCard } from "../Overlays/TitleCard";

/**
 * Orbit Punch — Wide orbit that snap-zooms to a mid-tower detail + tagline.
 * 10 seconds at 30fps. Skybox is now rendered in-canvas via VideoTower.
 */
export const OrbitPunch: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#120e18" }}>
      <AbsoluteFill>
        <VideoTower cameraPath={orbitPunch} />
      </AbsoluteFill>
      <Sequence from={180} durationInFrames={90}>
        <TitleCard text="EVERY BLOCK MATTERS" />
      </Sequence>
    </AbsoluteFill>
  );
};
