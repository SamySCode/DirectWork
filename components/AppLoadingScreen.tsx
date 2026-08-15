import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors, spacing } from "../lib/theme";
import { FadeIn } from "./FadeIn";
import { Wordmark } from "./Wordmark";

export function AppLoadingScreen() {
  return (
    <View style={styles.container}>
      <FadeIn>
        <View style={styles.content}>
          <Wordmark />
          <ActivityIndicator color={colors.accent} />
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
});
