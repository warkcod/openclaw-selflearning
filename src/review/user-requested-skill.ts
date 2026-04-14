import fs from "node:fs";
import type { PromotionConfig } from "../types.js";
import { applyReviewResult } from "../growth/candidate-writer.js";
import { buildExplicitSkillLearningPrompt } from "./review-prompt.js";
import { runReviewWorker } from "./review-worker.js";
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
  const transcript = summarizeSessionFile(params.sessionFile);
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

function summarizeSessionFile(sessionFile: string) {
  const lines = fs.readFileSync(sessionFile, "utf8").split(/\r?\n/u).filter(Boolean);
  return lines
    .slice(-40)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as { role?: string; content?: string };
        return `${parsed.role ?? "unknown"} ${String(parsed.content ?? "")}`.trim();
      } catch {
        return line.trim();
      }
    })
    .join("\n");
}
