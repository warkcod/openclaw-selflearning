import type { RecallAssetSelection, ReviewReasonCode } from "../types.js";

export function buildTurnReviewPrompt(params: {
  conversationSummary: string;
  reasonCodes: ReviewReasonCode[];
  recalledAssets?: RecallAssetSelection;
}): string {
  const recalledLines = [
    ...(params.recalledAssets?.memories ?? []).map(
      (memory) => `- memory:${memory.id} | ${memory.title} | ${memory.content}`,
    ),
    ...(params.recalledAssets?.skills ?? []).map(
      (skill) => `- skill:${skill.slug} | ${skill.title} | ${skill.summary}`,
    ),
  ];

  return [
    "Review the completed OpenClaw turn and decide what durable learning should survive it.",
    "Output strict JSON with keys: summary, memoryCandidates, skillCandidates, assetUsage, dedupeHints, reuseConfidence.",
    "Memory candidates must contain durable user preferences, environment facts, or stable project conventions.",
    "Skill candidates must capture reusable SOPs, checklists, decision rubrics, or tool-assisted workflows.",
    "If the turn refines an already recalled or clearly existing skill, prefer updating that capability rather than cloning it.",
    "Use assetUsage to explain whether recalled assets actually helped this turn and whether they appear successful, partial, failed, ignored, or user-corrected.",
    `Trigger reasons: ${params.reasonCodes.join(", ") || "none"}`,
    `Conversation summary:\n${params.conversationSummary}`,
    `Recalled assets offered this turn:\n${recalledLines.join("\n") || "- none"}`,
  ].join("\n\n");
}

export function buildExplicitSkillLearningPrompt(params: {
  sourceLabel: string;
  sourceText: string;
}): string {
  return [
    "Convert the provided SOP or workflow description into a reusable skill candidate.",
    "Output strict JSON with keys: summary, memoryCandidates, skillCandidates, assetUsage, dedupeHints, reuseConfidence.",
    "Prefer exactly one high-quality skill candidate unless the source obviously contains distinct unrelated workflows.",
    "Memory candidates should usually be empty unless the source includes durable user or environment facts.",
    `Source label: ${params.sourceLabel}`,
    `Source text:\n${params.sourceText}`,
  ].join("\n\n");
}
