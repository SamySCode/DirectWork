import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { colors, spacing, typography } from "../../../lib/theme";
import { usePayRecord } from "../hooks";
import { payRecordLine } from "../logic";

/**
 * The owner's payment record: a count of professionals' reports on agreed
 * Deal Sheets, nothing more. Hidden until the server returns a row (it
 * applies the minimum-reports threshold) - no adjectives, scores or colours
 * that read as a judgement.
 */
export function PayRecordLine({ ownerId }: { ownerId: string | undefined }) {
  const record = usePayRecord(ownerId);
  const line = payRecordLine(record.data);
  if (!line) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={line}>
      <Ionicons name="receipt-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.text}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  text: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
