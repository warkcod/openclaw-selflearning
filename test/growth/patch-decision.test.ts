import { describe, expect, it } from "vitest";
import { decideSkillWriteAction } from "../../src/growth/patch-decision.js";

describe("decideSkillWriteAction", () => {
  it("patches an existing promoted skill when the workflow is clearly the same", () => {
    const result = decideSkillWriteAction({
      candidate: {
        slug: "customer-onboarding-checklist",
        title: "Customer Onboarding Checklist",
        summary: "Use a consistent onboarding process for new customers",
        content: "# Customer Onboarding Checklist",
        confidence: 0.9,
        origin: "selflearned",
      },
      existingSkills: [
        {
          slug: "customer-onboarding-checklist",
          title: "Customer Onboarding Checklist",
          summary: "Checklist for onboarding a customer",
          state: "promoted",
          confidence: 0.8,
          origin: "selflearned",
          ownership: "system",
          userModified: false,
          successfulRecalls: 3,
        },
      ],
    });

    expect(result.kind).toBe("patch");
    if (result.kind === "patch" || result.kind === "patch-proposal") {
      expect(result.targetSlug).toBe("customer-onboarding-checklist");
    }
  });

  it("creates a new candidate when no existing skill is similar enough", () => {
    const result = decideSkillWriteAction({
      candidate: {
        slug: "incident-retrospective-template",
        title: "Incident Retrospective Template",
        summary: "Template for post-incident review",
        content: "# Incident Retrospective Template",
        confidence: 0.88,
        origin: "selflearned",
      },
      existingSkills: [
        {
          slug: "customer-onboarding-checklist",
          title: "Customer Onboarding Checklist",
          summary: "Checklist for onboarding a customer",
          state: "promoted",
          confidence: 0.8,
          origin: "selflearned",
          ownership: "system",
          userModified: false,
          successfulRecalls: 3,
        },
      ],
    });

    expect(result.kind).toBe("create");
  });

  it("returns a guarded patch proposal for user-owned skills", () => {
    const result = decideSkillWriteAction({
      candidate: {
        slug: "customer-onboarding-checklist",
        title: "Customer Onboarding Checklist",
        summary: "Use a consistent onboarding process for new customers",
        content: "# Customer Onboarding Checklist",
        confidence: 0.9,
        origin: "selflearned",
      },
      existingSkills: [
        {
          slug: "customer-onboarding-checklist",
          title: "Customer Onboarding Checklist",
          summary: "Checklist for onboarding a customer",
          state: "promoted",
          confidence: 0.8,
          origin: "selflearned",
          ownership: "user",
          userModified: true,
          successfulRecalls: 3,
        },
      ],
    });

    expect(result.kind).toBe("patch-proposal");
    if (result.kind === "patch" || result.kind === "patch-proposal") {
      expect(result.targetSlug).toBe("customer-onboarding-checklist");
    }
  });
});
