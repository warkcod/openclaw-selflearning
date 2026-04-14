import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const openclawSrcRoot = path.resolve(repoRoot, "../openclaw_src");

async function importFromOpenClawSrc<T = unknown>(relativePath: string): Promise<T> {
  const absolutePath = path.resolve(openclawSrcRoot, relativePath);
  return (await import(pathToFileURL(absolutePath).href)) as T;
}

describe("OpenClaw loader smoke", () => {
  afterEach(async () => {
    const helpers = await importFromOpenClawSrc<{
      resetPluginLoaderTestStateForTest: () => void;
    }>("src/plugins/loader.test-fixtures.ts");
    helpers.resetPluginLoaderTestStateForTest();
  });

  it("loads the built selflearning plugin through the OpenClaw plugin loader", async () => {
    const helpers = await importFromOpenClawSrc<{
      resetPluginLoaderTestStateForTest: () => void;
      useNoBundledPlugins: () => void;
    }>("src/plugins/loader.test-fixtures.ts");
    const loader = await importFromOpenClawSrc<{
      loadOpenClawPlugins: (options: Record<string, unknown>) => {
        plugins: Array<{ id: string; status: string }>;
        commands: Array<{ command: { name: string } }>;
      };
    }>("src/plugins/loader.ts");

    helpers.resetPluginLoaderTestStateForTest();
    helpers.useNoBundledPlugins();

    const registry = loader.loadOpenClawPlugins({
      cache: false,
      workspaceDir: repoRoot,
      config: {
        plugins: {
          load: { paths: [repoRoot] },
          allow: ["selflearning"],
        },
      },
      onlyPluginIds: ["selflearning"],
    });

    expect(registry.plugins.find((entry) => entry.id === "selflearning")?.status).toBe("loaded");
    expect(registry.commands.map((entry) => entry.command.name)).toContain("selflearn");
  });
});
