import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssembleResult, ContextEngine, IngestResult } from "openclaw/plugin-sdk";
import type {
  PromotionConfig,
  RecallAssetSelection,
  RecallConfig,
  TriggerConfig,
} from "../types.js";
import { applyReviewResult } from "../growth/candidate-writer.js";
import { applyEvolutionTrace } from "../growth/evolution-trace.js";
import { buildRecallPromptAddition } from "../growth/recall-builder.js";
import { buildTurnReviewPrompt } from "../review/review-prompt.js";
import { runReviewWorker } from "../review/review-worker.js";
import { LearningStore } from "../store/learning-store.js";
import { decideReview } from "../trigger/review-trigger.js";

export function createSelfLearningEngine(params: {
  store: LearningStore;
  triggerConfig: TriggerConfig;
  recallConfig: RecallConfig;
  promotionConfig: PromotionConfig;
  runSilentReview: (params: { prompt: string; sessionId?: string; sessionKey?: string; sessionFile?: string }) => Promise<{ text: string }>;
}): ContextEngine {
  const lastReviewTurnIndexes = new Map<string, number>();
  const pendingRecall = new Map<string, RecallAssetSelection>();

  return {
    info: {
      id: "selflearning",
      name: "OpenClaw Self-Learning",
      ownsCompaction: false,
    },
    async ingest(): Promise<IngestResult> {
      return { ingested: false };
    },
    async compact() {
      return {
        ok: true,
        compacted: false,
        reason: "delegated-to-runtime",
      };
    },
    async assemble(context): Promise<AssembleResult> {
      const recall = params.store.listRecallAssets({
        maxMemories: params.recallConfig.maxMemories,
        maxSkills: params.recallConfig.maxSkills,
        maxTranscripts: params.recallConfig.maxTranscripts,
        allowCandidateRecall: params.recallConfig.allowCandidateRecall,
      });
      pendingRecall.set(context.sessionKey ?? context.sessionId, recall);

      return {
        messages: context.messages,
        estimatedTokens: estimateTokens(context.messages),
        systemPromptAddition: buildRecallPromptAddition(recall),
      };
    },
    async afterTurn(context) {
      if (context.sessionId.endsWith(":review")) {
        return;
      }

      const turnKey = context.sessionKey ?? context.sessionId;
      const decision = decideReview(
        {
          toolCalls: countToolLikeMessages(context.messages),
          retries: countMatches(context.messages, /retry|重试/giu),
          reroutes: countMatches(context.messages, /reroute|改道|换一种/giu),
          userCorrections: countMatches(context.messages, /不对|纠正|应该是|改成/giu),
          turnIndex: context.prePromptMessageCount + context.messages.length,
          lastReviewTurnIndex: lastReviewTurnIndexes.get(turnKey),
        },
        params.triggerConfig,
      );

      if (!decision.shouldReview) {
        return;
      }

      const recall = pendingRecall.get(turnKey);
      const prompt = buildTurnReviewPrompt({
        conversationSummary: summarizeMessages(context.messages),
        reasonCodes: decision.reasonCodes,
        recalledAssets: recall,
      });

      const result = await runReviewWorker({
        prompt,
        runSilentSubagent: ({ prompt: reviewPrompt }) =>
          params.runSilentReview({
            prompt: reviewPrompt,
            sessionId: context.sessionId,
            sessionKey: context.sessionKey,
            sessionFile: context.sessionFile,
          }),
      });

      const reviewId = params.store.saveReview({
        sessionId: context.sessionId,
        summary: result.summary,
        reasonCodes: decision.reasonCodes,
        complexityScore: decision.complexityScore,
        rawResult: result,
      });

      applyReviewResult({
        store: params.store,
        reviewId,
        result,
        promotionConfig: params.promotionConfig,
      });

      applyEvolutionTrace({
        store: params.store,
        sessionId: context.sessionId,
        assetUsage: result.assetUsage,
      });

      lastReviewTurnIndexes.set(turnKey, context.prePromptMessageCount + context.messages.length);
    },
  };
}

function countToolLikeMessages(messages: AgentMessage[]) {
  return messages.filter((message) => {
    const role = readString(message, "role");
    return role === "tool" || role === "toolResult";
  }).length;
}

function countMatches(messages: AgentMessage[], pattern: RegExp) {
  return messages.reduce((count, message) => {
    const content = readString(message, "content");
    return count + (content.match(pattern)?.length ?? 0);
  }, 0);
}

function summarizeMessages(messages: AgentMessage[]) {
  return messages
    .map((message) => {
      const role = readString(message, "role");
      const content = normalizeWhitespace(readString(message, "content"));
      return content ? `${role} ${content}`.trim() : null;
    })
    .filter((line): line is string => Boolean(line))
    .slice(-20)
    .join("\n")
    .slice(-4000);
}

function estimateTokens(messages: AgentMessage[]) {
  return Math.max(1, Math.ceil(summarizeMessages(messages).length / 4));
}

function readString(message: AgentMessage, key: "role" | "content") {
  const value = (message as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}
