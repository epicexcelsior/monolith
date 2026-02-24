import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useMultiplayerStore, onUsernameResult } from "@/stores/multiplayer-store";
import { usePlayerStore } from "@/stores/player-store";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

interface UsernameModalProps {
  visible: boolean;
  onDismiss: () => void;
  wallet: string;
}

export default function UsernameModal({ visible, onDismiss, wallet }: UsernameModalProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Register result callback
  useEffect(() => {
    if (!visible) return;

    onUsernameResult((data) => {
      setSubmitting(false);
      if (data.success && data.username) {
        usePlayerStore.getState().setUsername(data.username);
        onDismiss();
      } else {
        setError("Username already taken");
      }
    });
  }, [visible, onDismiss]);

  const handleSubmit = useCallback(() => {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (trimmed.length > 20) {
      setError("Username must be 20 characters or less");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Only letters, numbers, and underscores");
      return;
    }

    hapticButtonPress();
    playButtonTap();
    setSubmitting(true);
    setError(null);

    useMultiplayerStore.getState().sendSetUsername({ wallet, username: trimmed });

    // Safety timeout — if server doesn't respond in 5s, allow retry
    setTimeout(() => {
      setSubmitting(false);
    }, 5000);
  }, [username, wallet]);

  const handleSkip = useCallback(() => {
    hapticButtonPress();
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Choose Your Name</Text>
          <Text style={styles.subtitle}>
            How should other players know you?
          </Text>

          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setError(null);
            }}
            placeholder="Enter username..."
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.textOnGold} size="small" />
            ) : (
              <Text style={styles.buttonText}>Set Username</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(6, 8, 16, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.hudGlass,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
  },
  title: {
    color: COLORS.goldLight,
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 22,
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  subtitle: {
    color: COLORS.textOnDark,
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: SPACING.lg,
    opacity: 0.7,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    color: COLORS.textOnDark,
    fontFamily: FONT_FAMILY.mono,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
    marginBottom: SPACING.sm,
  },
  error: {
    color: "#ff6b6b",
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.textOnGold,
    fontFamily: FONT_FAMILY.heading,
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  skipText: {
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
  },
});
