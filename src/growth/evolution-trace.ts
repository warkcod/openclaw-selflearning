import crypto from "node:crypto";
import type { EvolutionTraceEntry, LearningStorePaths, ReviewAssetUsage } from "../types.js";
import { LearningStore } from "../store/learning-store.js";

export function buildTraceId(sessionId: string): string {
  return `trace_${sessionId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

export function applyEvolutionTrace(params: {
  store: LearningStore;
  sessionId: string;
  assetUsage: ReviewAssetUsage[];
}) {
  const traceEntries: EvolutionTraceEntry[] = params.assetUsage.map((entry) => ({
    assetId: entry.assetId,
    assetKind: entry.assetKind,
    outcome: entry.outcome,
    notes: entry.notes,
  }));

  if (traceEntries.length === 0) {
    return;
  }

  params.store.saveEvolutionTrace({
    traceId: buildTraceId(params.sessionId),
    sessionId: params.sessionId,
    createdAt: new Date().toISOString(),
    entries: traceEntries,
  });
  params.store.applyAssetUsage(traceEntries);
  for (const entry of traceEntries) {
    params.store.applyLifecyclePolicy(entry, { countUsage: false });
  }
}

export function formatTracePath(paths: LearningStorePaths, traceId: string): string {
  return `${paths.traceDir}/${traceId}.json`;
}
