import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Chip } from "../../../components/Chip";
import { LoadingState } from "../../../components/LoadingState";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { signOut } from "../../../features/auth/api";
import { useAuth } from "../../../features/auth/SessionProvider";
import { upsertMyProfile } from "../../../features/profile/api";
import { SkillsField } from "../../../features/profile/components/SkillsField";
import { useMyProfile } from "../../../features/profile/hooks";
import { profileSchema, remotePrefOptions } from "../../../features/profile/schemas";
import { colors, spacing, typography } from "../../../lib/theme";
import { fieldErrors } from "../../../lib/validation";

const remotePrefLabels: Record<(typeof remotePrefOptions)[number], string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  flexible: "Flexible",
};

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { profile, skills, loading, refetch } = useMyProfile(userId);

  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [remotePref, setRemotePref] = useState<(typeof remotePrefOptions)[number] | undefined>();
  const [availability, setAvailability] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [seekingPaid, setSeekingPaid] = useState(false);
  const [seekingPartner, setSeekingPartner] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setHeadline(profile.headline);
      setBio(profile.bio ?? "");
      setLocation(profile.location ?? "");
      setRemotePref(profile.remote_pref ?? undefined);
      setAvailability(profile.availability ?? "");
      setCurrentRole(profile.current_title ?? "");
      setExperienceLevel(profile.experience_level ?? "");
      setSeekingPaid(profile.seeking_paid);
      setSeekingPartner(profile.seeking_partner);
      setPortfolioUrl(profile.portfolio_url ?? "");
    }
    setSelectedSkills(skills);
  }, [profile, skills]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setFormError(null);
    setSaved(false);
    const result = profileSchema.safeParse({
      fullName,
      headline,
      bio: bio || undefined,
      location: location || undefined,
      remotePref,
      availability: availability || undefined,
      currentRole: currentRole || undefined,
      experienceLevel: experienceLevel || undefined,
      seekingPaid,
      seekingPartner,
      portfolioUrl,
      skills: selectedSkills,
    });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await upsertMyProfile(userId, result.data);
      setSaved(true);
      await refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Your profile</Text>

        <View style={styles.fields}>
          <TextField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
          />
          <TextField
            label="Headline"
            value={headline}
            onChangeText={setHeadline}
            placeholder="e.g. Senior React Native Engineer"
            error={errors.headline}
          />
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            error={errors.bio}
          />
          <TextField
            label="Location"
            value={location}
            onChangeText={setLocation}
            error={errors.location}
          />
          <TextField
            label="Current or preferred role"
            value={currentRole}
            onChangeText={setCurrentRole}
            error={errors.currentRole}
          />
          <TextField
            label="Experience level"
            value={experienceLevel}
            onChangeText={setExperienceLevel}
            placeholder="e.g. 5+ years"
            error={errors.experienceLevel}
          />
          <TextField
            label="Availability"
            value={availability}
            onChangeText={setAvailability}
            placeholder="e.g. 20 hrs/week"
            error={errors.availability}
          />
          <TextField
            label="Portfolio URL"
            value={portfolioUrl}
            onChangeText={setPortfolioUrl}
            keyboardType="url"
            error={errors.portfolioUrl}
          />

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Remote preference</Text>
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

          <SkillsField value={selectedSkills} onChange={setSelectedSkills} error={errors.skills} />

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Looking for</Text>
            <View style={styles.chipRow}>
              <Chip
                label="Paid work"
                selected={seekingPaid}
                onPress={() => setSeekingPaid((value) => !value)}
              />
              <Chip
                label="Partnership"
                selected={seekingPartner}
                onPress={() => setSeekingPartner((value) => !value)}
              />
            </View>
            {errors.seekingPaid ? <Text style={styles.error}>{errors.seekingPaid}</Text> : null}
          </View>
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        {saved ? <Text style={styles.saved}>Profile saved.</Text> : null}

        <Button label="Save profile" onPress={handleSave} loading={saving} />

        <View style={styles.footer}>
          {session?.user.email ? (
            <Text style={styles.email}>Signed in as {session.user.email}</Text>
          ) : null}
          <Button
            label="Sign out"
            variant="secondary"
            onPress={handleSignOut}
            loading={signingOut}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  fields: {
    gap: spacing.md,
  },
  group: {
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
  error: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
  formError: {
    color: colors.danger,
    fontSize: typography.size.sm,
  },
  saved: {
    color: colors.success,
    fontSize: typography.size.sm,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  email: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
