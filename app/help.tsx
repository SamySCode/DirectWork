import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { Text } from "../components/Text";
import { useAuth } from "../features/auth/SessionProvider";
import { LegalLinks } from "../features/legal/components/LegalLinks";
import { useExportMyData } from "../features/legal/hooks";
import { contactRoutes } from "../features/legal/operator";
import { errorMessage } from "../lib/functions";
import { colors, spacing, typography } from "../lib/theme";

/** Help & legal: how to reach us, report problems, get your data, read the documents. */
export default function HelpScreen() {
  const { session } = useAuth();
  const exportData = useExportMyData();
  const [exportNote, setExportNote] = useState<string | null>(null);

  const onExport = () => {
    setExportNote(null);
    exportData.mutate(undefined, {
      onSuccess: () => setExportNote("Your data is ready. Keep the file somewhere safe."),
      onError: (error) => setExportNote(errorMessage(error)),
    });
  };

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          Help & legal
        </Text>
        <Text style={styles.lead}>
          How to reach us, report a problem, get a copy of your data, and read the documents behind
          DirectWork.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Contact us" />
        <Card style={styles.card}>
          {contactRoutes.map((route, index) => (
            <View key={route.key} style={[styles.contact, index > 0 ? styles.divider : null]}>
              <Text style={styles.contactLabel}>{route.label}</Text>
              <Text style={styles.body}>{route.use}</Text>
              <Text style={styles.email} selectable>
                {route.email}
              </Text>
              <Button
                label={`Email ${route.label.toLowerCase()}`}
                variant="secondary"
                size="sm"
                icon="mail-outline"
                onPress={() => Linking.openURL(`mailto:${route.email}`).catch(() => {})}
              />
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Report a problem" />
        <Card style={styles.block}>
          <Text style={styles.body}>
            To report a profile or listing, open it and choose Report. Pick the reason that fits and
            add any details that help. We never tell the person who reported them.
          </Text>
          <Text style={styles.body}>
            For anything else, like a reference, a question or an application, email support with
            what happened and where.
          </Text>
          <Text style={styles.body}>
            DirectWork never asks for money. If anyone asks you to pay to get work, report them. If
            someone is in immediate danger, call 999.
          </Text>
        </Card>
      </View>

      {session ? (
        <View style={styles.section}>
          <SectionHeader title="Your data" />
          <Card style={styles.block}>
            <Text style={styles.body}>
              Download a copy of everything you've given DirectWork and everything we hold about
              your account, as a JSON file.
            </Text>
            <Button
              label="Download my data"
              icon="download-outline"
              variant="secondary"
              onPress={onExport}
              loading={exportData.isPending}
            />
            {exportNote ? (
              <Text
                style={exportData.isError ? styles.error : styles.body}
                accessibilityLiveRegion="polite"
              >
                {exportNote}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Legal documents" />
        <LegalLinks />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm },
  title: {
    fontFamily: typography.displayFontFamily,
    fontSize: typography.size.xxl,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  lead: { fontSize: typography.size.md, lineHeight: 23, color: colors.textSecondary },
  section: { gap: spacing.md },
  card: { padding: 0 },
  block: { gap: spacing.md },
  contact: { gap: spacing.xs, padding: spacing.md, alignItems: "flex-start" },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  contactLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  body: { fontSize: typography.size.sm, lineHeight: 20, color: colors.textSecondary },
  email: { fontSize: typography.size.md, color: colors.textPrimary, marginBottom: spacing.xs },
  error: { fontSize: typography.size.sm, color: colors.danger },
});
