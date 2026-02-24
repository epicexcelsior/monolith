import { useState } from "react";
import { Alert, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useTowerStore, type DemoBlock } from "@/stores/tower-store";
import { usePlayerStore } from "@/stores/player-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import XPBar from "@/components/ui/XPBar";
import { getClusterName } from "@/services/mwa";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenLayout, Card, Button, Badge, ChargeBar } from "@/components/ui";
import { TEXT, COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress, setHapticsEnabled, isHapticsEnabled } from "@/utils/haptics";
import { playButtonTap, setMuted, isMuted } from "@/utils/audio";

/**
 * Me screen — Player profile, My Blocks grid, and account management.
 *
 * Game-first: shows identity, block ownership, and streaks up top.
 * Finance/settings are collapsed below as secondary concerns.
 */
export default function MeScreen() {
  const router = useRouter();
  const { disconnect } = useAuthorization();
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLoading = useWalletStore((s) => s.isLoading);
  const publicKey = useWalletStore((s) => s.publicKey);
  const truncatedAddress = useTruncatedAddress();
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const resetTower = useTowerStore((s) => s.resetTower);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const cluster = getClusterName();
  const [showSettings, setShowSettings] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isMuted());
  const [hapticsMuted, setHapticsMuted] = useState(!isHapticsEnabled());
  const username = usePlayerStore((s) => s.username);

  const xp = usePlayerStore((s) => s.xp);
  const level = usePlayerStore((s) => s.level);
  const totalClaims = usePlayerStore((s) => s.totalClaims);
  const totalCharges = usePlayerStore((s) => s.totalCharges);
  const comboBest = usePlayerStore((s) => s.comboBest);

  // Derive my blocks
  const myBlocks = publicKey
    ? demoBlocks.filter((b) => b.owner === publicKey.toBase58())
    : [];
  const totalEnergy = myBlocks.length > 0
    ? Math.round(myBlocks.reduce((sum, b) => sum + b.energy, 0) / myBlocks.length)
    : 0;
  const bestStreak = myBlocks.reduce((max, b) => Math.max(max, b.streak ?? 0), 0);

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Wallet",
      "Are you sure you want to disconnect?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnect();
            } catch (err) {
              console.error("Disconnect failed:", err);
            }
          },
        },
      ],
    );
  };

  if (!isConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={TEXT.displaySm}>Who Are You?</Text>
          <Text style={[TEXT.bodySm, { textAlign: "center" }]}>
            Connect your wallet to claim your identity on the tower.
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
    <ScreenLayout title="Me">
      {/* ─── Player Identity Card ─── */}
      <Card variant="accent">
        <View style={styles.identityCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarEmoji}>🗿</Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.playerName}>
              {username || `Keeper ${truncatedAddress}`}
            </Text>
            <Badge
              label="Connected"
              variant="dot"
              color={COLORS.success}
            />
          </View>
        </View>

        <View style={styles.identityStats}>
          <View style={styles.identityStatItem}>
            <Text style={styles.identityStatValue}>{myBlocks.length}</Text>
            <Text style={styles.identityStatLabel}>Blocks</Text>
          </View>
          <View style={styles.identityStatDivider} />
          <View style={styles.identityStatItem}>
            <Text style={styles.identityStatValue}>{totalEnergy}%</Text>
            <Text style={styles.identityStatLabel}>Avg Charge</Text>
          </View>
          <View style={styles.identityStatDivider} />
          <View style={styles.identityStatItem}>
            <Text style={styles.identityStatValue}>{bestStreak > 0 ? `Day ${bestStreak}` : "—"}</Text>
            <Text style={styles.identityStatLabel}>Streak</Text>
          </View>
        </View>
      </Card>

      {/* ─── My Blocks ─── */}
      <Card>
        <Text style={TEXT.overline}>MY BLOCKS</Text>

        {myBlocks.length === 0 ? (
          <View style={styles.emptyBlocks}>
            <Text style={styles.emptyBlocksIcon}>🧱</Text>
            <Text style={[TEXT.bodySm, { textAlign: "center" }]}>
              No blocks yet. Head to the Tower and claim your first one!
            </Text>
            <Button
              title="Go to Tower"
              variant="secondary"
              size="sm"
              onPress={() => router.push("/(tabs)")}
            />
          </View>
        ) : (
          <View style={styles.blocksGrid}>
            {myBlocks.map((block, i) => (
              <Animated.View key={block.id} entering={FadeInDown.delay(100 + i * 60).duration(250)} style={{ flex: 1, minWidth: 130 }}>
              <TouchableOpacity
                style={styles.blockCard}
                onPress={() => {
                  hapticButtonPress();
                  playButtonTap();
                  selectBlock(block.id);
                  router.push("/(tabs)");
                }}
              >
                <View style={styles.blockCardHeader}>
                  <View
                    style={[
                      styles.blockColorDot,
                      { backgroundColor: block.ownerColor },
                    ]}
                  />
                  <Text style={styles.blockCardTitle}>
                    L{block.layer} / B{block.index}
                  </Text>
                </View>
                <ChargeBar charge={block.energy} size="sm" />
                <Text style={styles.blockCardCharge}>
                  {Math.round(block.energy)}%
                </Text>
              </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </Card>

      {/* ─── XP Progress ─── */}
      <Card>
        <Text style={TEXT.overline}>EXPERIENCE</Text>
        <View style={{ marginTop: SPACING.sm }}>
          <XPBar xp={xp} level={level} size="md" />
        </View>
        <View style={[styles.identityStats, { marginTop: SPACING.md }]}>
          <View style={styles.identityStatItem}>
            <Text style={styles.identityStatValue}>{totalClaims}</Text>
            <Text style={styles.identityStatLabel}>Claims</Text>
          </View>
          <View style={styles.identityStatDivider} />
          <View style={styles.identityStatItem}>
            <Text style={styles.identityStatValue}>{totalCharges}</Text>
            <Text style={styles.identityStatLabel}>Charges</Text>
          </View>
          <View style={styles.identityStatDivider} />
          <View style={styles.identityStatItem}>
            <Text style={[styles.identityStatValue, { color: COLORS.gold }]}>{comboBest}x</Text>
            <Text style={styles.identityStatLabel}>Best Combo</Text>
          </View>
        </View>
      </Card>

      {/* ─── Badges (Mock for now) ─── */}
      <Card>
        <Text style={TEXT.overline}>BADGES</Text>
        <View style={styles.badgesRow}>
          <View style={styles.badgeItem}>
            <Text style={styles.badgeIcon}>⚡</Text>
            <Text style={styles.badgeLabel}>Charged Up</Text>
          </View>
          <View style={styles.badgeItemLocked}>
            <Text style={styles.badgeIcon}>🏅</Text>
            <Text style={[styles.badgeLabel, { color: COLORS.textMuted }]}>Week Warrior</Text>
          </View>
          <View style={styles.badgeItemLocked}>
            <Text style={styles.badgeIcon}>🔥</Text>
            <Text style={[styles.badgeLabel, { color: COLORS.textMuted }]}>Flame Keeper</Text>
          </View>
          <View style={styles.badgeItemLocked}>
            <Text style={styles.badgeIcon}>👑</Text>
            <Text style={[styles.badgeLabel, { color: COLORS.textMuted }]}>Monument</Text>
          </View>
        </View>
      </Card>

      {/* ─── Get Test Tokens ─── */}
      <Button
        title="Get Test Tokens"
        variant="ghost"
        onPress={() => {
          hapticButtonPress();
          playButtonTap();
          router.push("/faucet" as any);
        }}
      />

      {/* ─── Settings (Collapsible) ─── */}
      <TouchableOpacity
        style={styles.settingsToggle}
        onPress={() => {
          hapticButtonPress();
          playButtonTap();
          setShowSettings(!showSettings);
        }}
      >
        <Text style={styles.settingsToggleText}>
          {showSettings ? "Hide" : "Show"} Settings
        </Text>
        <Text style={styles.settingsToggleIcon}>
          {showSettings ? "▲" : "▼"}
        </Text>
      </TouchableOpacity>

      {showSettings && (
        <View style={styles.settingsSection}>
          <Card>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => {
                const next = !soundMuted;
                setSoundMuted(next);
                setMuted(next);
                hapticButtonPress();
                if (!next) playButtonTap();
              }}
            >
              <Text style={TEXT.bodySm}>Sound</Text>
              <Text style={[TEXT.bodySm, { color: soundMuted ? COLORS.textMuted : COLORS.gold, fontWeight: "600" }]}>
                {soundMuted ? "OFF" : "ON"}
              </Text>
            </TouchableOpacity>
          </Card>
          <Card>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => {
                const next = !hapticsMuted;
                setHapticsMuted(next);
                setHapticsEnabled(!next);
                if (!next) hapticButtonPress();
              }}
            >
              <Text style={TEXT.bodySm}>Haptics</Text>
              <Text style={[TEXT.bodySm, { color: hapticsMuted ? COLORS.textMuted : COLORS.gold, fontWeight: "600" }]}>
                {hapticsMuted ? "OFF" : "ON"}
              </Text>
            </TouchableOpacity>
          </Card>
          <Card>
            <View style={styles.cardRow}>
              <Text style={TEXT.bodySm}>Network</Text>
              <Text style={[TEXT.bodySm, { color: COLORS.gold, fontWeight: "600" }]}>
                {cluster.charAt(0).toUpperCase() + cluster.slice(1)}
              </Text>
            </View>
          </Card>
          <Card>
            <View style={styles.cardRow}>
              <Text style={TEXT.bodySm}>Version</Text>
              <Text style={[TEXT.bodySm, { fontWeight: "600" }]}>1.0.0 — Hackathon MVP</Text>
            </View>
          </Card>
          <Button
            title="Replay Onboarding"
            variant="secondary"
            onPress={() => {
              hapticButtonPress();
              playButtonTap();
              resetOnboarding();
              router.push("/(tabs)");
            }}
          />
          <Button
            title="Reset Tower (Dev)"
            variant="secondary"
            onPress={() => {
              Alert.alert(
                "Reset Tower",
                "This re-seeds all bot blocks. Your claimed blocks will be lost. Continue?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                      await resetTower();
                      Alert.alert("Done", "Tower re-seeded with fresh bots.");
                    },
                  },
                ],
              );
            }}
          />
          <Button
            title={isLoading ? "Disconnecting..." : "Disconnect Wallet"}
            variant="danger"
            onPress={handleDisconnect}
            disabled={isLoading}
          />
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  // ─── Empty ───
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

  // ─── Identity card ───
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.glassMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  identityInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  playerName: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 18,
    color: COLORS.text,
  },
  identityStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  identityStatItem: {
    alignItems: "center",
  },
  identityStatValue: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 18,
    color: COLORS.text,
  },
  identityStatLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  identityStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },

  // ─── Blocks grid ───
  emptyBlocks: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  emptyBlocksIcon: {
    fontSize: 32,
  },
  blocksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  blockCard: {
    ...GLASS_STYLE.muted,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  blockCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  blockColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  blockCardTitle: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    color: COLORS.text,
  },
  blockCardCharge: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "right",
  },

  // ─── Badges ───
  badgesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  badgeItem: {
    alignItems: "center",
    gap: 4,
  },
  badgeItemLocked: {
    alignItems: "center",
    gap: 4,
    opacity: 0.4,
  },
  badgeIcon: {
    fontSize: 24,
  },
  badgeLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },

  // ─── Settings ───
  settingsToggle: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  settingsToggleText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  settingsToggleIcon: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  settingsSection: {
    gap: SPACING.sm,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
