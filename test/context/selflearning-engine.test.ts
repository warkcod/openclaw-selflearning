import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LearningStore } from "../../src/store/learning-store.js";
import { createSelfLearningEngine } from "../../src/context/selflearning-engine.js";

describe("createSelfLearningEngine", () => {
  let root: string;
  let store: LearningStore;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-engine-"));
    store = new LearningStore({
      rootDir: root,
      reviewsDir: path.join(root, "reviews"),
      skillsDir: path.join(root, "skills"),
      memoryDir: path.join(root, "memory"),
      traceDir: path.join(root, "evolution-trace"),
      manifestFile: path.join(root, "manifest.json"),
      stateFile: path.join(root, "state.json"),
    });
    store.initialize();
  });

  it("injects promoted assets into the system prompt addition", async () => {
    store.upsertMemoryRecord({
      id: "memory:follow-up-channel",
      kind: "durable-memory",
      title: "Default follow-up channel",
      content: "The user prefers Telegram follow-ups.",
      state: "promoted",
      confidence: 0.8,
    });
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Customer Onboarding Checklist",
      summary: "Checklist for onboarding a customer",
      state: "promoted",
      origin: "selflearned",
      ownership: "system",
      reviewStatus: "approved",
      confidence: 0.9,
      successfulRecalls: 0,
      hitCount: 0,
      userModified: false,
      version: 1,
      content: "# Customer Onboarding Checklist",
    });

    const engine = createSelfLearningEngine({
      store,
      triggerConfig: {
        toolCallCandidateThreshold: 3,
        toolCallForceThreshold: 6,
        cooldownTurns: 2,
        retryWeight: 1,
        rerouteWeight: 1,
        userCorrectionWeight: 1,
      },
      recallConfig: {
        maxMemories: 5,
        maxSkills: 5,
        maxTranscripts: 5,
        allowCandidateRecall: false,
        trackAssetUsage: true,
      },
      promotionConfig: {
        autoPromote: false,
        minConfidence: 0.85,
        minSuccessfulRecalls: 2,
      },
      runSilentReview: async () => ({
        text: JSON.stringify({
          summary: "learned onboarding flow",
          memoryCandidates: [],
          skillCandidates: [],
          transcriptCandidates: [],
          assetUsage: [],
          dedupeHints: [],
          reuseConfidence: 0.8,
        }),
      }),
    });

    const result = await engine.assemble({
      sessionId: "session-1",
      messages: [],
      tokenBudget: 2048,
    });

    expect(result.systemPromptAddition).toContain("Default follow-up channel");
    expect(result.systemPromptAddition).toContain("customer-onboarding-checklist");
  });

  it("reviews a turn and writes new candidates", async () => {
    const engine = createSelfLearningEngine({
      store,
      triggerConfig: {
        toolCallCandidateThreshold: 1,
        toolCallForceThreshold: 2,
        cooldownTurns: 0,
        retryWeight: 1,
        rerouteWeight: 1,
        userCorrectionWeight: 1,
      },
      recallConfig: {
        maxMemories: 5,
        maxSkills: 5,
        maxTranscripts: 5,
        allowCandidateRecall: false,
        trackAssetUsage: true,
      },
      promotionConfig: {
        autoPromote: false,
        minConfidence: 0.85,
        minSuccessfulRecalls: 2,
      },
      runSilentReview: async () => ({
        text: JSON.stringify({
          summary: "learned onboarding flow",
          memoryCandidates: [
            {
              kind: "durable-memory",
              title: "Default follow-up channel",
              content: "The user prefers Telegram follow-ups.",
              confidence: 0.8,
            },
          ],
          skillCandidates: [
            {
              title: "Customer Onboarding Checklist",
              slug: "customer-onboarding-checklist",
              summary: "Checklist for onboarding a customer",
              content: "# Customer Onboarding Checklist",
              confidence: 0.9,
            },
          ],
          transcriptCandidates: [
            {
              title: "Incident retrospective decision context",
              summary: "Why the team moved incident snapshots to Glacier.",
              content:
                "The team chose Glacier after comparing restore latency and storage cost tradeoffs.",
              confidence: 0.75,
            },
          ],
          assetUsage: [],
          dedupeHints: [],
          reuseConfidence: 0.9,
        }),
      }),
    });

    await engine.afterTurn!({
      sessionId: "session-1",
      sessionKey: "agent:alpha:main",
      sessionFile: path.join(root, "session.jsonl"),
      messages: [{ role: "tool", name: "memory_search", content: "ok" }] as never[],
      prePromptMessageCount: 0,
    });

    expect(store.listCandidateSkills()).toHaveLength(1);
    expect(
      store.listRecallAssets({
        maxMemories: 5,
        maxSkills: 5,
        maxTranscripts: 5,
        allowCandidateRecall: true,
      }).memories,
    ).toHaveLength(1);
    expect(
      store.listRecallAssets({
        maxMemories: 5,
        maxSkills: 5,
        maxTranscripts: 5,
        allowCandidateRecall: true,
      }).transcripts,
    ).toHaveLength(1);
  });
});
