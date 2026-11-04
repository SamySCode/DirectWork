import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Chip } from "../../components/Chip";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { TextField } from "../../components/TextField";
import { TipsCard } from "../../features/guide/components/TipsCard";
import { remotePrefLabels } from "../../features/profile/labels";
import { ProfileImagesEditor } from "../../features/profile/components/ProfileImagesEditor";
import { SkillsField } from "../../features/profile/components/SkillsField";
import { useMyProfile, useSaveProfile } from "../../features/profile/hooks";
import { profileSchema, remotePrefOptions } from "../../features/profile/schemas";
import { errorMessage } from "../../lib/functions";
import { colors, spacing, typography } from "../../lib/theme";
import { useFormValidation } from "../../lib/validation";

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, skills, loading } = useMyProfile();
  const save = useSaveProfile();

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
  const [wantsToHire, setWantsToHire] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Fill the form once per profile. Later refetches (e.g. after changing the
  // photo below) must not overwrite what someone has typed but not saved.
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !profile || hydratedFor.current === profile.id) return;
    hydratedFor.current = profile.id;
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
    setWantsToHire(profile.wants_to_hire);
    setPortfolioUrl(profile.portfolio_url ?? "");
    setSelectedSkills(skills);
  }, [loading, profile, skills]);

  const form = useFormValidation(profileSchema, {
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
    wantsToHire,
    portfolioUrl,
    skills: selectedSkills,
  });
  const { errors } = form;
  const blur = (field: string) => () => form.touch(field);

  const handleSave = () => {
    const data = form.submit();
    if (data) save.mutate(data, { onSuccess: () => router.back() });
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {form.hasErrors ? (
            <Text style={styles.formError}>Fix the highlighted fields to save.</Text>
          ) : null}
          {save.isError ? <Text style={styles.formError}>{errorMessage(save.error)}</Text> : null}
          <Button label="Save profile" onPress={handleSave} loading={save.isPending} />
        </View>
      }
    >
      <TipsCard section="profile" />
      {profile ? (
        <Card style={styles.card}>
          <ProfileImagesEditor profile={profile} />
        </Card>
      ) : null}

      <View style={styles.fields}>
        <TextField
          label="Full name"
          required
          value={fullName}
          onChangeText={setFullName}
          onBlur={blur("fullName")}
          autoCapitalize="words"
          autoComplete="name"
          maxLength={200}
          error={errors.fullName}
        />
        <TextField
          label="Headline"
          required
          value={headline}
          onChangeText={setHeadline}
          onBlur={blur("headline")}
          autoCapitalize="sentences"
          placeholder="e.g. Senior React Native Engineer"
          maxLength={200}
          showCount
          error={errors.headline}
        />
        <TextField
          label="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          onBlur={blur("bio")}
          autoCapitalize="sentences"
          multiline
          numberOfLines={4}
          maxLength={1000}
          showCount
          hint="What you've done and what you're looking for. No contact details - they're shared on acceptance."
          error={errors.bio}
        />
        <TextField
          label="Location (optional)"
          value={location}
          onChangeText={setLocation}
          onBlur={blur("location")}
          autoCapitalize="words"
          maxLength={200}
          error={errors.location}
        />
        <TextField
          label="Current or preferred role (optional)"
          value={currentRole}
          onChangeText={setCurrentRole}
          onBlur={blur("currentRole")}
          autoCapitalize="sentences"
          maxLength={200}
          error={errors.currentRole}
        />
        <TextField
          label="Experience level (optional)"
          value={experienceLevel}
          onChangeText={setExperienceLevel}
          onBlur={blur("experienceLevel")}
          placeholder="e.g. 5+ years"
          maxLength={200}
          error={errors.experienceLevel}
        />
        <TextField
          label="Availability (optional)"
          value={availability}
          onChangeText={setAvailability}
          onBlur={blur("availability")}
          placeholder="e.g. 20 hrs/week"
          maxLength={200}
          error={errors.availability}
        />
        <TextField
          label="Portfolio link (optional)"
          value={portfolioUrl}
          onChangeText={setPortfolioUrl}
          onBlur={blur("portfolioUrl")}
          keyboardType="url"
          placeholder="https://"
          maxLength={500}
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

        <SkillsField
          value={selectedSkills}
          onChange={(next) => {
            setSelectedSkills(next);
            form.touch("skills");
          }}
          error={errors.skills}
        />

        <View style={styles.group}>
          <Text style={styles.groupLabel}>Here to</Text>
          <View style={styles.chipRow}>
            <Chip
              label="Find paid work"
              selected={seekingPaid}
              onPress={() => {
                setSeekingPaid((value) => !value);
                form.touch("seekingPaid");
              }}
            />
            <Chip
              label="Join as a partner"
              selected={seekingPartner}
              onPress={() => {
                setSeekingPartner((value) => !value);
                form.touch("seekingPaid");
              }}
            />
            <Chip
              label="Post projects"
              selected={wantsToHire}
              onPress={() => {
                setWantsToHire((value) => !value);
                form.touch("seekingPaid");
              }}
            />
          </View>
          {errors.seekingPaid ? <Text style={styles.error}>{errors.seekingPaid}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
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
    textAlign: "center",
  },
  footer: {
    gap: spacing.sm,
  },
});
