import { z } from "zod";

export const reviewResultSchema = z.object({
  summary: z.string().min(1),
  memoryCandidates: z.array(
    z.object({
      kind: z.enum(["durable-memory", "user-model"]),
      title: z.string().min(1),
      content: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
  skillCandidates: z.array(
    z.object({
      slug: z.string().min(1).optional(),
      title: z.string().min(1),
      summary: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
      confidence: z.number().min(0).max(1).optional(),
      scope: z.string().min(1).optional(),
      inputs: z.array(z.string().min(1)).optional(),
      coreSteps: z.array(z.string().min(1)).optional(),
      outputs: z.array(z.string().min(1)).optional(),
      caveats: z.array(z.string().min(1)).optional(),
      origin: z.enum(["selflearned", "user_requested"]).optional(),
    }),
  ),
  transcriptCandidates: z.array(
    z.object({
      id: z.string().min(1).optional(),
      title: z.string().min(1),
      summary: z.string().min(1),
      content: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
  assetUsage: z.array(
    z.object({
      assetId: z.string().min(1),
      assetKind: z.enum(["memory", "skill", "transcript"]),
      outcome: z.enum(["success", "partial", "failure", "user_corrected", "ignored"]),
      notes: z.string().optional(),
    }),
  ),
  dedupeHints: z.array(z.string()),
  reuseConfidence: z.number().min(0).max(1),
});
