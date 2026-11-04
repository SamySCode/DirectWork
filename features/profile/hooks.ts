import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/SessionProvider";
import type { PreparedImage } from "../../lib/images";
import {
  addPortfolioImages,
  clearAvatar,
  confirmAvailability,
  getPortfolio,
  getProfile,
  getProfileSkills,
  getReferences,
  getReplyRecord,
  getTrackRecord,
  PortfolioImage,
  removePortfolioImage,
  setAvatar,
  upsertMyProfile,
} from "./api";
import type { ProfileInput } from "./schemas";

export const profileKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  skills: (userId: string) => ["profile", userId, "skills"] as const,
  trackRecord: (userId: string) => ["profile", userId, "track-record"] as const,
  portfolio: (userId: string) => ["profile", userId, "portfolio"] as const,
  replyRecord: (userId: string) => ["profile", userId, "reply-record"] as const,
  references: (userId: string) => ["profile", userId, "references"] as const,
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.profile(userId ?? ""),
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
  });
}

export function useProfileSkills(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.skills(userId ?? ""),
    queryFn: () => getProfileSkills(userId!),
    enabled: !!userId,
  });
}

export function useTrackRecord(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.trackRecord(userId ?? ""),
    queryFn: () => getTrackRecord(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/** The signed-in user's profile + skills, loaded together. */
export function useMyProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const profile = useProfile(userId);
  const skills = useProfileSkills(userId);
  return {
    userId,
    profile: profile.data ?? null,
    skills: skills.data ?? [],
    loading: profile.isPending || skills.isPending,
    error: profile.error ?? skills.error,
    refetch: () => Promise.all([profile.refetch(), skills.refetch()]),
  };
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (input: ProfileInput) => upsertMyProfile(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
  });
}

export function usePortfolio(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.portfolio(userId ?? ""),
    queryFn: () => getPortfolio(userId!),
    enabled: !!userId,
  });
}

/** Avatar and portfolio edits share one invalidation: everything under ["profile", userId]. */
function useProfileMutation<V>(fn: (userId: string, vars: V) => Promise<void>) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (vars: V) => fn(userId!, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
  });
}

export const useSetAvatar = () =>
  useProfileMutation((userId, vars: { image: PreparedImage; previous: string | null }) =>
    setAvatar(userId, vars.image, vars.previous),
  );

export const useClearAvatar = () =>
  useProfileMutation((userId, previous: string | null) => clearAvatar(userId, previous));

export const useAddPortfolioImages = () =>
  useProfileMutation((userId, vars: { images: PreparedImage[]; startAt: number }) =>
    addPortfolioImages(userId, vars.images, vars.startAt),
  );

export const useRemovePortfolioImage = () =>
  useProfileMutation((_userId, image: PortfolioImage) => removePortfolioImage(image));

/** Changes slowly and is shown on every listing - cache for 10 minutes. */
export function useReplyRecord(ownerId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.replyRecord(ownerId ?? ""),
    queryFn: () => getReplyRecord(ownerId!),
    enabled: !!ownerId,
    staleTime: 10 * 60_000,
  });
}

export function useReferences(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.references(userId ?? ""),
    queryFn: () => getReferences(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useConfirmAvailability() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: confirmAvailability,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.profile(userId ?? "") }),
  });
}
