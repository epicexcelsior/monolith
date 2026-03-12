import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  PanResponder,
} from "react-native";
import { Canvas } from "@react-three/fiber/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfiguratorScene } from "./ConfiguratorScene";
import { useConfiguratorState } from "./useConfiguratorState";
import { hapticConfiguratorOpen, hapticConfiguratorSave } from "@/utils/haptics";
import { playBlockDeselect } from "@/utils/audio";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";

interface Props {
  blockId: string;
  onClose: () => void;
}

export function BlockConfigurator({ blockId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { block, preview, save, discard, hasChanges } = useConfiguratorState(blockId);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    hapticConfiguratorOpen();
    Animated.spring(fadeAnim, {
      toValue: 1,
      tension: 65,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  // Exit animation
  const handleClose = useCallback(
    (shouldSave: boolean) => {
      if (shouldSave && hasChanges) {
        save();
        hapticConfiguratorSave();
      } else {
        discard();
        playBlockDeselect();
      }
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onClose());
    },
    [onClose, save, discard, hasChanges, fadeAnim],
  );

  // Drag gesture for orbit control
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const cameraState = ConfiguratorScene.getCameraState();
        if (!cameraState) return;
        const sensitivity = 0.005;
        cameraState.azimuth += gestureState.dx * sensitivity;
        cameraState.autoRotating = false;
        cameraState.lastInteraction = Date.now();
      },
      onPanResponderRelease: () => {
        const cameraState = ConfiguratorScene.getCameraState();
        if (cameraState) {
          cameraState.lastInteraction = Date.now();
        }
      },
    }),
  ).current;

  if (!block) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] },
      ]}
    >
      {/* Background */}
      <View style={styles.background} />

      {/* 3D Canvas */}
      <View style={styles.canvasContainer}>
        <Canvas style={styles.canvas}>
          <ConfiguratorScene
            block={block}
            previewColor={preview.color}
            previewStyle={preview.style}
          />
        </Canvas>
        {/* Drag overlay for orbit */}
        <View style={styles.dragOverlay} {...panResponder.panHandlers} />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => handleClose(false)} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customize</Text>
        <TouchableOpacity onPress={() => handleClose(true)} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, hasChanges && styles.saveButtonText]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom info — placeholder for Phase 3 controls */}
      <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Text style={styles.blockName}>{block.name || `Block ${block.layer}-${block.index}`}</Text>
        <Text style={styles.hint}>Drag to rotate. Controls coming soon.</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0c14",
  },
  canvasContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dragOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  headerButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  headerButtonText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  saveButtonText: {
    color: COLORS.goldAccent,
  },
  headerTitle: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 18,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  bottomInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  blockName: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  hint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
