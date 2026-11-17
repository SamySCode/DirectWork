import { StyleSheet, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { LegalLinks } from "../../features/legal/components/LegalLinks";
import { colors, spacing, typography } from "../../lib/theme";

/** All legal documents. Reachable signed out (see useProtectedRoute). */
export default function LegalIndexScreen() {
  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          Legal
        </Text>
        <Text style={styles.lead}>
          The terms you agree to, how we handle your data, and the rules that keep DirectWork
          trustworthy.
        </Text>
      </View>
      <LegalLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  lead: { fontSize: typography.size.md, lineHeight: 23, color: colors.textSecondary },
});
