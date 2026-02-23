/**
 * Deposit Screen — Deposit USDC into the Monolith vault.
 *
 * Half-sheet (formSheet) so the 3D tower remains visible behind.
 * Route: app/deposit.tsx
 */

import { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Linking,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useStaking } from "@/hooks/useStaking";
import { useWalletStore } from "@/stores/wallet-store";
import { MIN_STAKE_UNITS, unitsToUsdc } from "@/services/monolith-program";
import {
    getAssociatedTokenAddress,
    getAccount,
} from "@solana/spl-token";
import { DEVNET_USDC_MINT } from "@/services/monolith-program";
import { connection } from "@/services/solana";
import { Button, Card, Input, Chip } from "@/components/ui";
import { TEXT, COLORS, SPACING, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress, hapticError, hapticBlockClaimed } from "@/utils/haptics";
import { playButtonTap, playError, playBlockClaim } from "@/utils/audio";

const MIN_USDC = unitsToUsdc(MIN_STAKE_UNITS); // 0.10

export default function DepositScreen() {
    const router = useRouter();
    const isConnected = useWalletStore((s) => s.isConnected);
    const publicKey = useWalletStore((s) => s.publicKey);
    const { deposit, isLoading, error, lastTxSignature } = useStaking();

    const [amount, setAmount] = useState("1.00");
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    const parsedAmount = parseFloat(amount) || 0;
    const isValidAmount = parsedAmount >= MIN_USDC;

    // Fetch wallet USDC balance
    const refreshBalance = useCallback(async () => {
        if (!publicKey) return;
        try {
            const ata = await getAssociatedTokenAddress(DEVNET_USDC_MINT, publicKey);
            const account = await getAccount(connection, ata);
            setWalletBalance(Number(account.amount) / 1_000_000);
        } catch {
            setWalletBalance(0);
        }
    }, [publicKey]);

    useEffect(() => {
        refreshBalance();
    }, [refreshBalance]);

    const handleDeposit = async () => {
        if (!isValidAmount) return;
        hapticButtonPress();
        playButtonTap();
        console.log("[DepositScreen] Starting deposit of", parsedAmount, "USDC");
        const sig = await deposit(parsedAmount);
        if (sig) {
            console.log("[DepositScreen] Deposit success:", sig);
            hapticBlockClaimed();
            playBlockClaim();
            refreshBalance();
        } else {
            console.log("[DepositScreen] Deposit returned null (failed)");
            hapticError();
            playError();
        }
    };

    const openExplorer = (sig: string) => {
        Linking.openURL(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    };

    const quickAmounts = [0.1, 0.5, 1.0, 5.0];

    // Success state
    if (lastTxSignature) {
        return (
            <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
                <Text style={styles.sheetTitle}>Fueled Up!</Text>
                <Text style={[TEXT.bodySm, styles.centered]}>
                    You deposited {parsedAmount.toFixed(2)} USDC into the vault.
                </Text>
                <TouchableOpacity onPress={() => openExplorer(lastTxSignature)} style={styles.fullWidth}>
                    <Card variant="accent">
                        <Text style={[TEXT.monoSm, { color: COLORS.gold, textAlign: "center" }]} numberOfLines={1} ellipsizeMode="middle">
                            View on Explorer
                        </Text>
                    </Card>
                </TouchableOpacity>
                <View style={styles.fullWidth}>
                    <Button title="Done" variant="primary" onPress={() => router.back()} />
                </View>
            </ScrollView>
        );
    }

    // Not connected guard
    if (!isConnected) {
        return (
            <View style={[styles.sheet, styles.sheetContent]}>
                <Text style={styles.sheetTitle}>Wallet Required</Text>
                <Text style={[TEXT.bodySm, styles.centered]}>
                    Connect your wallet before depositing USDC.
                </Text>
                <View style={styles.fullWidth}>
                    <Button
                        title="Connect Wallet"
                        variant="primary"
                        onPress={() => router.push("/connect")}
                    />
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.sheet}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>Add Fuel</Text>
                <Text style={[TEXT.bodySm, styles.centered]}>
                    Power your blocks on the tower.{"\n"}
                    Your funds earn yield while staked.
                </Text>

                {/* Wallet Balance */}
                {walletBalance !== null && (
                    <Card variant="accent" style={styles.fullWidth}>
                        <View style={styles.cardRow}>
                            <Text style={TEXT.bodySm}>Wallet Balance</Text>
                            <Text style={[TEXT.mono, { color: COLORS.success }]}>
                                {walletBalance.toFixed(2)} USDC
                            </Text>
                        </View>
                    </Card>
                )}

                {/* Amount Input */}
                <Input
                    label="DEPOSIT AMOUNT"
                    value={amount}
                    onChangeText={setAmount}
                    prefix="$"
                    suffix="USDC"
                    keyboardType="decimal-pad"
                    disabled={isLoading}
                    inputFontSize={28}
                    error={
                        !isValidAmount && amount.length > 0
                            ? `Minimum: ${MIN_USDC.toFixed(2)} USDC`
                            : undefined
                    }
                />

                {/* Quick amount buttons */}
                <View style={styles.chipRow}>
                    {quickAmounts.map((qa) => (
                        <Chip
                            key={qa}
                            label={qa < 1 ? `$${qa}` : `$${qa.toFixed(0)}`}
                            selected={parsedAmount === qa}
                            onPress={() => setAmount(qa.toFixed(2))}
                            disabled={isLoading}
                        />
                    ))}
                    {walletBalance !== null && walletBalance > 0 && (
                        <Chip
                            label="MAX"
                            selected={parsedAmount === walletBalance}
                            onPress={() => setAmount(walletBalance.toFixed(2))}
                            disabled={isLoading}
                        />
                    )}
                </View>

                {/* Summary card */}
                <Card variant="muted" style={styles.fullWidth}>
                    <View style={styles.cardRow}>
                        <Text style={TEXT.bodySm}>You deposit</Text>
                        <Text style={TEXT.mono}>{parsedAmount.toFixed(2)} USDC</Text>
                    </View>
                    <View style={[styles.cardRow, { marginTop: SPACING.sm }]}>
                        <Text style={TEXT.bodySm}>To vault</Text>
                        <Text style={[TEXT.mono, { color: COLORS.gold }]}>Monolith Vault</Text>
                    </View>
                </Card>

                {/* Error display */}
                {error && (
                    <Card variant="muted" style={styles.fullWidth}>
                        <View style={styles.errorRow}>
                            <Text style={styles.errorIcon}>!</Text>
                            <Text style={[TEXT.bodySm, { color: COLORS.error, flex: 1 }]}>
                                {error}
                            </Text>
                        </View>
                    </Card>
                )}

                {/* Deposit button */}
                <View style={styles.fullWidth}>
                    <Button
                        title={isLoading ? "Confirming..." : `Add ${parsedAmount.toFixed(2)} USDC Fuel`}
                        variant="primary"
                        onPress={handleDeposit}
                        disabled={!isValidAmount}
                        loading={isLoading}
                    />
                </View>

                <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => router.back()}
                    disabled={isLoading}
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    sheet: {
        flex: 1,
    },
    sheetContent: {
        alignItems: "center",
        gap: SPACING.md,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    sheetTitle: {
        ...TEXT.displaySm,
        textAlign: "center",
    },
    centered: {
        textAlign: "center",
        paddingHorizontal: SPACING.sm,
    },
    fullWidth: {
        width: "100%",
    },
    cardRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    chipRow: {
        flexDirection: "row",
        gap: SPACING.sm,
        flexWrap: "wrap",
        justifyContent: "center",
    },
    errorRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
    },
    errorIcon: {
        fontSize: 14,
        fontWeight: "700",
        color: COLORS.error,
    },
});
