import { ReactNode, useRef } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useReducedMotion } from "../lib/accessibility";
import { TabName, useTabReselect } from "../lib/tabReselect";
import { colors, layout, motion, spacing } from "../lib/theme";
import { useFadeIn } from "./FadeIn";

type ScreenProps = {
  children: ReactNode;
  /** Pull-to-refresh. Only wire this up where data can actually be stale. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Rendered edge-to-edge above the centred content column (e.g. a hero). */
  header?: ReactNode;
  /** Pinned below the scroll area - for a primary action that must stay reachable. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** On a tab's own screen: pressing that tab again scrolls back to the top. */
  tab?: TabName;
};

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  header,
  footer,
  contentStyle,
  tab,
}: ScreenProps) {
  // The content dissolves in as the screen opens (often straight after a
  // loading placeholder); the header and footer are solid from the start.
  const opacity = useFadeIn(motion.base);
  const scroll = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  useTabReselect(tab, () => scroll.current?.scrollTo({ y: 0, animated: !reduceMotion }));
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          ) : undefined
        }
      >
        {header}
        <Animated.View style={[styles.content, contentStyle, { opacity }]}>
          {children}
        </Animated.View>
      </ScrollView>
      {footer ? (
        <View style={styles.footer}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerInner: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
});
