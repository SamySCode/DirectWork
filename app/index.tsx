import { Redirect } from "expo-router";
import { useAuth } from "../features/auth/SessionProvider";

export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? "/dashboard" : "/sign-in"} />;
}
