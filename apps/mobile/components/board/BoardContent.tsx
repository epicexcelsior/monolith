/**
 * BoardContent — Dark-themed leaderboard + activity feed for use inside BoardSheet.
 *
 * Extracts the core content from blocks.tsx (Board screen) into a reusable component
 * that renders well on a dark glass background (inside BottomPanel dark mode).
 */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useWalletStore } from "@/stores/wallet-store";
import { useTowerStore, type DemoBlock } from "@/stores/tower-store";
import { usePlayerStore } from "@/stores/player-store";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playTabSwitch } from "@/utils/audio";
import { isBotOwner } from "@/utils/seed-tower";
import { GAME_SERVER_URL } from "@/constants/network";

// ─── Types ─────────────────────────────────────────────
type LeaderboardTab = "skyline" | "brightest" | "streak" | "territory" | "xp";

interface LeaderboardEntry {
  rank: number;
  address: string;
  value: string;
  isYou: boolean;
  blockId?: string;
}

interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  time: string;
}

// ─── Helpers ───────────────────────────────────────────
function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function displayName(owner: string): string {
  return isBotOwner(owner) ? owner : truncAddr(owner);
}

function getApiBaseUrl(): string {
  return GAME_SERVER_URL.replace(/^ws/, "http").replace(/\/$/, "");
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const LEADERBOARD_TABS: { key: LeaderboardTab; label: string }[] = [
  { key: "xp", label: "XP" },
  { key: "skyline", label: "Skyline" },
  { key: "brightest", label: "Brightest" },
  { key: "streak", label: "Streaks" },
  { key: "territory", label: "Territory" },
];

// ─── Leaderboard computation ───────────────────────────
async function fetchXpLeaderboard(userAddress: string | null): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/leaderboard?limit=20`);
    if (!res.ok) return [];
    const players: Array<{ wallet: string; xp: number; level: number; username?: string | null }> = await res.json();
    return players.map((p, i) => ({
      rank: i + 1,
      address: p.username || truncAddr(p.wallet),
      value: `${p.xp.toLocaleString()} XP (Lv${p.level})`,
      isYou: userAddress !== null && p.wallet === userAddress,
    }));
  } catch {
    return [];
  }
}

function computeLeaderboard(tab: LeaderboardTab, blocks: DemoBlock[], userAddress: string | null): LeaderboardEntry[] {
  if (tab === "xp") return [];
  const owned = blocks.filter((b) => b.owner !== null);
  if (owned.length === 0) return [];

  const byOwner = new Map<string, DemoBlock[]>();
  for (const b of owned) {
    const list = byOwner.get(b.owner!) || [];
    list.push(b);
    byOwner.set(b.owner!, list);
  }

  let entries: { owner: string; sortVal: number; display: string; blockId?: string }[] = [];

  switch (tab) {
    case "skyline":
      for (const [owner, obs] of byOwner) {
        const best = obs.reduce((a, b) => (b.layer > a.layer ? b : a), obs[0]);
        entries.push({ owner, sortVal: best.layer, display: `Layer ${best.layer}`, blockId: best.id });
      }
      break;
    case "brightest":
      for (const [owner, obs] of byOwner) {
        const best = obs.reduce((a, b) => (b.energy > a.energy ? b : a), obs[0]);
        entries.push({ owner, sortVal: best.energy, display: `${Math.round(best.energy)}%`, blockId: best.id });
      }
      break;
    case "streak":
      for (const [owner, obs] of byOwner) {
        const best = obs.reduce((a, b) => ((b.streak ?? 0) > (a.streak ?? 0) ? b : a), obs[0]);
        entries.push({ owner, sortVal: best.streak ?? 0, display: `Day ${best.streak ?? 0}`, blockId: best.id });
      }
      break;
    case "territory":
      for (const [owner, obs] of byOwner) {
        entries.push({ owner, sortVal: obs.length, display: `${obs.length} block${obs.length !== 1 ? "s" : ""}` });
      }
      break;
  }

  entries.sort((a, b) => b.sortVal - a.sortVal);
  return entries.slice(0, 8).map((e, i) => ({
    rank: i + 1,
    address: displayName(e.owner),
    value: e.display,
    isYou: userAddress !== null && e.owner === userAddress,
    blockId: e.blockId,
  }));
}

// ─── Activity feed ─────────────────────────────────────
const EVENT_ICONS: Record<string, string> = { claim: "🔥", charge: "⚡", customize: "🎨", reclaim: "💀", level_up: "🌟" };

function formatServerEvent(evt: { id: number; type: string; block_id?: string; wallet?: string; data?: any; created_at: string }): ActivityItem {
  const icon = EVENT_ICONS[evt.type] ?? "📡";
  const who = evt.wallet ? truncAddr(evt.wallet) : "Someone";
  const blockLabel = evt.block_id ?? "a block";
  let text: string;
  switch (evt.type) {
    case "claim": text = `${who} claimed ${blockLabel}`; break;
    case "charge": text = `${who} charged ${blockLabel}`; break;
    case "customize": text = `${who} customized ${blockLabel}`; break;
    case "reclaim": text = `${who} reclaimed ${blockLabel}`; break;
    case "level_up": text = `${who} reached Level ${evt.data?.level ?? "?"}`; break;
    default: text = `${who} performed ${evt.type}`;
  }
  return { id: String(evt.id), icon, text, time: relativeTime(evt.created_at) };
}

async function fetchActivityFeed(): Promise<ActivityItem[] | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/events?limit=6`);
    if (!res.ok) return null;
    return (await res.json()).map(formatServerEvent);
  } catch {
    return null;
  }
}

const TIME_STRINGS = ["just now", "2m ago", "15m ago", "1h ago", "3h ago", "6h ago"];

function generateActivityFeed(blocks: DemoBlock[], userAddress: string | null): ActivityItem[] {
  const owned = blocks.filter((b) => b.owner !== null);
  if (owned.length === 0) return [];
  const items: ActivityItem[] = [];
  const crown = owned.reduce((a, b) => (b.layer > a.layer ? b : a), owned[0]);
  const totalKeepers = new Set(owned.map((b) => b.owner)).size;
  const avgEnergy = Math.round(owned.reduce((s, b) => s + b.energy, 0) / owned.length);
  items.push({ id: "crown", icon: "👑", text: `${displayName(crown.owner!)} holds the Crown at Layer ${crown.layer}`, time: TIME_STRINGS[2] });
  items.push({ id: "stats", icon: "🏔️", text: `${totalKeepers} keepers, avg ${avgEnergy}% charge`, time: TIME_STRINGS[0] });
  const fading = owned.filter((b) => b.energy < 20 && b.energy > 0);
  if (fading.length > 0) items.push({ id: "fading", icon: "💀", text: `${fading.length} block${fading.length !== 1 ? "s" : ""} fading — territory up for grabs`, time: TIME_STRINGS[3] });
  return items.slice(0, 6);
}

// ─── Component ─────────────────────────────────────────
interface BoardContentProps {
  onSelectBlock?: (blockId: string) => void;
}

export default function BoardContent({ onSelectBlock }: BoardContentProps) {
  const publicKey = useWalletStore((s) => s.publicKey);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const isConnected = useWalletStore((s) => s.isConnected);

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("xp");
  const [xpLeaderboard, setXpLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [liveActivity, setLiveActivity] = useState<ActivityItem[] | null>(null);
  const activityFetchedRef = useRef(false);

  const userAddress = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (activeTab !== "xp") return;
    fetchXpLeaderboard(userAddress).then(setXpLeaderboard);
  }, [activeTab, userAddress]);

  const leaderboardData = useMemo(
    () => activeTab === "xp" ? xpLeaderboard : computeLeaderboard(activeTab, demoBlocks, userAddress),
    [activeTab, demoBlocks, userAddress, xpLeaderboard],
  );

  useEffect(() => {
    if (activityFetchedRef.current) return;
    activityFetchedRef.current = true;
    fetchActivityFeed().then((items) => {
      if (items && items.length > 0) setLiveActivity(items);
    });
  }, []);

  const activityFeed = liveActivity ?? generateActivityFeed(demoBlocks, userAddress);

  const handleBlockTap = useCallback((blockId: string) => {
    hapticButtonPress();
    selectBlock(blockId);
    onSelectBlock?.(blockId);
  }, [selectBlock, onSelectBlock]);

  if (!isConnected) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏔️</Text>
        <Text style={styles.emptyTitle}>Connect Wallet</Text>
        <Text style={styles.emptyText}>Connect to see your rank and compete.</Text>
        <TouchableOpacity style={styles.connectButton} onPress={() => useWalletStore.getState().setShowConnectSheet(true)}>
          <Text style={styles.connectButtonText}>Connect Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Tab selector */}
      <View style={styles.tabRow}>
        {LEADERBOARD_TABS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabButton, activeTab === key && styles.tabButtonActive]}
            onPress={() => { hapticButtonPress(); playTabSwitch(); setActiveTab(key); }}
          >
            <Text style={[styles.tabLabel, activeTab === key && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard entries */}
      <View style={styles.leaderboardList}>
        {leaderboardData.length === 0 && (
          <Text style={styles.emptyListText}>No data yet</Text>
        )}
        {leaderboardData.map((entry, i) => (
          <TouchableOpacity
            key={`${entry.rank}-${entry.address}`}
            activeOpacity={0.7}
            onPress={() => entry.blockId && handleBlockTap(entry.blockId)}
          >
            <Animated.View
              entering={FadeInDown.delay(100 + i * 40).duration(200)}
              style={[styles.leaderboardRow, entry.isYou && styles.leaderboardRowYou]}
            >
              <Text style={[styles.rankCol, entry.rank <= 3 && styles.rankColTop]}>
                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}`}
              </Text>
              <Text style={[styles.addressCol, entry.isYou && styles.addressColYou]} numberOfLines={1}>
                {entry.isYou ? `${entry.address} (you)` : entry.address}
              </Text>
              <Text style={[styles.valueCol, entry.isYou && styles.valueColYou]}>{entry.value}</Text>
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity feed */}
      {activityFeed.length > 0 && (
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          {activityFeed.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <Text style={styles.activityIcon}>{item.icon}</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>{item.text}</Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.lg },

  // Empty state
  emptyContainer: { alignItems: "center", paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: FONT_FAMILY.headingSemibold, fontSize: 18, color: COLORS.textOnDark },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: 14, color: COLORS.textMuted, textAlign: "center" },
  connectButton: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gold,
  },
  connectButtonText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 14, color: COLORS.textOnGold },

  // Tabs
  tabRow: { flexDirection: "row", gap: 4, marginBottom: SPACING.md },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tabButtonActive: {
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  tabLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tabLabelActive: { color: COLORS.goldLight },

  // Leaderboard
  leaderboardList: { gap: 2 },
  emptyListText: { fontFamily: FONT_FAMILY.body, fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingVertical: SPACING.lg },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  leaderboardRowYou: { backgroundColor: COLORS.goldSubtle },
  rankCol: { fontFamily: FONT_FAMILY.mono, fontSize: 14, color: COLORS.textMuted, width: 32, textAlign: "center" },
  rankColTop: { fontSize: 18 },
  addressCol: { flex: 1, fontFamily: FONT_FAMILY.mono, fontSize: 13, color: COLORS.textOnDark },
  addressColYou: { color: COLORS.gold, fontFamily: FONT_FAMILY.bodySemibold },
  valueCol: { fontFamily: FONT_FAMILY.bodySemibold, fontSize: 13, color: COLORS.textMuted, textAlign: "right" },
  valueColYou: { color: COLORS.gold },

  // Activity
  activitySection: { marginTop: SPACING.lg, gap: SPACING.sm },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
  },
  activityRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  activityIcon: { fontSize: 14, marginTop: 2 },
  activityContent: { flex: 1 },
  activityText: { fontFamily: FONT_FAMILY.body, fontSize: 13, color: COLORS.textOnDark, lineHeight: 18 },
  activityTime: { fontFamily: FONT_FAMILY.bodyMedium, fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
