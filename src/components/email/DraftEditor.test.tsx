import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftEditor } from "./DraftEditor";
import type { DraftEmail } from "@/types/email";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeDraftEmail(overrides: Partial<DraftEmail> = {}): DraftEmail {
  return {
    workflow: "email_inbox",
    category: "URGENT",
    email_id: "draft-001",
    sender_name: "Customer",
    sender_email: "customer@example.com",
    subject: "Re: Invoice #1234",
    original_subject: "Invoice #1234",
    original_preview: "Please check attached invoice.",
    draft_html: "<p>Sehr geehrte Damen und Herren,</p>",
    draft_plain: "Sehr geehrte Damen und Herren,",
    placeholders: [],
    reply_language: "de",
    confidence: 0.85,
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

function renderEditor(overrides: Record<string, unknown> = {}) {
  const props = {
    email: makeDraftEmail(overrides.email as Partial<DraftEmail>),
    draftContent:
      (overrides.draftContent as string) ?? "Sehr geehrte Damen und Herren,",
    submittingAction:
      (overrides.submittingAction as "approve" | "reject" | null) ?? null,
    onDraftChange: (overrides.onDraftChange as (s: string) => void) ?? vi.fn(),
    onApprove:
      (overrides.onApprove as (id: string, content: string) => void) ?? vi.fn(),
    onReject:
      (overrides.onReject as (id: string, reason: string) => void) ?? vi.fn(),
  };
  return render(<DraftEditor {...props} />);
}

// ===========================================================================
// Approve button / placeholder logic
// ===========================================================================

describe("approve button", () => {
  it("is enabled when no placeholders and not submitting", () => {
    renderEditor({ draftContent: "Clean draft without placeholders" });
    const btn = screen.getByRole("button", { name: /genehmigen/i });
    expect(btn).not.toBeDisabled();
  });

  it("is disabled when placeholders exist", () => {
    renderEditor({ draftContent: "Dear [BITTE ERGÄNZEN: Name]" });
    const btn = screen.getByRole("button", { name: /genehmigen/i });
    expect(btn).toBeDisabled();
  });

  it('is disabled when submittingAction is "approve"', () => {
    renderEditor({ submittingAction: "approve" });
    const btn = screen.getByRole("button", { name: /genehmigen/i });
    expect(btn).toBeDisabled();
  });

  it('is disabled when submittingAction is "reject"', () => {
    renderEditor({ submittingAction: "reject" });
    const btn = screen.getByRole("button", { name: /genehmigen/i });
    expect(btn).toBeDisabled();
  });

  it("calls onApprove with emailId and draftContent when clicked", async () => {
    const onApprove = vi.fn();
    renderEditor({ onApprove, draftContent: "Clean draft" });
    const btn = screen.getByRole("button", { name: /genehmigen/i });
    await userEvent.click(btn);
    expect(onApprove).toHaveBeenCalledWith("draft-001", "Clean draft");
  });
});

// ===========================================================================
// Placeholder warning alert
// ===========================================================================

describe("placeholder warning", () => {
  it("shows alert when placeholders exist", () => {
    renderEditor({ draftContent: "Hello [BITTE ERGÄNZEN: Name]" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not show alert when no placeholders", () => {
    renderEditor({ draftContent: "Clean draft" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Reject button and dialog
// ===========================================================================

describe("reject button and dialog", () => {
  it("reject button is disabled during submission", () => {
    renderEditor({ submittingAction: "reject" });
    const rejectBtn = screen.getByRole("button", { name: /ablehnen/i });
    expect(rejectBtn).toBeDisabled();
  });

  it("opens reject dialog when clicked", async () => {
    renderEditor();
    const rejectBtn = screen.getByRole("button", { name: /ablehnen/i });
    await userEvent.click(rejectBtn);
    expect(screen.getByText(/entwurf ablehnen/i)).toBeInTheDocument();
  });

  it("calls onReject with emailId and reason on confirm", async () => {
    const onReject = vi.fn().mockResolvedValue(undefined);
    renderEditor({ onReject });
    const user = userEvent.setup();

    // Open dialog
    await user.click(screen.getByRole("button", { name: /ablehnen/i }));

    // Type reason
    const reasonInput = screen.getByPlaceholderText(/grund für die ablehnung/i);
    await user.type(reasonInput, "Qualität unzureichend");

    // Confirm
    const dialogButtons = screen.getAllByRole("button", { name: /ablehnen/i });
    const confirmBtn = dialogButtons[dialogButtons.length - 1];
    await user.click(confirmBtn);

    expect(onReject).toHaveBeenCalledWith("draft-001", "Qualität unzureichend");
  });
});

// ===========================================================================
// Escalated badge and confidence display
// ===========================================================================

describe("display elements", () => {
  it("shows escalated badge when email is escalated", () => {
    renderEditor({ email: { is_escalated: true } });
    expect(screen.getByText("Eskaliert")).toBeInTheDocument();
  });

  it("does not show escalated badge when not escalated", () => {
    renderEditor({ email: { is_escalated: false } });
    expect(screen.queryByText("Eskaliert")).not.toBeInTheDocument();
  });

  it("shows confidence percentage", () => {
    renderEditor({ email: { confidence: 0.85 } });
    expect(screen.getByText(/konfidenz: 85%/i)).toBeInTheDocument();
  });

  it("shows subject", () => {
    renderEditor({ email: { subject: "Re: Invoice #1234" } });
    expect(screen.getByText("Re: Invoice #1234")).toBeInTheDocument();
  });

  it('shows language as Deutsch for "de"', () => {
    renderEditor({ email: { reply_language: "de" } });
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
  });

  it('shows language as Englisch for "en"', () => {
    renderEditor({ email: { reply_language: "en" } });
    expect(screen.getByText("Englisch")).toBeInTheDocument();
  });

  it("shows review reason when present", () => {
    renderEditor({ email: { review_reason: "Low confidence draft" } });
    expect(screen.getByText("Low confidence draft")).toBeInTheDocument();
  });
});

// ===========================================================================
// Spinner states
// ===========================================================================

describe("spinner during submission", () => {
  it("shows spinner on approve button during approve submission", () => {
    const { container } = renderEditor({ submittingAction: "approve" });
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("does not show spinner when not submitting", () => {
    const { container } = renderEditor({ submittingAction: null });
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeInTheDocument();
  });
});
