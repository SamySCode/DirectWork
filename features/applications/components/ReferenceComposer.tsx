import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../../../components/Button";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { errorMessage } from "../../../lib/functions";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { useFormValidation } from "../../../lib/validation";
import { useHasWrittenReference, useWriteReference } from "../hooks";
import { referenceSchema } from "../schemas";

type ReferenceComposerProps = { membershipId: string; otherName: string };

/**
 * One line about what the other person delivered, offered once both sides
 * have confirmed the work was completed. It shows on their profile, marked
 * as coming from a verified collaboration, and can't be edited afterwards.
 */
export function ReferenceComposer({ membershipId, otherName }: ReferenceComposerProps) {
  const written = useHasWrittenReference(membershipId, true);
  const write = useWriteReference();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const form = useFormValidation(referenceSchema, { body });
  const firstName = otherName.split(" ")[0];

  if (written.isPending) return null;
  if (written.data) {
    return (
      <View style={styles.done}>
        <Ionicons name="checkmark-circle" size={18} color={colors.mintInk} />
        <Text style={styles.doneText}>Your reference for {firstName} is on their profile.</Text>
      </View>
    );
  }

  const submit = () => {
    const data = form.submit();
    if (!data) return;
    setError(null);
    write.mutate(
      { membershipId, body: data.body },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Write {firstName} a reference</Text>
      <Text style={styles.hint}>
        One or two sentences on what they actually delivered. It appears on their profile as a
        verified reference - only people who completed work together can write one - and can't be
        edited later.
      </Text>
      <TextField
        label="Reference"
        value={body}
        onChangeText={setBody}
        onBlur={() => form.touch("body")}
        error={form.errors.body}
        multiline
        maxLength={300}
        showCount
        autoCapitalize="sentences"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label="Publish reference"
        icon="ribbon-outline"
        size="sm"
        onPress={submit}
        loading={write.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  done: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  doneText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.mintInk,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
