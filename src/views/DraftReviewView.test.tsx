import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftReviewView } from "./DraftReviewView";
import { useEmailStore } from "@/lib/store/email-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { DraftEmail } from "@/types/email";

vi.mock("@/lib/api/webhooks", () => ({
  approveDraft: vi.fn().mockResolvedValue(undefined),
  rejectDraft: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/audit", () => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

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
    confidence: 0.85,
    review_reason: "Review needed",
    requires_human_review: true,
    low_confidence: false,
    is_escalated: false,
    sentiment_score: 0.2,
    date: "2025-06-01T10:00:00Z",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  useEmailStore.setState({
    spam: [],
    ads: [],
    urgent: [],
    other: [],
    escalations: [],
    unsubscribes: [],
  });
  useUiStore.setState({
    activeTab: "urgent",
    selectedEmailId: null,
    draftEditorContent: "",
  });
  vi.clearAllMocks();
});

describe("empty state", () => {
  it("shows empty state for urgent", () => {
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    expect(screen.getByText("Dringend")).toBeInTheDocument();
    expect(
      screen.getByText("Keine E-Mails zur Prüfung vorhanden"),
    ).toBeInTheDocument();
  });
});

describe("with drafts", () => {
  it("shows draft list", () => {
    useEmailStore.setState({
      urgent: [makeDraft({ email_id: "d1", sender_name: "Max Müller" })],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    expect(screen.getByText("Max Müller")).toBeInTheDocument();
    expect(screen.getByText("1 Entwurf zur Prüfung")).toBeInTheDocument();
  });

  it("shows plural for multiple drafts", () => {
    useEmailStore.setState({
      urgent: [makeDraft({ email_id: "d1" }), makeDraft({ email_id: "d2" })],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    expect(screen.getByText("2 Entwürfe zur Prüfung")).toBeInTheDocument();
  });

  it("shows no-selection message before selecting", () => {
    useEmailStore.setState({
      urgent: [makeDraft({ email_id: "d1" })],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    expect(
      screen.getByText(/e-mail aus der liste auswählen/i),
    ).toBeInTheDocument();
  });

  it("shows draft editor after selecting email", async () => {
    useEmailStore.setState({
      urgent: [
        makeDraft({
          email_id: "d1",
          sender_name: "Max Müller",
          subject: "Re: Test",
        }),
      ],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    const user = userEvent.setup();

    // Click on the email in the list
    await user.click(screen.getByText("Max Müller"));

    // Should now show the draft editor
    expect(screen.getByText(/ki-entwurf/i)).toBeInTheDocument();
    expect(screen.getByText(/genehmigen/i)).toBeInTheDocument();
  });
});

describe("approve flow", () => {
  it("calls approveDraft and removes from store", async () => {
    const { approveDraft } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const approveMock = approveDraft as ReturnType<typeof vi.fn>;
    approveMock.mockResolvedValue(undefined);

    useEmailStore.setState({
      urgent: [
        makeDraft({
          email_id: "d1",
          sender_name: "Customer A",
          draft_plain: "Clean draft",
        }),
      ],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    const user = userEvent.setup();

    // Select email
    await user.click(screen.getByText("Customer A"));

    // Click approve
    await user.click(screen.getByRole("button", { name: /genehmigen/i }));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().urgent).toHaveLength(0);
    });

    expect(approveMock).toHaveBeenCalled();
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "draft_approved" }),
    );
  });

  it("shows error toast when approve fails", async () => {
    const { approveDraft } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const { toast } = await import("sonner");
    const approveMock = approveDraft as ReturnType<typeof vi.fn>;
    approveMock.mockRejectedValue(new Error("Webhook timeout"));

    useEmailStore.setState({
      urgent: [
        makeDraft({
          email_id: "d1",
          sender_name: "Customer A",
          draft_plain: "Clean draft",
        }),
      ],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Customer A"));
    await user.click(screen.getByRole("button", { name: /genehmigen/i }));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "draft_approved",
        result: "failure",
        error: "Webhook timeout",
      }),
    );
    // Email should NOT be removed on failure
    expect(useEmailStore.getState().urgent).toHaveLength(1);
  });

  it("handles non-Error rejection in approve", async () => {
    const { approveDraft } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const approveMock = approveDraft as ReturnType<typeof vi.fn>;
    approveMock.mockRejectedValue("string error");

    useEmailStore.setState({
      urgent: [
        makeDraft({
          email_id: "d1",
          sender_name: "Customer A",
          draft_plain: "Clean draft",
        }),
      ],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Customer A"));
    await user.click(screen.getByRole("button", { name: /genehmigen/i }));

    await vi.waitFor(() => {
      expect(emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Unbekannter Fehler" }),
      );
    });
  });
});

describe("reject flow", () => {
  it("calls rejectDraft and removes from store", async () => {
    const { rejectDraft } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const { toast } = await import("sonner");
    const rejectMock = rejectDraft as ReturnType<typeof vi.fn>;
    rejectMock.mockResolvedValue(undefined);

    useEmailStore.setState({
      urgent: [
        makeDraft({
          email_id: "d1",
          sender_name: "Customer A",
          draft_plain: "Clean draft",
        }),
      ],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Customer A"));

    // Click reject button to open dialog
    await user.click(screen.getByRole("button", { name: /ablehnen/i }));

    // Find confirm button in dialog and click
    const confirmButtons = screen.getAllByRole("button", { name: /ablehnen/i });
    const confirmBtn = confirmButtons[confirmButtons.length - 1];
    await user.click(confirmBtn);

    await vi.waitFor(() => {
      expect(useEmailStore.getState().urgent).toHaveLength(0);
    });

    expect(rejectMock).toHaveBeenCalled();
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "draft_rejected", result: "success" }),
    );
    expect(toast.info).toHaveBeenCalled();
  });

  it("shows error toast when reject fails", async () => {
    const { rejectDraft } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const { toast } = await import("sonner");
    const rejectMock = rejectDraft as ReturnType<typeof vi.fn>;
    rejectMock.mockRejectedValue(new Error("Server error"));

    useEmailStore.setState({
      urgent: [
        makeDraft({
          email_id: "d1",
          sender_name: "Customer A",
          draft_plain: "Clean draft",
        }),
      ],
    });
    render(<DraftReviewView title="Dringend" slice="urgent" />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Customer A"));
    await user.click(screen.getByRole("button", { name: /ablehnen/i }));

    const confirmButtons = screen.getAllByRole("button", { name: /ablehnen/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "draft_rejected",
        result: "failure",
        error: "Server error",
      }),
    );
    expect(useEmailStore.getState().urgent).toHaveLength(1);
  });
});
