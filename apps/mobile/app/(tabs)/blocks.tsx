/**
 * Board screen — Leaderboard & player status.
 *
 * Game-first design: shows tower rank, Charge status, leaderboard,
 * and activity feed. Finance details are hidden behind "Fuel" actions.
 *
 * Tab route: app/(tabs)/blocks.tsx → "Board"
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useWalletStore } from "@/stores/wallet-store";
import { useTowerStore, type DemoBlock } from "@/stores/tower-store";
import { useStaking, type TowerInfo, type UserDepositInfo } from "@/hooks/useStaking";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenLayout, Card, Badge, Button, ChargeBar } from "@/components/ui";
import { TEXT, COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { isBotOwner } from "@/utils/seed-tower";
import { GAME_SERVER_URL } from "@/constants/network";

// ─── Leaderboard categories from GDD §6.2 ──────────────────────
type LeaderboardTab = "skyline" | "brightest" | "streak" | "territory" | "xp";

const LEADERBOARD_TABS: { key: LeaderboardTab; label: string; icon: string }[] = [
  { key: "xp", label: "XP", icon: "⭐" },
  { key: "skyline", label: "Skyline", icon: "🏔️" },
  { key: "brightest", label: "Brightest", icon: "💡" },
  { key: "streak", label: "Streaks", icon: "🔥" },
  { key: "territory", label: "Territory", icon: "👑" },
];

// ─── Leaderboard data (computed from demoBlocks) ────────────────
interface LeaderboardEntry {
  rank: number;
  address: string;
  value: string;
  isYou: boolean;
  blockId?: string;
}

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function displayName(owner: string): string {
  return isBotOwner(owner) ? owner : truncAddr(owner);
}

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

function computeLeaderboard(
  tab: LeaderboardTab,
  blocks: DemoBlock[],
  userAddress: string | null,
): LeaderboardEntry[] {
  if (tab === "xp") return []; // XP tab uses async fetch instead

  const owned = blocks.filter((b) => b.owner !== null);
  if (owned.length === 0) return [];

  // Group blocks by owner
  const byOwner = new Map<string, DemoBlock[]>();
  for (const b of owned) {
    const list = byOwner.get(b.owner!) || [];
    list.push(b);
    byOwner.set(b.owner!, list);
  }

  let entries: { owner: string; sortVal: number; display: string; blockId?: string }[] = [];

  switch (tab) {
    case "skyline": {
      for (const [owner, obs] of byOwner) {
        const best = obs.reduce((a, b) => (b.layer > a.layer ? b : a), obs[0]);
        entries.push({ owner, sortVal: best.layer, display: `Layer ${best.layer}`, blockId: best.id });
      }
      entries.sort((a, b) => b.sortVal - a.sortVal);
      break;
    }
    case "brightest": {
      for (const [owner, obs] of byOwner) {
        const best = obs.reduce((a, b) => (b.energy > a.energy ? b : a), obs[0]);
        entries.push({ owner, sortVal: best.energy, display: `${Math.round(best.energy)}%`, blockId: best.id });
      }
      entries.sort((a, b) => b.sortVal - a.sortVal);
      break;
    }
    case "streak": {
      for (const [owner, obs] of byOwner) {
        const best = obs.reduce((a, b) => ((b.streak ?? 0) > (a.streak ?? 0) ? b : a), obs[0]);
        const s = best.streak ?? 0;
        const badge = s >= 30 ? " 👑" : s >= 7 ? " 🔥" : "";
        entries.push({ owner, sortVal: s, display: `Day ${s}${badge}`, blockId: best.id });
      }
      entries.sort((a, b) => b.sortVal - a.sortVal);
      break;
    }
    case "territory": {
      for (const [owner, obs] of byOwner) {
        const count = obs.length;
        entries.push({ owner, sortVal: count, display: `${count} block${count !== 1 ? "s" : ""}` });
      }
      entries.sort((a, b) => b.sortVal - a.sortVal);
      break;
    }
  }

  return entries.slice(0, 8).map((e, i) => ({
    rank: i + 1,
    address: displayName(e.owner),
    value: e.display,
    isYou: userAddress !== null && e.owner === userAddress,
    blockId: e.blockId,
  }));
}

// ─── REST API base URL from WebSocket URL ────────────────────
function getApiBaseUrl(): string {
  const wsUrl = GAME_SERVER_URL;
  const httpUrl = wsUrl.replace(/^ws/, "http");
  return httpUrl.replace(/\/$/, "");
}

// ─── Activity feed ────────────────────────────────────────────
interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  time: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const EVENT_ICONS: Record<string, string> = {
  claim: "🔥",
  charge: "⚡",
  customize: "🎨",
  reclaim: "💀",
  level_up: "🌟",
};

function formatServerEvent(evt: { id: number; type: string; block_id?: string; wallet?: string; data?: any; created_at: string }): ActivityItem {
  const icon = EVENT_ICONS[evt.type] ?? "📡";
  const who = evt.wallet ? truncAddr(evt.wallet) : "Someone";
  const blockLabel = evt.block_id ?? "a block";
  let text: string;
  switch (evt.type) {
    case "claim":
      text = `${who} claimed ${blockLabel}`;
      break;
    case "charge":
      text = `${who} charged ${blockLabel}`;
      break;
    case "customize":
      text = `${who} customized ${blockLabel}`;
      break;
    case "reclaim":
      text = `${who} reclaimed ${blockLabel}`;
      break;
    case "level_up":
      text = `${who} reached Level ${evt.data?.level ?? "?"}`;
      break;
    default:
      text = `${who} performed ${evt.type}`;
  }
  return { id: String(evt.id), icon, text, time: relativeTime(evt.created_at) };
}

async function fetchActivityFeed(): Promise<ActivityItem[] | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/events?limit=8`);
    if (!res.ok) return null;
    const events = await res.json();
    return events.map(formatServerEvent);
  } catch {
    return null;
  }
}

const TIME_STRINGS = ["just now", "2m ago", "15m ago", "1h ago", "3h ago", "6h ago", "1d ago", "2d ago"];

function generateActivityFeed(blocks: DemoBlock[], userAddress: string | null): ActivityItem[] {
  const items: ActivityItem[] = [];
  const owned = blocks.filter((b) => b.owner !== null);
  if (owned.length === 0) return [];

  // Find interesting blocks
  const blazing = owned.filter((b) => b.energy > 90);
  const fading = owned.filter((b) => b.energy < 20 && b.energy > 0);
  const highStreak = owned.filter((b) => (b.streak ?? 0) > 7);
  const crown = owned.reduce((a, b) => (b.layer > a.layer ? b : a), owned[0]);
  const totalKeepers = new Set(owned.map((b) => b.owner)).size;
  const avgEnergy = Math.round(owned.reduce((s, b) => s + b.energy, 0) / owned.length);

  // Crown holder
  items.push({
    id: "crown",
    icon: "👑",
    text: `${displayName(crown.owner!)} holds the Crown at Layer ${crown.layer}`,
    time: TIME_STRINGS[2],
  });

  // Tower-wide stats
  items.push({
    id: "stats",
    icon: "🏔️",
    text: `${totalKeepers} keepers maintain ${owned.length} blocks (avg ${avgEnergy}% charge)`,
    time: TIME_STRINGS[0],
  });

  // Blazing blocks
  if (blazing.length > 0) {
    const b = blazing[Math.floor(blazing.length * 0.3)];
    items.push({
      id: "blazing",
      icon: "🔥",
      text: `${displayName(b.owner!)} is blazing at ${Math.round(b.energy)}% charge!`,
      time: TIME_STRINGS[1],
    });
  }

  // Fading blocks
  if (fading.length > 0) {
    items.push({
      id: "fading",
      icon: "💀",
      text: `${fading.length} block${fading.length !== 1 ? "s" : ""} fading below 20% — territory up for grabs`,
      time: TIME_STRINGS[3],
    });
  }

  // High streaks
  if (highStreak.length > 0) {
    const best = highStreak.reduce((a, b) => ((b.streak ?? 0) > (a.streak ?? 0) ? b : a), highStreak[0]);
    items.push({
      id: "streak",
      icon: "⚡",
      text: `${displayName(best.owner!)} is on a Day ${best.streak} streak!`,
      time: TIME_STRINGS[4],
    });
  }

  // User-specific
  if (userAddress) {
    const userBlks = blocks.filter((b) => b.owner === userAddress);
    if (userBlks.length > 0) {
      const bestUser = userBlks.reduce((a, b) => (b.energy > a.energy ? b : a), userBlks[0]);
      items.push({
        id: "you",
        icon: "✨",
        text: `Your best block is at ${Math.round(bestUser.energy)}% charge on Layer ${bestUser.layer}`,
        time: TIME_STRINGS[0],
      });
    } else {
      items.push({
        id: "you-hint",
        icon: "👀",
        text: "Claim a block to join the tower and start competing!",
        time: TIME_STRINGS[0],
      });
    }
  }

  // Newest neighborhood activity
  const topLayer = Math.max(...owned.map((b) => b.layer));
  const topBlocks = owned.filter((b) => b.layer === topLayer);
  if (topBlocks.length > 0) {
    items.push({
      id: "top-floor",
      icon: "🌟",
      text: `Floor ${topLayer} has ${topBlocks.length} keeper${topBlocks.length !== 1 ? "s" : ""} — the spire glows`,
      time: TIME_STRINGS[5],
    });
  }

  return items.slice(0, 8);
}

export default function BoardScreen() {
  const router = useRouter();
  const isConnected = useWalletStore((s) => s.isConnected);
  const publicKey = useWalletStore((s) => s.publicKey);
  const stats = useTowerStore((s) => s.stats);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const { fetchTowerState, fetchUserDeposit } = useStaking();

  const [towerInfo, setTowerInfo] = useState<TowerInfo | null>(null);
  const [userDeposit, setUserDeposit] = useState<UserDepositInfo | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("xp");
  const [refreshing, setRefreshing] = useState(false);
  const [xpLeaderboard, setXpLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Derive player stats from demo blocks
  const userBlocks = publicKey
    ? demoBlocks.filter((b) => b.owner === publicKey.toBase58())
    : [];
  const bestBlock = userBlocks.length > 0
    ? userBlocks.reduce((best, b) => (b.energy > best.energy ? b : best), userBlocks[0])
    : null;
  const totalBlocks = userBlocks.length;

  const refreshAll = useCallback(async () => {
    const [tower, deposit] = await Promise.all([
      fetchTowerState(),
      fetchUserDeposit(),
    ]);
    if (tower) setTowerInfo(tower);
    setUserDeposit(deposit);
  }, [fetchTowerState, fetchUserDeposit]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 60_000); // On-chain data; 60s is plenty
    return () => clearInterval(interval);
  }, [refreshAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  const userAddress = publicKey?.toBase58() ?? null;

  // Fetch XP leaderboard from server when XP tab is active
  useEffect(() => {
    if (activeTab !== "xp") return;
    fetchXpLeaderboard(userAddress).then(setXpLeaderboard);
  }, [activeTab, userAddress]);

  const leaderboardData = useMemo(
    () => activeTab === "xp" ? xpLeaderboard : computeLeaderboard(activeTab, demoBlocks, userAddress),
    [activeTab, demoBlocks, userAddress, xpLeaderboard],
  );

  // Activity feed: try real events from API, fall back to generated
  const [liveActivity, setLiveActivity] = useState<ActivityItem[] | null>(null);
  const activityFetchedRef = useRef(false);

  useEffect(() => {
    if (activityFetchedRef.current) return;
    activityFetchedRef.current = true;
    fetchActivityFeed().then((items) => {
      if (items && items.length > 0) setLiveActivity(items);
    });
  }, []);

  // Re-fetch on pull-to-refresh
  const originalOnRefresh = onRefresh;
  const onRefreshWithActivity = useCallback(async () => {
    await originalOnRefresh();
    const items = await fetchActivityFeed();
    if (items && items.length > 0) setLiveActivity(items);
    activityFetchedRef.current = true;
  }, [originalOnRefresh]);

  const activityFeed = liveActivity ?? generateActivityFeed(demoBlocks, userAddress);

  // Compute user's skyline rank for hero card
  const userSkylineRank = useMemo(() => {
    const skylineData = computeLeaderboard("skyline", demoBlocks, userAddress);
    const you = skylineData.find((e) => e.isYou);
    return you ? you.rank : null;
  }, [demoBlocks, userAddress]);

  // Best streak across user's blocks
  const bestUserStreak = useMemo(() => {
    if (!userAddress) return 0;
    return userBlocks.reduce((max, b) => Math.max(max, b.streak ?? 0), 0);
  }, [userBlocks, userAddress]);

  // ─── Not connected state ───
  if (!isConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyIcon}>🏔️</Text>
          <Text style={TEXT.displaySm}>The Board</Text>
          <Text style={[TEXT.bodySm, { textAlign: "center" }]}>
            Connect your wallet to see your rank and compete on the leaderboard.
          </Text>
          <View style={styles.fullWidth}>
            <Button
              title="Connect Wallet"
              variant="primary"
              onPress={() => router.push("/connect")}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScreenLayout
      title="The Board"
      subtitle={`${stats.occupiedBlocks} keepers • ${stats.totalBlocks} blocks`}
      onRefresh={onRefreshWithActivity}
      refreshing={refreshing}
    >
      {/* ─── Hero: My Tower Status ─── */}
      <Card variant="accent">
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={TEXT.overline}>YOUR STATUS</Text>
              <Text style={styles.heroPosition}>
                {bestBlock
                  ? `Floor ${bestBlock.layer}, Block ${bestBlock.index}`
                  : "No blocks yet"}
              </Text>
            </View>
            <View style={styles.heroRank}>
              <Text style={styles.rankNumber}>
                {userSkylineRank ? `#${userSkylineRank}` : "—"}
              </Text>
              <Text style={[TEXT.caption, { color: COLORS.gold }]}>Skyline</Text>
            </View>
          </View>

          {bestBlock && (
            <ChargeBar
              charge={bestBlock.energy}
              size="md"
              showLabel
              showPercentage
            />
          )}

          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{totalBlocks}</Text>
              <Text style={styles.heroStatLabel}>Blocks</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>
                {bestUserStreak > 0 ? `Day ${bestUserStreak}` : "—"}
              </Text>
              <Text style={styles.heroStatLabel}>Streak</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={[styles.heroStatValue, { color: COLORS.gold }]}>
                ${(userDeposit?.amount ?? 0).toFixed(0)}
              </Text>
              <Text style={styles.heroStatLabel}>Fuel</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* ─── Quick Actions ─── */}
      <View style={styles.quickActions}>
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ flex: 1 }}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              hapticButtonPress();
              router.push("/deposit" as any);
            }}
          >
            <Text style={styles.quickActionIcon}>⛽</Text>
            <Text style={styles.quickActionLabel}>Add Fuel</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ flex: 1 }}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              hapticButtonPress();
              router.push("/withdraw" as any);
            }}
          >
            <Text style={styles.quickActionIcon}>📤</Text>
            <Text style={styles.quickActionLabel}>Extract</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ─── Leaderboard ─── */}
      <Card>
        <Text style={TEXT.overline}>LEADERBOARD</Text>

        {/* Tab selector */}
        <View style={styles.tabRow}>
          {LEADERBOARD_TABS.map(({ key, label, icon }) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.tabButton,
                activeTab === key && styles.tabButtonActive,
              ]}
              onPress={() => {
                hapticButtonPress();
                setActiveTab(key);
              }}
            >
              <Text style={styles.tabIcon}>{icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === key && styles.tabLabelActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Entries */}
        <View style={styles.leaderboardList}>
          {leaderboardData.map((entry, i) => (
            <TouchableOpacity
              key={entry.rank}
              activeOpacity={0.7}
              onPress={() => {
                if (entry.blockId) {
                  hapticButtonPress();
                  selectBlock(entry.blockId);
                  router.push("/(tabs)");
                }
              }}
            >
              <Animated.View
                entering={FadeInDown.delay(200 + i * 50).duration(250)}
                style={[
                  styles.leaderboardRow,
                  entry.isYou && styles.leaderboardRowYou,
                ]}
              >
                <Text style={[styles.rankCol, entry.rank <= 3 && styles.rankColTop]}>
                  {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}`}
                </Text>
                <Text
                  style={[
                    styles.addressCol,
                    entry.isYou && { color: COLORS.gold, fontFamily: FONT_FAMILY.bodySemibold },
                  ]}
                >
                  {entry.isYou ? `${entry.address} (you)` : entry.address}
                </Text>
                <Text
                  style={[
                    styles.valueCol,
                    entry.isYou && { color: COLORS.gold },
                  ]}
                >
                  {entry.value}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* ─── Activity Feed ─── */}
      <Card>
        <Text style={TEXT.overline}>RECENT ACTIVITY</Text>
        <View style={styles.activityList}>
          {activityFeed.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <Text style={styles.activityIcon}>{item.icon}</Text>
              <View style={styles.activityContent}>
                <Text style={TEXT.bodySm}>{item.text}</Text>
                <Text style={TEXT.caption}>{item.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {/* ─── Tower Power ─── */}
      <Card variant="muted">
        <View style={styles.towerPowerRow}>
          <Text style={TEXT.bodySm}>Tower Power</Text>
          <Text style={[TEXT.mono, { color: COLORS.gold }]}>
            {towerInfo
              ? `$${towerInfo.totalDeposited.toFixed(0)} fuel • ${towerInfo.totalUsers} keepers`
              : "Loading..."}
          </Text>
        </View>
      </Card>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  // ─── Empty state ───
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  emptyContent: {
    alignItems: "center",
    gap: SPACING.md,
  },
  emptyIcon: {
    fontSize: 64,
  },
  fullWidth: {
    width: "100%",
  },

  // ─── Hero card ───
  heroCard: {
    gap: SPACING.md,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroPosition: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 20,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  heroRank: {
    alignItems: "center",
  },
  rankNumber: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 28,
    color: COLORS.gold,
    fontWeight: "900",
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  heroStatItem: {
    alignItems: "center",
  },
  heroStatValue: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 18,
    color: COLORS.text,
  },
  heroStatLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },

  // ─── Quick actions ───
  quickActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    ...GLASS_STYLE.muted,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm + 2,
  },
  quickActionIcon: {
    fontSize: 16,
  },
  quickActionLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // ─── Leaderboard ───
  tabRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.glassMuted,
  },
  tabButtonActive: {
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  tabLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tabLabelActive: {
    color: COLORS.goldDark,
  },
  leaderboardList: {
    gap: 2,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  leaderboardRowYou: {
    backgroundColor: COLORS.goldSubtle,
  },
  rankCol: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 14,
    color: COLORS.textMuted,
    width: 32,
    textAlign: "center",
  },
  rankColTop: {
    fontSize: 18,
  },
  addressCol: {
    flex: 1,
    fontFamily: FONT_FAMILY.mono,
    fontSize: 13,
    color: COLORS.text,
  },
  valueCol: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "right",
  },

  // ─── Activity ───
  activityList: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  activityIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },

  // ─── Tower power ───
  towerPowerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
