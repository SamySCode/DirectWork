import { useCallback, useEffect, useState } from "react";
import { getMyProfile, getMyProfileSkills, Profile } from "./api";

export function useMyProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setSkills([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profileData, skillsData] = await Promise.all([
        getMyProfile(userId),
        getMyProfileSkills(userId),
      ]);
      setProfile(profileData);
      setSkills(skillsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load profile"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, skills, loading, error, refetch };
}
