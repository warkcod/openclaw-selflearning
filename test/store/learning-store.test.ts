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

  it("rebinds imported skills to the current agent when requested", () => {
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
      agentId: "alpha",
      content: "# Customer Onboarding Checklist",
    });

    const bundle = store.exportBundle({ includeCandidates: false, agentId: "alpha" });

    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-store-import-rebind-"));
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
    otherStore.importBundle(bundle, {
      mode: "rebind_to_current_agent",
      currentAgentId: "beta",
      onConflict: "preserve_versions",
    });

    expect(otherStore.getSkillRecord("customer-onboarding-checklist")?.agentId).toBe("beta");
  });

  it("preserves the original agent id when requested", () => {
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
      agentId: "alpha",
      content: "# Customer Onboarding Checklist",
    });

    const bundle = store.exportBundle({ includeCandidates: false, agentId: "alpha" });

    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-store-import-preserve-"));
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
    otherStore.importBundle(bundle, {
      mode: "preserve_origin_agent",
      currentAgentId: "beta",
      onConflict: "preserve_versions",
    });

    expect(otherStore.getSkillRecord("customer-onboarding-checklist")?.agentId).toBe("alpha");
  });

  it("preserves user-owned local skills on import conflicts when configured", () => {
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Local Skill",
      summary: "Local version",
      state: "promoted",
      origin: "selflearned",
      ownership: "user",
      reviewStatus: "approved",
      confidence: 0.9,
      successfulRecalls: 5,
      hitCount: 6,
      userModified: true,
      version: 3,
      content: "# Local Skill",
    });

    const importRoot = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-store-import-conflict-"));
    const importStore = new LearningStore({
      rootDir: importRoot,
      reviewsDir: path.join(importRoot, "reviews"),
      skillsDir: path.join(importRoot, "skills"),
      memoryDir: path.join(importRoot, "memory"),
      traceDir: path.join(importRoot, "evolution-trace"),
      manifestFile: path.join(importRoot, "manifest.json"),
      stateFile: path.join(importRoot, "state.json"),
    });
    importStore.initialize();
    importStore.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Imported Skill",
      summary: "Imported version",
      state: "promoted",
      origin: "selflearned",
      ownership: "system",
      reviewStatus: "approved",
      confidence: 0.8,
      successfulRecalls: 1,
      hitCount: 1,
      userModified: false,
      version: 1,
      content: "# Imported Skill",
    });

    const bundle = importStore.exportBundle({ includeCandidates: false, agentId: "alpha" });
    store.importBundle(bundle, {
      mode: "rebind_to_current_agent",
      currentAgentId: "main",
      onConflict: "prefer_existing",
    });

    const kept = store.getSkillRecord("customer-onboarding-checklist");
    expect(kept?.title).toBe("Local Skill");
    expect(kept?.version).toBe(3);
  });

  it("applies the incoming version when prefer_incoming is selected", () => {
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Local Skill",
      summary: "Local version",
      state: "promoted",
      origin: "selflearned",
      ownership: "system",
      reviewStatus: "approved",
      confidence: 0.9,
      successfulRecalls: 5,
      hitCount: 6,
      userModified: false,
      version: 1,
      content: "# Local Skill",
    });

    const importRoot = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-store-import-incoming-"));
    const importStore = new LearningStore({
      rootDir: importRoot,
      reviewsDir: path.join(importRoot, "reviews"),
      skillsDir: path.join(importRoot, "skills"),
      memoryDir: path.join(importRoot, "memory"),
      traceDir: path.join(importRoot, "evolution-trace"),
      manifestFile: path.join(importRoot, "manifest.json"),
      stateFile: path.join(importRoot, "state.json"),
    });
    importStore.initialize();
    importStore.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Imported Skill",
      summary: "Imported version",
      state: "promoted",
      origin: "selflearned",
      ownership: "system",
      reviewStatus: "approved",
      confidence: 0.95,
      successfulRecalls: 3,
      hitCount: 3,
      userModified: false,
      version: 2,
      content: "# Imported Skill",
    });

    const bundle = importStore.exportBundle({ includeCandidates: false, agentId: "alpha" });
    store.importBundle(bundle, {
      mode: "rebind_to_current_agent",
      currentAgentId: "main",
      onConflict: "prefer_incoming",
    });

    const imported = store.getSkillRecord("customer-onboarding-checklist");
    expect(imported?.title).toBe("Imported Skill");
    expect(imported?.version).toBe(2);
  });
});
