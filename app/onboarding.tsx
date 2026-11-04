import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { FadeIn } from "../components/FadeIn";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { TextField } from "../components/TextField";
import { signOut } from "../features/auth/api";
import { SkillsField } from "../features/profile/components/SkillsField";
import { useSaveProfile } from "../features/profile/hooks";
import { profileSchema, remotePrefOptions } from "../features/profile/schemas";
import { remotePrefLabels } from "../features/listings/labels";
import { errorMessage } from "../lib/functions";
import { colors, radius, spacing, typography } from "../lib/theme";
import { useFormValidation } from "../lib/validation";

type Intent = "seekingPaid" | "seekingPartner" | "wantsToHire";

const intents: {
  key: Intent;
  title: string;
  body: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}[] = [
  {
    key: "seekingPaid",
    title: "Find paid projects",
    body: "Freelance or contract work, paid by the hour, day, or project.",
    icon: "briefcase-outline",
  },
  {
    key: "seekingPartner",
    title: "Join a venture as a partner",
    body: "Early projects offering equity or a share, for the right person.",
    icon: "git-merge-outline",
  },
  {
    key: "wantsToHire",
    title: "Post a project",
    body: "Find professionals for your paid work or your venture.",
    icon: "megaphone-outline",
  },
];

const STEPS = ["What brings you here?", "About you", "What you bring"] as const;

// Which fields each step owns: Continue only checks the current step's
// fields, and a final-submit error sends you back to the step that can fix it.
const STEP_FIELDS: string[][] = [
  ["seekingPaid"],
  ["fullName", "headline", "location"],
  ["skills", "availability"],
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const save = useSaveProfile();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<Record<Intent, boolean>>({
    seekingPaid: false,
    seekingPartner: false,
    wantsToHire: false,
  });
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [remotePref, setRemotePref] = useState<(typeof remotePrefOptions)[number] | undefined>();
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");

  const hiringOnly = intent.wantsToHire && !intent.seekingPaid && !intent.seekingPartner;

  const form = useFormValidation(profileSchema, {
    fullName,
    headline,
    location: location || undefined,
    remotePref,
    availability: availability || undefined,
    ...intent,
    portfolioUrl: "",
    skills,
  });
  const { errors } = form;
  const blur = (field: string) => () => form.touch(field);

  const next = () => {
    const fields = STEP_FIELDS[step] ?? [];
    fields.forEach(form.touch);
    if (!fields.some((field) => field in form.allErrors)) setStep((s) => s + 1);
  };

  const finish = () => {
    const data = form.submit();
    if (!data) {
      const firstStep = STEP_FIELDS.findIndex((fields) =>
        fields.some((field) => field in form.allErrors),
      );
      setStep(firstStep === -1 ? STEPS.length - 1 : firstStep);
      return;
    }
    // On success the root guard sees the new profile and moves to /home.
    save.mutate(data);
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep((s) => s - 1)}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}
        <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, index) => (
            <View
              key={label}
              style={[styles.progressSegment, index <= step ? styles.progressActive : null]}
            />
          ))}
        </View>
        <Pressable onPress={() => signOut()} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <Screen
        footer={
          <View style={styles.footer}>
            {save.isError ? <Text style={styles.formError}>{errorMessage(save.error)}</Text> : null}
            {step < STEPS.length - 1 ? (
              <Button label="Continue" onPress={next} />
            ) : (
              <Button label="Finish setup" onPress={finish} loading={save.isPending} />
            )}
          </View>
        }
      >
        <FadeIn key={step}>
          <View style={styles.stepBody}>
            <Text style={styles.eyebrow}>
              Step {step + 1} of {STEPS.length}
            </Text>
            <Text style={styles.title}>{STEPS[step]}</Text>

            {step === 0 ? (
              <View style={styles.group}>
                <Text style={styles.lead}>
                  Pick everything that applies. You can change this later.
                </Text>
                {intents.map((option) => {
                  const selected = intent[option.key];
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() =>
                        setIntent((prev) => ({ ...prev, [option.key]: !prev[option.key] }))
                      }
                      style={[styles.option, selected ? styles.optionSelected : null]}
                    >
                      <View
                        style={[styles.optionIcon, selected ? styles.optionIconSelected : null]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={22}
                          color={selected ? colors.onAccent : colors.accent}
                        />
                      </View>
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>{option.title}</Text>
                        <Text style={styles.optionBody}>{option.body}</Text>
                      </View>
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={selected ? colors.accent : colors.border}
                      />
                    </Pressable>
                  );
                })}
                {errors.seekingPaid ? <Text style={styles.error}>{errors.seekingPaid}</Text> : null}
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.group}>
                <TextField
                  label="Full name"
                  required
                  maxLength={200}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoComplete="name"
                  onBlur={blur("fullName")}
                  error={errors.fullName}
                />
                <TextField
                  label="Headline"
                  required
                  maxLength={200}
                  showCount
                  value={headline}
                  onChangeText={setHeadline}
                  autoCapitalize="sentences"
                  placeholder={
                    hiringOnly
                      ? "e.g. Founder, building a booking app"
                      : "e.g. Product designer, 8 years in fintech"
                  }
                  onBlur={blur("headline")}
                  error={errors.headline}
                />
                <TextField
                  label="Location (optional)"
                  value={location}
                  onChangeText={setLocation}
                  autoCapitalize="words"
                  placeholder="e.g. Manchester, UK"
                  onBlur={blur("location")}
                  error={errors.location}
                />
                <View style={styles.chipGroup}>
                  <Text style={styles.groupLabel}>How do you like to work?</Text>
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
                </View>
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.group}>
                <Text style={styles.lead}>
                  {hiringOnly
                    ? "Your own skills help professionals see what you bring to the team."
                    : "Listings that need these skills are highlighted for you in Discover."}
                </Text>
                <SkillsField
                  value={skills}
                  onChange={(next) => {
                    setSkills(next);
                    form.touch("skills");
                  }}
                  error={errors.skills}
                />
                {!hiringOnly ? (
                  <TextField
                    label="Availability (optional)"
                    value={availability}
                    onChangeText={setAvailability}
                    autoCapitalize="sentences"
                    placeholder="e.g. 15 hrs/week from January"
                    onBlur={blur("availability")}
                    error={errors.availability}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </FadeIn>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconSpacer: {
    width: 22,
  },
  progress: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressActive: {
    backgroundColor: colors.accent,
  },
  signOut: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  stepBody: {
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  lead: {
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  group: {
    gap: spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentMuted,
  },
  optionIconSelected: {
    backgroundColor: colors.accent,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  optionBody: {
    fontSize: typography.size.sm,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  chipGroup: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
  formError: {
    fontSize: typography.size.sm,
    color: colors.danger,
    textAlign: "center",
  },
});
