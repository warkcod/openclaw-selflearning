import fs from "node:fs";
import path from "node:path";
import type {
  EvolutionTrace,
  EvolutionTraceEntry,
  LearningBundle,
  LearningManifest,
  LearningState,
  LearningStorePaths,
  MemoryRecord,
  RecallAssetSelection,
  SkillPatchProposal,
  SkillRecord,
} from "../types.js";

export class LearningStore {
  constructor(private readonly paths: LearningStorePaths) {}

  initialize() {
    fs.mkdirSync(this.paths.rootDir, { recursive: true });
    fs.mkdirSync(this.paths.reviewsDir, { recursive: true });
    fs.mkdirSync(this.paths.skillsDir, { recursive: true });
    fs.mkdirSync(this.paths.traceDir, { recursive: true });
    fs.mkdirSync(path.join(this.paths.memoryDir, "candidate"), { recursive: true });
    fs.mkdirSync(path.join(this.paths.memoryDir, "durable"), { recursive: true });
    fs.mkdirSync(path.join(this.paths.memoryDir, "user_model"), { recursive: true });
    for (const state of ["candidate", "promoted", "stale", "deprecated"] as const) {
      fs.mkdirSync(path.join(this.paths.skillsDir, state), { recursive: true });
    }

    if (!fs.existsSync(this.paths.manifestFile)) {
      this.writeManifest({
        schemaVersion: 1,
        bundleVersion: 1,
        skills: {},
        memories: {},
      });
    }

    if (!fs.existsSync(this.paths.stateFile)) {
      this.writeState({
        schemaVersion: 1,
        skills: {},
        memories: {},
      });
    }
  }

  getPaths() {
    return this.paths;
  }

  saveReview(params: {
    sessionId?: string;
    summary: string;
    reasonCodes: string[];
    complexityScore: number;
    rawResult: unknown;
  }) {
    const reviewId = `review_${Date.now()}`;
    const reviewRecord = {
      reviewId,
      sessionId: params.sessionId,
      summary: params.summary,
      reasonCodes: params.reasonCodes,
      complexityScore: params.complexityScore,
      rawResult: params.rawResult,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(this.paths.reviewsDir, `${reviewId}.json`),
      JSON.stringify(reviewRecord, null, 2),
      "utf8",
    );
    return reviewId;
  }

  upsertMemoryRecord(params: {
    id: string;
    kind: MemoryRecord["kind"];
    title: string;
    content: string;
    state: MemoryRecord["state"];
    confidence: number;
    reviewId?: string;
  }) {
    const state = this.readState();
    const record: MemoryRecord = {
      id: params.id,
      kind: params.kind,
      title: params.title,
      content: params.content,
      state: params.state,
      confidence: params.confidence,
      reviewId: params.reviewId,
      updatedAt: new Date().toISOString(),
    };
    state.memories[params.id] = record;
    this.writeState(state);

    const relativePath = path.join(
      "memory",
      params.kind === "user-model" ? "user_model" : params.state === "promoted" ? "durable" : "candidate",
      `${safeFileName(params.id)}.md`,
    );
    fs.mkdirSync(path.dirname(path.join(this.paths.rootDir, relativePath)), { recursive: true });
    fs.writeFileSync(
      path.join(this.paths.rootDir, relativePath),
      `# ${params.title}\n\n${params.content}\n`,
      "utf8",
    );

    const manifest = this.readManifest();
    manifest.memories[params.id] = {
      state: params.state,
      kind: params.kind,
      relativePath,
    };
    this.writeManifest(manifest);
  }

  upsertSkillRecord(params: Omit<SkillRecord, "createdAt" | "updatedAt" | "patchHistory"> & {
    createdAt?: string;
    updatedAt?: string;
    patchHistory?: SkillPatchProposal[];
  }) {
    const state = this.readState();
    const existing = state.skills[params.slug];
    const record: SkillRecord = {
      ...existing,
      ...params,
      createdAt: params.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
      updatedAt: params.updatedAt ?? new Date().toISOString(),
      patchHistory: params.patchHistory ?? existing?.patchHistory ?? [],
    };
    state.skills[params.slug] = record;
    this.writeState(state);

    const relativePath = path.join("skills", params.state, params.slug, "SKILL.md");
    fs.mkdirSync(path.dirname(path.join(this.paths.rootDir, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(this.paths.rootDir, relativePath), params.content, "utf8");

    const manifest = this.readManifest();
    manifest.skills[params.slug] = {
      state: params.state,
      origin: params.origin,
      relativePath,
    };
    this.writeManifest(manifest);
  }

  appendPatchProposal(proposal: SkillPatchProposal) {
    const state = this.readState();
    const record = state.skills[proposal.targetSlug];
    if (!record) {
      return;
    }
    record.patchHistory = [...record.patchHistory, proposal];
    record.patchTargetSkillId = proposal.targetSlug;
    record.patchReason = proposal.reason;
    record.lastSuggestedPatchAt = proposal.createdAt;
    record.updatedAt = new Date().toISOString();
    state.skills[proposal.targetSlug] = record;
    this.writeState(state);
  }

  listPatchProposals() {
    return this.listAllSkills()
      .flatMap((skill) => skill.patchHistory.map((proposal) => ({ ...proposal, targetTitle: skill.title })))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  applyPatchProposal(proposalId: string) {
    const state = this.readState();

    for (const skill of Object.values(state.skills)) {
      const proposal = skill.patchHistory.find((entry) => entry.proposalId === proposalId);
      if (!proposal) {
        continue;
      }

      const updated: SkillRecord = {
        ...skill,
        summary: proposal.proposedSummary,
        content: proposal.proposedContent,
        version: skill.version + 1,
        parentVersion: skill.version,
        updatedAt: new Date().toISOString(),
        patchHistory: skill.patchHistory.filter((entry) => entry.proposalId !== proposalId),
        patchTargetSkillId: undefined,
        patchReason: undefined,
        lastSuggestedPatchAt: undefined,
      };

      state.skills[skill.slug] = updated;
      this.writeState(state);
      this.syncManifestFromState(state);

      const relativePath = path.join("skills", updated.state, updated.slug, "SKILL.md");
      fs.mkdirSync(path.dirname(path.join(this.paths.rootDir, relativePath)), { recursive: true });
      fs.writeFileSync(path.join(this.paths.rootDir, relativePath), updated.content, "utf8");

      return updated;
    }

    return null;
  }

  getSkillRecord(slug: string) {
    return this.readState().skills[slug];
  }

  listAllSkills() {
    return Object.values(this.readState().skills);
  }

  listCandidateSkills() {
    return this.listAllSkills().filter((skill) => skill.state === "candidate");
  }

  listRecallAssets(params: {
    maxMemories: number;
    maxSkills: number;
    allowCandidateRecall: boolean;
  }): RecallAssetSelection {
    const state = this.readState();
    const memoryStates = params.allowCandidateRecall ? ["promoted", "candidate"] : ["promoted"];
    const skillStates: SkillRecord["state"][] = params.allowCandidateRecall
      ? ["promoted", "candidate"]
      : ["promoted"];

    const memories = Object.values(state.memories)
      .filter((memory) => memoryStates.includes(memory.state))
      .sort(compareByConfidenceAndFreshness)
      .slice(0, params.maxMemories)
      .map((memory) => ({
        id: memory.id,
        title: memory.title,
        content: memory.content,
        confidence: memory.confidence,
        state: memory.state,
      }));

    const skills = Object.values(state.skills)
      .filter((skill) => skillStates.includes(skill.state))
      .sort(compareSkillsForRecall)
      .slice(0, params.maxSkills)
      .map((skill) => ({
        slug: skill.slug,
        title: skill.title,
        summary: skill.summary,
        content: skill.content,
        confidence: skill.confidence,
        state: skill.state,
        origin: skill.origin,
      }));

    return { memories, skills };
  }

  saveEvolutionTrace(trace: EvolutionTrace) {
    fs.writeFileSync(
      path.join(this.paths.traceDir, `${trace.traceId}.json`),
      JSON.stringify(trace, null, 2),
      "utf8",
    );
  }

  applyAssetUsage(entries: EvolutionTraceEntry[]) {
    const state = this.readState();
    const now = new Date().toISOString();

    for (const entry of entries) {
      if (entry.assetKind !== "skill") {
        continue;
      }
      const slug = entry.assetId.replace(/^skill:/u, "");
      const skill = state.skills[slug];
      if (!skill) {
        continue;
      }
      skill.hitCount += 1;
      skill.lastRecallAt = now;
      skill.lastOutcome = entry.outcome;
      if (entry.outcome === "success") {
        skill.successfulRecalls += 1;
      }
      state.skills[slug] = {
        ...skill,
        updatedAt: now,
      };
    }

    this.writeState(state);
  }

  setSkillReviewDecision(slug: string, decision: "approved" | "rejected" | "candidate") {
    const state = this.readState();
    const skill = state.skills[slug];
    if (!skill) {
      return false;
    }
    const now = new Date().toISOString();
    if (decision === "approved") {
      skill.state = "promoted";
      skill.reviewStatus = "approved";
      skill.promotedAt = now;
    } else if (decision === "rejected") {
      skill.state = "deprecated";
      skill.reviewStatus = "rejected";
    } else {
      skill.state = "candidate";
      skill.reviewStatus = "pending";
    }
    skill.updatedAt = now;
    state.skills[slug] = skill;
    this.writeState(state);
    this.syncManifestFromState(state);
    return true;
  }

  saveSkillRevision(params: { slug: string; feedback: string }) {
    const state = this.readState();
    const skill = state.skills[params.slug];
    if (!skill) {
      return null;
    }

    const revised: SkillRecord = {
      ...skill,
      state: "candidate",
      ownership: "user",
      userModified: true,
      reviewStatus: "pending",
      parentVersion: skill.version,
      version: skill.version + 1,
      reviewReason: params.feedback,
      updatedAt: new Date().toISOString(),
      content: appendRevisionNote(skill.content, params.feedback),
    };

    state.skills[params.slug] = revised;
    this.writeState(state);
    this.syncManifestFromState(state);

    const relativePath = path.join("skills", revised.state, revised.slug, "SKILL.md");
    fs.mkdirSync(path.dirname(path.join(this.paths.rootDir, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(this.paths.rootDir, relativePath), revised.content, "utf8");

    const revisionDir = path.join(this.paths.skillsDir, revised.state, revised.slug, "revisions");
    fs.mkdirSync(revisionDir, { recursive: true });
    fs.writeFileSync(
      path.join(revisionDir, `rev-${String(revised.version).padStart(3, "0")}.md`),
      [
        `# Revision ${revised.version}`,
        "",
        `Feedback: ${params.feedback}`,
        "",
        revised.content,
      ].join("\n"),
      "utf8",
    );

    return revised;
  }

  exportBundle(params: { includeCandidates: boolean; agentId?: string }): LearningBundle {
    const state = this.readState();
    const filteredState: LearningState = {
      schemaVersion: 1,
      skills: Object.fromEntries(
        Object.entries(state.skills).filter(([, record]) =>
          params.includeCandidates ? true : record.state !== "candidate",
        ),
      ),
      memories: Object.fromEntries(
        Object.entries(state.memories).filter(([, record]) =>
          params.includeCandidates ? true : record.state !== "candidate",
        ),
      ),
    };
    const manifest = this.readManifest();
    const filteredManifest: LearningManifest = {
      schemaVersion: 1,
      bundleVersion: 1,
      skills: Object.fromEntries(
        Object.entries(manifest.skills).filter(([slug]) => Boolean(filteredState.skills[slug])),
      ),
      memories: Object.fromEntries(
        Object.entries(manifest.memories).filter(([id]) => Boolean(filteredState.memories[id])),
      ),
    };

    return {
      bundleVersion: 1,
      exportedAt: new Date().toISOString(),
      sourcePluginVersion: "0.1.0",
      sourceOpenClawVersion: "2026.4.14-beta.1",
      agentId: params.agentId,
      includeCandidates: params.includeCandidates,
      manifest: filteredManifest,
      state: filteredState,
    };
  }

  importBundle(
    bundle: LearningBundle,
    params: {
      mode: "rebind_to_current_agent" | "preserve_origin_agent" | "merge_into_user_profile";
      currentAgentId?: string;
      onConflict?: "preserve_versions" | "prefer_incoming" | "prefer_existing";
    },
  ) {
    const state = this.readState();
    for (const [slug, record] of Object.entries(bundle.state.skills)) {
      const existing = state.skills[slug];
      const nextRecord = {
        ...record,
        agentId: resolveImportedAgentId(record.agentId, params.mode, params.currentAgentId),
        updatedAt: new Date().toISOString(),
      };

      if (!existing) {
        state.skills[slug] = nextRecord;
        continue;
      }

      if (params.onConflict === "prefer_existing") {
        continue;
      }

      if (params.onConflict === "prefer_incoming") {
        state.skills[slug] = nextRecord;
        continue;
      }

      if (existing.userModified) {
        continue;
      }

      if ((existing.version ?? 0) <= (nextRecord.version ?? 0)) {
        state.skills[slug] = nextRecord;
      }
    }
    for (const [id, record] of Object.entries(bundle.state.memories)) {
      if (!state.memories[id]) {
        state.memories[id] = {
          ...record,
          updatedAt: new Date().toISOString(),
        };
      }
    }
    this.writeState(state);
    this.syncManifestFromState(state);
    for (const skill of Object.values(state.skills)) {
      const relativePath = path.join("skills", skill.state, skill.slug, "SKILL.md");
      fs.mkdirSync(path.dirname(path.join(this.paths.rootDir, relativePath)), { recursive: true });
      fs.writeFileSync(path.join(this.paths.rootDir, relativePath), skill.content, "utf8");
    }
    for (const memory of Object.values(state.memories)) {
      const relativePath = path.join(
        "memory",
        memory.kind === "user-model" ? "user_model" : memory.state === "promoted" ? "durable" : "candidate",
        `${safeFileName(memory.id)}.md`,
      );
      fs.mkdirSync(path.dirname(path.join(this.paths.rootDir, relativePath)), { recursive: true });
      fs.writeFileSync(
        path.join(this.paths.rootDir, relativePath),
        `# ${memory.title}\n\n${memory.content}\n`,
        "utf8",
      );
    }
  }

  private syncManifestFromState(state: LearningState) {
    const manifest: LearningManifest = {
      schemaVersion: 1,
      bundleVersion: 1,
      skills: {},
      memories: {},
    };

    for (const skill of Object.values(state.skills)) {
      manifest.skills[skill.slug] = {
        state: skill.state,
        origin: skill.origin,
        relativePath: path.join("skills", skill.state, skill.slug, "SKILL.md"),
      };
    }

    for (const memory of Object.values(state.memories)) {
      manifest.memories[memory.id] = {
        state: memory.state,
        kind: memory.kind,
        relativePath: path.join(
          "memory",
          memory.kind === "user-model" ? "user_model" : memory.state === "promoted" ? "durable" : "candidate",
          `${safeFileName(memory.id)}.md`,
        ),
      };
    }

    this.writeManifest(manifest);
  }

  private readManifest(): LearningManifest {
    return JSON.parse(fs.readFileSync(this.paths.manifestFile, "utf8")) as LearningManifest;
  }

  private writeManifest(manifest: LearningManifest) {
    fs.writeFileSync(this.paths.manifestFile, JSON.stringify(manifest, null, 2), "utf8");
  }

  private readState(): LearningState {
    return JSON.parse(fs.readFileSync(this.paths.stateFile, "utf8")) as LearningState;
  }

  private writeState(state: LearningState) {
    fs.writeFileSync(this.paths.stateFile, JSON.stringify(state, null, 2), "utf8");
  }
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/giu, "-");
}

function resolveImportedAgentId(
  originalAgentId: string | undefined,
  mode: "rebind_to_current_agent" | "preserve_origin_agent" | "merge_into_user_profile",
  currentAgentId: string | undefined,
) {
  if (mode === "preserve_origin_agent") {
    return originalAgentId;
  }
  if (mode === "merge_into_user_profile") {
    return undefined;
  }
  return currentAgentId;
}

function appendRevisionNote(content: string, feedback: string) {
  return [
    content.trimEnd(),
    "",
    "## Revision Notes",
    "",
    `- ${feedback}`,
    "",
  ].join("\n");
}

function compareByConfidenceAndFreshness(left: { confidence: number; updatedAt?: string }, right: { confidence: number; updatedAt?: string }) {
  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }
  return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
}

function compareSkillsForRecall(left: SkillRecord, right: SkillRecord) {
  if (right.successfulRecalls !== left.successfulRecalls) {
    return right.successfulRecalls - left.successfulRecalls;
  }
  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }
  return right.updatedAt.localeCompare(left.updatedAt);
}
