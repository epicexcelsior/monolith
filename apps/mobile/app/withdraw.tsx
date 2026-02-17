/**
 * Withdraw Screen — Withdraw USDC from the Monolith vault.
 *
 * Half-sheet (formSheet) so the 3D tower remains visible behind.
 * Route: app/withdraw.tsx
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
import { useStaking, type UserDepositInfo } from "@/hooks/useStaking";
import { useWalletStore } from "@/stores/wallet-store";
import { Button, Card, Input, Chip } from "@/components/ui";
import { TEXT, COLORS, SPACING } from "@/constants/theme";
import { hapticButtonPress, hapticError, hapticBlockClaimed } from "@/utils/haptics";

export default function WithdrawScreen() {
    const router = useRouter();
    const isConnected = useWalletStore((s) => s.isConnected);
    const { withdraw, fetchUserDeposit, isLoading, error, lastTxSignature } =
        useStaking();

    const [amount, setAmount] = useState("");
    const [depositInfo, setDepositInfo] = useState<UserDepositInfo | null>(null);

    const parsedAmount = parseFloat(amount) || 0;
    const vaultBalance = depositInfo?.amount ?? 0;
    const isValidAmount = parsedAmount > 0 && parsedAmount <= vaultBalance;

    // Fetch user's vault balance
    const refreshDeposit = useCallback(async () => {
        const info = await fetchUserDeposit();
        setDepositInfo(info);
        if (info && !amount) {
            setAmount(info.amount.toFixed(2));
        }
    }, [fetchUserDeposit]);

    useEffect(() => {
        refreshDeposit();
    }, [refreshDeposit]);

    const handleWithdraw = async () => {
        if (!isValidAmount) return;
        hapticButtonPress();
        console.log("[WithdrawScreen] Starting withdraw of", parsedAmount, "USDC");
        const sig = await withdraw(parsedAmount);
        if (sig) {
            console.log("[WithdrawScreen] Withdraw success:", sig);
            hapticBlockClaimed();
        } else {
            console.log("[WithdrawScreen] Withdraw returned null (failed)");
            hapticError();
        }
    };

    const openExplorer = (sig: string) => {
        Linking.openURL(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    };

    // Success state
    if (lastTxSignature) {
        return (
            <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
                <Text style={styles.sheetTitle}>Extracted!</Text>
                <Text style={[TEXT.bodySm, styles.centered]}>
                    {parsedAmount.toFixed(2)} USDC returned to your wallet.
                </Text>
                <TouchableOpacity onPress={() => openExplorer(lastTxSignature!)} style={styles.fullWidth}>
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
                    Connect your wallet to withdraw USDC.
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

    // No deposit guard
    if (depositInfo && vaultBalance === 0) {
        return (
            <View style={[styles.sheet, styles.sheetContent]}>
                <Text style={styles.sheetTitle}>No Deposit</Text>
                <Text style={[TEXT.bodySm, styles.centered]}>
                    You haven't deposited any USDC yet.
                </Text>
                <View style={styles.fullWidth}>
                    <Button
                        title="Deposit USDC"
                        variant="primary"
                        onPress={() => {
                            router.back();
                            setTimeout(() => router.push("/deposit" as any), 100);
                        }}
                    />
                </View>
                <Button
                    title="Back"
                    variant="ghost"
                    onPress={() => router.back()}
                />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.sheet}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>Extract Fuel</Text>
                <Text style={[TEXT.bodySm, styles.centered]}>
                    Extract fuel from the tower back to your wallet.
                </Text>

                {/* Vault balance */}
                <Card variant="accent" style={styles.fullWidth}>
                    <View style={styles.cardRow}>
                        <Text style={TEXT.bodySm}>Vault Balance</Text>
                        <Text style={[TEXT.mono, { color: COLORS.gold }]}>
                            {vaultBalance.toFixed(2)} USDC
                        </Text>
                    </View>
                </Card>

                {/* Amount Input */}
                <Input
                    label="WITHDRAW AMOUNT"
                    value={amount}
                    onChangeText={setAmount}
                    prefix="$"
                    suffix="USDC"
                    keyboardType="decimal-pad"
                    disabled={isLoading}
                    inputFontSize={28}
                    error={
                        parsedAmount > vaultBalance
                            ? `Maximum: ${vaultBalance.toFixed(2)} USDC`
                            : undefined
                    }
                />

                {/* Quick amount buttons */}
                <View style={styles.chipRow}>
                    {vaultBalance > 0 && (
                        <>
                            {vaultBalance >= 0.5 && (
                                <Chip
                                    label="25%"
                                    selected={parsedAmount === parseFloat((vaultBalance * 0.25).toFixed(2))}
                                    onPress={() => setAmount((vaultBalance * 0.25).toFixed(2))}
                                    disabled={isLoading}
                                />
                            )}
                            {vaultBalance >= 0.2 && (
                                <Chip
                                    label="50%"
                                    selected={parsedAmount === parseFloat((vaultBalance * 0.5).toFixed(2))}
                                    onPress={() => setAmount((vaultBalance * 0.5).toFixed(2))}
                                    disabled={isLoading}
                                />
                            )}
                            <Chip
                                label="MAX"
                                selected={parsedAmount === vaultBalance}
                                onPress={() => setAmount(vaultBalance.toFixed(2))}
                                disabled={isLoading}
                            />
                        </>
                    )}
                </View>

                {/* Summary */}
                <Card variant="muted" style={styles.fullWidth}>
                    <View style={styles.cardRow}>
                        <Text style={TEXT.bodySm}>You receive</Text>
                        <Text style={TEXT.mono}>{parsedAmount.toFixed(2)} USDC</Text>
                    </View>
                    <View style={[styles.cardRow, { marginTop: SPACING.sm }]}>
                        <Text style={TEXT.bodySm}>Remaining in vault</Text>
                        <Text style={TEXT.mono}>
                            {(vaultBalance - parsedAmount).toFixed(2)} USDC
                        </Text>
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

                {/* Withdraw button */}
                <View style={styles.fullWidth}>
                    <Button
                        title={isLoading ? "Confirming..." : `Extract ${parsedAmount.toFixed(2)} USDC`}
                        variant="primary"
                        onPress={handleWithdraw}
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
