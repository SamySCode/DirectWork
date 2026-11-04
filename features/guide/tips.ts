// Practical advice, written as instructions rather than claims. No made-up
// statistics here - if a tip ever cites a number, it needs a source the way
// features/insights/facts.ts does.

export type Tip = { title: string; body: string };

export type GuideSection = {
  key: "profile" | "listing" | "applying";
  title: string;
  intro: string;
  tips: Tip[];
};

export const guide: GuideSection[] = [
  {
    key: "profile",
    title: "A profile that gets replies",
    intro: "Owners decide in seconds. Make it easy to see what you've done and what you want next.",
    tips: [
      {
        title: "Lead with a specific headline",
        body: '"Senior React Native engineer, payments and offline-first" beats "Developer". Name your craft and what you\'re known for.',
      },
      {
        title: "Show work, not adjectives",
        body: "Add 2-3 portfolio images or a link: screens you designed, a product you shipped, a before/after. One real example outweighs a paragraph of claims.",
      },
      {
        title: "List the skills you'd be hired for",
        body: "Three to eight focused skills match you to the right listings - they're highlighted for you in Discover. Leave out everything you'd rather not do.",
      },
      {
        title: "Say when you're free",
        body: '"15 hrs/week from January" lets an owner plan around you. Update it when it changes.',
      },
      {
        title: "Use a clear photo",
        body: "A recent, well-lit photo of your face helps people trust they're dealing with a real person.",
      },
    ],
  },
  {
    key: "listing",
    title: "A listing people apply to",
    intro: "Strong professionals choose carefully. Answer their questions before they have to ask.",
    tips: [
      {
        title: "Describe the outcome, not just the task",
        body: '"A booking flow live with 3 pilot clinics by March" tells someone what success looks like. "Build an app" doesn\'t.',
      },
      {
        title: "State the pay or terms up front",
        body: "Give a range or your equity offer. Listings that hide terms make good people wait - or skip them.",
      },
      {
        title: "Be honest about time",
        body: "Hours per week and duration let people check they can commit before applying. It saves both of you a conversation.",
      },
      {
        title: "Pick the skills that matter",
        body: "Choose the 3-5 skills the work actually needs. As you add them, you'll see how many people with them are open to work right now.",
      },
      {
        title: "For partnerships, show what exists",
        body: "Prototype, research, users, funding - and what you're putting in yourself. It's what separates a venture from an idea, and reviewers check it.",
      },
      {
        title: "Reply to everyone",
        body: "Your reply record shows on every listing. Declining with a short note takes seconds and keeps good people applying to you.",
      },
    ],
  },
  {
    key: "applying",
    title: "Applications that stand out",
    intro: "A short, specific note beats a long, general one.",
    tips: [
      {
        title: "Point at one relevant thing you've done",
        body: '"I rebuilt a booking and deposits flow for a 40-site gym chain" is more convincing than a list of strengths.',
      },
      {
        title: "Attach a work sample",
        body: "A screenshot or two of related work - only the listing owner can see them.",
      },
      {
        title: "Check the fit panel first",
        body: "It shows which of the listing's skills you have and whether the setup matches you, so you can apply where you'll stand out.",
      },
    ],
  },
];

export function guideSection(key: GuideSection["key"]): GuideSection {
  return guide.find((section) => section.key === key)!;
}
