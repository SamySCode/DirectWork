import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { isPro } from "../features/billing/api";
import { useBillingRedirect, useSubscription } from "../features/billing/hooks";
import { Plan, plans, PROFESSIONAL_PROMISE } from "../features/billing/plans";
import { billingAvailable } from "../features/billing/availability";
import { errorMessage } from "../lib/functions";
import { colors, radius, shadow, spacing, typography } from "../lib/theme";

export default function BillingScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const subscription = useSubscription();
  const redirect = useBillingRedirect();
  const pro = isPro(subscription.data);

  if (!billingAvailable) {
    return (
      <EmptyState
        icon="card-outline"
        title="Plans aren't available yet"
        description="Everyone gets the free plan for now."
      />
    );
  }

  const renderPlan = (plan: Plan, current: boolean, highlight: boolean) => (
    <Card key={plan.id} style={[styles.plan, highlight ? styles.planHighlight : null]}>
      <View style={styles.planHeader}>
        <Text style={[styles.planName, highlight ? styles.onInk : null]}>{plan.name}</Text>
        {current ? <Badge label="Your plan" tone={highlight ? "mint" : "neutral"} /> : null}
      </View>
      <View style={styles.priceRow}>
        <Text style={[styles.price, highlight ? styles.onInk : null]}>{plan.price}</Text>
        <Text style={[styles.cadence, highlight ? styles.onInkMuted : null]}>{plan.cadence}</Text>
      </View>
      <View style={styles.features}>
        {plan.features.map((feature) => (
          <View key={feature} style={styles.feature}>
            <Ionicons name="checkmark" size={16} color={highlight ? colors.mint : colors.accent} />
            <Text style={[styles.featureText, highlight ? styles.onInk : null]}>{feature}</Text>
          </View>
        ))}
      </View>
    </Card>
  );

  return (
    <Screen onRefresh={() => subscription.refetch()} refreshing={subscription.isRefetching}>
      {status === "success" ? (
        <Card style={styles.banner}>
          <Ionicons name="sparkles" size={18} color={colors.mintInk} />
          <Text style={styles.bannerText}>
            {pro
              ? "You're on Pro. Thanks for backing DirectWork."
              : "Payment received - activating Pro. Pull to refresh in a moment."}
          </Text>
        </Card>
      ) : null}

      <View style={styles.intro}>
        <Text style={styles.title}>More reach for your listings</Text>
        <Text style={styles.body}>{PROFESSIONAL_PROMISE}</Text>
      </View>

      {renderPlan(plans.pro, pro, true)}
      {renderPlan(plans.free, !pro, false)}

      {pro ? (
        <Button
          label="Manage subscription"
          variant="secondary"
          onPress={() => redirect.mutate("portal")}
          loading={redirect.isPending}
        />
      ) : (
        <Button
          label={`Upgrade to Pro - ${plans.pro.price}/month`}
          onPress={() => redirect.mutate("checkout")}
          loading={redirect.isPending}
        />
      )}
      {redirect.isError ? <Text style={styles.error}>{errorMessage(redirect.error)}</Text> : null}
      <Text style={styles.fineprint}>
        Payments are handled securely by Stripe. Cancel any time from Manage subscription - Pro
        stays active until the end of the period you've paid for.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.mintMuted,
    borderColor: colors.mintMuted,
  },
  bannerText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
  intro: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  plan: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  planHighlight: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    ...shadow.raised,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planName: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  price: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.display,
    color: colors.textPrimary,
  },
  cadence: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  features: {
    gap: spacing.sm,
  },
  feature: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  featureText: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  onInk: {
    color: colors.onInk,
  },
  onInkMuted: {
    color: colors.onInkMuted,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
    textAlign: "center",
  },
  fineprint: {
    fontSize: typography.size.xs,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: "center",
    borderRadius: radius.md,
  },
});
