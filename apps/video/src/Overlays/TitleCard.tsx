import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface TitleCardProps {
  text: string;
  subtitle?: string;
}

/**
 * Title card overlay with frame-driven fade and scale animation.
 */
export const TitleCard: React.FC<TitleCardProps> = ({ text, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [0, fps * 0.8], [0.85, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [fps * 0.5, fps * 1.2], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: "white",
            letterSpacing: 16,
            textShadow: "0 0 60px rgba(201, 128, 66, 0.8), 0 4px 20px rgba(0,0,0,0.5)",
            margin: 0,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {text}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 32,
              color: "rgba(255, 255, 255, 0.85)",
              letterSpacing: 8,
              marginTop: 20,
              opacity: subtitleOpacity,
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 300,
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
