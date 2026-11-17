import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors, spacing, typography } from "../lib/theme";
import { FadeIn } from "./FadeIn";
import { Text } from "./Text";
import { Wordmark } from "./Wordmark";

type AppLoadingScreenProps = {
  /**
   * What is happening, when it isn't just "starting up": "Signing out".
   * Shown under the spinner and announced to screen readers.
   */
  label?: string;
};

export function AppLoadingScreen({ label }: AppLoadingScreenProps) {
  return (
    <View style={styles.container}>
      <FadeIn>
        <View style={styles.content}>
          <Wordmark />
          <ActivityIndicator color={colors.accent} />
          {label ? (
            <Text style={styles.label} accessibilityLiveRegion="polite">
              {label}
            </Text>
          ) : null}
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    alignItems: "center",
    gap: spacing.lg,
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
