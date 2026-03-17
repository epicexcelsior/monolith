/**
 * SeasonPassPanel — 8-week season progression with free and premium tracks.
 *
 * Two rows of reward nodes:
 * - Free track (top): 10 rewards, always unlocked when level reached
 * - Premium track (bottom): 20 rewards, locked behind $2.99 premium pass
 *
 * Current level indicator + progress bar. "UPGRADE" CTA for non-premium.
 */
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import BottomPanel from "@/components/ui/BottomPanel";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";
import { useSeasonStore } from "@/stores/season-store";
import type { SeasonReward } from "@/stores/season-store";

// Season 1 static data (matches server seasons.ts)
const SEASON_1_FREE: SeasonReward[] = [
  { id: "free_1", level: 1, type: "loot_crate", label: "Common Crate", icon: "📦" },
  { id: "free_2", level: 3, type: "xp_boost", label: "XP Boost", icon: "⚡" },
  { id: "free_3", level: 5, type: "streak_freeze", label: "Freeze", icon: "❄️" },
  { id: "free_4", level: 7, type: "loot_crate", label: "Common Crate", icon: "📦" },
  { id: "free_5", level: 10, type: "xp_boost", label: "XP Boost", icon: "⚡" },
  { id: "free_6", level: 13, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
  { id: "free_7", level: 16, type: "streak_freeze", label: "Freeze", icon: "❄️" },
  { id: "free_8", level: 19, type: "loot_crate", label: "Common Crate", icon: "📦" },
  { id: "free_9", level: 22, type: "xp_boost", label: "XP Boost", icon: "⚡" },
  { id: "free_10", level: 25, type: "badge", label: "Genesis Badge", icon: "🏅" },
];

const SEASON_1_PREMIUM: SeasonReward[] = [
  { id: "prem_1", level: 1, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
  { id: "prem_2", level: 2, type: "color", label: "Crimson Red", icon: "🔴" },
  { id: "prem_3", level: 4, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
  { id: "prem_4", level: 5, type: "streak_freeze", label: "Freeze ×2", icon: "❄️" },
  { id: "prem_5", level: 6, type: "emoji", label: "Crown", icon: "👑" },
  { id: "prem_6", level: 8, type: "loot_crate", label: "Epic Crate", icon: "💎" },
  { id: "prem_7", level: 9, type: "style", label: "Gold Frame", icon: "✨" },
  { id: "prem_8", level: 11, type: "color", label: "Void Black", icon: "⬛" },
  { id: "prem_9", level: 12, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
  { id: "prem_10", level: 14, type: "streak_freeze", label: "Freeze", icon: "❄️" },
  { id: "prem_11", level: 15, type: "loot_crate", label: "Epic Crate", icon: "💎" },
  { id: "prem_12", level: 17, type: "xp_boost", label: "XP 1.5x", icon: "⚡" },
  { id: "prem_13", level: 18, type: "emoji", label: "Fire", icon: "🔥" },
  { id: "prem_14", level: 20, type: "loot_crate", label: "Legendary", icon: "🌟" },
  { id: "prem_15", level: 21, type: "color", label: "Solar Gold", icon: "🌟" },
  { id: "prem_16", level: 22, type: "streak_freeze", label: "Freeze ×3", icon: "❄️" },
  { id: "prem_17", level: 23, type: "loot_crate", label: "Epic Crate", icon: "💎" },
  { id: "prem_18", level: 24, type: "style", label: "Holographic", icon: "🌈" },
  { id: "prem_19", level: 25, type: "badge", label: "Founder", icon: "🏆" },
  { id: "prem_20", level: 30, type: "badge", label: "Pillar", icon: "🗿" },
];

interface RewardNodeProps {
  reward: SeasonReward;
  unlocked: boolean;
  claimed: boolean;
  isPremium: boolean;
  premiumLocked: boolean;
}

function RewardNode({ reward, unlocked, claimed, premiumLocked }: RewardNodeProps) {
  const locked = !unlocked || premiumLocked;
  return (
    <View style={styles.nodeWrapper}>
      <View style={[
        styles.node,
        unlocked && !premiumLocked && styles.nodeUnlocked,
        claimed && styles.nodeClaimed,
        premiumLocked && styles.nodePremiumLocked,
      ]}>
        <Text style={[styles.nodeIcon, locked && styles.nodeIconLocked]}>
          {premiumLocked ? "🔒" : reward.icon}
        </Text>
      </View>
      <Text style={[styles.nodeLevel, locked && styles.nodeLevelLocked]}>
        Lv {reward.level}
      </Text>
      <Text style={[styles.nodeLabel, locked && styles.nodeLabelLocked]} numberOfLines={1}>
        {reward.label}
      </Text>
    </View>
  );
}

interface SeasonPassPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function SeasonPassPanel({ visible, onClose }: SeasonPassPanelProps) {
  const seasonLevel = useSeasonStore((s) => s.seasonLevel);
  const seasonLevelXP = useSeasonStore((s) => s.seasonLevelXP);
  const isPremium = useSeasonStore((s) => s.isPremium);
  const claimedRewards = useSeasonStore((s) => s.claimedRewards);

  const xpPerLevel = 100;
  const pct = Math.min((seasonLevelXP / xpPerLevel) * 100, 100);

  return (
    <BottomPanel visible={visible} onClose={onClose} height={480} title="Season 1 · Genesis" dark>
      <View style={styles.container}>
        {/* Level + XP bar */}
        <View style={styles.levelRow}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelNum}>{seasonLevel}</Text>
            <Text style={styles.levelLabel}>LVL</Text>
          </View>
          <View style={styles.xpSection}>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${pct}%` as any }]} />
            </View>
            <Text style={styles.xpText}>{seasonLevelXP} / {xpPerLevel} XP to next level</Text>
          </View>
        </View>

        {/* Free track */}
        <View style={styles.trackSection}>
          <Text style={styles.trackLabel}>FREE TRACK</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.trackRow}>
              {SEASON_1_FREE.map((r) => (
                <RewardNode
                  key={r.id}
                  reward={r}
                  unlocked={seasonLevel >= r.level}
                  claimed={claimedRewards.includes(r.id)}
                  isPremium={isPremium}
                  premiumLocked={false}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Premium track */}
        <View style={styles.trackSection}>
          <View style={styles.premiumTrackHeader}>
            <Text style={styles.trackLabel}>PREMIUM TRACK</Text>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.trackRow}>
              {SEASON_1_PREMIUM.map((r) => (
                <RewardNode
                  key={r.id}
                  reward={r}
                  unlocked={seasonLevel >= r.level}
                  claimed={claimedRewards.includes(r.id)}
                  isPremium={isPremium}
                  premiumLocked={!isPremium}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Upgrade CTA */}
        {!isPremium && (
          <TouchableOpacity style={styles.upgradeButton} onPress={() => {/* TODO: trigger USDC purchase */}}>
            <Text style={styles.upgradeIcon}>⭐</Text>
            <Text style={styles.upgradeText}>UPGRADE TO PREMIUM — $2.99 USDC</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.seasonEnd}>Season ends May 11, 2026</Text>
      </View>
    </BottomPanel>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },

  // Level row
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  levelBadge: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 1,
    borderColor: COLORS.goldAccentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  levelNum: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 20,
    color: COLORS.goldLight,
    lineHeight: 22,
  },
  levelLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  xpSection: {
    flex: 1,
    gap: 4,
  },
  xpTrack: {
    height: 6,
    backgroundColor: COLORS.hudBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },
  xpText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Tracks
  trackSection: {
    gap: SPACING.xs,
  },
  trackLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  premiumTrackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  premiumBadge: {
    backgroundColor: COLORS.goldSubtle,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.goldAccentDim,
  },
  premiumBadgeText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  trackRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },

  // Reward nodes
  nodeWrapper: {
    alignItems: "center",
    width: 60,
    gap: 2,
  },
  node: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.hudGlass,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeUnlocked: {
    borderColor: COLORS.goldAccentDim,
    backgroundColor: COLORS.goldSubtle,
  },
  nodeClaimed: {
    borderColor: COLORS.gold,
    backgroundColor: "rgba(212, 168, 71, 0.15)",
  },
  nodePremiumLocked: {
    opacity: 0.4,
  },
  nodeIcon: {
    fontSize: 20,
  },
  nodeIconLocked: {
    opacity: 0.5,
  },
  nodeLevel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    color: COLORS.goldLight,
    letterSpacing: 0.5,
  },
  nodeLevelLocked: {
    color: COLORS.textMuted,
  },
  nodeLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 9,
    color: COLORS.inspectorTextSecondary,
    textAlign: "center",
  },
  nodeLabelLocked: {
    color: COLORS.hudBorder,
  },

  // Upgrade CTA
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gold,
  },
  upgradeIcon: {
    fontSize: 16,
  },
  upgradeText: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 13,
    color: COLORS.textOnGold,
    letterSpacing: 0.5,
  },

  seasonEnd: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});
