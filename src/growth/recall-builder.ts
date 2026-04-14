import type { RecallAssetSelection } from "../types.js";

export function buildRecallPromptAddition(recall: RecallAssetSelection): string {
  const memoryLines = recall.memories.map(
    (memory) => `- ${memory.title}: ${memory.content}`,
  );
  const skillLines = recall.skills.map(
    (skill) => `- ${skill.slug} [${skill.state}]: ${skill.summary}`,
  );

  return [
    "Learned Memory:",
    memoryLines.join("\n") || "- none",
    "",
    "Learned Skills:",
    skillLines.join("\n") || "- none",
  ].join("\n");
}
