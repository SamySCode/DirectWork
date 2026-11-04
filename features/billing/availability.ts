import { Platform } from "react-native";
import { env } from "../../lib/env";

// Purchase UI is web-only. App Store Guideline 3.1.1 and Google Play's
// payments policy require their own in-app purchase for digital
// subscriptions sold inside a mobile app, and forbid steering users to an
// outside payment page. A Pro plan bought on the web is still honoured in the
// mobile apps (Apple 3.1.3(b) multiplatform services) - the limits come from
// the database, not from where you paid. See docs/MONETIZATION.md.
export const billingAvailable = env.EXPO_PUBLIC_BILLING_ENABLED && Platform.OS === "web";
