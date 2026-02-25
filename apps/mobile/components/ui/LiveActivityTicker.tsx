/**
 * LiveActivityTicker — Compact streaming activity feed, bottom-left of tower.
 *
 * Shows the latest 4 events (claims, charges, customizations, pokes) with
 * animated entrance/exit. Creates FOMO without being distracting.
 *
 * Data sources:
 * - activity-store (real multiplayer events)
 * - Bot simulation generates synthetic events when offline
 *
 * Tap any event → fly camera to that block.
 * Auto-fades individual items after 12s.
 * Hidden when BlockInspector is open or onboarding.
 *
 * Includes a "Poke" action pill to poke a random block.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInLeft, FadeOutLeft, FadeInUp, Layout } from "react-native-reanimated";
import { Lightning, Fire, Palette, HandPointing, Sparkle, Skull } from "phosphor-react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useTowerStore, type DemoBlock } from "@/stores/tower-store";
import { useActivityStore } from "@/stores/activity-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useMultiplayerStore } from "@/stores/multiplayer-store";
import { usePokeStore } from "@/stores/poke-store";
import { hapticButtonPress } from "@/utils/haptics";
import { playPokeSend } from "@/utils/audio";
import { isBotOwner } from "@/utils/seed-tower";

// ─── Types ─────────────────────────────────────────────
interface TickerItem {
  id: string;
  type: "claim" | "charge" | "customize" | "poke" | "fading" | "streak";
  text: string;
  subtext?: string;
  blockId?: string;
  color: string;
  timestamp: number;
}

// ─── Constants ─────────────────────────────────────────
const MAX_VISIBLE = 4;
const ITEM_LIFETIME_MS = 12_000;
const SCAN_INTERVAL_MS = 4_000;
const SYNTHETIC_INTERVAL_MS = 6_000;

// ─── Icon component ────────────────────────────────────
const ICON_SIZE = 11;

function EventIcon({ type }: { type: TickerItem["type"] }) {
  switch (type) {
    case "claim": return <Fire size={ICON_SIZE} color={COLORS.blazing} weight="fill" />;
    case "charge": return <Lightning size={ICON_SIZE} color={COLORS.goldLight} weight="fill" />;
    case "customize": return <Palette size={ICON_SIZE} color={COLORS.info} weight="fill" />;
    case "poke": return <HandPointing size={ICON_SIZE} color={COLORS.warning} weight="fill" />;
    case "fading": return <Skull size={ICON_SIZE} color={COLORS.fading} weight="fill" />;
    case "streak": return <Sparkle size={ICON_SIZE} color={COLORS.blazing} weight="fill" />;
  }
}

// ─── Helpers ───────────────────────────────────────────
function truncName(owner: string): string {
  if (isBotOwner(owner)) return owner.length > 10 ? owner.slice(0, 10) : owner;
  if (owner.length <= 8) return owner;
  return `${owner.slice(0, 4)}..${owner.slice(-3)}`;
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 5) return "now";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m`;
}

// ─── Synthetic event generation (bot + block scanning) ─
function generateSyntheticEvents(blocks: DemoBlock[]): TickerItem[] {
  const items: TickerItem[] = [];
  const now = Date.now();

  // Find interesting blocks
  const owned = blocks.filter((b) => b.owner);

  // Recently charged (last 2 min)
  const recentCharged = owned.filter(
    (b) => b.lastChargeTime && now - b.lastChargeTime < 120_000 && b.energy > 50
  );
  if (recentCharged.length > 0) {
    const b = recentCharged[Math.floor(Math.random() * recentCharged.length)];
    items.push({
      id: `synth-charge-${b.id}-${now}`,
      type: "charge",
      text: `${truncName(b.owner!)} charged to ${Math.round(b.energy)}%`,
      subtext: `Layer ${b.layer}`,
      blockId: b.id,
      color: COLORS.goldLight,
      timestamp: now - Math.floor(Math.random() * 30_000),
    });
  }

  // High energy (blazing)
  const blazing = owned.filter((b) => b.energy > 90);
  if (blazing.length > 0) {
    const b = blazing[Math.floor(Math.random() * blazing.length)];
    items.push({
      id: `synth-blaze-${b.id}-${now}`,
      type: "claim",
      text: `${truncName(b.owner!)} blazing ${Math.round(b.energy)}%`,
      subtext: b.name || `Layer ${b.layer}`,
      blockId: b.id,
      color: COLORS.blazing,
      timestamp: now - Math.floor(Math.random() * 60_000),
    });
  }

  // Fading blocks (danger zone)
  const fading = owned.filter((b) => b.energy > 0 && b.energy < 15);
  if (fading.length > 0) {
    const b = fading[Math.floor(Math.random() * fading.length)];
    items.push({
      id: `synth-fade-${b.id}-${now}`,
      type: "fading",
      text: `L${b.layer} needs help! ${Math.round(b.energy)}% left`,
      subtext: b.name ? `${b.name} is fading` : "Going dark soon",
      blockId: b.id,
      color: COLORS.fading,
      timestamp: now,
    });
  }

  // High streaks
  const streaking = owned.filter((b) => (b.streak ?? 0) >= 7);
  if (streaking.length > 0) {
    const b = streaking[Math.floor(Math.random() * streaking.length)];
    items.push({
      id: `synth-streak-${b.id}-${now}`,
      type: "streak",
      text: `${truncName(b.owner!)} Day ${b.streak} streak!`,
      subtext: `${Math.round(b.energy)}% energy`,
      blockId: b.id,
      color: COLORS.blazing,
      timestamp: now - Math.floor(Math.random() * 120_000),
    });
  }

  // Customizations (random pick)
  const customized = owned.filter((b) => b.emoji || b.name);
  if (customized.length > 0) {
    const b = customized[Math.floor(Math.random() * customized.length)];
    const detail = b.name ? `"${b.name}"` : (b.emoji || "");
    items.push({
      id: `synth-custom-${b.id}-${now}`,
      type: "customize",
      text: `${truncName(b.owner!)} styled ${detail}`,
      subtext: `Layer ${b.layer}`,
      blockId: b.id,
      color: COLORS.info,
      timestamp: now - Math.floor(Math.random() * 90_000),
    });
  }

  return items;
}

// ─── Component ─────────────────────────────────────────
export default function LiveActivityTicker() {
  const insets = useSafeAreaInsets();
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const realEvents = useActivityStore((s) => s.events);

  const publicKey = useWalletStore((s) => s.publicKey);
  const mpConnected = useMultiplayerStore((s) => s.connected && !s.reconnecting);
  const sendPoke = useMultiplayerStore((s) => s.sendPoke);
  const canPoke = usePokeStore((s) => s.canPoke);
  const recordPoke = usePokeStore((s) => s.recordPoke);

  const [items, setItems] = useState<TickerItem[]>([]);
  const [pokeLabel, setPokeLabel] = useState<string | null>(null);
  const lastSyntheticRef = useRef(0);
  const seenIdsRef = useRef(new Set<string>());

  // Convert real activity events to ticker items
  useEffect(() => {
    if (realEvents.length === 0) return;
    const now = Date.now();
    const newItems: TickerItem[] = [];

    for (const evt of realEvents.slice(-5)) {
      if (seenIdsRef.current.has(evt.id)) continue;
      seenIdsRef.current.add(evt.id);

      let text: string;
      let subtext: string | undefined;
      const name = truncName(evt.owner);
      switch (evt.type) {
        case "claim":
          text = `${name} claimed a block`;
          subtext = `Layer ${evt.blockId.split("-")[1] ?? "?"}`;
          break;
        case "charge":
          text = `${name} charged up`;
          break;
        case "customize":
          text = `${name} styled their block`;
          break;
        case "poke":
          text = `${name} poked a neighbor`;
          subtext = "+10% energy sent";
          break;
        default:
          text = `${name} did something`;
          break;
      }

      newItems.push({
        id: evt.id,
        type: evt.type as TickerItem["type"],
        text,
        subtext,
        blockId: evt.blockId,
        color: evt.ownerColor || COLORS.goldLight,
        timestamp: evt.timestamp || now,
      });
    }

    if (newItems.length > 0) {
      setItems((prev) => [...newItems, ...prev].slice(0, MAX_VISIBLE * 2));
    }
  }, [realEvents]);

  // Generate synthetic events periodically (for demo mode / offline)
  const generateSynthetic = useCallback(() => {
    const now = Date.now();
    if (now - lastSyntheticRef.current < SYNTHETIC_INTERVAL_MS) return;
    lastSyntheticRef.current = now;

    const synthetic = generateSyntheticEvents(demoBlocks);
    if (synthetic.length === 0) return;

    // Pick 1-2 random events to add
    const count = Math.min(1 + Math.floor(Math.random() * 2), synthetic.length);
    const picked = synthetic.sort(() => Math.random() - 0.5).slice(0, count);

    setItems((prev) => [...picked, ...prev].slice(0, MAX_VISIBLE * 2));
  }, [demoBlocks]);

  // Scan periodically
  useEffect(() => {
    generateSynthetic();
    const interval = setInterval(generateSynthetic, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [generateSynthetic]);

  // Prune old items
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - ITEM_LIFETIME_MS;
      setItems((prev) => prev.filter((item) => item.timestamp > cutoff));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Poke a random block owned by someone else
  const handlePokeRandom = useCallback(() => {
    const wallet = publicKey?.toBase58() ?? null;
    // Find pokeable blocks (any block owned by someone else with energy)
    const pokeableBlocks = demoBlocks.filter(
      (b) => b.owner && b.owner !== wallet && b.energy > 0 && canPoke(b.id)
    );
    if (pokeableBlocks.length === 0) {
      setPokeLabel("No targets");
      hapticButtonPress();
      setTimeout(() => setPokeLabel(null), 2000);
      return;
    }
    const target = pokeableBlocks[Math.floor(Math.random() * pokeableBlocks.length)];
    hapticButtonPress();
    playPokeSend();
    // Send via multiplayer if connected, otherwise just local feedback
    if (wallet && mpConnected) {
      sendPoke({ blockId: target.id, wallet });
    }
    recordPoke(target.id);
    // Fly camera to the poked block
    selectBlock(target.id);
    setPokeLabel(`Poked L${target.layer}!`);
    setTimeout(() => setPokeLabel(null), 2500);
  }, [publicKey, mpConnected, demoBlocks, canPoke, sendPoke, recordPoke, selectBlock]);

  // Hide when inspector is open
  if (selectedBlockId) return null;

  const visible = items.slice(0, MAX_VISIBLE);

  // Position above FloatingNav
  const bottomOffset = Math.max(insets.bottom, 12) + 56 + SPACING.sm;

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: bottomOffset }]}>
      {/* Poke random action pill — always visible, works in demo mode too */}
      {(
        <Animated.View entering={FadeInUp.duration(300).delay(200)}>
          <TouchableOpacity
            style={styles.pokePill}
            onPress={handlePokeRandom}
            activeOpacity={0.7}
          >
            <HandPointing size={12} color={COLORS.goldLight} weight="fill" />
            <Text style={styles.pokeText}>
              {pokeLabel || "Poke"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {visible.map((item, i) => (
        <Animated.View
          key={item.id}
          entering={FadeInLeft.duration(300).delay(i * 50)}
          exiting={FadeOutLeft.duration(200)}
          layout={Layout.springify().damping(16).stiffness(120)}
        >
          <TouchableOpacity
            style={styles.item}
            onPress={() => item.blockId && selectBlock(item.blockId)}
            activeOpacity={0.7}
          >
            <EventIcon type={item.type} />
            <View style={styles.itemContent}>
              <Text style={styles.itemText} numberOfLines={1}>{item.text}</Text>
              {item.subtext && (
                <Text style={styles.itemSubtext} numberOfLines={1}>{item.subtext}</Text>
              )}
            </View>
            <Text style={styles.itemTime}>{timeAgo(item.timestamp)}</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: SPACING.sm,
    maxWidth: 240,
    gap: 3,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.hudPillBg,
  },
  itemContent: {
    flex: 1,
    gap: 1,
  },
  itemText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 10,
    color: COLORS.textOnDark,
    letterSpacing: 0.2,
  },
  itemSubtext: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 0.1,
  },
  itemTime: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  pokePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.hudPillBg,
    borderWidth: 1,
    borderColor: COLORS.goldGlow,
    marginBottom: 4,
  },
  pokeText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 10,
    color: COLORS.goldLight,
    letterSpacing: 0.3,
  },
});
