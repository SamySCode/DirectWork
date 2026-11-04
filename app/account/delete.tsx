import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { TextField } from "../../components/TextField";
import { deleteAccount } from "../../features/auth/api";
import { useAuth } from "../../features/auth/SessionProvider";
import { errorMessage } from "../../lib/functions";
import { colors, radius, spacing, typography } from "../../lib/theme";

const WHAT_GOES = [
  "Your profile, photo and portfolio",
  "Your listings and their applicants",
  "Your applications and work samples",
  "Your track record (on both sides of every collaboration)",
  "Any Pro subscription - cancelled straight away",
];

/**
 * A screen, not a pop-up: deleting is permanent, so it says exactly what
 * goes and asks for the password (the server also insists on a fresh
 * sign-in - see supabase/functions/delete-account).
 */
export default function DeleteAccountScreen() {
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const email = session?.user.email ?? "";

  const onDelete = async () => {
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      // On success the session ends and the root guard returns to Welcome.
      await deleteAccount(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="warning-outline" size={24} color={colors.danger} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Delete your account
        </Text>
        <Text style={styles.body}>This can't be undone. Deleting removes:</Text>
      </View>

      <Card style={styles.list}>
        {WHAT_GOES.map((item) => (
          <View key={item} style={styles.item}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </Card>

      <TextField
        label="Your password"
        value={password}
        onChangeText={setPassword}
        secureToggle
        autoComplete="current-password"
        textContentType="password"
        hint={email ? `For ${email}` : undefined}
        error={error ?? undefined}
        onSubmitEditing={onDelete}
      />
      <Button
        label="Delete my account permanently"
        variant="danger"
        icon="trash-outline"
        onPress={onDelete}
        loading={deleting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  itemText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
});
