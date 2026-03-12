import React, { useCallback, useRef, useMemo } from "react";
import { View, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";
import { BLOCK_COLORS } from "@monolith/common";
import { hapticColorScrub } from "@/utils/haptics";
import { COLORS, SPACING, RADIUS } from "@/constants/theme";

interface Props {
  currentColor: string;
  onColorChange: (color: string) => void;
}

const WHEEL_SIZE = 220;
const SEGMENTS = 36; // hue segments around the wheel
const RINGS = 5; // saturation rings
const DEBOUNCE_MS = 50;

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function touchToHSL(
  touchX: number,
  touchY: number,
  centerX: number,
  centerY: number,
  radius: number,
): { h: number; s: number; l: number } {
  const dx = touchX - centerX;
  const dy = touchY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const clampedDist = Math.min(dist, radius);

  const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const saturation = (clampedDist / radius) * 100;

  return { h: hue, s: saturation, l: 50 };
}

export function ColorWheel({ currentColor, onColorChange }: Props) {
  const layoutRef = useRef({ x: 0, y: 0, width: WHEEL_SIZE, height: WHEEL_SIZE });
  const lastHapticRef = useRef(0);
  const lightnessRef = useRef(50);

  const handleTouch = useCallback(
    (pageX: number, pageY: number) => {
      const layout = layoutRef.current;
      const centerX = layout.width / 2;
      const centerY = layout.height / 2;
      const radius = Math.min(centerX, centerY);
      const localX = pageX - layout.x;
      const localY = pageY - layout.y;

      const { h, s } = touchToHSL(localX, localY, centerX, centerY, radius);
      const hex = hslToHex(h, s, lightnessRef.current);
      onColorChange(hex);

      // Debounced haptic
      const now = Date.now();
      if (now - lastHapticRef.current > DEBOUNCE_MS) {
        lastHapticRef.current = now;
        hapticColorScrub();
      }
    },
    [onColorChange],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        handleTouch(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => {
        handleTouch(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
    }),
  ).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    e.target.measureInWindow((x, y, width, height) => {
      layoutRef.current = { x, y, width, height };
    });
  }, []);

  // Build color segments for visual wheel
  const segments = useMemo(() => {
    const items: { hue: number; sat: number; x: number; y: number; size: number; color: string }[] = [];
    const center = WHEEL_SIZE / 2;
    const maxR = center - 4;

    for (let ring = 1; ring <= RINGS; ring++) {
      const sat = (ring / RINGS) * 100;
      const r = (ring / RINGS) * maxR;
      const segSize = Math.max(8, (2 * Math.PI * r) / SEGMENTS - 1);

      for (let seg = 0; seg < SEGMENTS; seg++) {
        const hue = (seg / SEGMENTS) * 360;
        const angle = (seg / SEGMENTS) * 2 * Math.PI;
        const x = center + Math.cos(angle) * r - segSize / 2;
        const y = center + Math.sin(angle) * r - segSize / 2;
        items.push({
          hue,
          sat,
          x,
          y,
          size: segSize,
          color: hslToHex(hue, sat, 50),
        });
      }
    }
    return items;
  }, []);

  return (
    <View style={styles.container}>
      {/* Color wheel - visual segments */}
      <View
        style={[styles.wheel, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        {/* Center white dot */}
        <View style={styles.centerDot} />
        {/* Color segments */}
        {segments.map((seg, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                left: seg.x,
                top: seg.y,
                width: seg.size,
                height: seg.size,
                borderRadius: seg.size / 2,
                backgroundColor: seg.color,
              },
            ]}
          />
        ))}
        {/* Selected color indicator */}
        <View style={[styles.selectedIndicator, { backgroundColor: currentColor, borderColor: "#fff" }]} />
      </View>

      {/* Quick-pick preset colors */}
      <View style={styles.presets}>
        {BLOCK_COLORS.map((color) => (
          <View
            key={color}
            style={[
              styles.presetDot,
              { backgroundColor: color },
              currentColor === color && styles.presetDotSelected,
            ]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={() => {
              onColorChange(color);
              hapticColorScrub();
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: SPACING.md,
  },
  wheel: {
    position: "relative",
    alignSelf: "center",
  },
  segment: {
    position: "absolute",
  },
  centerDot: {
    position: "absolute",
    left: WHEEL_SIZE / 2 - 6,
    top: WHEEL_SIZE / 2 - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    zIndex: 2,
  },
  selectedIndicator: {
    position: "absolute",
    bottom: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    zIndex: 3,
  },
  presets: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: SPACING.md,
  },
  presetDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  presetDotSelected: {
    borderColor: COLORS.goldAccent,
    borderWidth: 2,
  },
});
