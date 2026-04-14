import path from "node:path";
import fs from "node:fs";
import type { OpenClawPluginCommandDefinition } from "openclaw/plugin-sdk/plugin-entry";
import { resolveAgentIdFromSessionKey } from "../runtime/agent-resolution.js";
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

      if (subcommand === "memories") {
        const lines = store
          .listCandidateMemories()
          .map((memory) => `${memory.id} | ${memory.state} | ${memory.title}`);
        return { text: lines.length > 0 ? lines.join("\n") : "No candidate memories." };
      }

      if (subcommand === "transcripts") {
        const lines = store
          .listCandidateTranscripts()
          .map((transcript) => `${transcript.id} | ${transcript.state} | ${transcript.title}`);
        return { text: lines.length > 0 ? lines.join("\n") : "No candidate transcripts." };
      }

      if (subcommand === "traces") {
        const traces = store.listEvolutionTraces();
        if (traces.length === 0) {
          return { text: "No evolution traces." };
        }
        return {
          text: traces
            .slice(0, 10)
            .map((trace) => `${trace.traceId} | ${trace.sessionId} | ${trace.createdAt} | ${trace.entries.length} entries`)
            .join("\n"),
        };
      }

      if (subcommand === "trace") {
        const traceId = rest[0];
        if (!traceId) {
          return { text: "Usage: /selflearn trace <trace-id>" };
        }
        const trace = store.getEvolutionTrace(traceId);
        if (!trace) {
          return { text: `Trace ${traceId} not found.` };
        }
        return {
          text: [
            `Trace ${trace.traceId}`,
            `session: ${trace.sessionId}`,
            `created: ${trace.createdAt}`,
            "",
            ...trace.entries.map(
              (entry) =>
                `${entry.assetId} | ${entry.outcome}${entry.notes ? ` | ${entry.notes}` : ""}`,
            ),
          ].join("\n"),
        };
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

      if (subcommand === "patches") {
        const proposals = store.listPatchProposals();
        if (proposals.length === 0) {
          return { text: "No patch proposals." };
        }
        return {
          text: proposals
            .map(
              (proposal) =>
                `${proposal.proposalId} | ${proposal.targetSlug} | ${proposal.mode} | ${proposal.reason}`,
            )
            .join("\n"),
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

      if (subcommand === "approve-memory") {
        const memoryId = rest[0];
        if (!memoryId) {
          return { text: "Usage: /selflearn approve-memory <memory-id>" };
        }
        const updated = store.setMemoryReviewDecision(memoryId, "approved");
        return { text: updated ? `Memory ${memoryId} approved.` : `Memory ${memoryId} not found.` };
      }

      if (subcommand === "approve-transcript") {
        const transcriptId = rest[0];
        if (!transcriptId) {
          return { text: "Usage: /selflearn approve-transcript <transcript-id>" };
        }
        const updated = store.setTranscriptReviewDecision(transcriptId, "approved");
        return {
          text: updated
            ? `Transcript ${transcriptId} approved.`
            : `Transcript ${transcriptId} not found.`,
        };
      }

      if (subcommand === "reject-memory") {
        const memoryId = rest[0];
        if (!memoryId) {
          return { text: "Usage: /selflearn reject-memory <memory-id>" };
        }
        const updated = store.setMemoryReviewDecision(memoryId, "rejected");
        return { text: updated ? `Memory ${memoryId} rejected.` : `Memory ${memoryId} not found.` };
      }

      if (subcommand === "keep-memory") {
        const memoryId = rest[0];
        if (!memoryId) {
          return { text: "Usage: /selflearn keep-memory <memory-id>" };
        }
        const updated = store.setMemoryReviewDecision(memoryId, "candidate");
        return { text: updated ? `Memory ${memoryId} kept as candidate.` : `Memory ${memoryId} not found.` };
      }

      if (subcommand === "reject") {
        const slug = rest[0];
        if (!slug) {
          return { text: "Usage: /selflearn reject <skill-slug>" };
        }
        const updated = store.setSkillReviewDecision(slug, "rejected");
        return { text: updated ? `Skill ${slug} rejected.` : `Skill ${slug} not found.` };
      }

      if (subcommand === "suppress") {
        const slug = rest[0];
        if (!slug) {
          return { text: "Usage: /selflearn suppress <skill-slug>" };
        }
        const updated = store.suppressSkill(slug);
        return { text: updated ? `Skill ${slug} suppressed.` : `Skill ${slug} not found.` };
      }

      if (subcommand === "repromote") {
        const slug = rest[0];
        if (!slug) {
          return { text: "Usage: /selflearn repromote <skill-slug>" };
        }
        const updated = store.repromoteSkill(slug);
        return { text: updated ? `Skill ${slug} re-promoted.` : `Skill ${slug} not found.` };
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

      if (subcommand === "apply-patch") {
        const proposalId = rest[0];
        if (!proposalId) {
          return { text: "Usage: /selflearn apply-patch <proposal-id>" };
        }
        const updated = store.applyPatchProposal(proposalId);
        return {
          text: updated
            ? `Applied patch proposal ${proposalId} to ${updated.slug}.`
            : `Patch proposal ${proposalId} not found.`,
        };
      }

      if (subcommand === "reject-patch") {
        const proposalId = rest[0];
        if (!proposalId) {
          return { text: "Usage: /selflearn reject-patch <proposal-id>" };
        }
        const updated = store.rejectPatchProposal(proposalId);
        return {
          text: updated
            ? `Rejected patch proposal ${proposalId}.`
            : `Patch proposal ${proposalId} not found.`,
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
        const bundle = store.exportBundle({
          includeCandidates,
          agentId: resolveAgentIdFromSessionKey(ctx.sessionKey),
        });
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
        const onConflict = resolveConflictMode(rest);
        store.importBundle(bundle, {
          mode,
          currentAgentId: resolveAgentIdFromSessionKey(ctx.sessionKey),
          onConflict,
        });
        return { text: `Imported learning bundle from ${resolveInputPath(bundlePath)}` };
      }

      return {
        text: [
          "Usage:",
          "/selflearn queue",
          "/selflearn memories",
          "/selflearn transcripts",
          "/selflearn traces",
          "/selflearn trace <trace-id>",
          "/selflearn show <skill-slug>",
          "/selflearn patches",
          "/selflearn learn --from current",
          "/selflearn learn --from file <path>",
          "/selflearn revise <skill-slug> <feedback>",
          "/selflearn apply-patch <proposal-id>",
          "/selflearn approve <skill-slug>",
          "/selflearn approve-memory <memory-id>",
          "/selflearn approve-transcript <transcript-id>",
          "/selflearn reject-memory <memory-id>",
          "/selflearn keep-memory <memory-id>",
          "/selflearn reject <skill-slug>",
          "/selflearn suppress <skill-slug>",
          "/selflearn repromote <skill-slug>",
          "/selflearn keep-candidate <skill-slug>",
          "/selflearn reject-patch <proposal-id>",
          "/selflearn export [--include-candidates]",
          "/selflearn import <bundle-path> [--mode <mode>] [--on-conflict <mode>]",
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

function resolveConflictMode(values: string[]) {
  const conflictIndex = values.findIndex((value) => value === "--on-conflict");
  const mode = conflictIndex >= 0 ? values[conflictIndex + 1] : undefined;
  if (mode === "prefer_incoming" || mode === "prefer_existing" || mode === "preserve_versions") {
    return mode;
  }
  return "preserve_versions" as const;
}
