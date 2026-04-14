import fs from "node:fs";
import path from "node:path";
import type {
  AssetOrigin,
  PromotionConfig,
  ReviewCandidateSkill,
  ReviewResult,
  SkillCandidateForPatchDecision,
} from "../types.js";
import { decideSkillWriteAction } from "./patch-decision.js";
import { LearningStore } from "../store/learning-store.js";

export function applyReviewResult(params: {
  store: LearningStore;
  reviewId: string;
  result: ReviewResult;
  promotionConfig: PromotionConfig;
}) {
  for (const memory of params.result.memoryCandidates) {
    params.store.upsertMemoryRecord({
      id: `${params.reviewId}:${slugify(memory.title)}`,
      kind: memory.kind,
      title: memory.title,
      content: memory.content,
      state:
        params.promotionConfig.autoPromote && memory.confidence >= params.promotionConfig.minConfidence
          ? "promoted"
          : "candidate",
      confidence: memory.confidence,
      reviewId: params.reviewId,
    });
  }

  for (const transcript of params.result.transcriptCandidates) {
    params.store.upsertTranscriptRecord({
      id: transcript.id ?? `transcript:${params.reviewId}:${slugify(transcript.title)}`,
      title: transcript.title,
      summary: transcript.summary,
      content: transcript.content,
      state:
        params.promotionConfig.autoPromote &&
        transcript.confidence >= params.promotionConfig.minConfidence
          ? "promoted"
          : "candidate",
      confidence: transcript.confidence,
      reviewId: params.reviewId,
    });
  }

  const existingSkills = params.store.listAllSkills();

  for (const [index, rawCandidate] of params.result.skillCandidates.entries()) {
    const candidate = normalizeSkillCandidate(rawCandidate, params.result.reuseConfidence, index);
    const decision = decideSkillWriteAction({
      candidate,
      existingSkills,
    });

    if (decision.kind === "create") {
      params.store.upsertSkillRecord({
        slug: candidate.slug,
        title: candidate.title,
        summary: candidate.summary,
        state:
          params.promotionConfig.autoPromote &&
          candidate.confidence >= params.promotionConfig.minConfidence
            ? "promoted"
            : "candidate",
        origin: candidate.origin,
        ownership: "system",
        reviewStatus: "pending",
        confidence: candidate.confidence,
        successfulRecalls: 0,
        hitCount: 0,
        userModified: false,
        version: 1,
        content: candidate.content,
        sourceReviewId: params.reviewId,
      });
      continue;
    }

    params.store.appendPatchProposal({
      proposalId: `${params.reviewId}:${candidate.slug}:${decision.kind}`,
      candidateSlug: candidate.slug,
      targetSlug: decision.targetSlug,
      confidence: decision.confidence,
      reason: decision.reason,
      mode: decision.kind,
      createdAt: new Date().toISOString(),
      proposedSummary: candidate.summary,
      proposedContent: candidate.content,
    });
  }
}

function normalizeSkillCandidate(
  candidate: ReviewCandidateSkill,
  fallbackConfidence: number,
  index: number,
): SkillCandidateForPatchDecision {
  const title = candidate.title.trim();
  const slug = slugify(candidate.slug ?? title ?? `skill-${index + 1}`);
  const summary = (candidate.summary ?? candidate.scope ?? title).trim();
  const confidence = clamp(candidate.confidence ?? fallbackConfidence);
  const content =
    candidate.content?.trim() ??
    buildSkillMarkdown({
      slug,
      title,
      description: summary,
      scope: candidate.scope,
      inputs: candidate.inputs ?? [],
      coreSteps: candidate.coreSteps ?? [],
      outputs: candidate.outputs ?? [],
      caveats: candidate.caveats ?? [],
    });

  return {
    slug,
    title,
    summary,
    content,
    confidence,
    origin: candidate.origin ?? "selflearned",
  };
}

function buildSkillMarkdown(params: {
  slug: string;
  title: string;
  description: string;
  scope?: string;
  inputs: string[];
  coreSteps: string[];
  outputs: string[];
  caveats: string[];
}) {
  const lines = [
    "---",
    `name: ${params.slug}`,
    `description: ${JSON.stringify(params.description)}`,
    "---",
    "",
    `# ${params.title}`,
    "",
    params.description,
    "",
    "## When to Use",
    "",
    params.scope ? ensureUseWhen(params.scope) : `Use when the user needs help with ${params.title}.`,
  ];

  if (params.inputs.length > 0) {
    lines.push("", "## Inputs", "", ...params.inputs.map((item) => `- ${item}`));
  }
  if (params.coreSteps.length > 0) {
    lines.push("", "## Procedure", "", ...params.coreSteps.map((item) => `1. ${item}`));
  }
  if (params.outputs.length > 0) {
    lines.push("", "## Outputs", "", ...params.outputs.map((item) => `- ${item}`));
  }
  if (params.caveats.length > 0) {
    lines.push("", "## Caveats", "", ...params.caveats.map((item) => `- ${item}`));
  }

  return `${lines.join("\n")}\n`;
}

function ensureUseWhen(value: string) {
  const trimmed = value.trim();
  if (/^use when\b/iu.test(trimmed)) {
    return trimmed;
  }
  return `Use when ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "");
}
