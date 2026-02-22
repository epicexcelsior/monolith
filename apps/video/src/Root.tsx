import React from "react";
import { Composition, Folder } from "remotion";
import { SpiralReveal } from "./Scenes/SpiralReveal";
import { OrbitPunch } from "./Scenes/OrbitPunch";
import { DollyParallax } from "./Scenes/DollyParallax";
import { ShowcaseDemo } from "./Scenes/ShowcaseDemo";

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

// ShowcaseDemo: S0(30)+S1(120)+S2(105)+S3(105)+S4(120)+S5(105)+S6(180) - (5*10+20) = 765-70 = 695
const SHOWCASE_FRAMES = 695;

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Monolith">
      <Composition
        id="ShowcaseDemo"
        component={ShowcaseDemo}
        durationInFrames={SHOWCASE_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SpiralReveal"
        component={SpiralReveal}
        durationInFrames={12 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="OrbitPunch"
        component={OrbitPunch}
        durationInFrames={10 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="DollyParallax"
        component={DollyParallax}
        durationInFrames={12 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </Folder>
  );
};
