import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { ConnectMark } from "../../components/ConnectMark";
import { FadeIn } from "../../components/FadeIn";
import { Text } from "../../components/Text";
import { Wordmark } from "../../components/Wordmark";
import { FactCard } from "../../features/insights/components/FactCard";
import { fearOfFailure, ghosting } from "../../features/insights/facts";
import { colors, gradients, radius, spacing, typography } from "../../lib/theme";

// The three things that make this different from a job board, each tied to
// something the product actually enforces.
const promises = [
  {
    title: "Every listing is reviewed",
    body: "Partner projects show what's already built, the weekly commitment, and the terms, before anyone applies.",
  },
  {
    title: "Straight to the person",
    body: "When you both say yes, you get each other's contact details. No recruiters, no inbox games.",
  },
  {
    title: "A record you can't fake",
    body: "Finished collaborations count only when both sides confirm them.",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.page}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.column}>
          <FadeIn>
            <View style={styles.hero}>
              <Wordmark tone="light" />
              <Text style={styles.headline}>
                Find the people who'll actually build it with you.
              </Text>
              <Text style={styles.sub}>
                A curated place for professionals to take on paid projects or join early ventures as
                partners.
              </Text>
            </View>
          </FadeIn>

          <View style={styles.promises}>
            {promises.map((promise, index) => (
              <View key={promise.title} style={styles.promise}>
                <ConnectMark size={20} tone="light" lit={index === promises.length - 1} />
                <View style={styles.promiseText}>
                  <Text style={styles.promiseTitle}>{promise.title}</Text>
                  <Text style={styles.promiseBody}>{promise.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.facts}>
            <Text style={styles.factsTitle}>Why this exists</Text>
            <FactCard fact={fearOfFailure} tone="dark" color={colors.mint} />
            <FactCard fact={ghosting} tone="dark" color={colors.mint} />
          </View>

          <View style={styles.actions}>
            <Button
              label="Create your profile"
              variant="light"
              onPress={() => router.push("/sign-up")}
            />
            <Button
              label="I already have an account"
              variant="onDark"
              onPress={() => router.push("/sign-in")}
            />
            <Text style={styles.free}>Free for professionals, always.</Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  column: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
  },
  headline: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.display,
    lineHeight: 46,
    color: colors.onInk,
    letterSpacing: -1,
    marginTop: spacing.lg,
  },
  sub: {
    fontSize: typography.size.md,
    lineHeight: 24,
    color: colors.onInkMuted,
  },
  promises: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  promise: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  promiseText: {
    flex: 1,
    gap: 2,
    marginTop: -3,
  },
  promiseTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.onInk,
  },
  promiseBody: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.onInkMuted,
  },
  facts: {
    gap: spacing.md,
  },
  factsTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.onInkMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  actions: {
    gap: spacing.sm,
  },
  free: {
    textAlign: "center",
    fontSize: typography.size.xs,
    color: colors.onInkMuted,
    marginTop: spacing.xs,
  },
});
