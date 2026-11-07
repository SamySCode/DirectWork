import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";

export const CONSENT_LABEL =
  "I'm 18 or over, I agree to the Terms of Service, and I've read the Privacy Notice";

type LegalConsentProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
};

/**
 * The required sign-up / re-acceptance checkbox. The links sit outside the
 * checkbox so screen readers reach them as separate controls; they open the
 * documents in-app (the form stays mounted underneath).
 */
export function LegalConsent({ checked, onChange, error }: LegalConsentProps) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={CONSENT_LABEL}
        onPress={() => onChange(!checked)}
        style={styles.row}
        hitSlop={4}
      >
        <View
          style={[styles.box, checked ? styles.boxChecked : null, error ? styles.boxError : null]}
        >
          {checked ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
        </View>
        <Text style={styles.label}>{CONSENT_LABEL}.</Text>
      </Pressable>
      <Text style={styles.links}>
        Read the{" "}
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.push("/legal/terms")}
        >
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.push("/legal/privacy")}
        >
          Privacy Notice
        </Text>
        .
      </Text>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", minHeight: 44 },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  boxError: { borderColor: colors.danger },
  label: {
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  links: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    paddingLeft: 24 + spacing.sm,
  },
  link: { color: colors.accent, textDecorationLine: "underline" },
  error: { color: colors.danger, fontSize: typography.size.sm },
});
