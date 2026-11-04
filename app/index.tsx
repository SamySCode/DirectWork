import { Redirect } from "expo-router";
import { useAuth } from "../features/auth/SessionProvider";

export default function Index() {
  const { session } = useAuth();
  // Onboarding vs home is decided by useProtectedRoute once the profile loads.
  return <Redirect href={session ? "/home" : "/welcome"} />;
}
