import { describe, expect, it } from "vitest";
import { decideReview } from "../../src/trigger/review-trigger.js";

describe("decideReview", () => {
  const config = {
    toolCallCandidateThreshold: 3,
    toolCallForceThreshold: 6,
    cooldownTurns: 2,
    retryWeight: 2,
    rerouteWeight: 2,
    userCorrectionWeight: 3,
  };

  it("triggers review at the candidate threshold", () => {
    const result = decideReview(
      {
        toolCalls: 3,
        retries: 0,
        reroutes: 0,
        userCorrections: 0,
        turnIndex: 12,
      },
      config,
    );

    expect(result.shouldReview).toBe(true);
    expect(result.reasonCodes).toContain("tool-call-candidate-threshold");
  });

  it("forces review at the force threshold", () => {
    const result = decideReview(
      {
        toolCalls: 6,
        retries: 0,
        reroutes: 0,
        userCorrections: 0,
        turnIndex: 12,
      },
      config,
    );

    expect(result.shouldReview).toBe(true);
    expect(result.reasonCodes).toContain("tool-call-force-threshold");
  });

  it("uses retries, reroutes, and user corrections as amplifiers", () => {
    const result = decideReview(
      {
        toolCalls: 1,
        retries: 1,
        reroutes: 1,
        userCorrections: 1,
        turnIndex: 5,
      },
      config,
    );

    expect(result.shouldReview).toBe(true);
    expect(result.reasonCodes).toContain("retry-amplifier");
    expect(result.reasonCodes).toContain("reroute-amplifier");
    expect(result.reasonCodes).toContain("user-correction-amplifier");
    expect(result.complexityScore).toBe(8);
  });

  it("blocks review during cooldown", () => {
    const result = decideReview(
      {
        toolCalls: 6,
        retries: 1,
        reroutes: 0,
        userCorrections: 0,
        turnIndex: 10,
        lastReviewTurnIndex: 9,
      },
      config,
    );

    expect(result.shouldReview).toBe(false);
    expect(result.reasonCodes).toEqual(["cooldown-blocked"]);
  });
});
