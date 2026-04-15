import fs from "node:fs";
import type { PromotionConfig } from "../types.js";
import { applyReviewResult } from "../growth/candidate-writer.js";
import { buildExplicitSkillLearningPrompt } from "./review-prompt.js";
import { runReviewWorker } from "./review-worker.js";
import { buildSessionScope, formatScopePreview, type SessionScopeSource } from "./session-scope.js";
import { LearningStore } from "../store/learning-store.js";

export async function learnCurrentConversation(params: {
  store: LearningStore;
  sessionFile?: string;
  runSilentReview: (params: { prompt: string }) => Promise<{ text: string }>;
  promotionConfig: PromotionConfig;
}) {
  if (!params.sessionFile || !fs.existsSync(params.sessionFile)) {
    throw new Error("Current session transcript is not available.");
  }
  const transcript = buildSessionScope({
    sessionFile: params.sessionFile,
    source: { kind: "current" },
  }).sourceText;
  return learnFromSource({
    store: params.store,
    sourceLabel: `current session: ${params.sessionFile}`,
    sourceText: transcript,
    runSilentReview: params.runSilentReview,
    promotionConfig: params.promotionConfig,
  });
}

export async function learnFromFile(params: {
  store: LearningStore;
  filePath: string;
  runSilentReview: (params: { prompt: string }) => Promise<{ text: string }>;
  promotionConfig: PromotionConfig;
}) {
  const sourceText = fs.readFileSync(params.filePath, "utf8");
  return learnFromSource({
    store: params.store,
    sourceLabel: `file: ${params.filePath}`,
    sourceText,
    runSilentReview: params.runSilentReview,
    promotionConfig: params.promotionConfig,
  });
}

async function learnFromSource(params: {
  store: LearningStore;
  sourceLabel: string;
  sourceText: string;
  runSilentReview: (params: { prompt: string }) => Promise<{ text: string }>;
  promotionConfig: PromotionConfig;
}) {
  const result = await runReviewWorker({
    prompt: buildExplicitSkillLearningPrompt({
      sourceLabel: params.sourceLabel,
      sourceText: params.sourceText,
    }),
    runSilentSubagent: params.runSilentReview,
  });

  const reviewId = params.store.saveReview({
    summary: result.summary,
    reasonCodes: ["tool-call-candidate-threshold"],
    complexityScore: 0,
    rawResult: result,
  });

  const normalizedResult = {
    ...result,
    skillCandidates: result.skillCandidates.map((candidate) => ({
      ...candidate,
      origin: "user_requested" as const,
    })),
  };

  applyReviewResult({
    store: params.store,
    reviewId,
    result: normalizedResult,
    promotionConfig: params.promotionConfig,
  });

  const created =
    normalizedResult.skillCandidates[0]?.slug ??
    normalizedResult.skillCandidates[0]?.title
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+/u, "")
      .replace(/-+$/u, "");

  return {
    reviewId,
    slug: created ?? "unknown-skill",
    state: "candidate" as const,
  };
}

export async function learnFromSessionScope(params: {
  store: LearningStore;
  sessionFile?: string;
  sessionKey?: string;
  source: SessionScopeSource;
  runSilentReview: (params: { prompt: string }) => Promise<{ text: string }>;
  promotionConfig: PromotionConfig;
}) {
  if (!params.sessionFile) {
    throw new Error("Current session transcript is not available.");
  }
  const scope = buildSessionScope({
    sessionFile: params.sessionFile,
    source: params.source,
    markers:
      params.source.kind === "marked" && params.sessionKey
        ? params.store.getSessionMarkers(params.sessionKey)
        : undefined,
  });
  return learnFromSource({
    store: params.store,
    sourceLabel: scope.sourceLabel,
    sourceText: scope.sourceText,
    runSilentReview: params.runSilentReview,
    promotionConfig: params.promotionConfig,
  });
}

export function previewSessionScope(params: {
  store: LearningStore;
  sessionFile?: string;
  sessionKey?: string;
  source: SessionScopeSource;
}) {
  if (!params.sessionFile) {
    throw new Error("Current session transcript is not available.");
  }
  const scope = buildSessionScope({
    sessionFile: params.sessionFile,
    source: params.source,
    markers:
      params.source.kind === "marked" && params.sessionKey
        ? params.store.getSessionMarkers(params.sessionKey)
        : undefined,
  });
  return formatScopePreview(scope);
}

export function markSessionBoundary(params: {
  store: LearningStore;
  sessionFile?: string;
  sessionKey?: string;
  kind: "start" | "end";
}) {
  if (!params.sessionFile || !params.sessionKey) {
    throw new Error("Current session transcript is not available.");
  }
  return params.store.markSessionBoundary({
    sessionFile: params.sessionFile,
    sessionKey: params.sessionKey,
    kind: params.kind,
  });
}
