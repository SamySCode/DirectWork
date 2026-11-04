import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { FadeIn } from "../../components/FadeIn";
import { Text } from "../../components/Text";
import { TextField } from "../../components/TextField";
import { signIn } from "../../features/auth/api";
import { AuthHeader } from "../../features/auth/components/AuthHeader";
import { CheckEmail } from "../../features/auth/components/CheckEmail";
import { signInSchema } from "../../features/auth/schemas";
import { colors, shadow, spacing, typography } from "../../lib/theme";
import { errorMessage } from "../../lib/functions";
import { fieldErrors } from "../../lib/validation";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Signing in before confirming is common; turn the raw error into a fix.
  const [unconfirmed, setUnconfirmed] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    setUnconfirmed(false);
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(result.data);
      // Session change is picked up by the root layout's auth listener, which redirects.
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "email_not_confirmed") {
        setUnconfirmed(true);
      } else if (code === "invalid_credentials") {
        setFormError("That email and password don't match. Check both, or reset your password.");
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <FadeIn>
          <Card style={styles.card}>
            <AuthHeader title="Sign in to your account" />
            <View style={styles.fields}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                error={errors.email}
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureToggle
                autoComplete="current-password"
                textContentType="password"
                onSubmitEditing={handleSubmit}
                error={errors.password}
              />
            </View>
            {formError ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}
            {unconfirmed ? (
              <View style={styles.unconfirmed}>
                <Text style={styles.unconfirmedTitle}>Confirm your email first</Text>
                <CheckEmail email={email.trim()} onChangeEmail={() => setUnconfirmed(false)} />
              </View>
            ) : null}
            <Button label="Sign in" onPress={handleSubmit} loading={loading} />
            <View style={styles.footer}>
              <Link href="/forgot-password" style={styles.link}>
                Forgot password?
              </Link>
              <Link href="/sign-up" style={styles.link}>
                Don&apos;t have an account? Sign up
              </Link>
            </View>
          </Card>
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    ...shadow.raised,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  fields: {
    gap: spacing.md,
  },
  footer: {
    gap: spacing.sm,
  },
  unconfirmed: {
    gap: spacing.sm,
  },
  unconfirmedTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  formError: {
    color: colors.danger,
    fontSize: typography.size.sm,
  },
  link: {
    fontFamily: typography.fontFamily,
    color: colors.accent,
    fontSize: typography.size.sm,
    textAlign: "center",
  },
});
