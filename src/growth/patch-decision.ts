import type { PatchDecisionResult, SkillCandidateForPatchDecision, SkillRecord } from "../types.js";

export function decideSkillWriteAction(params: {
  candidate: SkillCandidateForPatchDecision;
  existingSkills: Array<
    Pick<
      SkillRecord,
      "slug" | "title" | "summary" | "state" | "confidence" | "origin" | "ownership" | "userModified" | "successfulRecalls"
    >
  >;
}): PatchDecisionResult {
  const best = params.existingSkills
    .map((skill) => ({
      skill,
      similarity: scoreSkillSimilarity(params.candidate, skill),
    }))
    .sort((left, right) => right.similarity - left.similarity)[0];

  if (!best || best.similarity < 0.6) {
    return {
      kind: "create",
      confidence: params.candidate.confidence,
      reason: "No existing skill is similar enough.",
    };
  }

  if (best.skill.ownership === "user" || best.skill.userModified) {
    return {
      kind: "patch-proposal",
      targetSlug: best.skill.slug,
      confidence: best.similarity,
      reason: "The best matching skill is user-owned or user-modified.",
    };
  }

  return {
    kind: "patch",
    targetSlug: best.skill.slug,
    confidence: best.similarity,
    reason: "The candidate closely matches an existing reusable skill.",
  };
}

function scoreSkillSimilarity(
  candidate: SkillCandidateForPatchDecision,
  existing: Pick<SkillRecord, "slug" | "title" | "summary">,
): number {
  if (candidate.slug === existing.slug) {
    return 1;
  }

  const candidateTokens = tokenize([candidate.slug, candidate.title, candidate.summary].join(" "));
  const existingTokens = tokenize([existing.slug, existing.title, existing.summary].join(" "));

  const intersection = [...candidateTokens].filter((token) => existingTokens.has(token)).length;
  const union = new Set([...candidateTokens, ...existingTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}
