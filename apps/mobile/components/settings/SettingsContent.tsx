/**
 * SettingsContent — Dark-themed profile + settings for use inside SettingsSheet.
 *
 * Extracts the core content from settings.tsx (Me screen) into a reusable component
 * that renders well on a dark glass background (inside BottomPanel dark mode).
 */
import { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useTowerStore } from "@/stores/tower-store";
import { usePlayerStore } from "@/stores/player-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import XPBar from "@/components/ui/XPBar";
import { COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { hapticButtonPress, setHapticsEnabled, isHapticsEnabled } from "@/utils/haptics";
import { playButtonTap, playToggle, setMuted, isMuted } from "@/utils/audio";
import { getClusterName } from "@/services/mwa";
import { useTapestryStore } from "@/stores/tapestry-store";

interface SettingsContentProps {
  onClose?: () => void;
}

export default function SettingsContent({ onClose }: SettingsContentProps) {
  const router = useRouter();
  const { disconnect } = useAuthorization();
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLoading = useWalletStore((s) => s.isLoading);
  const publicKey = useWalletStore((s) => s.publicKey);
  const truncatedAddress = useTruncatedAddress();
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const resetTower = useTowerStore((s) => s.resetTower);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const username = usePlayerStore((s) => s.username);
  const xp = usePlayerStore((s) => s.xp);
  const level = usePlayerStore((s) => s.level);
  const totalClaims = usePlayerStore((s) => s.totalClaims);
  const totalCharges = usePlayerStore((s) => s.totalCharges);
  const cluster = getClusterName();
  const socialCounts = useTapestryStore((s) => s.socialCounts);

  const [soundMuted, setSoundMuted] = useState(isMuted());
  const [hapticsMuted, setHapticsMuted] = useState(!isHapticsEnabled());

  const myBlocks = publicKey
    ? demoBlocks.filter((b) => b.owner === publicKey.toBase58())
    : [];
  const totalEnergy = myBlocks.length > 0
    ? Math.round(myBlocks.reduce((sum, b) => sum + b.energy, 0) / myBlocks.length)
    : 0;
  const bestStreak = myBlocks.reduce((max, b) => Math.max(max, b.streak ?? 0), 0);

  const handleDisconnect = useCallback(() => {
    Alert.alert("Disconnect Wallet", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect", style: "destructive",
        onPress: async () => { try { await disconnect(); } catch {} },
      },
    ]);
  }, [disconnect]);

  if (!isConnected) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👤</Text>
        <Text style={styles.emptyTitle}>Who Are You?</Text>
        <Text style={styles.emptyText}>Connect your wallet to see your profile.</Text>
        <TouchableOpacity style={styles.connectButton} onPress={() => useWalletStore.getState().setShowConnectSheet(true)}>
          <Text style={styles.connectButtonText}>Connect Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Identity */}
      <View style={styles.identityRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>🗿</Text>
        </View>
        <View style={styles.identityInfo}>
          <Text style={styles.playerName}>{username || `Keeper ${truncatedAddress}`}</Text>
          <View style={styles.connectedBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.connectedText}>Connected</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{myBlocks.length}</Text>
          <Text style={styles.statLabel}>Blocks</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalEnergy}%</Text>
          <Text style={styles.statLabel}>Avg Charge</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{bestStreak > 0 ? `Day ${bestStreak}` : "—"}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      {/* XP */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EXPERIENCE</Text>
        <XPBar xp={xp} level={level} size="md" />
        <View style={styles.xpStats}>
          <Text style={styles.xpStatText}>{totalClaims} claims</Text>
          <Text style={styles.xpStatDot}>·</Text>
          <Text style={styles.xpStatText}>{totalCharges} charges</Text>
        </View>
      </View>

      {/* Social stats (Tapestry) */}
      {socialCounts && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SOCIAL</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{socialCounts.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{socialCounts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>
      )}

      {/* Settings toggles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SETTINGS</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            const next = !soundMuted;
            if (!next) playToggle();
            setSoundMuted(next);
            setMuted(next);
            hapticButtonPress();
          }}
        >
          <Text style={styles.settingLabel}>Sound</Text>
          <Text style={[styles.settingValue, { color: soundMuted ? COLORS.textMuted : COLORS.gold }]}>
            {soundMuted ? "OFF" : "ON"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            const next = !hapticsMuted;
            setHapticsMuted(next);
            setHapticsEnabled(!next);
            playToggle();
            if (!next) hapticButtonPress();
          }}
        >
          <Text style={styles.settingLabel}>Haptics</Text>
          <Text style={[styles.settingValue, { color: hapticsMuted ? COLORS.textMuted : COLORS.gold }]}>
            {hapticsMuted ? "OFF" : "ON"}
          </Text>
        </TouchableOpacity>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Network</Text>
          <Text style={[styles.settingValue, { color: COLORS.gold }]}>
            {cluster.charAt(0).toUpperCase() + cluster.slice(1)}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => { hapticButtonPress(); playButtonTap(); router.push("/faucet" as any); }}
        >
          <Text style={styles.actionButtonText}>Get Test Tokens</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            hapticButtonPress();
            playButtonTap();
            resetOnboarding();
            onClose?.();
            router.push("/(tabs)");
          }}
        >
          <Text style={styles.actionButtonText}>Replay Onboarding</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleDisconnect}
          disabled={isLoading}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>
            {isLoading ? "Disconnecting..." : "Disconnect Wallet"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.lg, gap: SPACING.lg },

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

  // Identity
  identityRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  avatarEmoji: { fontSize: 24 },
  identityInfo: { flex: 1, gap: 4 },
  playerName: { fontFamily: FONT_FAMILY.headingSemibold, fontSize: 16, color: COLORS.textOnDark },
  connectedBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  connectedText: { fontFamily: FONT_FAMILY.bodySemibold, fontSize: 12, color: COLORS.success },

  // Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADIUS.md,
  },
  statItem: { alignItems: "center" },
  statValue: { fontFamily: FONT_FAMILY.headingSemibold, fontSize: 16, color: COLORS.textOnDark },
  statLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.08)" },

  // Sections
  section: { gap: SPACING.sm },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // XP
  xpStats: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, justifyContent: "center" },
  xpStatText: { fontFamily: FONT_FAMILY.bodySemibold, fontSize: 12, color: COLORS.textMuted },
  xpStatDot: { fontFamily: FONT_FAMILY.body, fontSize: 12, color: COLORS.textMuted },

  // Settings rows
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADIUS.sm,
  },
  settingLabel: { fontFamily: FONT_FAMILY.body, fontSize: 14, color: COLORS.textOnDark },
  settingValue: { fontFamily: FONT_FAMILY.bodySemibold, fontSize: 14 },

  // Action buttons
  actionButton: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  actionButtonText: { fontFamily: FONT_FAMILY.bodySemibold, fontSize: 14, color: COLORS.textOnDark },
  dangerButton: { backgroundColor: "rgba(196, 64, 42, 0.15)" },
  dangerText: { color: COLORS.error },
});
