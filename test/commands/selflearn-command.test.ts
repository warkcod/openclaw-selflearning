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
      learnFromSessionScope: vi.fn(),
      previewSessionScope: vi.fn(),
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
      learnFromSessionScope: vi.fn(),
      previewSessionScope: vi.fn(),
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

  it("lists candidate transcript recalls", async () => {
    store.upsertTranscriptRecord({
      id: "transcript:incident-retrospective",
      title: "Incident retrospective decision context",
      summary: "Why the team moved incident snapshots to Glacier.",
      content: "The team chose Glacier after comparing restore latency and storage cost tradeoffs.",
      state: "candidate",
      confidence: 0.75,
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
      learnFromSessionScope: vi.fn(),
      previewSessionScope: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn transcripts",
        args: "transcripts",
      }),
    );

    expect(result.text).toContain("transcript:incident-retrospective");
    expect(result.text).toContain("Incident retrospective decision context");
  });

  it("lists evolution traces", async () => {
    store.saveEvolutionTrace({
      traceId: "trace-session-1",
      sessionId: "session-1",
      createdAt: "2026-04-14T12:00:00.000Z",
      entries: [
        {
          assetId: "skill:customer-onboarding-checklist",
          assetKind: "skill",
          outcome: "success",
          notes: "The checklist guided the sequence.",
        },
      ],
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn traces",
        args: "traces",
      }),
    );

    expect(result.text).toContain("trace-session-1");
    expect(result.text).toContain("session-1");
  });

  it("shows a single evolution trace", async () => {
    store.saveEvolutionTrace({
      traceId: "trace-session-1",
      sessionId: "session-1",
      createdAt: "2026-04-14T12:00:00.000Z",
      entries: [
        {
          assetId: "skill:customer-onboarding-checklist",
          assetKind: "skill",
          outcome: "success",
          notes: "The checklist guided the sequence.",
        },
      ],
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn trace trace-session-1",
        args: "trace trace-session-1",
      }),
    );

    expect(result.text).toContain("Trace trace-session-1");
    expect(result.text).toContain("skill:customer-onboarding-checklist");
    expect(result.text).toContain("success");
  });

  it("delegates explicit learning from the current conversation", async () => {
    const learnCurrentConversation = vi.fn().mockResolvedValue({
      slug: "customer-onboarding-checklist",
      state: "candidate",
    });
    const learnFromSessionScope = vi.fn().mockResolvedValue({
      slug: "customer-onboarding-checklist",
      state: "candidate",
    });
    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation,
      learnFromFile: vi.fn(),
      learnFromSessionScope,
      previewSessionScope: vi.fn(),
    });

    const result = await command.handler({
      ...createCommandContext({
        commandBody: "selflearn learn --from current",
        args: "learn --from current",
        sessionFile: path.join(root, "session.jsonl"),
      }),
    });

    expect(learnFromSessionScope).toHaveBeenCalledWith({
      sessionFile: path.join(root, "session.jsonl"),
      sessionKey: undefined,
      source: { kind: "current" },
    });
    expect(learnCurrentConversation).not.toHaveBeenCalled();
    expect(result.text).toContain("customer-onboarding-checklist");
  });

  it("supports previewing a recent-turns learning scope", async () => {
    const previewSessionScope = vi.fn().mockReturnValue("Learning scope preview\nsource: recent-turns:2");
    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
      learnFromSessionScope: vi.fn(),
      previewSessionScope,
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn learn --from recent-turns 2 --preview",
        args: "learn --from recent-turns 2 --preview",
        sessionFile: path.join(root, "session.jsonl"),
        sessionKey: "agent:main:test",
      }),
    );

    expect(previewSessionScope).toHaveBeenCalledWith({
      sessionFile: path.join(root, "session.jsonl"),
      sessionKey: "agent:main:test",
      source: { kind: "recent-turns", turnCount: 2 },
    });
    expect(result.text).toContain("Learning scope preview");
  });

  it("marks the current session scope boundaries", async () => {
    const sessionFile = path.join(root, "session.jsonl");
    fs.writeFileSync(
      sessionFile,
      [
        JSON.stringify({ role: "user", content: "first" }),
        JSON.stringify({ role: "assistant", content: "reply" }),
      ].join("\n"),
      "utf8",
    );
    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
      learnFromSessionScope: vi.fn(),
      previewSessionScope: vi.fn(),
    });

    const startResult = await command.handler(
      createCommandContext({
        commandBody: "selflearn mark-start",
        args: "mark-start",
        sessionFile,
        sessionKey: "agent:main:test",
      }),
    );
    expect(startResult.text).toContain("start");

    fs.appendFileSync(
      sessionFile,
      "\n" + JSON.stringify({ role: "user", content: "second" }),
      "utf8",
    );

    const endResult = await command.handler(
      createCommandContext({
        commandBody: "selflearn mark-end",
        args: "mark-end",
        sessionFile,
        sessionKey: "agent:main:test",
      }),
    );
    expect(endResult.text).toContain("end");
    expect(store.getSessionMarkers("agent:main:test")?.startLine).toBe(2);
    expect(store.getSessionMarkers("agent:main:test")?.endLine).toBe(3);
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

  it("rejects a candidate memory", async () => {
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
        commandBody: "selflearn reject-memory memory:default-channel",
        args: "reject-memory memory:default-channel",
      }),
    );

    expect(result.text).toContain("rejected");
    expect(store.getMemoryRecord("memory:default-channel")?.state).toBe("deprecated");
  });

  it("approves a candidate transcript recall", async () => {
    store.upsertTranscriptRecord({
      id: "transcript:incident-retrospective",
      title: "Incident retrospective decision context",
      summary: "Why the team moved incident snapshots to Glacier.",
      content: "The team chose Glacier after comparing restore latency and storage cost tradeoffs.",
      state: "candidate",
      confidence: 0.75,
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn approve-transcript transcript:incident-retrospective",
        args: "approve-transcript transcript:incident-retrospective",
      }),
    );

    expect(result.text).toContain("approved");
    expect(store.getTranscriptRecord("transcript:incident-retrospective")?.state).toBe("promoted");
  });

  it("keeps a memory as candidate", async () => {
    store.upsertMemoryRecord({
      id: "memory:default-channel",
      kind: "durable-memory",
      title: "Default follow-up channel",
      content: "The user prefers Telegram follow-ups.",
      state: "deprecated",
      confidence: 0.8,
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn keep-memory memory:default-channel",
        args: "keep-memory memory:default-channel",
      }),
    );

    expect(result.text).toContain("candidate");
    expect(store.getMemoryRecord("memory:default-channel")?.state).toBe("candidate");
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

  it("rejects a patch proposal without changing the target skill", async () => {
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
      proposalId: "proposal-2",
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
        commandBody: "selflearn reject-patch proposal-2",
        args: "reject-patch proposal-2",
      }),
    );

    const updated = store.getSkillRecord("customer-onboarding-checklist");
    expect(result.text).toContain("Rejected patch proposal");
    expect(updated?.content).not.toContain("Escalation");
    expect(updated?.patchHistory.some((entry) => entry.proposalId === "proposal-2")).toBe(false);
  });

  it("imports a bundle with explicit mode and conflict options", async () => {
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

    const exportCommand = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const exportResult = await exportCommand.handler(
      createCommandContext({
        commandBody: "selflearn export",
        args: "export",
        sessionKey: "agent:alpha:main",
      }),
    );

    const exportText = exportResult.text ?? "";
    const match = /to (.+)$/u.exec(exportText);
    const bundlePath = match?.[1] ?? "";

    const importRoot = fs.mkdtempSync(path.join(os.tmpdir(), "selflearn-command-import-mode-"));
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
        commandBody:
          `selflearn import ${bundlePath} --mode preserve_origin_agent --on-conflict prefer_incoming`,
        args: `import ${bundlePath} --mode preserve_origin_agent --on-conflict prefer_incoming`,
        sessionKey: "agent:beta:main",
      }),
    );

    expect(importResult.text).toContain("Imported");
    expect(importStore.getSkillRecord("customer-onboarding-checklist")?.agentId).toBe("alpha");
  });

  it("suppresses a skill manually", async () => {
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
        commandBody: "selflearn suppress customer-onboarding-checklist",
        args: "suppress customer-onboarding-checklist",
      }),
    );

    expect(result.text).toContain("suppressed");
    expect(store.getSkillRecord("customer-onboarding-checklist")?.suppressed).toBe(true);
  });

  it("re-promotes a skill manually", async () => {
    store.upsertSkillRecord({
      slug: "customer-onboarding-checklist",
      title: "Customer Onboarding Checklist",
      summary: "Checklist for onboarding a customer",
      state: "stale",
      origin: "selflearned",
      ownership: "system",
      reviewStatus: "approved",
      confidence: 0.9,
      successfulRecalls: 2,
      hitCount: 3,
      userModified: false,
      version: 1,
      suppressed: true,
      content: "# Customer Onboarding Checklist\n\nUse this flow.",
    });

    const command = createSelfLearningCommand({
      resolveStore: () => store,
      learnCurrentConversation: vi.fn(),
      learnFromFile: vi.fn(),
    });

    const result = await command.handler(
      createCommandContext({
        commandBody: "selflearn repromote customer-onboarding-checklist",
        args: "repromote customer-onboarding-checklist",
      }),
    );

    const skill = store.getSkillRecord("customer-onboarding-checklist");
    expect(result.text).toContain("re-promoted");
    expect(skill?.state).toBe("promoted");
    expect(skill?.suppressed).toBe(false);
  });
});
