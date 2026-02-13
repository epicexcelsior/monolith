/**
 * Withdraw Screen — Withdraw USDC from the Monolith vault.
 *
 * Shows vault balance, amount input, confirms via MWA.
 * Route: app/withdraw.tsx (modal via expo-router)
 */

import { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useStaking, type UserDepositInfo } from "@/hooks/useStaking";
import { useWalletStore } from "@/stores/wallet-store";

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
            // Default to full withdraw
            setAmount(info.amount.toFixed(2));
        }
    }, [fetchUserDeposit]);

    useEffect(() => {
        refreshDeposit();
    }, [refreshDeposit]);

    const handleWithdraw = async () => {
        if (!isValidAmount) return;
        console.log("[WithdrawScreen] Starting withdraw of", parsedAmount, "USDC");
        const sig = await withdraw(parsedAmount);
        if (sig) {
            console.log("[WithdrawScreen] ✅ Withdraw success:", sig);
        } else {
            console.log("[WithdrawScreen] ❌ Withdraw returned null (failed)");
        }
    };

    const openExplorer = (sig: string) => {
        Linking.openURL(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    };

    // Success state
    if (lastTxSignature) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.icon}>✅</Text>
                    <Text style={styles.title}>Withdrawn!</Text>
                    <Text style={styles.subtitle}>
                        {parsedAmount.toFixed(2)} USDC returned to your wallet.
                    </Text>
                    <TouchableOpacity onPress={() => openExplorer(lastTxSignature!)}>
                        <Text style={styles.txLink} numberOfLines={1} ellipsizeMode="middle">
                            🔗 {lastTxSignature}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.primaryText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Not connected guard
    if (!isConnected) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.icon}>🔐</Text>
                    <Text style={styles.title}>Wallet Required</Text>
                    <Text style={styles.subtitle}>
                        Connect your wallet to withdraw USDC.
                    </Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.push("/connect")}
                    >
                        <Text style={styles.primaryText}>Connect Wallet</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // No deposit guard
    if (depositInfo && vaultBalance === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.icon}>📭</Text>
                    <Text style={styles.title}>No Deposit</Text>
                    <Text style={styles.subtitle}>
                        You haven't deposited any USDC yet.
                    </Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => {
                            router.back();
                            setTimeout(() => router.push("/deposit" as any), 100);
                        }}
                    >
                        <Text style={styles.primaryText}>Deposit USDC</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.cancelText}>Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>🏦</Text>
                <Text style={styles.title}>Withdraw USDC</Text>
                <Text style={styles.subtitle}>
                    Withdraw your USDC from the Monolith vault{"\n"}
                    back to your wallet.
                </Text>

                {/* Vault balance */}
                <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Vault Balance</Text>
                    <Text style={styles.balanceValue}>
                        {vaultBalance.toFixed(2)} USDC
                    </Text>
                </View>

                {/* Amount Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>WITHDRAW AMOUNT</Text>
                    <View style={styles.inputRow}>
                        <Text style={styles.currencyPrefix}>$</Text>
                        <TextInput
                            style={styles.input}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#444455"
                            returnKeyType="done"
                            editable={!isLoading}
                        />
                        <Text style={styles.currencySuffix}>USDC</Text>
                    </View>
                    {parsedAmount > vaultBalance && (
                        <Text style={styles.inputHint}>
                            Maximum: {vaultBalance.toFixed(2)} USDC
                        </Text>
                    )}
                </View>

                {/* Quick amount buttons */}
                <View style={styles.quickRow}>
                    {vaultBalance > 0 && (
                        <>
                            {vaultBalance >= 0.5 && (
                                <TouchableOpacity
                                    style={[
                                        styles.quickButton,
                                        parsedAmount === vaultBalance * 0.25 &&
                                        styles.quickButtonActive,
                                    ]}
                                    onPress={() =>
                                        setAmount((vaultBalance * 0.25).toFixed(2))
                                    }
                                    disabled={isLoading}
                                >
                                    <Text
                                        style={[
                                            styles.quickText,
                                            parsedAmount === vaultBalance * 0.25 &&
                                            styles.quickTextActive,
                                        ]}
                                    >
                                        25%
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {vaultBalance >= 0.2 && (
                                <TouchableOpacity
                                    style={[
                                        styles.quickButton,
                                        parsedAmount === vaultBalance * 0.5 &&
                                        styles.quickButtonActive,
                                    ]}
                                    onPress={() =>
                                        setAmount((vaultBalance * 0.5).toFixed(2))
                                    }
                                    disabled={isLoading}
                                >
                                    <Text
                                        style={[
                                            styles.quickText,
                                            parsedAmount === vaultBalance * 0.5 &&
                                            styles.quickTextActive,
                                        ]}
                                    >
                                        50%
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.quickButton,
                                    parsedAmount === vaultBalance &&
                                    styles.quickButtonActive,
                                ]}
                                onPress={() => setAmount(vaultBalance.toFixed(2))}
                                disabled={isLoading}
                            >
                                <Text
                                    style={[
                                        styles.quickText,
                                        parsedAmount === vaultBalance &&
                                        styles.quickTextActive,
                                    ]}
                                >
                                    MAX
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Summary */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>You receive</Text>
                        <Text style={styles.infoValue}>
                            {parsedAmount.toFixed(2)} USDC
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Remaining in vault</Text>
                        <Text style={styles.infoValue}>
                            {(vaultBalance - parsedAmount).toFixed(2)} USDC
                        </Text>
                    </View>
                </View>

                {/* Error display */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Withdraw button */}
                <TouchableOpacity
                    style={[
                        styles.withdrawButton,
                        (!isValidAmount || isLoading) && styles.buttonDisabled,
                    ]}
                    onPress={handleWithdraw}
                    disabled={!isValidAmount || isLoading}
                >
                    {isLoading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color="#0a0a0f" />
                            <Text style={[styles.withdrawText, styles.loadingText]}>
                                Confirming...
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.withdrawText}>
                            Withdraw {parsedAmount.toFixed(2)} USDC
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => router.back()}
                    disabled={isLoading}
                >
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    content: {
        alignItems: "center",
    },
    icon: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        color: "#ffffff",
        fontSize: 24,
        fontWeight: "900",
        marginBottom: 8,
        letterSpacing: 1,
    },
    subtitle: {
        color: "#888899",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    // Balance
    balanceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        backgroundColor: "rgba(0,255,255,0.06)",
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(0,255,255,0.15)",
    },
    balanceLabel: {
        color: "#888899",
        fontSize: 14,
    },
    balanceValue: {
        color: "#00ffff",
        fontSize: 14,
        fontWeight: "700",
        fontFamily: "monospace",
    },
    // Input
    inputContainer: {
        width: "100%",
        marginBottom: 16,
    },
    inputLabel: {
        color: "#ff9500",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 2,
        marginBottom: 8,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,149,0,0.3)",
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    currencyPrefix: {
        color: "#ff9500",
        fontSize: 28,
        fontWeight: "300",
        marginRight: 4,
    },
    input: {
        flex: 1,
        color: "#ffffff",
        fontSize: 32,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
        paddingVertical: 12,
    },
    currencySuffix: {
        color: "#555566",
        fontSize: 14,
        fontWeight: "600",
        letterSpacing: 1,
    },
    inputHint: {
        color: "#ff6b6b",
        fontSize: 12,
        marginTop: 6,
    },
    // Quick amounts
    quickRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 20,
        flexWrap: "wrap",
        justifyContent: "center",
    },
    quickButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    quickButtonActive: {
        backgroundColor: "rgba(255,149,0,0.15)",
        borderColor: "#ff9500",
    },
    quickText: {
        color: "#888899",
        fontSize: 14,
        fontWeight: "600",
    },
    quickTextActive: {
        color: "#ff9500",
    },
    // Info card
    infoCard: {
        width: "100%",
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        gap: 8,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    infoLabel: {
        color: "#555566",
        fontSize: 13,
    },
    infoValue: {
        color: "#ccccdd",
        fontSize: 13,
        fontWeight: "600",
        fontFamily: "monospace",
    },
    // Error
    errorContainer: {
        backgroundColor: "rgba(255, 59, 48, 0.1)",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 59, 48, 0.3)",
        padding: 14,
        marginBottom: 16,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
    },
    errorIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    errorText: {
        color: "#ff6b6b",
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    // Buttons
    withdrawButton: {
        backgroundColor: "#ff9500",
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
        marginBottom: 16,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    withdrawText: {
        color: "#0a0a0f",
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: 1,
    },
    primaryButton: {
        backgroundColor: "#00ffff",
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
        marginBottom: 16,
    },
    primaryText: {
        color: "#0a0a0f",
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: 1,
    },
    loadingRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    loadingText: {
        marginLeft: 10,
    },
    cancelButton: {
        padding: 12,
    },
    cancelText: {
        color: "#666680",
        fontSize: 14,
    },
    // Success
    txLink: {
        color: "#00ffff",
        fontSize: 12,
        fontFamily: "monospace",
        backgroundColor: "rgba(0,255,255,0.08)",
        padding: 10,
        borderRadius: 8,
        width: "100%",
        textAlign: "center",
        marginBottom: 20,
        overflow: "hidden",
    },
});
