import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "../../../components/Card";
import { NodeMeter } from "../../../components/NodeMeter";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";

export type FirstStep = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  onPress?: () => void;
};

/**
 * The first-run path on Home, shown until someone has applied or posted.
 * The next undone step is emphasised; finished ones stay visible (ticked)
 * so progress feels earned rather than disappearing.
 */
export function FirstSteps({ steps }: { steps: FirstStep[] }) {
  const done = steps.filter((step) => step.done).length;
  const nextKey = steps.find((step) => !step.done)?.key;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Your first steps
        </Text>
        <NodeMeter
          total={steps.length}
          lit={done}
          size={11}
          accessibilityLabel={`${done} of ${steps.length} first steps done`}
        />
      </View>
      {steps.map((step) => {
        const isNext = step.key === nextKey;
        const content = (
          <>
            <Ionicons
              name={
                step.done ? "checkmark-circle" : isNext ? "arrow-forward-circle" : "ellipse-outline"
              }
              size={24}
              color={step.done ? colors.mintInk : isNext ? colors.accent : colors.textMuted}
            />
            <View style={styles.stepText}>
              <Text
                style={[
                  styles.stepLabel,
                  step.done ? styles.stepDone : null,
                  isNext ? styles.stepNext : null,
                ]}
              >
                {step.label}
              </Text>
              {!step.done ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
            </View>
            {step.onPress && !step.done ? (
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            ) : null}
          </>
        );
        return step.onPress && !step.done ? (
          <Pressable
            key={step.key}
            onPress={step.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${step.label}. ${step.detail}`}
            style={styles.step}
          >
            {content}
          </Pressable>
        ) : (
          <View
            key={step.key}
            style={styles.step}
            accessible
            accessibilityLabel={`${step.label}${step.done ? ", done" : ""}`}
          >
            {content}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
  stepNext: {
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  stepDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  stepDetail: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
