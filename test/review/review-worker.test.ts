import { describe, expect, it } from "vitest";
import { parseReviewResult, runReviewWorker } from "../../src/review/review-worker.js";

describe("parseReviewResult", () => {
  it("parses strict JSON replies", () => {
    const result = parseReviewResult(
      JSON.stringify({
        summary: "learned onboarding flow",
        memoryCandidates: [],
        skillCandidates: [],
        assetUsage: [],
        dedupeHints: [],
        reuseConfidence: 0.9,
      }),
    );

    expect(result.summary).toContain("onboarding");
    expect(result.reuseConfidence).toBe(0.9);
  });

  it("extracts the first JSON object from noisy output", () => {
    const result = parseReviewResult(`
thinking...
{
  "summary": "learned onboarding flow",
  "memoryCandidates": [],
  "skillCandidates": [],
  "assetUsage": [],
  "dedupeHints": [],
  "reuseConfidence": 0.8
}
done
`);

    expect(result.summary).toContain("onboarding");
    expect(result.reuseConfidence).toBe(0.8);
  });
});

describe("runReviewWorker", () => {
  it("delegates to the silent reviewer and returns validated output", async () => {
    const result = await runReviewWorker({
      prompt: "review this turn",
      runSilentSubagent: async () => ({
        text: JSON.stringify({
          summary: "learned onboarding flow",
          memoryCandidates: [
            {
              kind: "durable-memory",
              title: "Default channel",
              content: "The user prefers Telegram for follow-up messages.",
              confidence: 0.8,
            },
          ],
          skillCandidates: [
            {
              title: "Onboarding Checklist",
              slug: "onboarding-checklist",
              summary: "Follow a consistent onboarding sequence",
              content: "# Onboarding Checklist",
              confidence: 0.9,
            },
          ],
          assetUsage: [],
          dedupeHints: [],
          reuseConfidence: 0.9,
        }),
      }),
    });

    expect(result.memoryCandidates).toHaveLength(1);
    expect(result.skillCandidates).toHaveLength(1);
  });
});
