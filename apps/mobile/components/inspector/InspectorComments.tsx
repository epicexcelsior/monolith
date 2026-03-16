import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { getComments, createComment, type TapestryCommentItem } from "@/utils/tapestry";

interface InspectorCommentsProps {
  blockId: string;
  contentId: string;
  profileId: string | null;
}

function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function InspectorComments({ blockId, contentId, profileId }: InspectorCommentsProps) {
  const [comments, setComments] = useState<TapestryCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getComments(contentId, profileId ?? undefined, 1, 20)
      .then((result) => setComments(result.comments ?? []))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [contentId, profileId]);

  const handleSubmit = useCallback(() => {
    if (!profileId || !text.trim()) return;
    const trimmed = text.trim();
    setText("");
    setSubmitting(true);
    hapticButtonPress();
    playButtonTap();

    // Optimistic add
    const optimistic: TapestryCommentItem = {
      comment: { id: `temp-${Date.now()}`, created_at: Date.now(), text: trimmed },
      author: { id: profileId, username: "You", bio: null, image: null, namespace: "themonolith", created_at: 0 },
    };
    setComments((prev) => [optimistic, ...prev]);

    createComment(profileId, contentId, trimmed)
      .then((result) => {
        // Replace optimistic with real
        setComments((prev) =>
          prev.map((c) =>
            c.comment.id === optimistic.comment.id
              ? { ...optimistic, comment: { ...result, text: trimmed } }
              : c,
          ),
        );
      })
      .catch((err) => {
        console.warn("Comment failed:", err);
        // Remove optimistic on failure
        setComments((prev) => prev.filter((c) => c.comment.id !== optimistic.comment.id));
      })
      .finally(() => setSubmitting(false));
  }, [profileId, text, contentId]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>COMMENTS</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={styles.loader} />
      ) : comments.length === 0 ? (
        <Text style={styles.emptyText}>No comments yet — be the first!</Text>
      ) : (
        comments.slice(0, 10).map((item) => (
          <View key={item.comment.id} style={styles.commentRow}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>
                {item.author?.username || "Anonymous"}
              </Text>
              <Text style={styles.commentTime}>
                {relativeTime(item.comment.created_at)}
              </Text>
            </View>
            <Text style={styles.commentText}>{item.comment.text}</Text>
          </View>
        ))
      )}

      {profileId && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={COLORS.textMuted}
            value={text}
            onChangeText={setText}
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            editable={!submitting}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || submitting) && styles.sendButtonDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim() || submitting}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    color: COLORS.inspectorTextSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
  },
  loader: {
    paddingVertical: SPACING.md,
  },
  emptyText: {
    ...TEXT.caption,
    color: COLORS.inspectorTextSecondary,
    textAlign: "center",
    paddingVertical: SPACING.md,
  },
  commentRow: {
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inspectorBorder,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  commentAuthor: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.inspectorText,
  },
  commentTime: {
    ...TEXT.caption,
    color: COLORS.inspectorTextSecondary,
  },
  commentText: {
    ...TEXT.bodySm,
    color: COLORS.inspectorTextSecondary,
  },
  inputRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    color: COLORS.inspectorText,
    backgroundColor: COLORS.inspectorBgMuted,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.inspectorBorder,
  },
  sendButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.gold,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textOnGold,
  },
});
