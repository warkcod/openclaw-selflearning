import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LearningStore } from "../../src/store/learning-store.js";

describe("LearningStore", () => {
  let root: string;
  let store: LearningStore;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-store-"));
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

  it("creates the initial directory and state structure", () => {
    expect(fs.existsSync(path.join(root, "reviews"))).toBe(true);
    expect(fs.existsSync(path.join(root, "skills"))).toBe(true);
    expect(fs.existsSync(path.join(root, "memory"))).toBe(true);
    expect(fs.existsSync(path.join(root, "evolution-trace"))).toBe(true);
    expect(fs.existsSync(path.join(root, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "state.json"))).toBe(true);
  });

  it("stores reviews, memories, and promoted skills for later recall", () => {
    const reviewId = store.saveReview({
      sessionId: "session-1",
      summary: "learned customer onboarding flow",
      reasonCodes: ["tool-call-force-threshold"],
      complexityScore: 9,
      rawResult: { ok: true },
    });

    store.upsertMemoryRecord({
      id: `${reviewId}:default-channel`,
      kind: "durable-memory",
      title: "Default follow-up channel",
      content: "The user prefers Telegram follow-ups.",
      state: "promoted",
      confidence: 0.8,
      reviewId,
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

    const recall = store.listRecallAssets({
      maxMemories: 5,
      maxSkills: 5,
      allowCandidateRecall: false,
    });

    expect(recall.memories).toHaveLength(1);
    expect(recall.skills).toHaveLength(1);
    expect(recall.skills[0]?.slug).toBe("customer-onboarding-checklist");
  });

  it("exports and re-imports a learning bundle", () => {
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Customer Onboarding Checklist",
      summary: "Checklist for onboarding a customer",
      state: "promoted",
      origin: "selflearned",
      ownership: "system",
      reviewStatus: "approved",
      confidence: 0.9,
      successfulRecalls: 2,
      hitCount: 3,
      userModified: false,
      version: 1,
      content: "# Customer Onboarding Checklist",
    });

    const bundle = store.exportBundle({ includeCandidates: false, agentId: "alpha" });

    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-store-import-"));
    const otherStore = new LearningStore({
      rootDir: otherRoot,
      reviewsDir: path.join(otherRoot, "reviews"),
      skillsDir: path.join(otherRoot, "skills"),
      memoryDir: path.join(otherRoot, "memory"),
      traceDir: path.join(otherRoot, "evolution-trace"),
      manifestFile: path.join(otherRoot, "manifest.json"),
      stateFile: path.join(otherRoot, "state.json"),
    });
    otherStore.initialize();
    otherStore.importBundle(bundle, { mode: "rebind_to_current_agent" });

    const imported = otherStore.getSkillRecord("customer-onboarding-checklist");
    expect(imported?.state).toBe("promoted");
    expect(imported?.successfulRecalls).toBe(2);
  });
});
