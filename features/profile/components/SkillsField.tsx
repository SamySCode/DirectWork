import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../../components/Text";
import { TextField } from "../../../components/TextField";
import { colors, radius, spacing, typography } from "../../../lib/theme";
import { searchSkills } from "../api";
import { searchCatalog } from "../skillCatalog";

const MAX_SUGGESTIONS = 8;

// Server answers for this session: backspacing and retyping, or the same
// word on another form, costs no request. Small and bounded (oldest out).
const communityCache = new Map<string, string[]>();
function rememberCommunity(key: string, names: string[]) {
  communityCache.set(key, names);
  if (communityCache.size > 100) {
    communityCache.delete(communityCache.keys().next().value!);
  }
}

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
  const [community, setCommunity] = useState<string[]>([]);

  // Instant, offline, free: the curated catalogue is searched on the device.
  const local = useMemo(() => searchCatalog(query, { exclude: value }), [query, value]);

  // Skills other people added aren't in the catalogue: ask the server, but
  // only once 2+ characters have been typed and typing has paused.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCommunity([]);
      return;
    }
    const key = trimmed.toLowerCase();
    const cached = communityCache.get(key);
    if (cached) {
      setCommunity(cached);
      return;
    }
    // A slow answer for "rea" must not overwrite the one for "react".
    let current = true;
    const timeout = setTimeout(() => {
      searchSkills(trimmed)
        .then((names) => {
          rememberCommunity(key, names);
          if (current) setCommunity(names);
        })
        .catch(() => {
          if (current) setCommunity([]);
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const suggestions = useMemo(() => {
    const seen = new Set([...local, ...value].map((s) => s.toLowerCase()));
    const extra = community.filter((s) => !seen.has(s.toLowerCase()));
    return [...local, ...extra].slice(0, MAX_SUGGESTIONS);
  }, [local, community, value]);

  const addSkill = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!value.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setQuery("");
    setCommunity([]);
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
