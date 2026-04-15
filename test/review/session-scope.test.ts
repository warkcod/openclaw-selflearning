import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSessionScope, countTranscriptEntries } from "../../src/review/session-scope.js";

function writeTranscript(lines: unknown[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "selflearning-scope-"));
  const file = path.join(dir, "session.jsonl");
  fs.writeFileSync(file, lines.map((line) => JSON.stringify(line)).join("\n"), "utf8");
  return file;
}

describe("session scope", () => {
  it("uses the last user turn for current scope", () => {
    const file = writeTranscript([
      { role: "user", content: "first request" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second request" },
      { role: "tool", content: "tool result" },
      { role: "assistant", content: "second answer" },
    ]);

    const scope = buildSessionScope({
      sessionFile: file,
      source: { kind: "current" },
    });

    expect(scope.userTurnCount).toBe(1);
    expect(scope.firstUserText).toContain("second request");
    expect(scope.sourceText).not.toContain("first request");
  });

  it("uses the last N user turns for recent-turns scope", () => {
    const file = writeTranscript([
      { role: "user", content: "first request" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second request" },
      { role: "assistant", content: "second answer" },
      { role: "user", content: "third request" },
      { role: "assistant", content: "third answer" },
    ]);

    const scope = buildSessionScope({
      sessionFile: file,
      source: { kind: "recent-turns", turnCount: 2 },
    });

    expect(scope.userTurnCount).toBe(2);
    expect(scope.sourceText).toContain("second request");
    expect(scope.sourceText).toContain("third request");
    expect(scope.sourceText).not.toContain("first request");
  });

  it("uses explicit marked ranges when provided", () => {
    const file = writeTranscript([
      { role: "user", content: "before marker" },
      { role: "assistant", content: "before answer" },
      { role: "user", content: "inside marker" },
      { role: "assistant", content: "inside answer" },
      { role: "user", content: "after marker" },
    ]);

    const scope = buildSessionScope({
      sessionFile: file,
      source: { kind: "marked", sessionKey: "agent:main:demo" },
      markers: { startLine: 2, endLine: 4 },
    });

    expect(scope.sourceText).toContain("inside marker");
    expect(scope.sourceText).not.toContain("before marker");
    expect(scope.sourceText).not.toContain("after marker");
  });

  it("counts transcript entries deterministically", () => {
    const file = writeTranscript([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "tool", content: "three" },
    ]);

    expect(countTranscriptEntries(file)).toBe(3);
  });
});
