import type { remotePrefOptions } from "./schemas";

export const remotePrefLabels: Record<(typeof remotePrefOptions)[number], string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  flexible: "Flexible",
};
