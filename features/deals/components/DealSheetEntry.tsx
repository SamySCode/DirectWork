import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { useDealSheet } from "../hooks";
import { dealEntryState, shortDate, type Side } from "../logic";

type DealSheetEntryProps = {
  applicationId: string;
  membershipId: string;
  side: Side;
};

/** The way into a collaboration's Deal Sheet, saying where it stands. */
export function DealSheetEntry({ applicationId, membershipId, side }: DealSheetEntryProps) {
  const router = useRouter();
  const deal = useDealSheet(membershipId);
  if (deal.isPending || deal.data === undefined) return null;
  const state = dealEntryState(deal.data, side);
  const open = () => router.push(`/deal/${applicationId}`);

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
        <Text style={styles.title}>Deal Sheet</Text>
        {state.kind === "agreed" ? <Badge label="Agreed" tone="mint" /> : null}
        {state.kind === "review" ? <Badge label="Needs your confirmation" tone="warning" /> : null}
        {state.kind === "waiting" ? <Badge label="Waiting for them" tone="neutral" /> : null}
      </View>
      <Text style={styles.body}>
        {state.kind === "none"
          ? "Write down scope, pay, payment terms and who owns the work. You both confirm the same version."
          : state.kind === "agreed"
            ? `Version ${state.version}${state.agreedAt ? ` · agreed ${shortDate(state.agreedAt)}` : ""}`
            : state.kind === "review"
              ? `Version ${state.version} changed since you last confirmed.`
              : `You confirmed version ${state.version}. They haven't yet.`}
      </Text>
      <Button
        label={state.action}
        size="sm"
        variant={state.kind === "review" || state.kind === "none" ? "primary" : "secondary"}
        onPress={open}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginRight: spacing.xs,
  },
  body: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  button: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
});
