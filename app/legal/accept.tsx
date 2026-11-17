import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { signOut } from "../../features/auth/api";
import { useAuth } from "../../features/auth/SessionProvider";
import { LegalConsent } from "../../features/legal/components/LegalConsent";
import { useAcceptLegal } from "../../features/legal/hooks";
import { errorMessage } from "../../lib/functions";
import { colors, radius, spacing, typography } from "../../lib/theme";

/**
 * Blocking re-acceptance screen. useProtectedRoute sends signed-in people
 * here while their accepted Terms/Privacy versions are older than the
 * current ones, and away again once they've accepted.
 */
export default function AcceptLegalScreen() {
  const { session } = useAuth();
  const accept = useAcceptLegal(session?.user.id);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const onAccept = () => {
    if (!checked) {
      setError("Tick the box to carry on.");
      return;
    }
    setError(undefined);
    accept.mutate(undefined, { onError: (err) => setError(errorMessage(err)) });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="document-text-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          We've updated our terms
        </Text>
        <Text style={styles.body}>
          Please read the updated Terms of Service and Privacy Notice. To keep using DirectWork,
          confirm you're 18 or over and accept them.
        </Text>
      </View>
      <LegalConsent
        checked={checked}
        onChange={(next) => {
          setChecked(next);
          if (next) setError(undefined);
        }}
        error={error}
      />
      <Button label="Accept and continue" onPress={onAccept} loading={accept.isPending} />
      <Button label="Sign out" variant="ghost" onPress={() => signOut().catch(() => {})} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
  },
  body: { fontSize: typography.size.md, lineHeight: 23, color: colors.textSecondary },
});
