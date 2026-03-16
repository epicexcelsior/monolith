import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";
import { useMultiplayerStore } from "@/stores/multiplayer-store";

type ActiveEvent = {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "charge_storm" | "land_rush";
};

/** Get next Saturday UTC midnight timestamp */
function getNextSaturdayUTC(): number {
  const now = new Date();
  const daysUntilSaturday = ((6 - now.getUTCDay()) + 7) % 7 || 7;
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSaturday,
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * EventBanner — gold pill shown below TopHUD when an event is active or <24h away.
 * Dismissable, shows countdown timer.
 */
export default function EventBanner() {
  const insets = useSafeAreaInsets();
  const activeEvent = useMultiplayerStore((s) => s.activeEvent);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const nextEventTime = getNextSaturdayUTC();
  const msUntilNext = nextEventTime - Date.now();
  const showUpcoming = !activeEvent && msUntilNext < TWENTY_FOUR_HOURS;
  const shouldShow = (!!activeEvent && dismissed !== activeEvent.id) || showUpcoming;

  // Fade in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, fadeAnim]);

  // Countdown timer
  useEffect(() => {
    if (!shouldShow) return;
    const update = () => {
      if (activeEvent) {
        // Active: count down to end of day (next midnight UTC)
        const endOfDay = new Date();
        endOfDay.setUTCHours(24, 0, 0, 0);
        setCountdown(formatCountdown(endOfDay.getTime() - Date.now()));
      } else {
        setCountdown(formatCountdown(nextEventTime - Date.now()));
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [shouldShow, activeEvent, nextEventTime]);

  if (!shouldShow) return null;

  const event: ActiveEvent | null = activeEvent ?? null;
  const displayName = event?.name ?? "Event Tomorrow";
  const displayIcon = event?.icon ?? "⏰";

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top + 52 },
        { opacity: fadeAnim },
      ]}
      pointerEvents={shouldShow ? "box-none" : "none"}
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setShowTooltip((v) => !v)}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>{displayIcon}</Text>
        <Text style={styles.name}>{displayName}</Text>
        {countdown && <Text style={styles.countdown}>{countdown}</Text>}
        <TouchableOpacity
          onPress={() => setDismissed(event?.id ?? "upcoming")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.closeHit}
        >
          <Text style={styles.closeX}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Tooltip with event description */}
      {showTooltip && event && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{event.description}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 200,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: "rgba(212, 168, 71, 0.20)",
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.goldAccentDim,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  icon: {
    fontSize: 14,
  },
  name: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 12,
    color: COLORS.goldLight,
    letterSpacing: 0.5,
  },
  countdown: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: COLORS.inspectorTextSecondary,
  },
  closeHit: {
    marginLeft: SPACING.xs,
  },
  closeX: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 10,
    color: COLORS.inspectorTextSecondary,
  },
  tooltip: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.hudGlass,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxWidth: 260,
  },
  tooltipText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: COLORS.inspectorTextSecondary,
    textAlign: "center",
  },
});
