import { useCallback, useEffect, useState } from "react";
import { useTowerStore, getStreakMultiplier } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useMultiplayerStore, onChargeResult, onClaimResult, onCustomizeResult, onPokeResult } from "@/stores/multiplayer-store";
import type { ChargeResult, ClaimResult, CustomizeResult, PokeResult } from "@/stores/multiplayer-store";
import { usePokeStore } from "@/stores/poke-store";
import { usePlayerStore } from "@/stores/player-store";
import { useStaking } from "@/hooks/useStaking";
import { useClaimCelebration } from "@/hooks/useClaimCelebration";
import { ENERGY_THRESHOLDS } from "@monolith/common";
import type { BlockState } from "@monolith/common";
import { COLORS } from "@/constants/theme";
import {
  hapticBlockDeselect,
  hapticButtonPress,
  hapticError,
  hapticBlockClaimed,
  hapticChargeTap,
  hapticCustomize,
  hapticStreakMilestone,
} from "@/utils/haptics";
import {
  playChargeTap,
  playBlockDeselect,
  playBlockClaim,
  playStreakMilestone,
  playError,
  playCustomize,
  playButtonTap,
  playPokeSend,
  playPokeReceive,
} from "@/utils/audio";
import { createContent, ensureBlockContent } from "@/utils/tapestry";
import { useTapestryStore } from "@/stores/tapestry-store";
import { submitScore, unlockAchievement } from "@/utils/soar";
import { PublicKey } from "@solana/web3.js";

/** Fire-and-forget Tapestry content creation. Never blocks gameplay. */
function postTapestryContent(
  text: string,
  customProps: { key: string; value: string }[],
): void {
  const profileId = useTapestryStore.getState().profileId;
  if (!profileId) return;
  createContent(profileId, text, customProps).catch(console.warn);
}

/** Fire-and-forget ensure canonical block content (deterministic ID for likes/comments). */
function postBlockContent(
  blockId: string,
  text: string,
  properties: { key: string; value: string }[],
): void {
  const profileId = useTapestryStore.getState().profileId;
  if (!profileId) return;
  ensureBlockContent(profileId, blockId, text, properties).catch(console.warn);
}

/** Fire-and-forget SOAR score submission. Never blocks gameplay. */
function recordSoarScore(wallet: string, totalXp: number): void {
  try {
    if (__DEV__) console.log("[SOAR] recordSoarScore called:", totalXp, "XP for", wallet.slice(0, 8));
    const pk = new PublicKey(wallet);
    submitScore(pk, totalXp).catch(console.warn);
  } catch { /* invalid pubkey in demo mode */ }
}

/** Fire-and-forget SOAR achievement unlock. Never blocks gameplay. */
function recordSoarAchievement(wallet: string, achievementId: string): void {
  try {
    const pk = new PublicKey(wallet);
    unlockAchievement(pk, achievementId).catch(console.warn);
  } catch { /* invalid pubkey in demo mode */ }
}

export function getBlockState(energy: number): BlockState {
  if (energy >= ENERGY_THRESHOLDS.blazing) return "blazing";
  if (energy >= ENERGY_THRESHOLDS.thriving) return "thriving";
  if (energy >= ENERGY_THRESHOLDS.fading) return "fading";
  if (energy >= ENERGY_THRESHOLDS.dying) return "dying";
  return "dead";
}

export function stateColor(state: BlockState): string {
  const map: Record<string, string> = {
    blazing: COLORS.blazing,
    thriving: COLORS.thriving,
    fading: COLORS.fading,
    dying: COLORS.flickering,
    dead: COLORS.dormant,
    flickering: COLORS.flickering,
    dormant: COLORS.dormant,
  };
  return map[state] ?? COLORS.textMuted;
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

export function formatUsdc(lamports: number): string {
  return `${(lamports / 1_000_000).toFixed(2)} USDC`;
}

const DORMANT_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

export function useBlockActions() {
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const claimBlock = useTowerStore((s) => s.claimBlock);
  const chargeBlock = useTowerStore((s) => s.chargeBlock);
  const customizeBlock = useTowerStore((s) => s.customizeBlock);
  const publicKey = useWalletStore((s) => s.publicKey);
  const isWalletConnected = useWalletStore((s) => s.isConnected);
  const { deposit } = useStaking();
  const { triggerCelebration } = useClaimCelebration();
  const getStoreState = useTowerStore.getState;
  const mpConnected = useMultiplayerStore((s) => s.connected && !s.reconnecting);
  const sendClaim = useMultiplayerStore((s) => s.sendClaim);
  const sendCharge = useMultiplayerStore((s) => s.sendCharge);
  const sendCustomize = useMultiplayerStore((s) => s.sendCustomize);
  const sendPoke = useMultiplayerStore((s) => s.sendPoke);
  const canPoke = usePokeStore((s) => s.canPoke);
  const recordPoke = usePokeStore((s) => s.recordPoke);
  const recentlyClaimedId = useTowerStore((s) => s.recentlyClaimedId);
  const ghostClaimBlock = useTowerStore((s) => s.ghostClaimBlock);

  // Onboarding state
  const onboardingPhase = useOnboardingStore((s) => s.phase);
  const advanceOnboarding = useOnboardingStore((s) => s.advancePhase);
  const isOnboardingClaim = onboardingPhase === "claim";

  const [cooldownText, setCooldownText] = useState<string | null>(null);
  const [pokeStatus, setPokeStatus] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);

  const block = selectedBlockId ? getDemoBlockById(selectedBlockId) : null;
  const isOwner = block?.owner && publicKey
    ? block.owner === publicKey.toBase58()
    : false;
  const isUnclaimed = block ? block.owner === null : false;
  const isDormant = block && !isUnclaimed && !isOwner && block.owner
    && block.energy === 0
    && block.lastChargeTime
    && (Date.now() - block.lastChargeTime) > DORMANT_THRESHOLD_MS;

  const state = block ? getBlockState(block.energy) : "dead";
  const energyPct = block ? Math.min(100, Math.max(0, block.energy)) : 0;
  const streak = block?.streak ?? 0;
  const multiplier = getStreakMultiplier(streak);

  // Handle claim
  const handleClaim = useCallback(async (amount: number, color: string) => {
    if (!publicKey || !selectedBlockId) throw new Error("Wallet not connected");
    const sig = await deposit(amount);
    if (!sig) throw new Error("Transaction failed or rejected");

    const wallet = publicKey.toBase58();
    if (mpConnected) {
      sendClaim({ blockId: selectedBlockId, wallet, amount: amount * 1_000_000, color });
    } else {
      claimBlock(selectedBlockId, wallet, amount * 1_000_000, color);
      hapticBlockClaimed();
      playBlockClaim();
      const blocks = useTowerStore.getState().demoBlocks;
      const isFirst = !blocks.some((b) => b.owner === wallet && b.id !== selectedBlockId);
      const pts = isFirst ? 300 : 100;
      const pStore = usePlayerStore.getState();
      pStore.addPoints({ pointsEarned: pts, totalXp: pStore.xp + pts, level: pStore.level });

      // SOAR: submit score + first claim achievement (offline)
      recordSoarScore(wallet, pStore.xp + pts);
      if (isFirst) recordSoarAchievement(wallet, "first_claim");

      // Tapestry: ensure canonical block content (offline)
      const ob = useTowerStore.getState().demoBlocks.find((b) => b.id === selectedBlockId);
      postBlockContent(
        selectedBlockId,
        `Claimed Block #${selectedBlockId} on Layer ${ob?.layer ?? "?"}!`,
        [
          { key: "type", value: "block_claim" },
          { key: "blockId", value: selectedBlockId },
          { key: "layer", value: String(ob?.layer ?? 0) },
        ],
      );
    }
    const { demoBlocks } = getStoreState();
    const claimedBlock = demoBlocks.find((b) => b.id === selectedBlockId);
    if (claimedBlock) {
      const walletStr = publicKey!.toBase58();
      const isFirst = !demoBlocks.some((b) => b.owner === walletStr && b.id !== selectedBlockId);
      triggerCelebration(claimedBlock.position, -1, isFirst, selectedBlockId);
    }
  }, [publicKey, selectedBlockId, deposit, claimBlock, mpConnected, sendClaim, triggerCelebration, getStoreState]);

  // Handle onboarding ghost claim (no wallet needed)
  const handleOnboardingClaim = useCallback(() => {
    if (!selectedBlockId) return;
    ghostClaimBlock(selectedBlockId);
    const block = getDemoBlockById(selectedBlockId);
    if (block) triggerCelebration(block.position, -1, true, selectedBlockId);
    advanceOnboarding();
  }, [selectedBlockId, ghostClaimBlock, getDemoBlockById, triggerCelebration, advanceOnboarding]);

  // Handle charge
  const setRecentlyChargedId = useTowerStore((s) => s.setRecentlyChargedId);

  const handleCharge = useCallback(() => {
    if (!selectedBlockId) return;
    hapticChargeTap();

    if (mpConnected) {
      const wallet = publicKey?.toBase58() || "";
      sendCharge({ blockId: selectedBlockId, wallet });
      playChargeTap();
    } else {
      const result = chargeBlock(selectedBlockId);
      if (!result.success && result.cooldownRemaining) {
        const secs = Math.ceil(result.cooldownRemaining / 1000);
        setCooldownText(`Wait ${secs}s`);
        setTimeout(() => setCooldownText(null), 2000);
        hapticError();
        playError();
      } else if (result.success) {
        playChargeTap();
        // Trigger 3D charge flash (pass quality for visual intensity)
        setRecentlyChargedId(selectedBlockId, result.chargeQuality);
        if (result.streak && [3, 7, 14, 30].includes(result.streak)) {
          hapticStreakMilestone();
          playStreakMilestone();
        }
        // Daily first-charge bonus
        const store = usePlayerStore.getState();
        const isFirstToday = store.isFirstChargeToday();
        const pts = isFirstToday ? 50 : 25;
        const label = isFirstToday ? "Daily Charge \u2713" : undefined;
        store.addPoints({
          pointsEarned: pts,
          totalXp: store.xp + pts,
          level: store.level,
          label,
          chargeAmount: result.chargeAmount,
          chargeQuality: result.chargeQuality,
        });
        if (isFirstToday) {
          store.markChargeToday();
          hapticStreakMilestone();
        }
        // SOAR: submit score + streak achievement (offline)
        const walletAddr = publicKey?.toBase58();
        if (walletAddr) {
          recordSoarScore(walletAddr, store.xp + pts);
          if (result.streak && [3, 7, 14, 30].includes(result.streak)) {
            recordSoarAchievement(walletAddr, `streak_${result.streak}`);
          }
        }

        // Tapestry: post charge content (offline)
        postTapestryContent(
          `Charged Block #${selectedBlockId} — Day ${result.streak ?? 1} streak!`,
          [
            { key: "type", value: "charge" },
            { key: "blockId", value: selectedBlockId },
            { key: "streak", value: String(result.streak ?? 1) },
          ],
        );
      }
    }
  }, [selectedBlockId, chargeBlock, mpConnected, sendCharge, setRecentlyChargedId, publicKey]);

  // Handle poke
  const handlePoke = useCallback(() => {
    if (!selectedBlockId || !publicKey || !mpConnected) return;
    if (!canPoke(selectedBlockId)) {
      setPokeStatus("Already poked today");
      setTimeout(() => setPokeStatus(null), 3000);
      hapticError();
      playError();
      return;
    }
    hapticButtonPress();
    playPokeSend();
    sendPoke({ blockId: selectedBlockId, wallet: publicKey.toBase58() });
  }, [selectedBlockId, publicKey, mpConnected, canPoke, sendPoke]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    hapticBlockDeselect();
    playBlockDeselect();
    selectBlock(null);
  }, [selectBlock]);

  // Customize helpers
  const applyCustomize = useCallback((changes: { color?: string; emoji?: string; name?: string; style?: number; textureId?: number }) => {
    if (!selectedBlockId) return;
    if (mpConnected) {
      const wallet = publicKey?.toBase58() || "";
      sendCustomize({ blockId: selectedBlockId, wallet, changes });
    } else {
      customizeBlock(selectedBlockId, changes);
    }
  }, [selectedBlockId, mpConnected, sendCustomize, customizeBlock]);

  const handleStyleChange = useCallback((style: number) => {
    applyCustomize({ style });
    hapticCustomize();
    playCustomize();
  }, [applyCustomize]);

  const handleColorChange = useCallback((color: string) => {
    applyCustomize({ color });
  }, [applyCustomize]);

  const handleEmojiChange = useCallback((emoji: string) => {
    applyCustomize({ emoji });
  }, [applyCustomize]);

  const handleNameSubmit = useCallback((name: string) => {
    if (!name.trim()) return;
    applyCustomize({ name: name.trim().slice(0, 12) });
  }, [applyCustomize]);

  const handleTextureChange = useCallback((textureId: number) => {
    applyCustomize({ textureId });
    hapticCustomize();
    playCustomize();
  }, [applyCustomize]);

  const handleImageUpload = useCallback(async () => {
    if (!selectedBlockId) return;
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const imageUri = result.assets[0].uri;
      hapticCustomize();
      playCustomize();

      // Resize to 512x512 before uploading
      const ImageManipulator = await import("expo-image-manipulator");
      const resized = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.WEBP },
      );

      // Read file as base64
      const FileSystem = await import("expo-file-system");
      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to server as JSON (avoids need for multer on server)
      const { GAME_SERVER_URL } = await import("@/constants/network");
      const serverUrl = GAME_SERVER_URL.replace("wss://", "https://").replace("ws://", "http://");
      const wallet = publicKey?.toBase58() || "";

      const response = await fetch(`${serverUrl}/api/blocks/${selectedBlockId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, image: base64 }),
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      if (data.imageUrl) {
        customizeBlock(selectedBlockId, { imageUrl: data.imageUrl });
      }
    } catch (err) {
      console.warn("[ImageUpload] Failed:", err);
      hapticError();
      playError();
    }
  }, [selectedBlockId, publicKey, customizeBlock]);

  // Listen for server results
  useEffect(() => {
    if (!mpConnected) return;
    onChargeResult((result: ChargeResult) => {
      if (!result.success && result.cooldownRemaining) {
        const secs = Math.ceil(result.cooldownRemaining / 1000);
        setCooldownText(`Wait ${secs}s`);
        setTimeout(() => setCooldownText(null), 2000);
        hapticError();
        playError();
      } else if (result.success) {
        if (result.streak && [3, 7, 14, 30].includes(result.streak)) {
          hapticStreakMilestone();
          playStreakMilestone();
        }
        if (result.pointsEarned) {
          usePlayerStore.getState().addPoints({
            pointsEarned: result.pointsEarned,
            combo: result.combo,
            totalXp: result.totalXp,
            level: result.level,
            levelUp: result.levelUp,
            chargeAmount: result.chargeAmount,
            chargeQuality: result.chargeQuality,
          });
        }
        // SOAR: submit score + streak achievement (multiplayer)
        const wallet = useWalletStore.getState().publicKey?.toBase58();
        if (wallet && result.totalXp != null) {
          recordSoarScore(wallet, result.totalXp);
          if (result.streak && [3, 7, 14, 30].includes(result.streak)) {
            recordSoarAchievement(wallet, `streak_${result.streak}`);
          }
        }

        // Tapestry: post charge content (multiplayer)
        const chargedBlockId = useTowerStore.getState().selectedBlockId;
        if (chargedBlockId) {
          postTapestryContent(
            `Charged Block #${chargedBlockId} — Day ${result.streak ?? 1} streak!`,
            [
              { key: "type", value: "charge" },
              { key: "blockId", value: chargedBlockId },
              { key: "streak", value: String(result.streak ?? 1) },
            ],
          );
        }
      }
    });

    onClaimResult((result: ClaimResult) => {
      if (result.success && result.pointsEarned) {
        usePlayerStore.getState().addPoints({
          pointsEarned: result.pointsEarned,
          combo: result.combo,
          totalXp: result.totalXp,
          level: result.level,
          levelUp: result.levelUp,
        });
      }
      // SOAR: submit score + first claim achievement (multiplayer)
      if (result.success && result.totalXp != null) {
        const wallet = useWalletStore.getState().publicKey?.toBase58();
        if (wallet) {
          recordSoarScore(wallet, result.totalXp);
          // Check first block: no other blocks owned by this wallet
          const blocks = useTowerStore.getState().demoBlocks;
          const isFirstBlock = !blocks.some((b) => b.owner === wallet && b.id !== result.blockId);
          if (isFirstBlock) recordSoarAchievement(wallet, "first_claim");
        }
      }

      // Tapestry: ensure canonical block content (multiplayer)
      if (result.success && result.blockId) {
        const b = useTowerStore.getState().demoBlocks.find((d) => d.id === result.blockId);
        postBlockContent(
          result.blockId,
          `Claimed Block #${result.blockId} on Layer ${b?.layer ?? "?"}!`,
          [
            { key: "type", value: "block_claim" },
            { key: "blockId", value: result.blockId },
            { key: "layer", value: String(b?.layer ?? 0) },
          ],
        );
      }
    });

    onCustomizeResult((_result: CustomizeResult) => {
      // XP from customization removed — was farmable by repeated color changes
    });

    onPokeResult((result: PokeResult) => {
      if (result.success) {
        if (result.blockId) recordPoke(result.blockId);
        setPokeStatus(`Poked! +${result.energyAdded ?? 10}% energy sent`);
        playPokeReceive();
        // Tapestry: post poke content only on confirmed success
        if (result.blockId) {
          const pokedBlock = useTowerStore.getState().demoBlocks.find((b) => b.id === result.blockId);
          const ownerDisplay = pokedBlock?.owner ? truncateAddress(pokedBlock.owner) : "someone";
          postTapestryContent(
            `Poked ${ownerDisplay}'s Block #${result.blockId}!`,
            [
              { key: "type", value: "poke" },
              { key: "blockId", value: result.blockId },
            ],
          );
        }
        if (result.pointsEarned) {
          usePlayerStore.getState().addPoints({
            pointsEarned: result.pointsEarned,
            combo: result.combo,
            totalXp: result.totalXp,
            level: result.level,
            levelUp: result.levelUp,
          });
        }
        // SOAR: submit score (multiplayer poke)
        if (result.totalXp != null) {
          const pokeWallet = useWalletStore.getState().publicKey?.toBase58();
          if (pokeWallet) recordSoarScore(pokeWallet, result.totalXp);
        }
      } else {
        setPokeStatus("Already poked today");
      }
      setTimeout(() => setPokeStatus(null), 3000);
    });
  }, [mpConnected, recordPoke]);

  // Reset state when panel closes
  const resetPanelState = useCallback(() => {
    setShowClaimModal(false);
    setPokeStatus(null);
  }, []);

  return {
    // Block data
    block,
    selectedBlockId,
    isOwner,
    isUnclaimed,
    isDormant,
    state,
    energyPct,
    streak,
    multiplier,
    recentlyClaimedId,
    // Wallet
    isWalletConnected,
    mpConnected,
    // UI state
    cooldownText,
    pokeStatus,
    showClaimModal,
    setShowClaimModal,
    // Onboarding
    isOnboardingClaim,
    handleOnboardingClaim,
    // Actions
    handleClaim,
    handleCharge,
    handlePoke,
    handleDismiss,
    handleStyleChange,
    handleColorChange,
    handleEmojiChange,
    handleNameSubmit,
    handleTextureChange,
    handleImageUpload,
    resetPanelState,
    canPoke,
  };
}
