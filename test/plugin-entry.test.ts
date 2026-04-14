import { describe, expect, it, vi } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: vi.fn((entry) => entry),
}));

describe("plugin entry", () => {
  it("registers the selflearning context engine and command surface", async () => {
    const plugin = (await import("../src/index.js")).default;
    const registerContextEngine = vi.fn();
    const registerCommand = vi.fn();

    plugin.register({
      id: "selflearning",
      name: "OpenClaw Self-Learning",
      source: "test",
      registrationMode: "full",
      config: {},
      pluginConfig: {},
      runtime: {
        agent: {
          resolveAgentWorkspaceDir: vi.fn((_config, agentId: string) => `/tmp/${agentId}`),
          resolveAgentTimeoutMs: vi.fn(() => 30_000),
          runEmbeddedPiAgent: vi.fn(async () => ({
            text: JSON.stringify({
              summary: "learned onboarding flow",
              memoryCandidates: [],
              skillCandidates: [],
              transcriptCandidates: [],
              assetUsage: [],
              dedupeHints: [],
              reuseConfidence: 0.8,
            }),
          })),
        },
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      registerContextEngine,
      registerCommand,
    } as never);

    expect(registerContextEngine).toHaveBeenCalledWith(
      "selflearning",
      expect.any(Function),
    );
    expect(registerCommand).toHaveBeenCalledTimes(1);
  });
});
