import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Chip } from "../../../components/Chip";
import { Screen } from "../../../components/Screen";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { ImagePickerGrid } from "../../../components/ImagePickerGrid";
import { errorMessage } from "../../../lib/functions";
import { pickImages, PreparedImage } from "../../../lib/images";
import { useFormValidation } from "../../../lib/validation";
import { TipsCard } from "../../guide/components/TipsCard";
import { TalentPool } from "../../insights/components/TalentPool";
import { SkillsField } from "../../profile/components/SkillsField";
import { remotePrefOptions } from "../../profile/schemas";
import type { ImageDraft, ListingDetail, ListingImage } from "../api";
import { commitmentLabels, compensationLabels, remotePrefLabels } from "../labels";
import {
  commitmentOptions,
  compensationTypes,
  currencies,
  ListingInput,
  listingSchema,
} from "../schemas";

type ListingFormProps = {
  initial?: ListingDetail | null;
  saving: boolean;
  error?: string | null;
  /** submit = save and send to review in one go. */
  onSave: (input: ListingInput, images: ImageDraft, submit: boolean) => void;
};

const MAX_IMAGES = 4;

const str = (value: number | null | undefined) => (value == null ? "" : String(value));

export function ListingForm({ initial, saving, error, onSave }: ListingFormProps) {
  const [opportunityType, setOpportunityType] = useState<"paid" | "partner">(
    initial?.opportunity_type ?? "paid",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [publicSummary, setPublicSummary] = useState(initial?.public_summary ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [compensationType, setCompensationType] = useState(initial?.compensation_type ?? undefined);
  const [compensationMin, setCompensationMin] = useState(str(initial?.compensation_min));
  const [compensationMax, setCompensationMax] = useState(str(initial?.compensation_max));
  const [currency, setCurrency] = useState(initial?.currency ?? "GBP");
  const [remotePref, setRemotePref] = useState(initial?.remote_pref ?? undefined);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [commitment, setCommitment] = useState(initial?.commitment ?? undefined);
  const [duration, setDuration] = useState(initial?.duration ?? "");
  const admission = initial?.admission;
  const [whatExistsAlready, setWhatExistsAlready] = useState(admission?.what_exists_already ?? "");
  const [weeklyHours, setWeeklyHours] = useState(str(admission?.weekly_commitment_hours));
  const [firstMilestone, setFirstMilestone] = useState(admission?.first_milestone ?? "");
  const [proposedTerms, setProposedTerms] = useState(admission?.proposed_terms ?? "");
  const [ownerContribution, setOwnerContribution] = useState(admission?.owner_contribution ?? "");
  const [keptImages, setKeptImages] = useState<ListingImage[]>(initial?.images ?? []);
  const [addedImages, setAddedImages] = useState<(PreparedImage & { key: string })[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const partner = opportunityType === "partner";

  const form = useFormValidation(listingSchema, {
    title,
    publicSummary,
    opportunityType,
    location,
    remotePref,
    commitment,
    duration,
    compensationType: partner ? undefined : compensationType,
    compensationMin: partner ? undefined : compensationMin,
    compensationMax: partner ? undefined : compensationMax,
    currency,
    skills,
    admission: partner
      ? {
          whatExistsAlready,
          weeklyCommitmentHours: weeklyHours,
          firstMilestone,
          proposedTerms,
          ownerContribution,
        }
      : undefined,
  });
  const { errors, hasErrors } = form;
  const blur = (field: string) => () => form.touch(field);

  const imageCount = keptImages.length + addedImages.length;
  const addImages = async () => {
    setImageError(null);
    setPicking(true);
    try {
      const picked = await pickImages({ limit: MAX_IMAGES - imageCount });
      setAddedImages((prev) => [
        ...prev,
        ...picked.map((image, index) => ({ ...image, key: `new-${Date.now()}-${index}` })),
      ]);
    } catch (err) {
      setImageError(errorMessage(err));
    } finally {
      setPicking(false);
    }
  };

  const handle = (submit: boolean) => {
    const data = form.submit();
    if (data) onSave(data, { keep: keptImages, added: addedImages }, submit);
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {hasErrors ? (
            <Text style={styles.formError}>Fix the highlighted fields to continue.</Text>
          ) : null}
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <View style={styles.footerButtons}>
            <Button
              label="Save draft"
              variant="secondary"
              onPress={() => handle(false)}
              disabled={saving}
              style={styles.footerButton}
            />
            <Button
              label="Submit for review"
              onPress={() => handle(true)}
              loading={saving}
              style={styles.footerButton}
            />
          </View>
        </View>
      }
    >
      <TipsCard section="listing" />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What are you offering?</Text>
        <View style={styles.typeRow}>
          {(
            [
              {
                key: "paid",
                title: "Paid work",
                body: "You pay for the work",
                icon: "cash-outline",
              },
              {
                key: "partner",
                title: "Partnership",
                body: "Equity or a share, not a fee",
                icon: "git-merge-outline",
              },
            ] as const
          ).map((option) => {
            const selected = opportunityType === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setOpportunityType(option.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.typeCard, selected ? styles.typeCardSelected : null]}
              >
                <Ionicons
                  name={option.icon}
                  size={22}
                  color={selected ? colors.accent : colors.textSecondary}
                />
                <Text style={styles.typeTitle}>{option.title}</Text>
                <Text style={styles.typeBody}>{option.body}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>The work</Text>
        <TextField
          label="Title"
          required
          maxLength={120}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
          placeholder={
            partner
              ? "e.g. Technical co-founder for a clinic booking app"
              : "e.g. React Native developer for a 6-week MVP"
          }
          onBlur={blur("title")}
          error={errors.title}
        />
        <TextField
          label="Description"
          required
          maxLength={2000}
          showCount
          value={publicSummary}
          onChangeText={setPublicSummary}
          autoCapitalize="sentences"
          multiline
          numberOfLines={6}
          placeholder="What needs doing, what done looks like, and who you are."
          onBlur={blur("publicSummary")}
          error={errors.publicSummary}
        />
        <SkillsField
          label="Skills you need"
          value={skills}
          onChange={(next) => {
            setSkills(next);
            form.touch("skills");
          }}
          error={errors.skills}
        />
        <TalentPool skills={skills} type={opportunityType} />
        <ImagePickerGrid
          label="Images (optional)"
          images={[
            ...keptImages.map((image) => ({ key: image.id, uri: image.url })),
            ...addedImages.map((image) => ({ key: image.key, uri: image.uri })),
          ]}
          max={MAX_IMAGES}
          onAdd={addImages}
          onRemove={(key) => {
            setKeptImages((prev) => prev.filter((image) => image.id !== key));
            setAddedImages((prev) => prev.filter((image) => image.key !== key));
          }}
          busy={picking}
          error={imageError}
          hint="Mockups, screenshots or product photos. The first one is the cover in Discover."
        />
      </View>

      {partner ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admission criteria</Text>
          <Card style={styles.explainer}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
            <Text style={styles.explainerText}>
              Strong professionals get pitched vague ideas every week. These answers show yours is
              real, and our reviewers check them before the listing goes live.
            </Text>
          </Card>
          <TextField
            label="What exists today?"
            required
            maxLength={1000}
            showCount
            value={whatExistsAlready}
            onChangeText={setWhatExistsAlready}
            autoCapitalize="sentences"
            multiline
            numberOfLines={3}
            placeholder="Prototype, research, customers, revenue, a waitlist..."
            onBlur={blur("whatExistsAlready")}
            error={errors.whatExistsAlready}
          />
          <TextField
            label="Hours per week you need from them"
            required
            maxLength={2}
            value={weeklyHours}
            onChangeText={setWeeklyHours}
            keyboardType="number-pad"
            placeholder="e.g. 10"
            onBlur={blur("weeklyCommitmentHours")}
            error={errors.weeklyCommitmentHours}
          />
          <TextField
            label="First milestone"
            required
            maxLength={500}
            showCount
            value={firstMilestone}
            onChangeText={setFirstMilestone}
            autoCapitalize="sentences"
            placeholder="e.g. Paid pilot with 3 clinics by March"
            onBlur={blur("firstMilestone")}
            error={errors.firstMilestone}
          />
          <TextField
            label="Proposed terms"
            required
            maxLength={500}
            showCount
            value={proposedTerms}
            onChangeText={setProposedTerms}
            autoCapitalize="sentences"
            placeholder="e.g. 10% equity, 4-year vest, 1-year cliff"
            onBlur={blur("proposedTerms")}
            error={errors.proposedTerms}
          />
          <TextField
            label="What you're putting in"
            required
            maxLength={500}
            showCount
            value={ownerContribution}
            onChangeText={setOwnerContribution}
            autoCapitalize="sentences"
            multiline
            numberOfLines={3}
            placeholder="Your time, funding, domain expertise, customer access..."
            onBlur={blur("ownerContribution")}
            error={errors.ownerContribution}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pay</Text>
          <View style={styles.chipRow}>
            {compensationTypes.map((option) => (
              <Chip
                key={option}
                label={compensationLabels[option]}
                selected={compensationType === option}
                onPress={() => setCompensationType(option)}
              />
            ))}
          </View>
          {errors.compensationType ? (
            <Text style={styles.error}>{errors.compensationType}</Text>
          ) : null}
          <View style={styles.amountRow}>
            <View style={styles.amount}>
              <TextField
                label="From (optional)"
                value={compensationMin}
                onChangeText={setCompensationMin}
                keyboardType="number-pad"
                onBlur={blur("compensationMin")}
                error={errors.compensationMin}
              />
            </View>
            <View style={styles.amount}>
              <TextField
                label="Up to (optional)"
                value={compensationMax}
                onChangeText={setCompensationMax}
                keyboardType="number-pad"
                onBlur={blur("compensationMax")}
                error={errors.compensationMax}
              />
            </View>
          </View>
          <View style={styles.chipRow}>
            {currencies.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={currency === option}
                onPress={() => setCurrency(option)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Where and when</Text>
        <View style={styles.chipRow}>
          {remotePrefOptions.map((option) => (
            <Chip
              key={option}
              label={remotePrefLabels[option]}
              selected={remotePref === option}
              onPress={() => setRemotePref(remotePref === option ? undefined : option)}
            />
          ))}
        </View>
        <TextField
          label="Location (optional)"
          value={location}
          onChangeText={setLocation}
          autoCapitalize="words"
          placeholder="e.g. London, or UK only"
          onBlur={blur("location")}
          error={errors.location}
        />
        <View style={styles.chipRow}>
          {commitmentOptions.map((option) => (
            <Chip
              key={option}
              label={commitmentLabels[option]}
              selected={commitment === option}
              onPress={() => setCommitment(commitment === option ? undefined : option)}
            />
          ))}
        </View>
        <TextField
          label="Duration (optional)"
          value={duration}
          onChangeText={setDuration}
          placeholder="e.g. 6 weeks, or ongoing"
          onBlur={blur("duration")}
          error={errors.duration}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
  },
  typeRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  typeCard: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  typeTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  typeBody: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  explainer: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentMuted,
  },
  explainerText: {
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  amountRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  amount: {
    flex: 1,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
  footer: {
    gap: spacing.sm,
  },
  footerButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  formError: {
    fontSize: typography.size.sm,
    color: colors.danger,
    textAlign: "center",
  },
});
