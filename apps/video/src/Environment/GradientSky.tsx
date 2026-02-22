import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Full-screen gradient background rendered as CSS behind the 3D canvas.
 * Navy → black gradient for a dramatic night-sky look.
 */
export const GradientSky: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a1628 0%, #050a12 40%, #020408 100%)",
      }}
    />
  );
};
