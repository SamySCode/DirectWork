import { StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { Wordmark } from "../../../components/Wordmark";
import { colors, spacing, typography } from "../../../lib/theme";

type AuthHeaderProps = {
  title: string;
};

export function AuthHeader({ title }: AuthHeaderProps) {
  return (
    <View style={styles.container}>
      <Wordmark />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
});
