export function resolveAgentId(sessionKey: string | undefined, config: unknown): string {
  const sessionAgentId = resolveAgentIdFromSessionKey(sessionKey);
  if (sessionAgentId !== "main") {
    return sessionAgentId;
  }
  return resolveDefaultAgentId(config);
}

export function resolveAgentIdFromSessionKey(sessionKey: string | undefined): string {
  const value = sessionKey?.trim();
  if (!value) {
    return "main";
  }
  const match = /^agent:([^:]+):/u.exec(value);
  return normalizeAgentId(match?.[1]);
}

export function resolveDefaultAgentId(config: unknown): string {
  if (!config || typeof config !== "object") {
    return "main";
  }
  const record = config as Record<string, unknown>;
  const agents = record.agents;
  if (!agents || typeof agents !== "object") {
    return "main";
  }
  const list = Array.isArray((agents as { list?: unknown[] }).list)
    ? ((agents as { list?: unknown[] }).list as unknown[])
    : [];
  const normalized = list
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({
      id: normalizeAgentId(entry.id),
      isDefault: entry.default === true,
    }));
  const chosen = normalized.find((entry) => entry.isDefault) ?? normalized[0];
  return chosen?.id ?? "main";
}

function normalizeAgentId(value: unknown): string {
  if (typeof value !== "string") {
    return "main";
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "")
    .slice(0, 64);
  return normalized || "main";
}
