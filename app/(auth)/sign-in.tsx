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
import { fieldErrors, signInSchema } from "../../features/auth/schemas";
import { colors, spacing, typography } from "../../lib/theme";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
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
        <FadeIn>
          <Card style={styles.card}>
            <AuthHeader title="Sign in to your account" />
            <View style={styles.fields}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                error={errors.email}
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={errors.password}
              />
            </View>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
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
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
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
