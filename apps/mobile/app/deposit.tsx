/**
 * Deposit Screen — Stake USDC to claim a block on the tower.
 *
 * Presents a USDC amount input and confirms the staking transaction
 * via MWA. Navigates back to the tower on success.
 *
 * Route: app/deposit.tsx (modal via expo-router)
 */

import { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useStaking } from "@/hooks/useStaking";
import { useWalletStore } from "@/stores/wallet-store";
import { MIN_STAKE_UNITS, unitsToUsdc } from "@/services/monolith-program";

const MIN_USDC = unitsToUsdc(MIN_STAKE_UNITS); // 0.10

export default function DepositScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        blockId?: string;
        posX?: string;
        posY?: string;
        posZ?: string;
    }>();

    const isConnected = useWalletStore((s) => s.isConnected);
    const { depositStake, isLoading, error, lastTxSignature } = useStaking();

    const [amount, setAmount] = useState("1.00");

    // Parse block parameters from navigation params
    const blockId = params.blockId ? parseInt(params.blockId, 10) : 0;
    const posX = params.posX ? parseInt(params.posX, 10) : 0;
    const posY = params.posY ? parseInt(params.posY, 10) : 0;
    const posZ = params.posZ ? parseInt(params.posZ, 10) : 0;

    const parsedAmount = parseFloat(amount) || 0;
    const isValidAmount = parsedAmount >= MIN_USDC;

    const handleDeposit = async () => {
        if (!isValidAmount) return;

        const sig = await depositStake(blockId, parsedAmount, posX, posY, posZ);
        if (sig) {
            // Success — go back to tower after a brief delay so user sees confirmation
            setTimeout(() => router.back(), 1500);
        }
    };

    // Quick amount buttons
    const quickAmounts = [0.1, 0.5, 1.0, 5.0];

    // Success state
    if (lastTxSignature) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.icon}>✅</Text>
                    <Text style={styles.title}>Block Claimed!</Text>
                    <Text style={styles.subtitle}>
                        You staked {parsedAmount.toFixed(2)} USDC on Block #{blockId}
                    </Text>
                    <Text style={styles.txLink} numberOfLines={1} ellipsizeMode="middle">
                        {lastTxSignature}
                    </Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.primaryText}>Back to Tower</Text>
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
                        Connect your wallet before staking USDC.
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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>🧱</Text>
                <Text style={styles.title}>Stake USDC</Text>
                <Text style={styles.subtitle}>
                    Claim Block #{blockId} on the tower by depositing USDC.
                </Text>

                {/* Amount Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>STAKE AMOUNT</Text>
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
                    {!isValidAmount && amount.length > 0 && (
                        <Text style={styles.inputHint}>
                            Minimum: {MIN_USDC.toFixed(2)} USDC
                        </Text>
                    )}
                </View>

                {/* Quick amount buttons */}
                <View style={styles.quickRow}>
                    {quickAmounts.map((qa) => (
                        <TouchableOpacity
                            key={qa}
                            style={[
                                styles.quickButton,
                                parsedAmount === qa && styles.quickButtonActive,
                            ]}
                            onPress={() => setAmount(qa.toFixed(2))}
                            disabled={isLoading}
                        >
                            <Text
                                style={[
                                    styles.quickText,
                                    parsedAmount === qa && styles.quickTextActive,
                                ]}
                            >
                                {qa < 1 ? `$${qa}` : `$${qa.toFixed(0)}`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Position info */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Block ID</Text>
                        <Text style={styles.infoValue}>#{blockId}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Position</Text>
                        <Text style={styles.infoValue}>
                            ({posX}, {posY}, {posZ})
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Amount</Text>
                        <Text style={styles.infoValue}>
                            {parsedAmount.toFixed(2)} USDC
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

                {/* Deposit button */}
                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        (!isValidAmount || isLoading) && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleDeposit}
                    disabled={!isValidAmount || isLoading}
                >
                    {isLoading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color="#0a0a0f" />
                            <Text style={[styles.primaryText, styles.loadingText]}>
                                Confirming...
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.primaryText}>
                            Stake {parsedAmount.toFixed(2)} USDC
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
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    // Input
    inputContainer: {
        width: "100%",
        marginBottom: 16,
    },
    inputLabel: {
        color: "#00ffff",
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
        borderColor: "rgba(0,255,255,0.2)",
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    currencyPrefix: {
        color: "#00ffff",
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
        backgroundColor: "rgba(0,255,255,0.15)",
        borderColor: "#00ffff",
    },
    quickText: {
        color: "#888899",
        fontSize: 14,
        fontWeight: "600",
    },
    quickTextActive: {
        color: "#00ffff",
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
    primaryButton: {
        backgroundColor: "#00ffff",
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
        marginBottom: 16,
    },
    primaryButtonDisabled: {
        opacity: 0.5,
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
