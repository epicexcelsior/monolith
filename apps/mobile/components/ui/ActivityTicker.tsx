/**
 * ActivityTicker — Real-time event feed on tower HUD.
 *
 * Shows last 3-4 events, each auto-fades after 8 seconds.
 * Positioned below TowerStats, left-aligned.
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInLeft, FadeOut } from "react-native-reanimated";
import { useMultiplayerStore } from "@/stores/multiplayer-store";
import type { ActivityEvent } from "@monolith/common";
import { COLORS, FONT_FAMILY, SPACING, GLASS_STYLE } from "@/constants/theme";

const MAX_VISIBLE = 4;
const EVENT_LIFETIME_MS = 8000;

function truncAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}..${addr.slice(-3)}`;
}

function formatEvent(event: ActivityEvent): { icon: string; text: string } {
  const name = truncAddr(event.owner);
  const blockLabel = event.blockId.replace("block-", "").replace("-", "/");

  switch (event.type) {
    case "claim":
      return { icon: "\uD83D\uDD25", text: `${name} claimed ${blockLabel}` };
    case "charge":
      return { icon: "\u26A1", text: `${name} charged ${blockLabel}` };
    case "customize":
      return { icon: "\uD83C\uDFA8", text: `${name} customized ${blockLabel}` };
    default:
      return { icon: "\u2728", text: `${name} acted on ${blockLabel}` };
  }
}

export default function ActivityTicker() {
  const recentEvents = useMultiplayerStore((s) => s.recentEvents);
  const [visibleEvents, setVisibleEvents] = useState<ActivityEvent[]>([]);

  // Filter events to only show recent ones (within lifetime)
  useEffect(() => {
    const now = Date.now();
    const fresh = recentEvents
      .filter((e) => now - e.timestamp < EVENT_LIFETIME_MS)
      .slice(0, MAX_VISIBLE);
    setVisibleEvents(fresh);

    // Cleanup timer
    const timer = setInterval(() => {
      const currentTime = Date.now();
      setVisibleEvents((prev) =>
        prev.filter((e) => currentTime - e.timestamp < EVENT_LIFETIME_MS),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [recentEvents]);

  if (visibleEvents.length === 0) return null;

  return (
    <View style={styles.container}>
      {visibleEvents.map((event) => {
        const { icon, text } = formatEvent(event);
        return (
          <Animated.View
            key={event.id}
            entering={SlideInLeft.duration(300)}
            exiting={FadeOut.duration(300)}
            style={styles.eventRow}
          >
            <Text style={styles.eventIcon}>{icon}</Text>
            <Text style={styles.eventText} numberOfLines={1}>{text}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.xs,
    gap: 2,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    ...GLASS_STYLE.hudDark,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: "flex-start",
    maxWidth: "80%",
  },
  eventIcon: {
    fontSize: 11,
  },
  eventText: {
    fontFamily: FONT_FAMILY.bodyMedium,
    fontSize: 11,
    color: COLORS.textOnDark,
    opacity: 0.8,
  },
});
