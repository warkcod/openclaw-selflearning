import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import fs from "node:fs";
import path from "node:path";
import { resolvePluginConfig } from "./config.js";
import { createSelfLearningCommand } from "./commands/selflearn-command.js";
import { createSelfLearningEngine } from "./context/selflearning-engine.js";
import {
  learnCurrentConversation,
  learnFromFile,
  learnFromSessionScope,
  previewSessionScope,
} from "./review/user-requested-skill.js";
import { resolveAgentId } from "./runtime/agent-resolution.js";
import { resolveLearningPaths } from "./runtime/paths.js";
import { LearningStore } from "./store/learning-store.js";

function resolveStore(api: OpenClawPluginApi, rootDirName: string) {
  const stores = new Map<string, LearningStore>();

  return (params: { sessionKey?: string }) => {
    const agentId = resolveAgentId(params.sessionKey, api.config);
    const existing = stores.get(agentId);
    if (existing) {
      return existing;
    }

    const workspaceDir = api.runtime.agent.resolveAgentWorkspaceDir(api.config, agentId);
    const store = new LearningStore(
      resolveLearningPaths({
        agentWorkspaceDir: workspaceDir,
        rootDirName,
      }),
    );
    store.initialize();
    stores.set(agentId, store);
    return store;
  };
}

export default definePluginEntry({
  id: "selflearning",
  name: "OpenClaw Self-Learning",
  description: "Self-learning context-engine plugin for OpenClaw",
  kind: "context-engine",
  register(api) {
    const config = resolvePluginConfig(api.pluginConfig);
    const storeResolver = resolveStore(api, config.store.rootDirName);

    const runSilentReview = async (params: {
      prompt: string;
      sessionId?: string;
      sessionKey?: string;
      sessionFile?: string;
    }) => {
      const agentId = resolveAgentId(params.sessionKey, api.config);
      const workspaceDir = api.runtime.agent.resolveAgentWorkspaceDir(api.config, agentId);
      const sessionId = params.sessionId ?? `selflearning-${Date.now()}`;
      const reviewSessionFile =
        params.sessionFile ??
        buildReviewSessionFile({
          workspaceDir,
          sessionId,
        });
      const result = await api.runtime.agent.runEmbeddedPiAgent({
        sessionId: `${sessionId}:review`,
        sessionKey: `${params.sessionKey ?? `agent:${agentId}:main`}:selflearning-review`,
        agentId,
        messageProvider: "memory",
        trigger: "memory",
        sessionFile: reviewSessionFile,
        workspaceDir,
        config: api.config,
        prompt: params.prompt,
        verboseLevel: "off",
        timeoutMs: api.runtime.agent.resolveAgentTimeoutMs({ cfg: api.config }),
        runId: `selflearning-review:${sessionId}:${Date.now()}`,
        lane: "memory",
        disableTools: true,
        silentExpected: true,
        extraSystemPrompt: [
          "You are a silent self-learning review worker for OpenClaw.",
          "Return strict JSON only.",
          "Do not include markdown fences or commentary.",
        ].join(" "),
      });

      return {
        text: extractReviewText(result),
      };
    };

    api.registerContextEngine("selflearning", () =>
      createSelfLearningEngine({
        store: storeResolver({}),
        triggerConfig: config.trigger,
        recallConfig: config.recall,
        promotionConfig: config.promotion,
        runSilentReview,
      }),
    );

    api.registerCommand(
      createSelfLearningCommand({
        resolveStore: (ctx) => storeResolver(ctx),
        learnCurrentConversation: ({ sessionFile }) =>
          learnCurrentConversation({
            store: storeResolver({}),
            sessionFile,
            runSilentReview: ({ prompt }) => runSilentReview({ prompt, sessionFile }),
            promotionConfig: config.promotion,
          }),
        learnFromFile: ({ filePath }) =>
          learnFromFile({
            store: storeResolver({}),
            filePath,
            runSilentReview: ({ prompt }) => runSilentReview({ prompt }),
            promotionConfig: config.promotion,
          }),
        learnFromSessionScope: ({ sessionFile, sessionKey, source }) =>
          learnFromSessionScope({
            store: storeResolver({ sessionKey }),
            sessionFile,
            sessionKey,
            source,
            runSilentReview: ({ prompt }) => runSilentReview({ prompt, sessionFile, sessionKey }),
            promotionConfig: config.promotion,
          }),
        previewSessionScope: ({ sessionFile, sessionKey, source }) =>
          previewSessionScope({
            store: storeResolver({ sessionKey }),
            sessionFile,
            sessionKey,
            source,
          }),
      }),
    );
  },
});

function extractReviewText(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "{}";
  }
  const record = result as {
    meta?: { finalAssistantVisibleText?: string };
    payloads?: Array<{ text?: string; isReasoning?: boolean; isError?: boolean }>;
  };
  if (typeof record.meta?.finalAssistantVisibleText === "string") {
    return record.meta.finalAssistantVisibleText;
  }
  const payloadText = record.payloads
    ?.filter((payload) => !payload.isReasoning && !payload.isError)
    .map((payload) => payload.text ?? "")
    .join("")
    .trim();
  return payloadText || "{}";
}

function buildReviewSessionFile(params: { workspaceDir: string; sessionId: string }) {
  const reviewDir = path.join(params.workspaceDir, ".openclaw-selflearning", "review-sessions");
  fs.mkdirSync(reviewDir, { recursive: true });
  return path.join(reviewDir, `${params.sessionId}-review.jsonl`);
}
