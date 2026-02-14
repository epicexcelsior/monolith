/**
 * Board screen — Leaderboard & player status.
 *
 * Game-first design: shows tower rank, Charge status, leaderboard,
 * and activity feed. Finance details are hidden behind "Fuel" actions.
 *
 * Tab route: app/(tabs)/blocks.tsx → "Board"
 */

import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useTowerStore } from "@/stores/tower-store";
import { useStaking, type TowerInfo, type UserDepositInfo } from "@/hooks/useStaking";
import { ScreenLayout, Card, Badge, Button, ChargeBar } from "@/components/ui";
import { TEXT, COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";

// ─── Leaderboard categories from GDD §6.2 ──────────────────────
type LeaderboardTab = "skyline" | "brightest" | "streak" | "territory";

const LEADERBOARD_TABS: { key: LeaderboardTab; label: string; icon: string }[] = [
  { key: "skyline", label: "Skyline", icon: "🏔️" },
  { key: "brightest", label: "Brightest", icon: "💡" },
  { key: "streak", label: "Streaks", icon: "🔥" },
  { key: "territory", label: "Territory", icon: "👑" },
];

// ─── Mock leaderboard data (will be server-driven post-MVP) ─────
interface LeaderboardEntry {
  rank: number;
  address: string;
  value: string;
  isYou: boolean;
}

function generateMockLeaderboard(
  tab: LeaderboardTab,
  userAddress: string | null,
): LeaderboardEntry[] {
  const mockAddresses = [
    "7xKX...m4Qp",
    "9bRd...vWn3",
    "3tFe...cH8j",
    "Dk4P...qR2x",
    "mN7W...sJ5y",
    "5aLc...pT9f",
    "Xr2Q...bK6n",
  ];

  const valuesByTab: Record<LeaderboardTab, string[]> = {
    skyline: ["Crown L12", "High L10", "High L9", "Mid L7", "Mid L6", "Base L3", "Base L1"],
    brightest: ["98%", "95%", "91%", "87%", "82%", "74%", "68%"],
    streak: ["Day 42 👑", "Day 28 🔥", "Day 14 🔥", "Day 9", "Day 7 🏅", "Day 4", "Day 2"],
    territory: ["8 blocks", "5 blocks", "4 blocks", "3 blocks", "2 blocks", "2 blocks", "1 block"],
  };

  const entries = mockAddresses.map((addr, i) => ({
    rank: i + 1,
    address: addr,
    value: valuesByTab[tab][i],
    isYou: false,
  }));

  // Inject user into the leaderboard if connected
  if (userAddress) {
    const truncAddr = userAddress.length > 12
      ? `${userAddress.slice(0, 4)}...${userAddress.slice(-4)}`
      : userAddress;
    const userValues: Record<LeaderboardTab, string> = {
      skyline: "Base L2",
      brightest: "72%",
      streak: "Day 1 ⚡",
      territory: "1 block",
    };
    entries.splice(5, 0, {
      rank: 6,
      address: truncAddr,
      value: userValues[tab],
      isYou: true,
    });
    // Re-rank
    entries.forEach((e, i) => (e.rank = i + 1));
  }

  return entries.slice(0, 8);
}

// ─── Activity feed mock ─────────────────────────────────────────
interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  time: string;
}

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: "1", icon: "🔥", text: "Tower Charge Storm! All blocks +10 Charge", time: "2h ago" },
  { id: "2", icon: "👀", text: "Someone claimed the block next to yours!", time: "5h ago" },
  { id: "3", icon: "🏆", text: "You moved up 3 spots on the Skyline!", time: "1d ago" },
  { id: "4", icon: "⚡", text: "New keeper joined Floor 3", time: "1d ago" },
  { id: "5", icon: "💡", text: "A Lighthouse appeared on Floor 8!", time: "2d ago" },
];

export default function BoardScreen() {
  const router = useRouter();
  const isConnected = useWalletStore((s) => s.isConnected);
  const publicKey = useWalletStore((s) => s.publicKey);
  const truncatedAddress = useTruncatedAddress();
  const stats = useTowerStore((s) => s.stats);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const { fetchTowerState, fetchUserDeposit } = useStaking();

  const [towerInfo, setTowerInfo] = useState<TowerInfo | null>(null);
  const [userDeposit, setUserDeposit] = useState<UserDepositInfo | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("skyline");
  const [refreshing, setRefreshing] = useState(false);

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
    const interval = setInterval(refreshAll, 15_000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  const leaderboardData = generateMockLeaderboard(
    activeTab,
    publicKey?.toBase58() ?? null,
  );

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
      onRefresh={onRefresh}
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
              <Text style={styles.rankNumber}>#6</Text>
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
              <Text style={styles.heroStatValue}>Day 1</Text>
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
          {leaderboardData.map((entry) => (
            <View
              key={entry.rank}
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
            </View>
          ))}
        </View>
      </Card>

      {/* ─── Activity Feed ─── */}
      <Card>
        <Text style={TEXT.overline}>RECENT ACTIVITY</Text>
        <View style={styles.activityList}>
          {MOCK_ACTIVITY.map((item) => (
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
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.bgMuted,
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
