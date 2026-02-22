import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/**
 * Call-to-action end card — "Download Now" with fade-in.
 */
export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });

  const slideUp = interpolate(frame, [0, fps * 0.6], [40, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 200,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${slideUp}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: "white",
            letterSpacing: 6,
            textShadow: "0 0 40px rgba(201, 128, 66, 0.6), 0 2px 12px rgba(0,0,0,0.5)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          DOWNLOAD NOW
        </div>
        <div
          style={{
            fontSize: 22,
            color: "rgba(255, 255, 255, 0.7)",
            marginTop: 12,
            letterSpacing: 4,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 300,
          }}
        >
          SOLANA SEEKER
        </div>
      </div>
    </AbsoluteFill>
  );
};
