import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { colors, layout, spacing } from "../lib/theme";

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
};

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  header,
  footer,
  contentStyle,
}: ScreenProps) {
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
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
        <View style={[styles.content, contentStyle]}>{children}</View>
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
