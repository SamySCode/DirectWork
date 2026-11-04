import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button } from "../../../components/Button";
import { Chip } from "../../../components/Chip";
import { FadeIn } from "../../../components/FadeIn";
import { Text } from "../../../components/Text";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import type { DiscoverSort } from "../api";
import { commitmentLabels, compensationLabels } from "../labels";
import { commitmentOptions, compensationTypes } from "../schemas";
import type { useDiscoverFilters } from "../useDiscoverFilters";

type Filters = ReturnType<typeof useDiscoverFilters>;

const SORTS: { value: DiscoverSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "match", label: "Best match" },
  { value: "pay", label: "Highest pay" },
];

type Props = {
  filters: Filters;
  open: boolean;
  onToggle: () => void;
  tint: string;
  /** Hidden when the viewer has no skills - "best match" means nothing then. */
  canMatch: boolean;
};

/** Sort + "Filters" toggle, the expandable panel, and removable active-filter chips. */
export function DiscoverFilterPanel({ filters, open, onToggle, tint, canMatch }: Props) {
  const { refine, update, active } = filters;
  const sorts = SORTS.filter((sort) => canMatch || sort.value !== "match");

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <View style={styles.sorts} accessibilityLabel="Sort listings">
          {sorts.map((sort) => (
            <Chip
              key={sort.value}
              label={sort.label}
              tint={tint}
              selected={filters.sort === sort.value}
              onPress={() => filters.setSort(sort.value)}
            />
          ))}
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Filters${active.length ? `, ${active.length} applied` : ""}`}
          style={[styles.toggle, open || active.length ? { borderColor: tint } : null]}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={open || active.length ? tint : colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              { color: open || active.length ? tint : colors.textSecondary },
            ]}
          >
            Filters{active.length ? ` · ${active.length}` : ""}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <FadeIn duration={160}>
          <View style={styles.panel}>
            <Group title="Commitment">
              {commitmentOptions.map((option) => (
                <Chip
                  key={option}
                  label={commitmentLabels[option]}
                  tint={tint}
                  selected={refine.commitment === option}
                  onPress={() =>
                    update({ commitment: refine.commitment === option ? undefined : option })
                  }
                />
              ))}
            </Group>

            {filters.payApplies ? (
              <>
                <Group title="Pay">
                  {compensationTypes.map((option) => (
                    <Chip
                      key={option}
                      label={compensationLabels[option]}
                      tint={tint}
                      selected={refine.compensationType === option}
                      onPress={() =>
                        update({
                          compensationType: refine.compensationType === option ? undefined : option,
                        })
                      }
                    />
                  ))}
                </Group>
                <View style={styles.minPay}>
                  <Text style={styles.groupTitle}>Minimum pay (£)</Text>
                  <TextInput
                    value={refine.minPay}
                    onChangeText={(text) =>
                      update({ minPay: text.replace(/[^\d]/g, "").slice(0, 7) })
                    }
                    placeholder="Any"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    accessibilityLabel="Minimum pay in pounds"
                    style={styles.input}
                  />
                </View>
              </>
            ) : null}

            <Group title="More">
              <Chip
                label="Remote-friendly"
                tint={tint}
                selected={refine.remoteOnly}
                onPress={() => update({ remoteOnly: !refine.remoteOnly })}
              />
              {canMatch ? (
                <Chip
                  label="Needs my skills"
                  tint={tint}
                  selected={refine.matchesOnly}
                  onPress={() => update({ matchesOnly: !refine.matchesOnly })}
                />
              ) : null}
            </Group>

            <View style={styles.panelActions}>
              <Button
                label="Clear all"
                variant="ghost"
                size="sm"
                onPress={filters.clear}
                disabled={active.length === 0}
              />
              <Button label="Done" size="sm" onPress={onToggle} />
            </View>
          </View>
        </FadeIn>
      ) : null}

      {!open && active.length > 0 ? (
        <View style={styles.activeRow}>
          {active.map((filter) => (
            <Pressable
              key={filter.key}
              onPress={() => filters.remove(filter.key)}
              accessibilityRole="button"
              accessibilityLabel={`Remove filter: ${filter.label}`}
              hitSlop={6}
              style={[styles.activeChip, { borderColor: tint }]}
            >
              <Text style={[styles.activeText, { color: tint }]}>{filter.label}</Text>
              <Ionicons name="close" size={14} color={tint} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  sorts: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  panel: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  minPay: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 44,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  panelActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  activeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  activeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
