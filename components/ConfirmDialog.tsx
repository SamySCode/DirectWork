import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../lib/accessibility";
import { nativeDriverEnabled } from "../lib/animation";
import {
  answerConfirm,
  type ConfirmRequest,
  registerConfirmHost,
  useConfirmRequest,
} from "../lib/confirm";
import { colors, elevation, layout, radius, spacing, surfaces, typography } from "../lib/theme";
import { Button } from "./Button";
import { Text } from "./Text";

// Wider than a phone held upright: show a centred card instead of a sheet.
const WIDE = 640;

/**
 * The app's own confirmation dialog, for every `confirm()` call (lib/confirm.ts).
 * Mounted once in the root layout. On a phone it rises from the bottom, in
 * reach of a thumb; on a wide screen it's a centred card. A tap outside, the
 * Android back button and Escape all cancel. Screen readers hear it as an
 * alert dialog and can't wander behind it.
 */
export function ConfirmHost() {
  const request = useConfirmRequest();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  // What's on screen. Kept separately from the request so the dialog can
  // animate out after it has been answered.
  const [shown, setShown] = useState<ConfirmRequest | null>(null);
  const answering = useRef(false);

  useEffect(() => registerConfirmHost(), []);

  // On the web, focus goes to the dialog itself: screen readers announce
  // its title and message, a stray Enter can't confirm anything, and the
  // first Tab lands on Cancel. Focusing a button instead would draw a focus
  // ring that touch users read as "already chosen". (Phones place no focus.)
  useEffect(() => {
    if (Platform.OS !== "web" || !shown) return;
    const timer = setTimeout(() => {
      const panel = document.querySelector<HTMLElement>('[role="alertdialog"]');
      if (!panel) return;
      panel.tabIndex = -1;
      panel.style.outline = "none";
      panel.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [shown]);

  useEffect(() => {
    if (!request) return;
    answering.current = false;
    setShown(request);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriverEnabled,
    }).start();
  }, [request, progress, reduceMotion]);

  const answer = (ok: boolean) => {
    if (!shown || answering.current) return;
    answering.current = true;
    const id = shown.id;
    // The answer goes straight away; the dialog fades out on its own. Never
    // make the answer wait for an animation to report back: one that is
    // interrupted would leave the press unanswered and the screen stuck.
    answerConfirm(id, ok);
    const hide = () => setShown((current) => (current?.id === id ? null : current));
    Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: nativeDriverEnabled,
    }).start(hide);
    setTimeout(hide, 400);
  };

  if (!shown) return null;
  const wide = width >= WIDE;
  const destructive = !!shown.destructive;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => answer(false)}
      testID="confirm-modal"
    >
      <View style={[styles.root, wide ? styles.rootWide : null]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          {/* A tap outside cancels. Not a control of its own for screen
              readers or the keyboard: they have the Cancel button. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => answer(false)}
            testID="confirm-backdrop"
            accessible={false}
            focusable={false}
            importantForAccessibility="no"
          />
        </Animated.View>
        <Animated.View
          role="alertdialog"
          testID="confirm-dialog"
          aria-modal
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          accessibilityViewIsModal
          style={[
            styles.panel,
            wide
              ? styles.card
              : [styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }],
            {
              opacity: progress,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          {wide ? null : <View style={styles.handle} />}
          <View style={[styles.icon, destructive ? styles.iconDanger : styles.iconNeutral]}>
            <Ionicons
              name={destructive ? "alert-circle-outline" : "help-circle-outline"}
              size={24}
              color={destructive ? colors.danger : colors.accent}
            />
          </View>
          <Text nativeID="confirm-title" role="heading" style={styles.title}>
            {shown.title}
          </Text>
          <Text nativeID="confirm-message" style={styles.message}>
            {shown.message}
          </Text>
          {/* Cancel comes first, so it's what the keyboard lands on and a
              stray Enter can't confirm something destructive. On a phone
              the confirm button is drawn on top, nearest the thumb's path. */}
          <View style={[styles.actions, wide ? styles.actionsWide : styles.actionsStacked]}>
            <Button
              label={shown.cancelLabel ?? "Cancel"}
              testID="confirm-cancel"
              variant="secondary"
              onPress={() => answer(false)}
              style={wide ? styles.flex : null}
            />
            <Button
              label={shown.confirmLabel}
              variant={destructive ? "destructive" : "primary"}
              onPress={() => answer(true)}
              style={wide ? styles.flex : null}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  rootWide: {
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  backdrop: {
    backgroundColor: "rgba(13, 11, 34, 0.55)",
  },
  panel: {
    ...surfaces.raised,
    gap: spacing.md,
    padding: spacing.lg,
    ...elevation.lg,
  },
  sheet: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomWidth: 0,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.lg,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginTop: -spacing.xs,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDanger: {
    backgroundColor: colors.dangerMuted,
  },
  iconNeutral: {
    backgroundColor: colors.accentMuted,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.lg,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  message: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsStacked: {
    flexDirection: "column-reverse",
  },
  actionsWide: {
    flexDirection: "row",
  },
  flex: {
    flex: 1,
  },
});
