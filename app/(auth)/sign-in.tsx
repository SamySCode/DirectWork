import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
} from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Checkbox } from "../../components/Checkbox";
import { FadeIn } from "../../components/FadeIn";
import { Text } from "../../components/Text";
import { TextField } from "../../components/TextField";
import { signIn } from "../../features/auth/api";
import {
  forgetEmail,
  getRememberedEmail,
  rememberEmail,
} from "../../features/auth/rememberedEmail";
import { AuthHeader } from "../../features/auth/components/AuthHeader";
import { CheckEmail } from "../../features/auth/components/CheckEmail";
import { signInSchema } from "../../features/auth/schemas";
import { type AuthLinkState, useAuthLink } from "../../features/auth/useAuthLink";
import { colors, radius, shadow, spacing, typography } from "../../lib/theme";
import { errorMessage } from "../../lib/functions";
import { fieldErrors } from "../../lib/validation";

// The sign-up confirmation email links here (features/auth/api.ts). Say
// what happened, so a confirmed person isn't left on a blank form.
function linkNotice(link: AuthLinkState): { text: string; ok: boolean } | null {
  switch (link.status) {
    case "exchanging":
      return { text: "Confirming your email…", ok: true };
    case "signed_in":
      return { text: "Email confirmed. Signing you in…", ok: true };
    case "exchange_failed":
      // The link was verified before it reached the app; only the sign-in
      // part failed (e.g. opened on another device or browser).
      return { text: "Your email is confirmed. Sign in to continue.", ok: true };
    case "link_error":
      return link.expired
        ? { text: "That link has expired. Sign in and we'll send a new one.", ok: false }
        : {
            text: "That link didn't work - it may have been used already. Sign in, and if your email still needs confirming we'll send a new link.",
            ok: false,
          };
    default:
      return null;
  }
}

export default function SignInScreen() {
  // Enter in the email field moves to the password, as a keyboard's Next key does.
  const passwordInput = useRef<TextInputInstance>(null);
  const notice = linkNotice(useAuthLink());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Signing in before confirming is common; turn the raw error into a fix.
  const [unconfirmed, setUnconfirmed] = useState(false);
  // Opt-in only (see features/auth/rememberedEmail.ts): starts unticked,
  // and is ticked here only because the person ticked it last time.
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    let active = true;
    void getRememberedEmail().then((saved) => {
      if (!active || !saved) return;
      setEmail((current) => current || saved);
      setRemember(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const onRememberChange = (next: boolean) => {
    setRemember(next);
    // Unticking withdraws consent: forget straight away, not at sign-in.
    if (!next) void forgetEmail();
  };

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
      if (remember) await rememberEmail(result.data.email);
      else await forgetEmail();
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
            {notice ? (
              <View
                style={[styles.notice, notice.ok ? styles.noticeOk : styles.noticeWarning]}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.noticeText}>{notice.text}</Text>
              </View>
            ) : null}
            <View style={styles.fields}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
                error={errors.email}
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureToggle
                ref={passwordInput}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                error={errors.password}
              />
            </View>
            <Checkbox
              label="Remember my email on this device"
              checked={remember}
              onChange={onRememberChange}
              hint={
                <>
                  Kept only on this device and never sent to us. Untick to forget it.{" "}
                  <Link href="/legal/cookies" style={styles.link}>
                    About device storage
                  </Link>
                </>
              }
            />
            {formError ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}
            {unconfirmed ? (
              <View style={styles.unconfirmed}>
                <Text style={styles.unconfirmedTitle}>Confirm your email first</Text>
                <CheckEmail
                  email={email.trim()}
                  onChangeEmail={() => setUnconfirmed(false)}
                  justSent={false}
                />
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
  notice: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeOk: {
    backgroundColor: colors.mintMuted,
  },
  noticeWarning: {
    backgroundColor: colors.warningMuted,
  },
  noticeText: {
    fontSize: typography.size.sm,
    lineHeight: 20,
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
