import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Text } from "../../../components/Text";
import { errorMessage } from "../../../lib/functions";
import { colors, spacing, typography } from "../../../lib/theme";
import { resendConfirmation } from "../api";

// Supabase allows a confirmation email per address roughly once a minute;
// matching it here means the button never offers something that will fail.
const COOLDOWN_SECONDS = 60;

type CheckEmailProps = {
  email: string;
  /** Go back and fix a mistyped address. */
  onChangeEmail: () => void;
};

/**
 * The "check your inbox" step after sign-up - where people most often get
 * stuck (email in spam, typo in the address). So it says exactly where the
 * email went, and offers both fixes right there.
 */
export function CheckEmail({ email, onChangeEmail }: CheckEmailProps) {
  // A deadline rather than a decrementing counter: stays correct if ticks
  // are late (backgrounded app, slow device).
  const [until, setUntil] = useState(() => Date.now() + COOLDOWN_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const cooldown = Math.max(0, Math.ceil((until - now) / 1000));

  // Tick only while counting down; restarts when a resend sets a new deadline.
  const counting = cooldown > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const resend = async () => {
    setSending(true);
    setStatus(null);
    try {
      await resendConfirmation(email);
      setStatus({ ok: true, text: "Sent again. It can take a minute to arrive." });
      setUntil(Date.now() + COOLDOWN_SECONDS * 1000);
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error) });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.group}>
      <Text style={styles.body}>
        We sent a confirmation link to <Text style={styles.email}>{email}</Text>. Open it on this
        device to finish signing up.
      </Text>
      <Text style={styles.hint}>Can't see it? Check spam or promotions.</Text>
      <Button
        label={cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
        variant="secondary"
        onPress={resend}
        disabled={cooldown > 0}
        loading={sending}
      />
      {status ? (
        <Text
          style={[styles.status, { color: status.ok ? colors.success : colors.danger }]}
          accessibilityLiveRegion="polite"
        >
          {status.text}
        </Text>
      ) : null}
      <Button label="Use a different email" variant="ghost" onPress={onChangeEmail} />
      <Link href="/sign-in" style={styles.link}>
        Already confirmed? Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.md,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  email: {
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  status: {
    fontSize: typography.size.sm,
    textAlign: "center",
  },
  link: {
    fontFamily: typography.fontFamily,
    color: colors.accent,
    fontSize: typography.size.sm,
    textAlign: "center",
  },
});
