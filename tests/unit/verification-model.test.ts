import { describe, expect, test } from "vitest";
import { VERIFICATION_STATES, isActiveState, verificationState, type VerificationFacts } from "@/lib/verification/model";

const base: VerificationFacts = { aiAssisted: false, humanApprovalRecorded: false, reviewerIsAppointedPerson: false };

describe("verification state", () => {
  test("AI-written content with no human review is an AI-assisted draft, never verified", () => {
    expect(verificationState({ ...base, aiAssisted: true })).toBe("ai_assisted_draft");
  });
  test("content with no human review and no AI flag is pending verification", () => {
    expect(verificationState(base)).toBe("pending_verification");
  });
  test("verified needs a recorded human approval by an appointed person", () => {
    expect(verificationState({ ...base, humanApprovalRecorded: true, reviewerIsAppointedPerson: true })).toBe("verified");
    // an approval with no appointed reviewer (an AI identity, an unappointed account) is NOT verification
    expect(verificationState({ ...base, humanApprovalRecorded: true, reviewerIsAppointedPerson: false })).not.toBe("verified");
    expect(verificationState({ ...base, aiAssisted: true, humanApprovalRecorded: false, reviewerIsAppointedPerson: true })).not.toBe("verified");
  });
  test("an edit that invalidated the approval, or a change request, is not verified", () => {
    for (const d of ["invalidated", "changes_requested"] as const)
      expect(verificationState({ ...base, humanApprovalRecorded: true, reviewerIsAppointedPerson: true, reviewDecision: d })).not.toBe("verified");
  });
  test("rejection, withdrawal and a missing source take precedence over everything", () => {
    const approved = { ...base, humanApprovalRecorded: true, reviewerIsAppointedPerson: true };
    expect(verificationState({ ...approved, withdrawn: true })).toBe("withdrawn");
    expect(verificationState({ ...approved, reviewDecision: "rejected" })).toBe("rejected");
    expect(verificationState({ ...approved, sourceUnavailable: true })).toBe("source_unavailable");
  });
  test("a dispute or a historians' estimate is shown as such, even on an AI draft", () => {
    expect(verificationState({ ...base, aiAssisted: true, disputed: true })).toBe("disputed");
    expect(verificationState({ ...base, aiAssisted: true, historicalEstimate: true })).toBe("historical_estimate");
  });
  test("rejected and withdrawn content is never active guidance; every other state is", () => {
    for (const s of VERIFICATION_STATES) expect(isActiveState(s)).toBe(s !== "rejected" && s !== "withdrawn");
  });
});
