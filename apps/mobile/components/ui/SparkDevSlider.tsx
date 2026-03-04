/**
 * SparkDevSlider — Floating face testing panel for tower view (__DEV__ only).
 * Energy slider + evolution tier picker + eye/mouth variant selectors.
 */
import { useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  LayoutChangeEvent,
} from "react-native";
import { useTowerStore } from "@/stores/tower-store";
import { COLORS, FONT_FAMILY, RADIUS, SPACING } from "@/constants/theme";

const TIERS = [
  { min: 80, label: "Blazing", color: "#d4a847" },
  { min: 50, label: "Thriving", color: "#b89030" },
  { min: 20, label: "Fading", color: "#8a6e50" },
  { min: 1, label: "Dying", color: "#7a3020" },
  { min: 0, label: "Dead", color: "#555" },
] as const;

const EVO_TIERS = ["Spark", "Ember", "Flame", "Blaze", "Beacon"] as const;
const EYE_SHAPES = ["Circle", "Oval", "Star", "Heart", "Cat"] as const;
const MOUTH_SHAPES = ["Arc", "Cat :3", "O", "Grin"] as const;

function getTier(energy: number) {
  return TIERS.find((t) => energy >= t.min) ?? TIERS[TIERS.length - 1];
}

export default function SparkDevSlider() {
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const block = useTowerStore((s) =>
    s.selectedBlockId ? s.getDemoBlockById(s.selectedBlockId) : undefined,
  );
  const devFaceOverride = useTowerStore((s) => s.devFaceOverride);

  const trackWidth = useRef(0);
  // Use ref for latest callback so PanResponder never captures stale closure
  const applyEnergyRef = useRef((locationX: number) => {});
  applyEnergyRef.current = (locationX: number) => {
    const id = useTowerStore.getState().selectedBlockId;
    if (!id || trackWidth.current <= 0) return;
    const pct = Math.max(0, Math.min(100, Math.round((locationX / trackWidth.current) * 100)));
    useTowerStore.getState().updateDemoBlock(id, { energy: pct });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => applyEnergyRef.current(e.nativeEvent.locationX),
      onPanResponderMove: (e) => applyEnergyRef.current(e.nativeEvent.locationX),
    }),
  ).current;

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  if (!selectedBlockId || !block) return null;

  const tier = getTier(block.energy);
  const pct = Math.round(block.energy);
  const evoTier = block.evolutionTier ?? 0;

  // Decode current dev face override
  const currentEye = devFaceOverride >= 0 ? Math.floor(devFaceOverride / 10) : -1;
  const currentMouth = devFaceOverride >= 0 ? Math.round(devFaceOverride % 10) : -1;

  const setEvo = (t: number) => {
    useTowerStore.getState().updateDemoBlock(selectedBlockId, { evolutionTier: t });
  };

  const setFaceOverride = (eye: number, mouth: number) => {
    useTowerStore.setState({ devFaceOverride: eye * 10 + mouth });
  };

  const toggleEye = (idx: number) => {
    if (currentEye === idx) {
      // Reset to hash-based
      useTowerStore.setState({ devFaceOverride: -1 });
    } else {
      setFaceOverride(idx, Math.max(0, currentMouth));
    }
  };

  const toggleMouth = (idx: number) => {
    if (currentMouth === idx) {
      useTowerStore.setState({ devFaceOverride: -1 });
    } else {
      setFaceOverride(Math.max(0, currentEye), idx);
    }
  };

  const shuffle = () => {
    const e = Math.round(Math.random() * 100);
    const t = Math.floor(Math.random() * 5);
    const eye = Math.floor(Math.random() * 5);
    const mouth = Math.floor(Math.random() * 4);
    useTowerStore.getState().updateDemoBlock(selectedBlockId, { energy: e, evolutionTier: t });
    useTowerStore.setState({ devFaceOverride: eye * 10 + mouth });
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.bar}>
        {/* Energy label */}
        <Text style={styles.label}>
          {pct}% — <Text style={{ color: tier.color }}>{tier.label}</Text>
        </Text>

        {/* Energy slider track */}
        <View
          style={styles.trackOuter}
          onLayout={onTrackLayout}
          {...panResponder.panHandlers}
        >
          <View style={styles.trackBg} />
          <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: tier.color }]} />
          <View style={[styles.thumb, { left: `${pct}%`, backgroundColor: tier.color }]} />
        </View>

        {/* Evolution tier pills */}
        <Text style={styles.sectionLabel}>Tier</Text>
        <View style={styles.pillRow}>
          {EVO_TIERS.map((name, i) => (
            <TouchableOpacity
              key={name}
              style={[styles.pill, evoTier === i && styles.pillActive]}
              onPress={() => setEvo(i)}
            >
              <Text style={[styles.pillText, evoTier === i && styles.pillTextActive]}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Eye shape pills */}
        <Text style={styles.sectionLabel}>Eyes</Text>
        <View style={styles.pillRow}>
          {EYE_SHAPES.map((name, i) => (
            <TouchableOpacity
              key={name}
              style={[styles.pill, currentEye === i && styles.pillActive]}
              onPress={() => toggleEye(i)}
            >
              <Text style={[styles.pillText, currentEye === i && styles.pillTextActive]}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mouth shape pills */}
        <Text style={styles.sectionLabel}>Mouth</Text>
        <View style={styles.pillRow}>
          {MOUTH_SHAPES.map((name, i) => (
            <TouchableOpacity
              key={name}
              style={[styles.pill, currentMouth === i && styles.pillActive]}
              onPress={() => toggleMouth(i)}
            >
              <Text style={[styles.pillText, currentMouth === i && styles.pillTextActive]}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Shuffle button */}
        <TouchableOpacity style={styles.shuffleBtn} onPress={shuffle}>
          <Text style={styles.shuffleText}>Shuffle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const THUMB_SIZE = 18;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  bar: {
    width: 300,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  label: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    color: COLORS.textOnDark,
    textAlign: "center",
    marginBottom: 4,
  },
  trackOuter: {
    height: 28,
    justifyContent: "center",
    marginBottom: 6,
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginLeft: -THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  sectionLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 2,
    marginBottom: 2,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  pillActive: {
    backgroundColor: "rgba(212,168,71,0.25)",
    borderColor: "#d4a847",
  },
  pillText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  pillTextActive: {
    color: "#d4a847",
  },
  shuffleBtn: {
    marginTop: 4,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(212,168,71,0.2)",
    borderWidth: 1,
    borderColor: "rgba(212,168,71,0.4)",
  },
  shuffleText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: "#d4a847",
  },
});
