import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LearningStore } from "../../src/store/learning-store.js";
import { applyEvolutionTrace } from "../../src/growth/evolution-trace.js";

describe("applyEvolutionTrace", () => {
  let root: string;
  let store: LearningStore;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-trace-"));
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
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Customer Onboarding Checklist",
      summary: "Checklist for onboarding a customer",
      state: "promoted",
      origin: "selflearned",
      ownership: "system",
      reviewStatus: "approved",
      confidence: 0.8,
      successfulRecalls: 0,
      hitCount: 0,
      userModified: false,
      version: 1,
      content: "# Customer Onboarding Checklist",
    });
  });

  it("increments successful recall signals on successful usage", () => {
    applyEvolutionTrace({
      store,
      sessionId: "session-1",
      assetUsage: [
        {
          assetId: "skill:customer-onboarding-checklist",
          assetKind: "skill",
          outcome: "success",
          notes: "The checklist guided the tool-using sequence.",
        },
      ],
    });

    const skill = store.getSkillRecord("customer-onboarding-checklist");
    expect(skill?.successfulRecalls).toBe(1);
    expect(skill?.hitCount).toBe(1);
    expect(skill?.lastOutcome).toBe("success");
  });

  it("tracks memory usage outcomes as well", () => {
    store.upsertMemoryRecord({
      id: "memory:default-channel",
      kind: "durable-memory",
      title: "Default follow-up channel",
      content: "The user prefers Telegram follow-ups.",
      state: "promoted",
      confidence: 0.8,
    });

    applyEvolutionTrace({
      store,
      sessionId: "session-2",
      assetUsage: [
        {
          assetId: "memory:default-channel",
          assetKind: "memory",
          outcome: "success",
          notes: "The preference shaped the reply routing choice.",
        },
      ],
    });

    const memory = store.getMemoryRecord("memory:default-channel");
    expect(memory?.successfulRecalls).toBe(1);
    expect(memory?.hitCount).toBe(1);
    expect(memory?.lastOutcome).toBe("success");
  });
});
