import type { Application, Outcome } from "../features/applications/api";
import type { ListingDetail } from "../features/listings/api";
import type { Profile } from "../features/profile/api";

export const T = "2026-11-01T00:00:00Z";

export function makeListing(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    id: "listing-1",
    owner_id: "owner-1",
    title: "React Native developer for a 6-week MVP",
    public_summary: "We need a field-survey app built for iOS and Android with offline sync.",
    opportunity_type: "paid",
    status: "published",
    location: "UK only",
    remote_pref: "remote",
    commitment: "part_time",
    duration: "6 weeks",
    compensation_type: "daily",
    compensation_min: 450,
    compensation_max: 550,
    currency: "GBP",
    review_note: null,
    is_featured: false,
    published_at: T,
    created_at: T,
    updated_at: T,
    owner: {
      id: "owner-1",
      full_name: "Tom Ellery",
      headline: "Co-founder, Fieldnote",
      avatar_url: null,
    },
    skills: ["React Native", "TypeScript", "Offline sync"],
    admission: null,
    images: [],
    ...overrides,
  };
}

export function makeApplication(
  overrides: Partial<Application> = {},
  outcome: Outcome | null = null,
): Application {
  return {
    id: "app-1",
    project_id: "listing-1",
    applicant_id: "user-1",
    application_type: "paid",
    status: "submitted",
    cover_note: "I shipped two offline-first React Native apps last year.",
    decision_note: null,
    decided_at: null,
    created_at: T,
    project: {
      id: "listing-1",
      title: "React Native developer",
      status: "published",
      owner_id: "owner-1",
    },
    applicant: {
      id: "user-1",
      full_name: "Lena Fischer",
      headline: "Product designer",
      avatar_url: null,
    },
    attachments: [],
    questions: [],
    membership:
      overrides.status === "accepted"
        ? { id: "membership-1", role: "contractor", left_at: null, outcome }
        : null,
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    full_name: "Sam Saib",
    headline: "React Native engineer",
    bio: "I build mobile products end to end.",
    location: "Manchester, UK",
    remote_pref: "remote",
    availability: "15 hrs/week",
    current_title: "Senior mobile engineer",
    experience_level: "6 years",
    seeking_paid: true,
    seeking_partner: false,
    wants_to_hire: false,
    portfolio_url: "https://sam.dev",
    avatar_url: null,
    cv_url: null,
    availability_confirmed_at: new Date().toISOString(),
    created_at: T,
    updated_at: T,
    ...overrides,
  };
}
