import { describe, it, expect, beforeEach } from "vitest";
import { useEmailStore } from "./email-store";
import type {
  SpamAdEmail,
  DraftEmail,
  EscalationAlert,
  UnsubscribeStatus,
} from "@/types/email";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeSpam(overrides: Partial<SpamAdEmail> = {}): SpamAdEmail {
  return {
    workflow: "email_inbox",
    category: "SPAM",
    email_id: `spam-${Math.random().toString(36).slice(2, 8)}`,
    sender_name: "Spammer",
    sender_email: "spam@example.com",
    sender_domain: "example.com",
    subject: "Win a prize!",
    preview: "Click here",
    date: "2025-06-01T10:00:00Z",
    confidence: 0.9,
    low_confidence: false,
    reasoning: "Spam pattern",
    list_unsubscribe_url: null,
    list_unsubscribe_mailto: null,
    unsubscribe_available: false,
    ...overrides,
  };
}

function makeAd(overrides: Partial<SpamAdEmail> = {}): SpamAdEmail {
  return makeSpam({
    category: "AD",
    email_id: `ad-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  });
}

function makeDraft(overrides: Partial<DraftEmail> = {}): DraftEmail {
  return {
    workflow: "email_inbox",
    category: "URGENT",
    email_id: `draft-${Math.random().toString(36).slice(2, 8)}`,
    sender_name: "Customer",
    sender_email: "customer@example.com",
    subject: "Re: Invoice",
    original_subject: "Invoice",
    original_preview: "Please check invoice.",
    draft_html: "<p>Dear Customer,</p>",
    draft_plain: "Dear Customer,",
    placeholders: [],
    reply_language: "de",
    confidence: 0.8,
    review_reason: "Contains placeholder",
    requires_human_review: true,
    low_confidence: false,
    is_escalated: false,
    sentiment_score: 0.2,
    date: "2025-06-01T10:00:00Z",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

function makeEscalation(
  overrides: Partial<EscalationAlert> = {},
): EscalationAlert {
  return {
    workflow: "email_inbox",
    category: "ESCALATION",
    email_id: `esc-${Math.random().toString(36).slice(2, 8)}`,
    sender_name: "Angry Customer",
    sender_email: "angry@example.com",
    subject: "Legal action",
    sentiment_score: -0.8,
    urgency: 5,
    complaint_risk: true,
    legal_threat: true,
    churn_risk: "high",
    summary: "Customer threatening legal action.",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

function makeUnsub(
  overrides: Partial<UnsubscribeStatus> = {},
): UnsubscribeStatus {
  return {
    email_id: `unsub-${Math.random().toString(36).slice(2, 8)}`,
    sender: "newsletter@example.com",
    unsubscribe_method: "one-click",
    status: "erfolgreich",
    reason: "Unsubscribe link found",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset store before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useEmailStore.setState({
    spam: [],
    ads: [],
    urgent: [],
    other: [],
    escalations: [],
    unsubscribes: [],
  });
});

// ===========================================================================
// addEmail
// ===========================================================================

describe("addEmail", () => {
  it("routes SPAM to spam slice", () => {
    const email = makeSpam({ email_id: "spam-001" });
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().spam).toHaveLength(1);
    expect(useEmailStore.getState().spam[0].email_id).toBe("spam-001");
  });

  it("routes AD to ads slice", () => {
    const email = makeAd({ email_id: "ad-001" });
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().ads).toHaveLength(1);
    expect(useEmailStore.getState().ads[0].email_id).toBe("ad-001");
  });

  it("routes URGENT to urgent slice", () => {
    const email = makeDraft({ category: "URGENT", email_id: "urgent-001" });
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().urgent).toHaveLength(1);
  });

  it("routes OTHER to other slice", () => {
    const email = makeDraft({ category: "OTHER", email_id: "other-001" });
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().other).toHaveLength(1);
  });

  it("routes ESCALATION to escalations slice", () => {
    const email = makeEscalation({ email_id: "esc-001" });
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().escalations).toHaveLength(1);
  });

  it("routes UnsubscribeStatus (no category field) to unsubscribes slice", () => {
    const email = makeUnsub({ email_id: "unsub-001" });
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().unsubscribes).toHaveLength(1);
    expect(useEmailStore.getState().unsubscribes[0].email_id).toBe("unsub-001");
  });

  it("prevents duplicate by email_id in spam", () => {
    const email = makeSpam({ email_id: "dup-001" });
    useEmailStore.getState().addEmail(email);
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().spam).toHaveLength(1);
  });

  it("prevents duplicate by email_id in unsubscribes", () => {
    const email = makeUnsub({ email_id: "dup-unsub" });
    useEmailStore.getState().addEmail(email);
    useEmailStore.getState().addEmail(email);
    expect(useEmailStore.getState().unsubscribes).toHaveLength(1);
  });

  it("caps spam slice at 500 items", () => {
    for (let i = 0; i < 501; i++) {
      useEmailStore.getState().addEmail(makeSpam({ email_id: `spam-${i}` }));
    }
    expect(useEmailStore.getState().spam).toHaveLength(500);
    // Should keep the most recent items (tail)
    expect(useEmailStore.getState().spam[499].email_id).toBe("spam-500");
  });

  it("caps unsubscribes slice at 500 items", () => {
    for (let i = 0; i < 501; i++) {
      useEmailStore.getState().addEmail(makeUnsub({ email_id: `unsub-${i}` }));
    }
    expect(useEmailStore.getState().unsubscribes).toHaveLength(500);
  });

  it("does not affect other slices", () => {
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-001" }));
    expect(useEmailStore.getState().ads).toHaveLength(0);
    expect(useEmailStore.getState().urgent).toHaveLength(0);
    expect(useEmailStore.getState().escalations).toHaveLength(0);
  });
});

// ===========================================================================
// removeEmail
// ===========================================================================

describe("removeEmail", () => {
  it("removes from spam slice", () => {
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-001" }));
    useEmailStore.getState().removeEmail("spam", "spam-001");
    expect(useEmailStore.getState().spam).toHaveLength(0);
  });

  it("removes from ads slice", () => {
    useEmailStore.getState().addEmail(makeAd({ email_id: "ad-001" }));
    useEmailStore.getState().removeEmail("ads", "ad-001");
    expect(useEmailStore.getState().ads).toHaveLength(0);
  });

  it("removes from urgent slice", () => {
    useEmailStore
      .getState()
      .addEmail(makeDraft({ category: "URGENT", email_id: "u-001" }));
    useEmailStore.getState().removeEmail("urgent", "u-001");
    expect(useEmailStore.getState().urgent).toHaveLength(0);
  });

  it("removes from other slice", () => {
    useEmailStore
      .getState()
      .addEmail(makeDraft({ category: "OTHER", email_id: "o-001" }));
    useEmailStore.getState().removeEmail("other", "o-001");
    expect(useEmailStore.getState().other).toHaveLength(0);
  });

  it("removes from escalations slice", () => {
    useEmailStore.getState().addEmail(makeEscalation({ email_id: "esc-001" }));
    useEmailStore.getState().removeEmail("escalations", "esc-001");
    expect(useEmailStore.getState().escalations).toHaveLength(0);
  });

  it("removes from unsubscribes slice", () => {
    useEmailStore.getState().addEmail(makeUnsub({ email_id: "unsub-001" }));
    useEmailStore.getState().removeEmail("unsubscribes", "unsub-001");
    expect(useEmailStore.getState().unsubscribes).toHaveLength(0);
  });

  it("is a no-op for non-existent email_id", () => {
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-001" }));
    useEmailStore.getState().removeEmail("spam", "nonexistent");
    expect(useEmailStore.getState().spam).toHaveLength(1);
  });

  it("only removes the specified email, keeps others", () => {
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-001" }));
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-002" }));
    useEmailStore.getState().removeEmail("spam", "spam-001");
    expect(useEmailStore.getState().spam).toHaveLength(1);
    expect(useEmailStore.getState().spam[0].email_id).toBe("spam-002");
  });
});

// ===========================================================================
// updateEmail
// ===========================================================================

describe("updateEmail", () => {
  it("updates matching email immutably", () => {
    const original = makeSpam({ email_id: "spam-001", subject: "Old" });
    useEmailStore.getState().addEmail(original);
    useEmailStore
      .getState()
      .updateEmail("spam", "spam-001", { subject: "New" });

    const updated = useEmailStore.getState().spam[0];
    expect(updated.subject).toBe("New");
    expect(updated.email_id).toBe("spam-001");
    expect(updated).not.toBe(original);
  });

  it("only updates the matching email_id", () => {
    useEmailStore
      .getState()
      .addEmail(makeSpam({ email_id: "spam-001", subject: "A" }));
    useEmailStore
      .getState()
      .addEmail(makeSpam({ email_id: "spam-002", subject: "B" }));
    useEmailStore
      .getState()
      .updateEmail("spam", "spam-001", { subject: "Updated" });

    expect(useEmailStore.getState().spam[0].subject).toBe("Updated");
    expect(useEmailStore.getState().spam[1].subject).toBe("B");
  });

  it("works on escalations slice", () => {
    useEmailStore
      .getState()
      .addEmail(makeEscalation({ email_id: "esc-001", urgency: 3 }));
    useEmailStore
      .getState()
      .updateEmail("escalations", "esc-001", { urgency: 5 } as never);

    expect(
      (useEmailStore.getState().escalations[0] as EscalationAlert).urgency,
    ).toBe(5);
  });

  it("is a no-op for non-matching email_id", () => {
    useEmailStore
      .getState()
      .addEmail(makeSpam({ email_id: "spam-001", subject: "A" }));
    useEmailStore
      .getState()
      .updateEmail("spam", "nonexistent", { subject: "Changed" });
    expect(useEmailStore.getState().spam[0].subject).toBe("A");
  });

  it("works on ads slice", () => {
    useEmailStore
      .getState()
      .addEmail(makeAd({ email_id: "ad-001", subject: "Old" }));
    useEmailStore.getState().updateEmail("ads", "ad-001", { subject: "New" });
    expect(useEmailStore.getState().ads[0].subject).toBe("New");
  });

  it("works on urgent slice", () => {
    useEmailStore
      .getState()
      .addEmail(
        makeDraft({ category: "URGENT", email_id: "u-001", subject: "Old" }),
      );
    useEmailStore.getState().updateEmail("urgent", "u-001", { subject: "New" });
    expect(useEmailStore.getState().urgent[0].subject).toBe("New");
  });

  it("works on other slice", () => {
    useEmailStore
      .getState()
      .addEmail(
        makeDraft({ category: "OTHER", email_id: "o-001", subject: "Old" }),
      );
    useEmailStore.getState().updateEmail("other", "o-001", { subject: "New" });
    expect(useEmailStore.getState().other[0].subject).toBe("New");
  });

  it("works on unsubscribes slice", () => {
    useEmailStore
      .getState()
      .addEmail(makeUnsub({ email_id: "unsub-001", reason: "Old reason" }));
    useEmailStore.getState().updateEmail("unsubscribes", "unsub-001", {
      reason: "New reason",
    } as never);
    expect(useEmailStore.getState().unsubscribes[0].reason).toBe("New reason");
  });
});

// ===========================================================================
// clearCategory
// ===========================================================================

describe("clearCategory", () => {
  it("clears spam without affecting other slices", () => {
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-001" }));
    useEmailStore.getState().addEmail(makeAd({ email_id: "ad-001" }));
    useEmailStore.getState().clearCategory("spam");
    expect(useEmailStore.getState().spam).toHaveLength(0);
    expect(useEmailStore.getState().ads).toHaveLength(1);
  });

  it("clears ads", () => {
    useEmailStore.getState().addEmail(makeAd({ email_id: "ad-001" }));
    useEmailStore.getState().clearCategory("ads");
    expect(useEmailStore.getState().ads).toHaveLength(0);
  });

  it("clears urgent", () => {
    useEmailStore
      .getState()
      .addEmail(makeDraft({ category: "URGENT", email_id: "u-001" }));
    useEmailStore.getState().clearCategory("urgent");
    expect(useEmailStore.getState().urgent).toHaveLength(0);
  });

  it("clears other", () => {
    useEmailStore
      .getState()
      .addEmail(makeDraft({ category: "OTHER", email_id: "o-001" }));
    useEmailStore.getState().clearCategory("other");
    expect(useEmailStore.getState().other).toHaveLength(0);
  });

  it("clears escalations", () => {
    useEmailStore.getState().addEmail(makeEscalation({ email_id: "esc-001" }));
    useEmailStore.getState().clearCategory("escalations");
    expect(useEmailStore.getState().escalations).toHaveLength(0);
  });

  it("clears unsubscribes", () => {
    useEmailStore.getState().addEmail(makeUnsub({ email_id: "unsub-001" }));
    useEmailStore.getState().clearCategory("unsubscribes");
    expect(useEmailStore.getState().unsubscribes).toHaveLength(0);
  });
});

// ===========================================================================
// getActionCount
// ===========================================================================

describe("getActionCount", () => {
  it("returns 0 for empty store", () => {
    expect(useEmailStore.getState().getActionCount()).toBe(0);
  });

  it("sums all slices", () => {
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-001" }));
    useEmailStore.getState().addEmail(makeAd({ email_id: "ad-001" }));
    useEmailStore
      .getState()
      .addEmail(makeDraft({ category: "URGENT", email_id: "u-001" }));
    useEmailStore
      .getState()
      .addEmail(makeDraft({ category: "OTHER", email_id: "o-001" }));
    useEmailStore.getState().addEmail(makeEscalation({ email_id: "esc-001" }));
    expect(useEmailStore.getState().getActionCount()).toBe(5);
  });

  it('only counts "nicht erfolgreich" unsubscribes', () => {
    useEmailStore
      .getState()
      .addEmail(makeUnsub({ email_id: "u1", status: "erfolgreich" }));
    useEmailStore
      .getState()
      .addEmail(makeUnsub({ email_id: "u2", status: "nicht erfolgreich" }));
    useEmailStore
      .getState()
      .addEmail(makeUnsub({ email_id: "u3", status: "nicht erfolgreich" }));
    expect(useEmailStore.getState().getActionCount()).toBe(2);
  });

  it("counts mixed slices correctly", () => {
    useEmailStore.getState().addEmail(makeSpam({ email_id: "spam-001" }));
    useEmailStore
      .getState()
      .addEmail(makeUnsub({ email_id: "u1", status: "erfolgreich" }));
    useEmailStore
      .getState()
      .addEmail(makeUnsub({ email_id: "u2", status: "nicht erfolgreich" }));
    // 1 spam + 1 failed unsub = 2
    expect(useEmailStore.getState().getActionCount()).toBe(2);
  });
});
