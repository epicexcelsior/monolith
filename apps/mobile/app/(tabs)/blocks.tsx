/**
 * Vault screen — Shows user's vault deposit details and transaction history.
 *
 * Displays vault balance, deposit/withdraw actions, and on-chain stats.
 * Tab route: app/(tabs)/blocks.tsx → renamed to "Vault"
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useStaking, type TowerInfo, type UserDepositInfo } from "@/hooks/useStaking";
import {
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { DEVNET_USDC_MINT } from "@/services/monolith-program";
import { connection } from "@/services/solana";

export default function VaultScreen() {
  const router = useRouter();
  const isConnected = useWalletStore((s) => s.isConnected);
  const publicKey = useWalletStore((s) => s.publicKey);
  const truncatedAddress = useTruncatedAddress();
  const { fetchTowerState, fetchUserDeposit } = useStaking();

  const [towerInfo, setTowerInfo] = useState<TowerInfo | null>(null);
  const [userDeposit, setUserDeposit] = useState<UserDepositInfo | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    const [tower, deposit] = await Promise.all([
      fetchTowerState(),
      fetchUserDeposit(),
    ]);
    if (tower) setTowerInfo(tower);
    setUserDeposit(deposit);

    // Fetch wallet USDC balance
    if (publicKey) {
      try {
        const ata = await getAssociatedTokenAddress(DEVNET_USDC_MINT, publicKey);
        const account = await getAccount(connection, ata);
        setWalletBalance(Number(account.amount) / 1_000_000);
      } catch {
        setWalletBalance(0);
      }
    }
  }, [fetchTowerState, fetchUserDeposit, publicKey]);

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

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>Connect Wallet</Text>
          <Text style={styles.emptySubtitle}>
            Connect your wallet to view your vault balance.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/connect")}
          >
            <Text style={styles.primaryButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const vaultAmount = userDeposit?.amount ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#00ffff"
        />
      }
    >
      {/* Header */}
      <Text style={styles.screenTitle}>My Vault</Text>
      <Text style={styles.screenSubtitle}>{truncatedAddress}</Text>

      {/* Vault Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>VAULT BALANCE</Text>
        <Text style={styles.balanceAmount}>
          ${vaultAmount.toFixed(2)}
        </Text>
        <Text style={styles.balanceSuffix}>USDC</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.depositButton}
          onPress={() => router.push("/deposit" as any)}
        >
          <Text style={styles.depositIcon}>↗</Text>
          <Text style={styles.depositText}>Deposit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.withdrawButton}
          onPress={() => router.push("/withdraw" as any)}
        >
          <Text style={styles.withdrawIcon}>↙</Text>
          <Text style={styles.withdrawText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>DETAILS</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Wallet USDC</Text>
          <Text style={styles.detailValue}>
            {walletBalance !== null
              ? `${walletBalance.toFixed(2)} USDC`
              : "Loading..."}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Vault Deposit</Text>
          <Text style={[styles.detailValue, { color: "#00ffff" }]}>
            {vaultAmount.toFixed(2)} USDC
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Last Deposit</Text>
          <Text style={styles.detailValue}>
            {userDeposit?.lastDepositAt
              ? new Date(userDeposit.lastDepositAt * 1000).toLocaleString()
              : "Never"}
          </Text>
        </View>
      </View>

      {/* Global Stats */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>VAULT STATS</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Value Locked</Text>
          <Text style={styles.detailValue}>
            {towerInfo
              ? `$${towerInfo.totalDeposited.toFixed(2)}`
              : "Loading..."}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Depositors</Text>
          <Text style={styles.detailValue}>
            {towerInfo ? towerInfo.totalUsers.toString() : "Loading..."}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  screenTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
  },
  screenSubtitle: {
    color: "#666680",
    fontSize: 13,
    fontFamily: "monospace",
    marginBottom: 24,
  },
  // Balance Card
  balanceCard: {
    backgroundColor: "rgba(0,255,255,0.06)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.15)",
  },
  balanceLabel: {
    color: "#666680",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 8,
  },
  balanceAmount: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  balanceSuffix: {
    color: "#00ffff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 2,
    marginTop: 4,
  },
  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  depositButton: {
    flex: 1,
    backgroundColor: "#00ffff",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  depositIcon: {
    fontSize: 18,
    color: "#0a0a0f",
    fontWeight: "900",
  },
  depositText: {
    color: "#0a0a0f",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  withdrawButton: {
    flex: 1,
    backgroundColor: "transparent",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ff9500",
  },
  withdrawIcon: {
    fontSize: 18,
    color: "#ff9500",
    fontWeight: "900",
  },
  withdrawText: {
    color: "#ff9500",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  // Details Card
  detailsCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailsTitle: {
    color: "#666680",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  detailLabel: {
    color: "#888899",
    fontSize: 14,
  },
  detailValue: {
    color: "#ccccdd",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 8,
  },
  // Empty state
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#888899",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#00ffff",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#0a0a0f",
    fontSize: 16,
    fontWeight: "800",
  },
});
