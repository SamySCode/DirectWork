import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { searchSkills } from "../api";

type SkillsFieldProps = {
  value: string[];
  onChange: (skills: string[]) => void;
  error?: string;
  label?: string;
  placeholder?: string;
};

export function SkillsField({
  value,
  onChange,
  error,
  label = "Skills",
  placeholder = "Type a skill and press enter",
}: SkillsFieldProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchSkills(trimmed)
        .then((results) => setSuggestions(results.filter((s) => !value.includes(s))))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, value]);

  const addSkill = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!value.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setQuery("");
    setSuggestions([]);
  };

  const removeSkill = (name: string) => {
    onChange(value.filter((s) => s !== name));
  };

  // Offer the typed text itself as an option - "press enter" isn't
  // discoverable on a phone keyboard.
  const trimmedQuery = query.trim();
  const showAddTyped =
    trimmedQuery.length > 0 &&
    !suggestions.some((s) => s.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !value.some((s) => s.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <View style={styles.container}>
      <TextField
        label={label}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => addSkill(query)}
        placeholder={placeholder}
        returnKeyType="done"
        submitBehavior="submit"
        error={error}
      />
      {suggestions.length > 0 || showAddTyped ? (
        <View style={styles.suggestions}>
          {showAddTyped ? (
            <Pressable
              onPress={() => addSkill(trimmedQuery)}
              style={styles.suggestionItem}
              accessibilityRole="button"
            >
              <Text style={[styles.suggestionText, styles.addTyped]}>Add “{trimmedQuery}”</Text>
            </Pressable>
          ) : null}
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => addSkill(suggestion)}
              style={styles.suggestionItem}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((skill) => (
            <Pressable key={skill} onPress={() => removeSkill(skill)} style={styles.chip}>
              <Text style={styles.chipText}>{skill}</Text>
              <Text style={styles.chipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  suggestions: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  suggestionItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  suggestionText: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
  addTyped: {
    color: colors.accent,
    fontWeight: typography.weight.semibold,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    fontSize: typography.size.sm,
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
  chipRemove: {
    fontSize: typography.size.sm,
    color: colors.accent,
    fontWeight: typography.weight.bold,
  },
});
