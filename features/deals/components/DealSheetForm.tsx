import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Chip } from "../../../components/Chip";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { dealCurrencies, ipTermsOptions, payBases, type DealSheet, type DealTerms } from "../api";
import { ipTermsLabels, payBasisLabels } from "../labels";
import {
  dealSheetSchema,
  fieldErrors,
  MAX_MILESTONES,
  toDealTerms,
  type DealSheetForm as FormValues,
} from "../schemas";
import { a11yState } from "../../../lib/accessibility";

type Prefill = {
  scope: string;
  payBasis: FormValues["payBasis"];
  currency: FormValues["currency"];
  amount: string;
  equityPercent: string;
  vestingMonths: string;
  cliffMonths: string;
};

/** Form values from the current sheet (editing) or the listing (first proposal). */
export function initialDealForm(
  sheet: DealSheet | null,
  prefill: Prefill,
  partner: boolean,
  business: boolean,
): FormValues {
  const str = (value: number | null | undefined) => (value == null ? "" : String(value));
  if (!sheet) {
    return {
      partner,
      scope: prefill.scope,
      payBasis: prefill.payBasis,
      amount: prefill.amount,
      currency: prefill.currency,
      paymentTermsDays: "14",
      milestones: [],
      ipTerms: "client_owns_on_payment",
      ipNotes: "",
      equityPercent: prefill.equityPercent,
      vestingMonths: prefill.vestingMonths,
      cliffMonths: prefill.cliffMonths,
      decisionRights: "",
      business,
    };
  }
  return {
    partner,
    scope: sheet.scope,
    payBasis: sheet.pay_basis,
    amount: str(sheet.amount),
    currency: sheet.currency,
    paymentTermsDays: String(sheet.payment_terms_days),
    milestones: sheet.milestones.map((m) => ({
      title: m.title,
      dueDate: m.due_date,
      amount: str(m.amount),
    })),
    ipTerms: sheet.ip_terms,
    ipNotes: sheet.ip_notes ?? "",
    equityPercent: str(sheet.equity_percent),
    vestingMonths: str(sheet.vesting_months),
    cliffMonths: str(sheet.cliff_months),
    decisionRights: sheet.decision_rights ?? "",
    business,
  };
}

type DealSheetFormProps = {
  initial: FormValues;
  partner: boolean;
  /** True when a sheet exists: proposing replaces it with a new version. */
  editing: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (terms: DealTerms, business: boolean) => void;
  onCancel?: () => void;
};

export function DealSheetForm({
  initial,
  partner,
  editing,
  submitting,
  error,
  onSubmit,
  onCancel,
}: DealSheetFormProps) {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const milestones = values.milestones;
  const setMilestone = (index: number, patch: Partial<(typeof milestones)[number]>) =>
    set(
      "milestones",
      milestones.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );

  const bases = payBases.filter((basis) => partner || (basis !== "equity" && basis !== "mixed"));
  const equity = partner && (values.payBasis === "equity" || values.payBasis === "mixed");

  const submit = () => {
    const parsed = dealSheetSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    onSubmit(toDealTerms(parsed.data), parsed.data.business);
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Scope"
        required
        value={values.scope}
        onChangeText={(text) => set("scope", text)}
        multiline
        maxLength={2000}
        showCount
        hint="What will be delivered, and what's not included."
        error={errors.scope}
      />

      <View style={styles.group}>
        <Text style={styles.label}>Pay basis</Text>
        <View style={styles.chips}>
          {bases.map((basis) => (
            <Chip
              key={basis}
              label={payBasisLabels[basis]}
              selected={values.payBasis === basis}
              onPress={() => set("payBasis", basis)}
            />
          ))}
        </View>
        {errors.payBasis ? <Text style={styles.error}>{errors.payBasis}</Text> : null}
      </View>

      {values.payBasis !== "equity" ? (
        <>
          <TextField
            label={
              values.payBasis === "hourly"
                ? "Hourly rate"
                : values.payBasis === "daily"
                  ? "Day rate"
                  : "Amount"
            }
            required={values.payBasis !== "mixed"}
            value={values.amount ?? ""}
            onChangeText={(text) => set("amount", text)}
            keyboardType="decimal-pad"
            error={errors.amount}
          />
          <View style={styles.group}>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.chips}>
              {dealCurrencies.map((currency) => (
                <Chip
                  key={currency}
                  label={currency}
                  selected={values.currency === currency}
                  onPress={() => set("currency", currency)}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}

      <TextField
        label="Payment terms (days after invoice or milestone)"
        required
        value={values.paymentTermsDays}
        onChangeText={(text) => set("paymentTermsDays", text)}
        keyboardType="number-pad"
        error={errors.paymentTermsDays}
      />

      <View style={styles.group}>
        <Text style={styles.label}>Milestones</Text>
        <Text style={styles.hint}>
          Optional, up to {MAX_MILESTONES}. Payment reports are made per milestone once its date
          passes.
        </Text>
        {milestones.map((milestone, index) => (
          <View key={index} style={styles.milestone}>
            <View style={styles.milestoneHeader}>
              <Text style={styles.milestoneTitle}>Milestone {index + 1}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove milestone ${index + 1}`}
                onPress={() =>
                  set(
                    "milestones",
                    milestones.filter((_, i) => i !== index),
                  )
                }
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextField
              label="Title"
              value={milestone.title}
              onChangeText={(text) => setMilestone(index, { title: text })}
              maxLength={120}
              error={errors[`milestones.${index}.title`]}
            />
            <TextField
              label="Due date (YYYY-MM-DD)"
              value={milestone.dueDate}
              onChangeText={(text) => setMilestone(index, { dueDate: text })}
              autoCapitalize="none"
              error={errors[`milestones.${index}.dueDate`]}
            />
            {values.payBasis !== "equity" ? (
              <TextField
                label="Amount"
                value={milestone.amount ?? ""}
                onChangeText={(text) => setMilestone(index, { amount: text })}
                keyboardType="decimal-pad"
                error={errors[`milestones.${index}.amount`]}
              />
            ) : null}
          </View>
        ))}
        {milestones.length < MAX_MILESTONES ? (
          <Button
            label="Add a milestone"
            icon="add"
            variant="secondary"
            size="sm"
            onPress={() =>
              set("milestones", [...milestones, { title: "", dueDate: "", amount: "" }])
            }
            style={styles.start}
          />
        ) : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Who owns the work (IP)</Text>
        <View style={styles.chips}>
          {ipTermsOptions.map((option) => (
            <Chip
              key={option}
              label={ipTermsLabels[option]}
              selected={values.ipTerms === option}
              onPress={() => set("ipTerms", option)}
            />
          ))}
        </View>
      </View>
      <TextField
        label="IP notes"
        required={values.ipTerms === "other"}
        value={values.ipNotes ?? ""}
        onChangeText={(text) => set("ipNotes", text)}
        multiline
        maxLength={500}
        error={errors.ipNotes}
      />

      {equity ? (
        <>
          <TextField
            label="Equity %"
            required
            value={values.equityPercent ?? ""}
            onChangeText={(text) => set("equityPercent", text)}
            keyboardType="decimal-pad"
            error={errors.equityPercent}
          />
          <TextField
            label="Vesting (months)"
            value={values.vestingMonths ?? ""}
            onChangeText={(text) => set("vestingMonths", text)}
            keyboardType="number-pad"
            error={errors.vestingMonths}
          />
          <TextField
            label="Cliff (months)"
            value={values.cliffMonths ?? ""}
            onChangeText={(text) => set("cliffMonths", text)}
            keyboardType="number-pad"
            error={errors.cliffMonths}
          />
        </>
      ) : null}
      {partner ? (
        <TextField
          label="Decision rights"
          value={values.decisionRights ?? ""}
          onChangeText={(text) => set("decisionRights", text)}
          multiline
          maxLength={500}
          hint="Who decides what, and what happens if one of you leaves."
          error={errors.decisionRights}
        />
      ) : null}

      <BusinessCheckbox
        checked={values.business}
        onChange={(checked) => set("business", checked)}
      />

      <Text style={styles.hint}>
        {editing
          ? "Proposing changes makes a new version. Both of you then confirm it again."
          : "The other side reviews these terms. It's agreed once you've both confirmed the same version."}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttons}>
        {onCancel ? (
          <Button
            label="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={submitting}
            style={styles.flex}
          />
        ) : null}
        <Button
          label={editing ? "Propose changes" : "Propose terms"}
          onPress={submit}
          loading={submitting}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

export const BUSINESS_LABEL = "I'm acting in the course of business (as a business or sole trader)";

export function BusinessCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      {...a11yState({ checked })}
      accessibilityLabel={BUSINESS_LABEL}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
      hitSlop={4}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
      </View>
      <View style={styles.flex}>
        <Text style={styles.checkLabel}>{BUSINESS_LABEL}</Text>
        <Text style={styles.hint}>
          Each of you confirms this for yourself. When you both do, late payment interest under UK
          law can apply.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  milestone: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  milestoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  milestoneTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  start: {
    alignSelf: "flex-start",
  },
  checkRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkLabel: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
