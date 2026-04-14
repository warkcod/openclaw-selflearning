import type { ReviewComplexityInput, ReviewDecision, ReviewReasonCode, TriggerConfig } from "../types.js";

export function decideReview(
  input: ReviewComplexityInput,
  config: TriggerConfig,
): ReviewDecision {
  const complexityScore =
    input.toolCalls +
    input.retries * config.retryWeight +
    input.reroutes * config.rerouteWeight +
    input.userCorrections * config.userCorrectionWeight;

  if (
    input.lastReviewTurnIndex !== undefined &&
    input.turnIndex - input.lastReviewTurnIndex <= config.cooldownTurns
  ) {
    return {
      shouldReview: false,
      reasonCodes: ["cooldown-blocked"],
      complexityScore,
    };
  }

  const reasonCodes: ReviewReasonCode[] = [];

  if (input.toolCalls >= config.toolCallForceThreshold) {
    reasonCodes.push("tool-call-force-threshold");
  } else if (input.toolCalls >= config.toolCallCandidateThreshold) {
    reasonCodes.push("tool-call-candidate-threshold");
  }

  if (input.retries > 0) {
    reasonCodes.push("retry-amplifier");
  }
  if (input.reroutes > 0) {
    reasonCodes.push("reroute-amplifier");
  }
  if (input.userCorrections > 0) {
    reasonCodes.push("user-correction-amplifier");
  }

  return {
    shouldReview: reasonCodes.length > 0,
    reasonCodes,
    complexityScore,
  };
}
