import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { Text } from "../../../components/Text";
import { signOut } from "../../../features/auth/api";
import { useAuth } from "../../../features/auth/SessionProvider";
import { colors, spacing, typography } from "../../../lib/theme";

export default function ProfileScreen() {
  const { session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // Session change is picked up by the root layout's auth listener, which redirects.
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <EmptyState
        title="Profile"
        description="Editing your professional profile arrives in slice 3."
      />
      <View style={styles.footer}>
        {session?.user.email ? (
          <Text style={styles.email}>Signed in as {session.user.email}</Text>
        ) : null}
        <Button label="Sign out" variant="secondary" onPress={handleSignOut} loading={signingOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  email: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
