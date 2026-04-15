import fs from "node:fs";

export type SessionScopeSource =
  | { kind: "current" | "last-task" }
  | { kind: "recent-turns"; turnCount: number }
  | { kind: "marked"; sessionKey: string };

export type SessionScopePreview = {
  sourceLabel: string;
  sourceText: string;
  entryCount: number;
  userTurnCount: number;
  firstUserText?: string;
  lastUserText?: string;
};

type TranscriptEntry = {
  index: number;
  role: string;
  content: string;
};

export function buildSessionScope(params: {
  sessionFile: string;
  source: SessionScopeSource;
  markers?: { startLine?: number; endLine?: number } | null;
}): SessionScopePreview {
  const entries = readTranscriptEntries(params.sessionFile);

  if (params.source.kind === "marked") {
    const start = params.markers?.startLine;
    const end = params.markers?.endLine ?? entries.length;
    if (start === undefined) {
      throw new Error("No marked range is available for this session.");
    }
    return toPreview(`marked range in ${params.sessionFile}`, entries.slice(start, end));
  }

  if (params.source.kind === "recent-turns") {
    return buildRecentTurnsScope(entries, params.source.turnCount, params.sessionFile);
  }

  return buildRecentTurnsScope(entries, 1, params.sessionFile, params.source.kind);
}

export function countTranscriptEntries(sessionFile: string): number {
  return readTranscriptEntries(sessionFile).length;
}

export function formatScopePreview(preview: SessionScopePreview): string {
  return [
    "Learning scope preview",
    `source: ${preview.sourceLabel}`,
    `entries: ${preview.entryCount}`,
    `user turns: ${preview.userTurnCount}`,
    preview.firstUserText ? `first user turn: ${preview.firstUserText}` : undefined,
    preview.lastUserText ? `last user turn: ${preview.lastUserText}` : undefined,
    "",
    preview.sourceText,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildRecentTurnsScope(
  entries: TranscriptEntry[],
  turnCount: number,
  sessionFile: string,
  label: "recent-turns" | "current" | "last-task" = "recent-turns",
) {
  const userEntries = entries.filter((entry) => entry.role === "user");
  if (userEntries.length === 0) {
    throw new Error("No user turns are available in the current session transcript.");
  }
  const startUser = userEntries[Math.max(0, userEntries.length - turnCount)];
  const sliced = entries.slice(startUser?.index ?? 0);
  const scopeLabel =
    label === "recent-turns"
      ? `${label}:${turnCount} from ${sessionFile}`
      : `${label} from ${sessionFile}`;
  return toPreview(scopeLabel, sliced);
}

function toPreview(sourceLabel: string, entries: TranscriptEntry[]): SessionScopePreview {
  const userEntries = entries.filter((entry) => entry.role === "user");
  return {
    sourceLabel,
    sourceText: entries.map((entry) => `${entry.role} ${entry.content}`.trim()).join("\n"),
    entryCount: entries.length,
    userTurnCount: userEntries.length,
    firstUserText: userEntries[0]?.content,
    lastUserText: userEntries.at(-1)?.content,
  };
}

function readTranscriptEntries(sessionFile: string): TranscriptEntry[] {
  if (!fs.existsSync(sessionFile)) {
    throw new Error(`Session transcript not found: ${sessionFile}`);
  }
  return fs
    .readFileSync(sessionFile, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => ({ line, index }))
    .map(({ line, index }) => parseTranscriptLine(line, index));
}

function parseTranscriptLine(line: string, index: number): TranscriptEntry {
  try {
    const parsed = JSON.parse(line) as { role?: string; content?: string };
    return {
      index,
      role: typeof parsed.role === "string" ? parsed.role : "unknown",
      content: String(parsed.content ?? "").trim(),
    };
  } catch {
    return {
      index,
      role: "unknown",
      content: line.trim(),
    };
  }
}
