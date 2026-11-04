import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { ImagePickerGrid } from "../../../components/ImagePickerGrid";
import { Text } from "../../../components/Text";
import { errorMessage } from "../../../lib/functions";
import { pickImages } from "../../../lib/images";
import { colors, spacing, typography } from "../../../lib/theme";
import { avatarUrl, Profile } from "../api";
import {
  useAddPortfolioImages,
  useClearAvatar,
  usePortfolio,
  useRemovePortfolioImage,
  useSetAvatar,
} from "../hooks";

const MAX_PORTFOLIO = 6;

// Photos save immediately rather than with the rest of the form - an upload
// is slow enough that bundling it with "Save profile" would make that
// button feel broken.
export function ProfileImagesEditor({ profile }: { profile: Profile }) {
  const setAvatar = useSetAvatar();
  const clearAvatar = useClearAvatar();
  const portfolio = usePortfolio(profile.id);
  const addPortfolio = useAddPortfolioImages();
  const removePortfolio = useRemovePortfolioImage();
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const changeAvatar = async () => {
    setAvatarError(null);
    try {
      const [image] = await pickImages({ square: true });
      if (image) await setAvatar.mutateAsync({ image, previous: profile.avatar_url });
    } catch (error) {
      setAvatarError(errorMessage(error));
    }
  };

  const addImages = async () => {
    setPortfolioError(null);
    const existing = portfolio.data ?? [];
    setPicking(true);
    try {
      const images = await pickImages({ limit: MAX_PORTFOLIO - existing.length });
      if (images.length > 0) {
        await addPortfolio.mutateAsync({ images, startAt: existing.length });
      }
    } catch (error) {
      setPortfolioError(errorMessage(error));
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarRow}>
        <Avatar name={profile.full_name} uri={avatarUrl(profile.avatar_url)} size={72} />
        <View style={styles.avatarActions}>
          <Text style={styles.label}>Profile photo</Text>
          <View style={styles.buttons}>
            <Button
              label={profile.avatar_url ? "Change" : "Add photo"}
              size="sm"
              variant="secondary"
              icon="camera-outline"
              onPress={changeAvatar}
              loading={setAvatar.isPending}
            />
            {profile.avatar_url ? (
              <Button
                label="Remove"
                size="sm"
                variant="ghost"
                onPress={() =>
                  clearAvatar.mutate(profile.avatar_url, {
                    onError: (error) => setAvatarError(errorMessage(error)),
                  })
                }
                disabled={clearAvatar.isPending}
              />
            ) : null}
          </View>
        </View>
      </View>
      {avatarError ? <Text style={styles.error}>{avatarError}</Text> : null}

      <ImagePickerGrid
        label="Portfolio"
        images={(portfolio.data ?? []).map((image) => ({ key: image.id, uri: image.url }))}
        max={MAX_PORTFOLIO}
        onAdd={addImages}
        onRemove={(id) => {
          const image = portfolio.data?.find((item) => item.id === id);
          if (image) {
            removePortfolio.mutate(image, {
              onError: (error) => setPortfolioError(errorMessage(error)),
            });
          }
        }}
        busy={picking || addPortfolio.isPending}
        error={portfolioError}
        hint="Screenshots or photos of past work. JPEG, PNG or WebP, up to 6."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatarActions: {
    flex: 1,
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
});
