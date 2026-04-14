export type AssetOrigin = "selflearned" | "user_requested";

export type SkillLifecycleState = "candidate" | "promoted" | "stale" | "deprecated";

export type OwnershipMode = "system" | "user";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type RecallOutcome = "success" | "partial" | "failure" | "user_corrected" | "ignored";

export type MemoryRecordState = "candidate" | "promoted" | "deprecated";
export type TranscriptRecordState = "candidate" | "promoted" | "deprecated";

export type MemoryRecord = {
  id: string;
  kind: "durable-memory" | "user-model";
  title: string;
  content: string;
  state: MemoryRecordState;
  confidence: number;
  successfulRecalls: number;
  hitCount: number;
  failureCount?: number;
  userCorrectionCount?: number;
  lastRecallAt?: string;
  lastOutcome?: RecallOutcome;
  suppressed?: boolean;
  suppressedAt?: string;
  suppressionReason?: string;
  reviewId?: string;
  updatedAt: string;
};

export type SkillRecord = {
  slug: string;
  title: string;
  summary: string;
  state: SkillLifecycleState;
  origin: AssetOrigin;
  ownership: OwnershipMode;
  reviewStatus: ReviewStatus;
  confidence: number;
  successfulRecalls: number;
  hitCount: number;
  failureCount?: number;
  userCorrectionCount?: number;
  userModified: boolean;
  version: number;
  content: string;
  sourceReviewId?: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  promotedAt?: string;
  parentVersion?: number;
  reviewReason?: string;
  lastSuggestedPatchAt?: string;
  frozen?: boolean;
  lastRecallAt?: string;
  lastOutcome?: RecallOutcome;
  suppressed?: boolean;
  suppressedAt?: string;
  suppressionReason?: string;
  patchTargetSkillId?: string;
  patchReason?: string;
  patchHistory: SkillPatchProposal[];
};

export type SkillPatchProposal = {
  proposalId: string;
  candidateSlug: string;
  targetSlug: string;
  confidence: number;
  reason: string;
  mode: "patch" | "patch-proposal";
  createdAt: string;
  proposedSummary: string;
  proposedContent: string;
};

export type ReviewReasonCode =
  | "tool-call-candidate-threshold"
  | "tool-call-force-threshold"
  | "retry-amplifier"
  | "reroute-amplifier"
  | "user-correction-amplifier"
  | "cooldown-blocked";

export type ReviewComplexityInput = {
  toolCalls: number;
  retries: number;
  reroutes: number;
  userCorrections: number;
  turnIndex: number;
  lastReviewTurnIndex?: number;
};

export type ReviewDecision = {
  shouldReview: boolean;
  reasonCodes: ReviewReasonCode[];
  complexityScore: number;
};

export type ReviewCandidateMemory = {
  kind: "durable-memory" | "user-model";
  title: string;
  content: string;
  confidence: number;
};

export type TranscriptRecord = {
  id: string;
  title: string;
  summary: string;
  content: string;
  state: TranscriptRecordState;
  confidence: number;
  successfulRecalls: number;
  hitCount: number;
  failureCount?: number;
  userCorrectionCount?: number;
  lastRecallAt?: string;
  lastOutcome?: RecallOutcome;
  suppressed?: boolean;
  suppressedAt?: string;
  suppressionReason?: string;
  reviewId?: string;
  updatedAt: string;
};

export type ReviewCandidateSkill = {
  slug?: string;
  title: string;
  summary?: string;
  content?: string;
  confidence?: number;
  scope?: string;
  inputs?: string[];
  coreSteps?: string[];
  outputs?: string[];
  caveats?: string[];
  origin?: AssetOrigin;
};

export type ReviewCandidateTranscript = {
  id?: string;
  title: string;
  summary: string;
  content: string;
  confidence: number;
};

export type ReviewAssetUsage = {
  assetId: string;
  assetKind: "memory" | "skill" | "transcript";
  outcome: RecallOutcome;
  notes?: string;
};

export type ReviewResult = {
  summary: string;
  memoryCandidates: ReviewCandidateMemory[];
  skillCandidates: ReviewCandidateSkill[];
  transcriptCandidates: ReviewCandidateTranscript[];
  assetUsage: ReviewAssetUsage[];
  dedupeHints: string[];
  reuseConfidence: number;
};

export type RecallMemoryAsset = {
  id: string;
  title: string;
  content: string;
  confidence: number;
  state: MemoryRecordState;
};

export type RecallSkillAsset = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  confidence: number;
  state: SkillLifecycleState;
  origin: AssetOrigin;
};

export type RecallTranscriptAsset = {
  id: string;
  title: string;
  summary: string;
  content: string;
  confidence: number;
  state: TranscriptRecordState;
};

export type RecallAssetSelection = {
  memories: RecallMemoryAsset[];
  skills: RecallSkillAsset[];
  transcripts: RecallTranscriptAsset[];
};

export type EvolutionTraceEntry = {
  assetId: string;
  assetKind: "memory" | "skill" | "transcript";
  outcome: RecallOutcome;
  notes?: string;
};

export type EvolutionTrace = {
  traceId: string;
  sessionId: string;
  createdAt: string;
  entries: EvolutionTraceEntry[];
};

export type LearningManifest = {
  schemaVersion: 1;
  bundleVersion: 1;
  skills: Record<
    string,
    {
      state: SkillLifecycleState;
      origin: AssetOrigin;
      relativePath: string;
    }
  >;
  memories: Record<
    string,
    {
      state: MemoryRecordState;
      kind: MemoryRecord["kind"];
      relativePath: string;
    }
  >;
  transcripts: Record<
    string,
    {
      state: TranscriptRecordState;
      relativePath: string;
    }
  >;
};

export type LearningState = {
  schemaVersion: 1;
  skills: Record<string, SkillRecord>;
  memories: Record<string, MemoryRecord>;
  transcripts: Record<string, TranscriptRecord>;
};

export type LearningBundle = {
  bundleVersion: 1;
  exportedAt: string;
  sourcePluginVersion: string;
  sourceOpenClawVersion: string;
  agentId?: string;
  includeCandidates: boolean;
  manifest: LearningManifest;
  state: LearningState;
};

export type TriggerConfig = {
  toolCallCandidateThreshold: number;
  toolCallForceThreshold: number;
  cooldownTurns: number;
  retryWeight: number;
  rerouteWeight: number;
  userCorrectionWeight: number;
};

export type RecallConfig = {
  maxMemories: number;
  maxSkills: number;
  maxTranscripts: number;
  allowCandidateRecall: boolean;
  trackAssetUsage: boolean;
};

export type PromotionConfig = {
  autoPromote: boolean;
  minConfidence: number;
  minSuccessfulRecalls: number;
};

export type RevisionConfig = {
  requireUserApprovalForUserRequestedSkills: boolean;
  allowUserRevisionFlow: boolean;
};

export type ImportMode =
  | "rebind_to_current_agent"
  | "preserve_origin_agent"
  | "merge_into_user_profile";

export type ImportConfig = {
  mode: ImportMode;
  onConflict: "preserve_versions" | "prefer_incoming" | "prefer_existing";
};

export type ExportConfig = {
  includeCandidates: boolean;
};

export type StoreConfig = {
  rootDirName: string;
};

export type SelfLearningPluginConfig = {
  store: StoreConfig;
  trigger: TriggerConfig;
  recall: RecallConfig;
  promotion: PromotionConfig;
  revision: RevisionConfig;
  import: ImportConfig;
  export: ExportConfig;
};

export type LearningStorePaths = {
  rootDir: string;
  reviewsDir: string;
  skillsDir: string;
  memoryDir: string;
  traceDir: string;
  manifestFile: string;
  stateFile: string;
};

export type PatchDecisionResult =
  | { kind: "create"; confidence: number; reason: string }
  | { kind: "patch"; targetSlug: string; confidence: number; reason: string }
  | { kind: "patch-proposal"; targetSlug: string; confidence: number; reason: string };

export type SkillCandidateForPatchDecision = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  confidence: number;
  origin: AssetOrigin;
};
