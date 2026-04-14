import path from "node:path";
import fs from "node:fs";
import type { OpenClawPluginCommandDefinition } from "openclaw/plugin-sdk/plugin-entry";
import { LearningStore } from "../store/learning-store.js";

export function createSelfLearningCommand(params: {
  resolveStore: (ctx: { sessionKey?: string }) => LearningStore;
  learnCurrentConversation: (params: { sessionFile?: string }) => Promise<{ slug: string; state: string }>;
  learnFromFile: (params: { filePath: string }) => Promise<{ slug: string; state: string }>;
}): OpenClawPluginCommandDefinition {
  return {
    name: "selflearn",
    description: "Inspect, approve, revise, and export self-learning assets.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const args = ctx.args?.trim() ?? "";
      const [subcommand = "", ...rest] = args.split(/\s+/u).filter(Boolean);
      const store = params.resolveStore({ sessionKey: ctx.sessionKey });

      if (subcommand === "queue") {
        const lines = store
          .listCandidateSkills()
          .map((skill) => `${skill.slug} | ${skill.state} | ${skill.origin} | ${skill.updatedAt}`);
        return { text: lines.length > 0 ? lines.join("\n") : "No candidate skills." };
      }

      if (subcommand === "show") {
        const slug = rest[0];
        if (!slug) {
          return { text: "Usage: /selflearn show <skill-slug>" };
        }
        const skill = store.getSkillRecord(slug);
        if (!skill) {
          return { text: `Skill ${slug} not found.` };
        }
        return {
          text: [
            `${skill.title} (${skill.slug})`,
            `state: ${skill.state}`,
            `origin: ${skill.origin}`,
            `version: ${skill.version}`,
            "",
            skill.content,
          ].join("\n"),
        };
      }

      if (subcommand === "approve") {
        const slug = rest[0];
        if (!slug) {
          return { text: "Usage: /selflearn approve <skill-slug>" };
        }
        const updated = store.setSkillReviewDecision(slug, "approved");
        return { text: updated ? `Skill ${slug} approved.` : `Skill ${slug} not found.` };
      }

      if (subcommand === "reject") {
        const slug = rest[0];
        if (!slug) {
          return { text: "Usage: /selflearn reject <skill-slug>" };
        }
        const updated = store.setSkillReviewDecision(slug, "rejected");
        return { text: updated ? `Skill ${slug} rejected.` : `Skill ${slug} not found.` };
      }

      if (subcommand === "keep-candidate") {
        const slug = rest[0];
        if (!slug) {
          return { text: "Usage: /selflearn keep-candidate <skill-slug>" };
        }
        const updated = store.setSkillReviewDecision(slug, "candidate");
        return { text: updated ? `Skill ${slug} kept as candidate.` : `Skill ${slug} not found.` };
      }

      if (subcommand === "revise") {
        const slug = rest[0];
        const feedback = rest.slice(1).join(" ").trim();
        if (!slug || !feedback) {
          return { text: "Usage: /selflearn revise <skill-slug> <feedback>" };
        }
        const revised = store.saveSkillRevision({ slug, feedback });
        return {
          text: revised
            ? `Created revision ${revised.version} for ${slug}.`
            : `Skill ${slug} not found.`,
        };
      }

      if (subcommand === "learn") {
        if (rest[0] === "--from" && rest[1] === "current") {
          const result = await params.learnCurrentConversation({ sessionFile: ctx.sessionFile });
          return { text: `Created ${result.state} skill ${result.slug} from the current conversation.` };
        }
        if (rest[0] === "--from" && rest[1] === "file" && rest[2]) {
          const filePath = resolveInputPath(rest[2]);
          const result = await params.learnFromFile({ filePath });
          return { text: `Created ${result.state} skill ${result.slug} from ${filePath}.` };
        }
        return { text: "Usage: /selflearn learn --from current|file <path>" };
      }

      if (subcommand === "export") {
        const includeCandidates = rest.includes("--include-candidates");
        const bundle = store.exportBundle({ includeCandidates, agentId: undefined });
        const exportDir = path.join(store.getPaths().rootDir, "exports");
        fs.mkdirSync(exportDir, { recursive: true });
        const filePath = path.join(exportDir, `selflearning-bundle-${Date.now()}.json`);
        fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf8");
        return { text: `Exported learning bundle to ${filePath}` };
      }

      if (subcommand === "import") {
        const bundlePath = rest[0];
        const mode = resolveImportMode(rest);
        if (!bundlePath) {
          return { text: "Usage: /selflearn import <bundle-path> [--mode <mode>]" };
        }
        const bundle = JSON.parse(fs.readFileSync(resolveInputPath(bundlePath), "utf8"));
        store.importBundle(bundle, { mode });
        return { text: `Imported learning bundle from ${resolveInputPath(bundlePath)}` };
      }

      return {
        text: [
          "Usage:",
          "/selflearn queue",
          "/selflearn show <skill-slug>",
          "/selflearn learn --from current",
          "/selflearn learn --from file <path>",
          "/selflearn revise <skill-slug> <feedback>",
          "/selflearn approve <skill-slug>",
          "/selflearn reject <skill-slug>",
          "/selflearn keep-candidate <skill-slug>",
          "/selflearn export [--include-candidates]",
          "/selflearn import <bundle-path> [--mode <mode>]",
        ].join("\n"),
      };
    },
  };
}

function resolveInputPath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(value);
}

function resolveImportMode(values: string[]) {
  const modeIndex = values.findIndex((value) => value === "--mode");
  const mode = modeIndex >= 0 ? values[modeIndex + 1] : undefined;
  if (
    mode === "preserve_origin_agent" ||
    mode === "merge_into_user_profile" ||
    mode === "rebind_to_current_agent"
  ) {
    return mode;
  }
  return "rebind_to_current_agent" as const;
}
