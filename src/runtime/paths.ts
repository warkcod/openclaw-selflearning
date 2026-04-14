import path from "node:path";
import type { LearningStorePaths } from "../types.js";

export function resolveLearningPaths(params: {
  agentWorkspaceDir: string;
  rootDirName: string;
}): LearningStorePaths {
  const rootDir = path.join(params.agentWorkspaceDir, params.rootDirName);
  return {
    rootDir,
    reviewsDir: path.join(rootDir, "reviews"),
    skillsDir: path.join(rootDir, "skills"),
    memoryDir: path.join(rootDir, "memory"),
    traceDir: path.join(rootDir, "evolution-trace"),
    manifestFile: path.join(rootDir, "manifest.json"),
    stateFile: path.join(rootDir, "state.json"),
  };
}
