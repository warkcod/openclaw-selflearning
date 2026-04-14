import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginCommandContext } from "openclaw/plugin-sdk/plugin-entry";
import { LearningStore } from "../../src/store/learning-store.js";
import { createSelfLearningCommand } from "../../src/commands/selflearn-command.js";

describe("createSelfLearningCommand", () => {
  let root: string;
  let store: LearningStore;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "selflearn-command-"));
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

  function createCommandContext(
    overrides: Partial<PluginCommandContext> = {},
  ): PluginCommandContext {
    return {
      channel: "cli",
      isAuthorizedSender: true,
      commandBody: "selflearn",
      args: "",
      config: {} as never,
      requestConversationBinding: vi.fn(async () => ({
        status: "error" as const,
        message: "not implemented in test",
      })),
      detachConversationBinding: vi.fn(async () => ({ removed: false })),
      getCurrentConversationBinding: vi.fn(async () => null),
      ...overrides,
    };
  }

  it("lists candidate skills from the queue", async () => {
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Customer Onboarding Checklist",
      summary: "Checklist for onboarding a customer",
      state: "candidate",
      origin: "user_requested",
      ownership: "system",
      reviewStatus: "pending",
      confidence: 0.9,
      successfulRecalls: 0,
      hitCount: 0,
      userModified: false,
      version: 1,
      content: "# Customer Onboarding Checklist",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler({
      ...createCommandContext({
        commandBody: "selflearn queue",
        args: "queue",
      }),
    });

    expect(result.text).toContain("customer-onboarding-checklist");
    expect(result.text).toContain("candidate");
  });

  it("lists candidate memories", async () => {
    store.upsertMemoryRecord({
      id: "memory:default-channel",
      kind: "durable-memory",
      title: "Default follow-up channel",
      content: "The user prefers Telegram follow-ups.",
      state: "candidate",
      confidence: 0.8,
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn memories",
        args: "memories",
      }),
    );

    expect(result.text).toContain("memory:default-channel");
    expect(result.text).toContain("Default follow-up channel");
  });

  it("delegates explicit learning from the current conversation", async () => {
    const learnCurrentConversation = vi.fn().mockResolvedValue({
      slug: "customer-onboarding-checklist",
      state: "candidate",
    });
    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation,
      learnFromFile: vi.fn(),
    });

    const result = await command.handler({
      ...createCommandContext({
        commandBody: "selflearn learn --from current",
        args: "learn --from current",
        sessionFile: path.join(root, "session.jsonl"),
      }),
    });

    expect(learnCurrentConversation).toHaveBeenCalled();
    expect(result.text).toContain("customer-onboarding-checklist");
  });

  it("approves a candidate skill", async () => {
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Customer Onboarding Checklist",
      summary: "Checklist for onboarding a customer",
      state: "candidate",
      origin: "user_requested",
      ownership: "system",
      reviewStatus: "pending",
      confidence: 0.9,
      successfulRecalls: 0,
      hitCount: 0,
      userModified: false,
      version: 1,
      content: "# Customer Onboarding Checklist",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler({
      ...createCommandContext({
        commandBody: "selflearn approve customer-onboarding-checklist",
        args: "approve customer-onboarding-checklist",
      }),
    });

    expect(result.text).toContain("approved");
    expect(store.getSkillRecord("customer-onboarding-checklist")?.state).toBe("promoted");
  });

  it("approves a candidate memory", async () => {
    store.upsertMemoryRecord({
      id: "memory:default-channel",
      kind: "durable-memory",
      title: "Default follow-up channel",
      content: "The user prefers Telegram follow-ups.",
      state: "candidate",
      confidence: 0.8,
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn approve-memory memory:default-channel",
        args: "approve-memory memory:default-channel",
      }),
    );

    expect(result.text).toContain("approved");
    expect(store.getMemoryRecord("memory:default-channel")?.state).toBe("promoted");
  });

  it("shows detailed skill content", async () => {
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Customer Onboarding Checklist",
      summary: "Checklist for onboarding a customer",
      state: "candidate",
      origin: "user_requested",
      ownership: "system",
      reviewStatus: "pending",
      confidence: 0.9,
      successfulRecalls: 0,
      hitCount: 0,
      userModified: false,
      version: 1,
      content: "# Customer Onboarding Checklist\n\nUse this flow.",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn show customer-onboarding-checklist",
        args: "show customer-onboarding-checklist",
      }),
    );

    expect(result.text).toContain("Customer Onboarding Checklist");
    expect(result.text).toContain("Use this flow.");
  });

  it("creates a user-owned revision candidate", async () => {
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
      content: "# Customer Onboarding Checklist\n\nUse this flow.",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody:
          "selflearn revise customer-onboarding-checklist add an escalation step",
        args: "revise customer-onboarding-checklist add an escalation step",
      }),
    );

    const revised = store.getSkillRecord("customer-onboarding-checklist");
    expect(result.text).toContain("revision");
    expect(revised?.userModified).toBe(true);
    expect(revised?.ownership).toBe("user");
    expect(revised?.version).toBe(2);
    expect(revised?.parentVersion).toBe(1);
  });

  it("exports and imports a learning bundle", async () => {
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
      content: "# Customer Onboarding Checklist\n\nUse this flow.",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const exportResult = await command.handler(
      createCommandContext({
        commandBody: "selflearn export",
        args: "export",
      }),
    );
    const exportText = exportResult.text ?? "";
    expect(exportText).toContain("Exported");

    const match = /to (.+)$/u.exec(exportText);
    expect(match?.[1]).toBeTruthy();
    const bundlePath = match?.[1] ?? "";
    expect(fs.existsSync(bundlePath)).toBe(true);

    const importRoot = fs.mkdtempSync(path.join(os.tmpdir(), "selflearn-command-import-"));
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

    const importCommand = createSelfLearningCommand({
      resolveStore: () => importStore,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const importResult = await importCommand.handler(
      createCommandContext({
        commandBody: `selflearn import ${bundlePath}`,
        args: `import ${bundlePath}`,
      }),
    );

    expect(importResult.text).toContain("Imported");
    expect(importStore.getSkillRecord("customer-onboarding-checklist")?.state).toBe("promoted");
  });

  it("lists patch proposals", async () => {
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
      content: "# Customer Onboarding Checklist\n\nUse this flow.",
    });
    store.appendPatchProposal({
      proposalId: "proposal-1",
      candidateSlug: "customer-onboarding-checklist",
      targetSlug: "customer-onboarding-checklist",
      confidence: 0.92,
      reason: "Add an escalation step.",
      mode: "patch",
      createdAt: new Date().toISOString(),
      proposedContent: "# Customer Onboarding Checklist\n\nUse this flow.\n\n## Escalation\n\n- Escalate billing blockers.",
      proposedSummary: "Checklist with escalation step",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn patches",
        args: "patches",
      }),
    );

    expect(result.text).toContain("proposal-1");
    expect(result.text).toContain("customer-onboarding-checklist");
  });

  it("applies a patch proposal to the target skill", async () => {
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
      content: "# Customer Onboarding Checklist\n\nUse this flow.",
    });
    store.appendPatchProposal({
      proposalId: "proposal-1",
      candidateSlug: "customer-onboarding-checklist",
      targetSlug: "customer-onboarding-checklist",
      confidence: 0.92,
      reason: "Add an escalation step.",
      mode: "patch",
      createdAt: new Date().toISOString(),
      proposedContent: "# Customer Onboarding Checklist\n\nUse this flow.\n\n## Escalation\n\n- Escalate billing blockers.",
      proposedSummary: "Checklist with escalation step",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn apply-patch proposal-1",
        args: "apply-patch proposal-1",
      }),
    );

    const updated = store.getSkillRecord("customer-onboarding-checklist");
    expect(result.text).toContain("Applied patch proposal");
    expect(updated?.content).toContain("Escalation");
    expect(updated?.version).toBe(2);
  });
});
