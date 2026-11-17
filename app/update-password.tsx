import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { TextField } from "../components/TextField";
import { useAuth } from "../features/auth/SessionProvider";
import { updatePasswordSchema } from "../features/auth/schemas";
import { useAuthLink } from "../features/auth/useAuthLink";
import { errorMessage } from "../lib/functions";
import { supabase } from "../lib/supabase";
import { colors, spacing, typography } from "../lib/theme";
import { fieldErrors } from "../lib/validation";

// The reset email links here with a one-time PKCE `?code=` (lib/supabase.ts),
// exchanged by useAuthLink (features/auth/useAuthLink.ts).
export default function UpdatePasswordScreen() {
  // Without this, a valid link flashed "expired" while the code was exchanged.
  const exchanging = useAuthLink().status === "exchanging";
  const router = useRouter();
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setFormError(null);
    const result = updatePasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: result.data.password });
      if (error) throw error;
      router.replace("/home");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card style={styles.card}>
        {session ? (
          <View style={styles.group}>
            <Text style={styles.title}>Choose a new password</Text>
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
            />
            <TextField
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={errors.confirmPassword}
            />
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Button label="Save new password" onPress={handleSave} loading={saving} />
          </View>
        ) : exchanging ? (
          <LoadingState />
        ) : (
          <View style={styles.group}>
            <Text style={styles.title}>This reset link didn't work</Text>
            <Text style={styles.body}>
              Reset links work once, expire after an hour, and only open on the phone or browser you
              asked for them from. Request a new one there to continue.
            </Text>
            <Button label="Request a new link" onPress={() => router.replace("/forgot-password")} />
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
  },
  group: {
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  formError: {
    color: colors.danger,
    fontSize: typography.size.sm,
  },
});
