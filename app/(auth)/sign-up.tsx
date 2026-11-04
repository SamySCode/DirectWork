import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { FadeIn } from "../../components/FadeIn";
import { Text } from "../../components/Text";
import { TextField } from "../../components/TextField";
import { signUp } from "../../features/auth/api";
import { AuthHeader } from "../../features/auth/components/AuthHeader";
import { CheckEmail } from "../../features/auth/components/CheckEmail";
import { signUpSchema } from "../../features/auth/schemas";
import { colors, shadow, spacing, typography } from "../../lib/theme";
import { errorMessage } from "../../lib/functions";
import { fieldErrors } from "../../lib/validation";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    const result = signUpSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signUp(result.data);
      setSubmitted(true);
    } catch (error) {
      setFormError(errorMessage(error));
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
                <CheckEmail email={email.trim()} onChangeEmail={() => setSubmitted(false)} />
              </View>
            ) : (
              <View style={styles.group}>
                <AuthHeader title="Create your account" />
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
                    autoComplete="new-password"
                    textContentType="newPassword"
                    hint="At least 8 characters."
                    error={errors.password}
                  />
                  <TextField
                    label="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureToggle
                    autoComplete="new-password"
                    textContentType="newPassword"
                    error={errors.confirmPassword}
                  />
                </View>
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}
                <Button label="Create account" onPress={handleSubmit} loading={loading} />
                <Link href="/sign-in" style={styles.link}>
                  Already have an account? Sign in
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
  fields: {
    gap: spacing.md,
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
