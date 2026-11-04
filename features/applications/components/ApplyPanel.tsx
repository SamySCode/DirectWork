import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Text } from "../../../components/Text";
import { ImagePickerGrid } from "../../../components/ImagePickerGrid";
import { TextField } from "../../../components/TextField";
import { errorMessage } from "../../../lib/functions";
import { pickImages, PreparedImage } from "../../../lib/images";
import { useFormValidation } from "../../../lib/validation";
import { colors, spacing, typography } from "../../../lib/theme";
import { applicationSchema } from "../../listings/schemas";
import { useApply, useMyApplications } from "../hooks";
import { applicationStatusMeta } from "../labels";

const MAX_ATTACHMENTS = 3;

type ApplyPanelProps = {
  projectId: string;
  ownerFirstName: string;
};

export function ApplyPanel({ projectId, ownerFirstName }: ApplyPanelProps) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const mine = useMyApplications();
  const apply = useApply();
  const [open, setOpen] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<(PreparedImage & { key: string })[]>([]);
  const [picking, setPicking] = useState(false);
  const form = useFormValidation(applicationSchema, { coverNote });

  const existing = mine.data?.find(
    (app) =>
      app.project_id === projectId && (app.status === "submitted" || app.status === "accepted"),
  );

  if (existing) {
    const status = applicationStatusMeta[existing.status];
    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>You've applied</Text>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Button
          label="View your application"
          variant="secondary"
          onPress={() => router.push(`/application/${existing.id}`)}
        />
      </Card>
    );
  }

  if (!open) {
    return <Button label="Apply" icon="paper-plane" onPress={() => setOpen(true)} />;
  }

  const addImages = async () => {
    setError(null);
    setPicking(true);
    try {
      const picked = await pickImages({ limit: MAX_ATTACHMENTS - images.length });
      setImages((prev) => [
        ...prev,
        ...picked.map((image, index) => ({ ...image, key: `${Date.now()}-${index}` })),
      ]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPicking(false);
    }
  };

  const submit = () => {
    const data = form.submit();
    if (!data) return;
    setError(null);
    apply.mutate(
      { projectId, coverNote: data.coverNote, images },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    // Lives in the screen footer, outside the page scroll: cap its height so
    // the send button stays reachable on small screens with the keyboard up.
    <ScrollView
      style={{ maxHeight: Math.round(height * 0.6) }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card style={styles.card}>
        <Text style={styles.title}>Tell {ownerFirstName} why you're a fit</Text>
        <Text style={styles.hint}>
          Point to something specific you've done that matches this work. Your profile is shared
          with your note. Your email is only shared if you're accepted.
        </Text>
        <TextField
          label="Your note"
          value={coverNote}
          onChangeText={setCoverNote}
          autoCapitalize="sentences"
          multiline
          numberOfLines={5}
          maxLength={1500}
          showCount
          required
          onBlur={() => form.touch("coverNote")}
          error={form.errors.coverNote}
        />
        <ImagePickerGrid
          label="Work samples (optional)"
          images={images.map((image) => ({ key: image.key, uri: image.uri }))}
          max={MAX_ATTACHMENTS}
          onAdd={addImages}
          onRemove={(key) => setImages((prev) => prev.filter((image) => image.key !== key))}
          busy={picking}
          hint="Only the listing owner can see these."
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttons}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => setOpen(false)}
            style={styles.flex}
          />
          <Button
            label="Send application"
            onPress={submit}
            loading={apply.isPending}
            style={styles.flex}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
