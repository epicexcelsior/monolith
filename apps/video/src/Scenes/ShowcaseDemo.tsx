import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  Audio,
  staticFile,
} from "remotion";
import {
  TransitionSeries,
  springTiming,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";
import { VideoTower } from "../Tower/VideoTower";
import { generateBlocks } from "../Tower/generateBlocks";
import { globalShowcasePath } from "../Camera/paths";

const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "700"],
  subsets: ["latin"],
});

// ─── Durations ──────────────────────────────────────────
const FPS = 30;
const S0 = 1   * FPS;              //  30  — The Void (1s short void)
const S1 = 4   * FPS;              // 120  — MONOLITH reveal (DROP)
const S2 = Math.round(3.5 * FPS); // 105  — CLAIM
const S3 = Math.round(3.5 * FPS); // 105  — EARN
const S4 = 4   * FPS;              // 120  — CUSTOMIZE (3 tabs × 40f)
const S5 = Math.round(3.5 * FPS); // 105  — CONQUER
const S6 = 6   * FPS;              // 180  — JOIN THE MONOLITH (longer for fade-out)

const T_WIPE = 10;  // smooth linear wipe
const T_FADE = 20;  // slow organic fade into CTA

// Sum sequences: 30+120+105+105+120+105+180 = 765
// Transitions: 5×10 + 20 = 70
// TOTAL: 695 frames = 23.2s
export const TOTAL_FRAMES = 695;

// Music: drop at 0:57 = frame 30 = S0→S1 wipe resolves
const MUSIC_START = 56 * FPS; // 1680
const MUSIC_END   = 80 * FPS; // 2400 — 24s of audio, covers full video + fade-out

// ─── Text constants ─────────────────────────────────────
const GLOW =
  "0 0 120px rgba(255, 150, 40, 0.95), 0 0 60px rgba(255, 120, 20, 0.5), 0 8px 48px rgba(0,0,0,1)";
const AMBER_GLOW =
  "0 0 80px rgba(220, 140, 40, 0.8), 0 0 40px rgba(255, 170, 60, 0.35), 0 6px 32px rgba(0,0,0,0.98)";
const CYAN_GLOW =
  "0 0 40px rgba(100, 200, 255, 0.6), 0 4px 16px rgba(0,0,0,0.9)";

const gradientText: React.CSSProperties = {
  background: "linear-gradient(160deg, #ffffff 0%, #ffe0a8 55%, #ffaa44 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

// Separator line helper
const Separator = ({ width, opacity = 1 }: { width: number; opacity?: number }) => (
  <div
    style={{
      height: 2,
      width,
      margin: "22px auto",
      background: "linear-gradient(90deg, transparent, rgba(255,180,80,0.85), transparent)",
      opacity,
    }}
  />
);

// ─── Shared components ──────────────────────────────────

const DarkVignette: React.FC<{ strength?: number }> = ({ strength = 1 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 80% 80% at center, transparent 15%, rgba(0,0,0,${0.62 * strength}) 65%, rgba(0,0,0,${0.93 * strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

// ─── MechanicText ───────────────────────────────────────

interface MechanicTextProps {
  mechanic: string;
  sub: string;
  frame: number;
  fps: number;
  durationInFrames: number;
  delay?: number;
}

const MechanicText: React.FC<MechanicTextProps> = ({
  mechanic,
  sub,
  frame,
  fps,
  durationInFrames,
  delay = 8,
}) => {
  const wordIn = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay });
  const wordScale = interpolate(wordIn, [0, 1], [0.65, 1]);

  const lineIn = spring({ frame, fps, config: { damping: 200 }, delay: delay + 10 });

  const subIn = spring({ frame, fps, config: { damping: 200 }, delay: delay + 18 });
  const subY = interpolate(subIn, [0, 1], [36, 0]);

  const exitStart = durationInFrames - 14;
  const exitFade = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
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
      <div style={{ textAlign: "center", opacity: exitFade }}>
        {/* Mechanic word — gradient, huge, punchy */}
        <div
          style={{
            fontFamily,
            fontSize: 156,
            fontWeight: 700,
            letterSpacing: 20,
            whiteSpace: "nowrap",
            opacity: wordIn,
            transform: `scale(${wordScale})`,
            textShadow: GLOW,
            lineHeight: 1,
            ...gradientText,
          }}
        >
          {mechanic}
        </div>

        {/* Separator */}
        <Separator width={interpolate(lineIn, [0, 1], [0, 340])} />

        {/* Sub line */}
        <div
          style={{
            fontFamily,
            fontSize: 50,
            fontWeight: 700,
            color: "rgba(255, 210, 140, 0.92)",
            letterSpacing: 10,
            whiteSpace: "nowrap",
            opacity: subIn,
            transform: `translateY(${subY}px)`,
            textShadow: AMBER_GLOW,
          }}
        >
          {sub}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── EarnVisual — large SOL earnings panel ──────────────

const CHART_PATH = "M0,110 C80,100 180,80 300,60 C420,40 540,22 660,8 L732,4";
const CHART_LEN  = 760; // approximate path length

const EarnVisual: React.FC<{ frame: number; fps: number; durationInFrames: number }> = ({
  frame,
  fps,
  durationInFrames,
}) => {
  const panelIn = spring({ frame, fps, config: { damping: 14, stiffness: 160 }, delay: 14 });
  const panelY  = interpolate(panelIn, [0, 1], [60, 0]);

  // SOL counter — counts up over first 80% of scene
  const earnAmount = interpolate(frame, [20, Math.floor(durationInFrames * 0.8)], [0, 2.847], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Rate counter (smaller)
  const rateAmount = interpolate(frame, [25, Math.floor(durationInFrames * 0.75)], [0, 0.182], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Chart draws itself
  const chartProg = interpolate(frame, [26, Math.floor(durationInFrames * 0.75)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const dashOff = CHART_LEN * (1 - chartProg);

  // Moving dot at chart tip
  const dotX  = interpolate(chartProg, [0, 1], [0, 732]);
  const dotY  = interpolate(chartProg, [0, 1], [110, 4]);

  const exitFade = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 240,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: panelIn * exitFade,
          transform: `translateY(${panelY}px)`,
          background: "rgba(5, 3, 18, 0.92)",
          border: "1.5px solid rgba(255, 180, 60, 0.40)",
          borderRadius: 36,
          padding: "52px 64px 48px",
          width: 820,
          backdropFilter: "blur(20px)",
          boxShadow: "0 0 80px rgba(255,150,30,0.12), 0 20px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div
          style={{
            fontFamily,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 8,
            color: "rgba(255, 200, 100, 0.70)",
            marginBottom: 12,
          }}
        >
          DAILY REWARDS
        </div>

        {/* Giant SOL amount */}
        <div
          style={{
            fontFamily,
            fontSize: 130,
            fontWeight: 700,
            letterSpacing: 4,
            lineHeight: 1,
            marginBottom: 36,
            ...gradientText,
          }}
        >
          +{earnAmount.toFixed(3)}
          <span
            style={{
              fontSize: 72,
              marginLeft: 14,
              background: "linear-gradient(160deg, #ffd080 0%, #ffaa44 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ◎
          </span>
        </div>

        {/* Chart */}
        <svg
          width="732"
          height="120"
          viewBox="0 0 732 120"
          style={{ display: "block" }}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1="0"
              y1={120 - t * 116}
              x2="732"
              y2={120 - t * 116}
              stroke="rgba(255,180,60,0.08)"
              strokeWidth="1"
            />
          ))}
          {/* Glow copy */}
          <path
            d={CHART_PATH}
            stroke="rgba(255,180,60,0.25)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CHART_LEN}
            strokeDashoffset={dashOff}
          />
          {/* Main line */}
          <path
            d={CHART_PATH}
            stroke="#ffcc55"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CHART_LEN}
            strokeDashoffset={dashOff}
          />
          {/* Moving tip dot */}
          {chartProg > 0.05 && (
            <>
              <circle cx={dotX} cy={dotY} r="10" fill="rgba(255,200,60,0.3)" />
              <circle cx={dotX} cy={dotY} r="5"  fill="#ffcc55" />
            </>
          )}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ─── CustomizeVisual — 3-tab style picker ───────────────

const SWATCH_COLORS = ["#ff6b35", "#9b5de5", "#00d4aa", "#f7b731", "#ff3a8c"];

const CustomizeVisual: React.FC<{ frame: number; fps: number; durationInFrames: number }> = ({
  frame,
  fps,
  durationInFrames,
}) => {
  const panelIn = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay: 14 });
  const panelY = interpolate(panelIn, [0, 1], [60, 0]);

  // Cycle through colors continuously
  const colorPhase = (frame - 14) / (durationInFrames - 28);
  const colorIdx = Math.min(
    Math.floor(colorPhase * SWATCH_COLORS.length),
    SWATCH_COLORS.length - 1,
  );
  const activeColor = SWATCH_COLORS[colorIdx];

  // Block rotation — continuously spinning
  const rotX = interpolate(frame, [14, durationInFrames - 14], [0, 720], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotY = interpolate(frame, [14, durationInFrames - 14], [0, -720], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Material morphing: glass (sharp 8px) → neon (rounded 30px) → matte (very rounded 56px) → glass
  const materialT = colorPhase % 1;
  let borderRadius = 8;
  if (materialT < 0.33) {
    borderRadius = interpolate(materialT, [0, 0.33], [8, 30]);
  } else if (materialT < 0.67) {
    borderRadius = interpolate(materialT, [0.33, 0.67], [30, 56]);
  } else {
    borderRadius = interpolate(materialT, [0.67, 1], [56, 8]);
  }

  const materialName = materialT < 0.33 ? "GLASS" : materialT < 0.67 ? "NEON" : "MATTE";

  const exitFade = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 240,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: panelIn * exitFade,
          transform: `translateY(${panelY}px)`,
          background: "rgba(5, 3, 18, 0.92)",
          border: "1.5px solid rgba(180, 100, 255, 0.35)",
          borderRadius: 36,
          padding: "52px 64px 56px",
          width: 820,
          backdropFilter: "blur(20px)",
          boxShadow: "0 0 80px rgba(150,80,255,0.12), 0 20px 60px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* Heading */}
        <div
          style={{
            fontFamily,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 8,
            color: "rgba(200, 150, 255, 0.85)",
            whiteSpace: "nowrap",
          }}
        >
          DESIGN YOUR BLOCK
        </div>

        {/* Rotating 3D block */}
        <div
          style={{
            perspective: "1200px",
            width: 280,
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 260,
              height: 260,
              background: activeColor,
              borderRadius,
              boxShadow: `0 0 120px ${activeColor}aa, 0 0 220px ${activeColor}55`,
              transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
              transformStyle: "preserve-3d",
              transition: "border-radius 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
        </div>

        {/* Material label */}
        <div
          style={{
            fontFamily,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 8,
            color: "rgba(200, 150, 255, 0.75)",
            whiteSpace: "nowrap",
          }}
        >
          {materialName}
        </div>

        {/* Color swatches */}
        <div style={{ display: "flex", gap: 18 }}>
          {SWATCH_COLORS.map((color, i) => {
            const isActive = i === colorIdx;
            return (
              <div
                key={color}
                style={{
                  width: isActive ? 70 : 54,
                  height: isActive ? 70 : 54,
                  borderRadius: "50%",
                  background: color,
                  border: isActive ? "4px solid white" : "2px solid rgba(255,255,255,0.25)",
                  boxShadow: isActive ? `0 0 32px ${color}` : "none",
                  transition: "all 0.2s ease-out",
                }}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════
// SCENE 0 — The Void (overlay only — 3D tower is at root)
// ═══════════════════════════════════════════════════════
const Scene0: React.FC = () => <AbsoluteFill />;

// ═══════════════════════════════════════════════════════
// SCENE 1 — MONOLITH Reveal (THE DROP) — overlay only
// ═══════════════════════════════════════════════════════
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleIn = spring({ frame, fps, config: { damping: 14, stiffness: 170 }, delay: 6 });
  const titleScale = interpolate(titleIn, [0, 1], [0.82, 1]);

  const exitStart = durationInFrames - 14;
  const exitFade  = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <DarkVignette />

      {/* Brand stack: icon → THE / MONOLITH */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          pointerEvents: "none",
        }}
      >
        {/* Game icon */}
        <Img
          src={staticFile("icon.png")}
          style={{
            width: 130,
            height: 130,
            borderRadius: 30,
            opacity: titleIn * exitFade,
            transform: `scale(${titleScale})`,
            boxShadow: "0 0 60px rgba(255,140,30,0.45), 0 8px 36px rgba(0,0,0,0.95)",
            marginBottom: 28,
          }}
        />

        {/* "THE" — spaced out, elegant */}
        <div
          style={{
            fontFamily,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: 28,
            whiteSpace: "nowrap",
            textShadow: AMBER_GLOW,
            color: "rgba(255,210,140,0.85)",
            opacity: titleIn * exitFade,
            transform: `scale(${titleScale})`,
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          THE
        </div>

        {/* "MONOLITH" — 8 chars, large, fits 1080px */}
        <div
          style={{
            fontFamily,
            fontSize: 160,
            fontWeight: 700,
            letterSpacing: 10,
            whiteSpace: "nowrap",
            textShadow: GLOW,
            lineHeight: 1,
            opacity: titleIn * exitFade,
            transform: `scale(${titleScale})`,
            ...gradientText,
          }}
        >
          MONOLITH
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════
// SCENE 2 — CLAIM — overlay only
// ═══════════════════════════════════════════════════════
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      <DarkVignette />
      <MechanicText mechanic="CLAIM" sub="A SPOT IN THE TOWER" frame={frame} fps={fps} durationInFrames={durationInFrames} delay={10} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════
// SCENE 3 — EARN — overlay only
// ═══════════════════════════════════════════════════════
const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      <DarkVignette />
      <EarnVisual frame={frame} fps={fps} durationInFrames={durationInFrames} />
      <MechanicText mechanic="EARN" sub="PASSIVE INCOME ON-CHAIN" frame={frame} fps={fps} durationInFrames={durationInFrames} delay={10} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════
// SCENE 4 — CUSTOMIZE — overlay only
// ═══════════════════════════════════════════════════════
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      <DarkVignette />
      <CustomizeVisual frame={frame} fps={fps} durationInFrames={durationInFrames} />
      <MechanicText mechanic="CUSTOMIZE" sub="YOUR BLOCK  ·  YOUR IDENTITY" frame={frame} fps={fps} durationInFrames={durationInFrames} delay={10} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════
// SCENE 5 — CONQUER — overlay only
// ═══════════════════════════════════════════════════════
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const words = ["STAKE.", "EARN.", "CONQUER."];
  const exitStart = durationInFrames - 14;
  const exitFade = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <DarkVignette />
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 200, pointerEvents: "none" }}
      >
        <div style={{ textAlign: "center", opacity: exitFade }}>
          {words.map((word, i) => {
            const wIn    = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay: 8 + i * 18 });
            const wScale = interpolate(wIn, [0, 1], [0.55, 1]);
            const wY     = interpolate(wIn, [0, 1], [56, 0]);
            return (
              <div
                key={word}
                style={{
                  fontFamily,
                  fontSize: 152,
                  fontWeight: 700,
                  letterSpacing: 16,
                  whiteSpace: "nowrap",
                  opacity: wIn,
                  transform: `scale(${wScale}) translateY(${wY}px)`,
                  textShadow: GLOW,
                  lineHeight: 1.1,
                  ...gradientText,
                }}
              >
                {word}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════
// SCENE 6 — JOIN THE MONOLITH (CTA) — overlay only
// ═══════════════════════════════════════════════════════
const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const iconIn = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay: 16 });

  const ctaIn  = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay: 26 });
  const ctaScale = interpolate(ctaIn, [0, 1], [0.55, 1]);

  const solIn  = spring({ frame, fps, config: { damping: 200 }, delay: 46 });
  const solY   = interpolate(solIn, [0, 1], [30, 0]);

  const seekIn = spring({ frame, fps, config: { damping: 200 }, delay: 62 });
  const seekY  = interpolate(seekIn, [0, 1], [20, 0]);

  const sepW   = interpolate(ctaIn, [0, 1], [0, 500]);

  const closeFade = interpolate(frame, [durationInFrames - 35, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad),
  });
  const gradIn = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <DarkVignette strength={0.95} />

      {/* Bottom gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(0deg, rgba(0,0,0,${0.93 * gradIn}) 0%, rgba(0,0,0,${0.60 * gradIn}) 38%, transparent 68%)`,
          pointerEvents: "none",
        }}
      />

      {/* CTA block */}
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 180, pointerEvents: "none" }}
      >
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Game icon */}
          <Img
            src={staticFile("icon.png")}
            style={{
              width: 140,
              height: 140,
              borderRadius: 32,
              opacity: iconIn,
              transform: `scale(${interpolate(iconIn, [0, 1], [0.55, 1])})`,
              boxShadow: "0 0 60px rgba(255,140,30,0.50), 0 8px 40px rgba(0,0,0,0.96)",
              marginBottom: 36,
            }}
          />

          {/* JOIN THE / MONOLITH — two lines to fit width */}
          <div
            style={{
              opacity: ctaIn,
              transform: `scale(${ctaScale})`,
              textAlign: "center",
              lineHeight: 1.05,
            }}
          >
            <div
              style={{
                fontFamily,
                fontSize: 130,
                fontWeight: 700,
                letterSpacing: 10,
                whiteSpace: "nowrap",
                textShadow: GLOW,
                ...gradientText,
              }}
            >
              JOIN THE
            </div>
            <div
              style={{
                fontFamily,
                fontSize: 160,
                fontWeight: 700,
                letterSpacing: 14,
                whiteSpace: "nowrap",
                textShadow: GLOW,
                ...gradientText,
              }}
            >
              MONOLITH
            </div>
          </div>

          <Separator width={sepW} opacity={ctaIn} />

          {/* Solana logo + ON SOLANA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 32,
              opacity: solIn,
              transform: `translateY(${solY}px)`,
              marginTop: 8,
            }}
          >
            <Img
              src={staticFile("solana.png")}
              style={{
                width: 80,
                height: 80,
                filter: "brightness(1.2) saturate(1.3)",
              }}
            />
            <div
              style={{
                fontFamily,
                fontSize: 72,
                fontWeight: 700,
                color: "rgba(255, 200, 130, 0.90)",
                letterSpacing: 12,
                textShadow: AMBER_GLOW,
                whiteSpace: "nowrap",
              }}
            >
              ON SOLANA
            </div>
          </div>

          {/* SEEKER EXCLUSIVE badge */}
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: 10,
              color: "rgba(100, 200, 255, 0.90)",
              marginTop: 32,
              border: "1.5px solid rgba(100, 200, 255, 0.45)",
              borderRadius: 10,
              padding: "12px 32px",
              opacity: seekIn,
              transform: `translateY(${seekY}px)`,
              textShadow: CYAN_GLOW,
              whiteSpace: "nowrap",
            }}
          >
            SEEKER EXCLUSIVE
          </div>
        </div>
      </AbsoluteFill>

      {/* Fade to black */}
      <AbsoluteFill style={{ backgroundColor: "black", opacity: closeFade, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════
// ROOT COMPOSITION
// ═══════════════════════════════════════════════════════

/**
 * ShowcaseDemo — 7-scene Monolith tower commercial.
 * 655 frames = 21.8s at 30fps, 1080×1920.
 *
 * S0 (1s)   The Void       — short pre-drop silence
 * S1 (4s)   MONOLITH       — DROP HITS, icon + wordmark slams in, scarcity tag
 * S2 (3.5s) CLAIM          — slow orbit, "A SPOT IN THE TOWER"
 * S3 (3.5s) EARN           — hovering, large SOL earnings panel animates up
 * S4 (4s)   CUSTOMIZE      — block inspect + 3-tab picker (PHOTO/COLOR/STYLE)
 * S5 (3.5s) CONQUER        — dramatic pullback, "STAKE. EARN. CONQUER."
 * S6 (5s)   JOIN           — low angle, icon + CTA + Solana logo + badge
 */
export const ShowcaseDemo: React.FC = () => {
  const blocks = useMemo(() => generateBlocks(42), []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#070410" }}>
      {/* Music: fade in first 25f, fade out last 60f */}
      <Audio
        src={staticFile("music.mp3")}
        startFrom={MUSIC_START}
        endAt={MUSIC_END}
        volume={(frame) => {
          const fadeIn  = interpolate(frame, [0, 25],                          [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const fadeOut = interpolate(frame, [TOTAL_FRAMES - 60, TOTAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return Math.min(fadeIn, fadeOut);
        }}
      />

      {/*
        ── Single root-level VideoTower ──────────────────────────────────────
        Lives OUTSIDE TransitionSeries so only ONE ThreeCanvas ever renders.
        globalShowcasePath drives the camera continuously across all scenes,
        smoothly lerping during transition windows — no camera glitch possible.
      */}
      <VideoTower
        cameraPath={globalShowcasePath}
        blocks={blocks}
        isInspectPath
      />

      {/* Text overlays only — crossfades between lightweight DOM elements */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={S0}>
          <Scene0 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_WIPE })}
        />

        <TransitionSeries.Sequence durationInFrames={S1}>
          <Scene1 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_WIPE })}
        />

        <TransitionSeries.Sequence durationInFrames={S2}>
          <Scene2 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_WIPE })}
        />

        <TransitionSeries.Sequence durationInFrames={S3}>
          <Scene3 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_WIPE })}
        />

        <TransitionSeries.Sequence durationInFrames={S4}>
          <Scene4 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_WIPE })}
        />

        <TransitionSeries.Sequence durationInFrames={S5}>
          <Scene5 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T_FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={S6}>
          <Scene6 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
