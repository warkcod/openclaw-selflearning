import { z } from "zod";
import type { SelfLearningPluginConfig } from "./types.js";

export const defaultPluginConfig: SelfLearningPluginConfig = {
  store: {
    rootDirName: ".openclaw-selflearning",
  },
  trigger: {
    toolCallCandidateThreshold: 6,
    toolCallForceThreshold: 10,
    cooldownTurns: 2,
    retryWeight: 1,
    rerouteWeight: 1,
    userCorrectionWeight: 1,
  },
  recall: {
    maxMemories: 5,
    maxSkills: 5,
    maxTranscripts: 5,
    allowCandidateRecall: false,
    trackAssetUsage: true,
  },
  promotion: {
    autoPromote: false,
    minConfidence: 0.85,
    minSuccessfulRecalls: 2,
  },
  revision: {
    requireUserApprovalForUserRequestedSkills: true,
    allowUserRevisionFlow: true,
  },
  import: {
    mode: "rebind_to_current_agent",
    onConflict: "preserve_versions",
  },
  export: {
    includeCandidates: false,
  },
};

const triggerSchema = z.object({
  toolCallCandidateThreshold: z.number().int().min(1),
  toolCallForceThreshold: z.number().int().min(1),
  cooldownTurns: z.number().int().min(0),
  retryWeight: z.number().min(0),
  rerouteWeight: z.number().min(0),
  userCorrectionWeight: z.number().min(0),
});

const recallSchema = z.object({
  maxMemories: z.number().int().min(1),
  maxSkills: z.number().int().min(1),
  maxTranscripts: z.number().int().min(1),
  allowCandidateRecall: z.boolean(),
  trackAssetUsage: z.boolean(),
});

const promotionSchema = z.object({
  autoPromote: z.boolean(),
  minConfidence: z.number().min(0).max(1),
  minSuccessfulRecalls: z.number().int().min(0),
});

const revisionSchema = z.object({
  requireUserApprovalForUserRequestedSkills: z.boolean(),
  allowUserRevisionFlow: z.boolean(),
});

const importSchema = z.object({
  mode: z.enum([
    "rebind_to_current_agent",
    "preserve_origin_agent",
    "merge_into_user_profile",
  ]),
  onConflict: z.enum(["preserve_versions", "prefer_incoming", "prefer_existing"]),
});

const exportSchema = z.object({
  includeCandidates: z.boolean(),
});

export const pluginConfigSchema = z.object({
  store: z
    .object({
      rootDirName: z.string().min(1),
    })
    .default(defaultPluginConfig.store),
  trigger: triggerSchema.default(defaultPluginConfig.trigger),
  recall: recallSchema.default(defaultPluginConfig.recall),
  promotion: promotionSchema.default(defaultPluginConfig.promotion),
  revision: revisionSchema.default(defaultPluginConfig.revision),
  import: importSchema.default(defaultPluginConfig.import),
  export: exportSchema.default(defaultPluginConfig.export),
});

export function resolvePluginConfig(input: unknown): SelfLearningPluginConfig {
  const merged = {
    ...defaultPluginConfig,
    ...(typeof input === "object" && input !== null ? input : {}),
  };
  return pluginConfigSchema.parse(merged);
}
