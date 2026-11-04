// Researched facts shown to motivate action. Every one carries its source,
// shown in the UI and tappable - an unsourced statistic is just a claim.
// Wording stays as close to the source as the space allows. Before adding
// one, find the primary source; if editions disagree, show a rank or the
// most conservative figure, not the most dramatic.

export type Source = { label: string; url: string };

export type ShareFact = {
  kind: "share";
  key: string;
  /** Out of 100. */
  value: number;
  headline: string;
  detail: string;
  answer: string;
  source: Source;
};

export type RankFact = {
  kind: "rank";
  key: string;
  headline: string;
  ranking: string[];
  /** Index in `ranking` to highlight. */
  highlight: number;
  answer: string;
  source: Source;
};

export type Fact = ShareFact | RankFact;

export const fearOfFailure: ShareFact = {
  kind: "share",
  key: "fear",
  value: 58,
  headline: "58 in 100",
  detail: "UK adults who don't run a business say fear of failure would stop them starting one.",
  answer: "Start smaller: one defined first milestone, with someone who's done it before.",
  source: {
    label: "Global Entrepreneurship Monitor UK 2024",
    url: "https://www.gla.ac.uk/schools/business/news/headline_1148629_en.html",
  },
};

export const wrongTeam: RankFact = {
  kind: "rank",
  key: "team",
  headline: "Not having the right team is a top-three reason startups fail.",
  ranking: ["No market need", "Ran out of cash", "Not the right team"],
  highlight: 2,
  answer: "Find the people before the idea stalls - most of the work is in the team.",
  source: {
    label: "CB Insights, The Top 20 Reasons Startups Fail (2019)",
    url: "https://www.cbinsights.com/research/startup-failure-post-mortem/",
  },
};

export const ghosting: ShareFact = {
  kind: "share",
  key: "ghosting",
  value: 61,
  headline: "61 in 100",
  detail: "job seekers have been ghosted after an interview.",
  answer: "Every owner here shows how often they reply - before you apply.",
  source: {
    label: "Greenhouse, 2024 State of Job Hunting",
    url: "https://www.greenhouse.com/uk/blog/greenhouse-2024-state-of-job-hunting-report",
  },
};
