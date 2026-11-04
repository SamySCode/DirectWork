import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { FadeIn } from "../../components/FadeIn";
import { Text } from "../../components/Text";
import { TextField } from "../../components/TextField";
import { requestPasswordReset } from "../../features/auth/api";
import { AuthHeader } from "../../features/auth/components/AuthHeader";
import { forgotPasswordSchema } from "../../features/auth/schemas";
import { colors, shadow, spacing, typography } from "../../lib/theme";
import { fieldErrors } from "../../lib/validation";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await requestPasswordReset(result.data);
      setSubmitted(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong");
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
        <Card style={styles.card}>
          <FadeIn key={submitted ? "success" : "form"}>
            {submitted ? (
              <View style={styles.group}>
                <AuthHeader title="Check your email" />
                <Text style={styles.description}>
                  If an account exists for {email}, we sent a password reset link to it.
                </Text>
                <Link href="/sign-in" style={styles.link}>
                  Back to sign in
                </Link>
              </View>
            ) : (
              <View style={styles.group}>
                <AuthHeader title="Reset your password" />
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  error={errors.email}
                />
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}
                <Button label="Send reset link" onPress={handleSubmit} loading={loading} />
                <Link href="/sign-in" style={styles.link}>
                  Back to sign in
                </Link>
              </View>
            )}
          </FadeIn>
        </Card>
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
  },
  group: {
    gap: spacing.lg,
  },
  description: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
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
