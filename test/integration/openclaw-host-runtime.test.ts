import path from "node:path";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const openclawSrcRoot = path.resolve(repoRoot, "../openclaw_src");

async function importFromOpenClawSrc<T = unknown>(relativePath: string): Promise<T> {
  const absolutePath = path.resolve(openclawSrcRoot, relativePath);
  return (await import(pathToFileURL(absolutePath).href)) as T;
}

function createCommandContext(overrides: Record<string, unknown> = {}) {
  return {
    channel: "cli",
    isAuthorizedSender: true,
    commandBody: "selflearn queue",
    args: "queue",
    config: {},
    sessionKey: "agent:alpha:main",
    requestConversationBinding: vi.fn(async () => ({
      status: "error" as const,
      message: "not implemented in test",
    })),
    detachConversationBinding: vi.fn(async () => ({ removed: false })),
    getCurrentConversationBinding: vi.fn(async () => null),
    ...overrides,
  };
}

describe("OpenClaw host runtime integration", () => {
  afterEach(async () => {
    const helpers = await importFromOpenClawSrc<{
      resetPluginLoaderTestStateForTest: () => void;
      clearPluginCommands: () => void;
    }>("src/plugins/loader.test-fixtures.ts");
    helpers.resetPluginLoaderTestStateForTest();
  });

  it(
    "resolves the context engine and executes the registered command through the host loader",
    async () => {
      execSync("npm run build", { cwd: repoRoot, stdio: "ignore" });

      const helpers = await importFromOpenClawSrc<{
        resetPluginLoaderTestStateForTest: () => void;
        useNoBundledPlugins: () => void;
    }>("src/plugins/loader.test-fixtures.ts");
    const loader = await importFromOpenClawSrc<{
      loadOpenClawPlugins: (options: Record<string, unknown>) => {
        plugins: Array<{ id: string; status: string }>;
        commands: Array<{ command: { name: string; handler: (ctx: unknown) => Promise<{ text: string }> } }>;
      };
    }>("src/plugins/loader.ts");
    const contextRegistry = await importFromOpenClawSrc<{
      resolveContextEngine: (config: Record<string, unknown>) => Promise<{
        info: { id: string };
        assemble: (params: Record<string, unknown>) => Promise<{ systemPromptAddition?: string }>;
      }>;
    }>("src/context-engine/index.ts");

    helpers.resetPluginLoaderTestStateForTest();
    helpers.useNoBundledPlugins();

    const registry = loader.loadOpenClawPlugins({
      cache: false,
      workspaceDir: repoRoot,
      config: {
        plugins: {
          load: { paths: [repoRoot] },
          allow: ["selflearning"],
          slots: { contextEngine: "selflearning" },
        },
      },
      onlyPluginIds: ["selflearning"],
    });

    expect(registry.plugins.find((entry) => entry.id === "selflearning")?.status).toBe("loaded");

    const engine = await contextRegistry.resolveContextEngine({
      plugins: {
        slots: {
          contextEngine: "selflearning",
        },
      },
    });

    expect(engine.info.id).toBe("selflearning");

    const assembled = await engine.assemble({
      sessionId: "session-1",
      sessionKey: "agent:alpha:main",
      messages: [],
      tokenBudget: 1024,
    });

    expect(assembled.systemPromptAddition).toContain("Learned Memory");

    const command = registry.commands.find((entry) => entry.command.name === "selflearn");
    expect(command).toBeDefined();

    const result = await command!.command.handler(createCommandContext());
    expect(result.text).toContain("No candidate skills.");
    },
    45_000,
  );
});
