import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpamView } from "./SpamView";
import { useEmailStore } from "@/lib/store/email-store";
import type { SpamAdEmail } from "@/types/email";

// ---------------------------------------------------------------------------
// Mock webhooks and audit (fire-and-forget, shouldn't make real HTTP calls)
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/webhooks", () => ({
  retriage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/emails", () => ({
  deleteEmailFromServer: vi.fn().mockImplementation(async (emailId: string) => {
    // Simulate SSE removal that the real server would broadcast
    useEmailStore.getState().removeEmailById(emailId);
  }),
}));

vi.mock("@/lib/api/audit", () => ({
  emitAuditEvent: vi.fn(),
}));

// Sonner toast mock
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeSpam(overrides: Partial<SpamAdEmail> = {}): SpamAdEmail {
  return {
    workflow: "email_inbox",
    category: "SPAM",
    email_id: `spam-${Math.random().toString(36).slice(2, 8)}`,
    sender_name: "Spammer",
    sender_email: "spam@example.com",
    sender_domain: "example.com",
    subject: "You won!",
    preview: "Click here to claim",
    date: "2025-06-01T10:00:00Z",
    confidence: 0.95,
    low_confidence: false,
    reasoning: "Spam pattern detected",
    list_unsubscribe_url: null,
    list_unsubscribe_mailto: null,
    unsubscribe_available: false,
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
  vi.clearAllMocks();
});

// ===========================================================================
// Empty state
// ===========================================================================

describe("empty state", () => {
  it("shows empty message when no spam emails", () => {
    render(<SpamView />);
    expect(screen.getByText("Kein Spam erkannt")).toBeInTheDocument();
  });

  it('shows "0 E-Mails erkannt" count', () => {
    render(<SpamView />);
    expect(screen.getByText("0 E-Mails erkannt")).toBeInTheDocument();
  });
});

// ===========================================================================
// Email display
// ===========================================================================

describe("with emails", () => {
  it("shows email count", () => {
    useEmailStore.setState({
      spam: [makeSpam({ email_id: "s1" }), makeSpam({ email_id: "s2" })],
    });
    render(<SpamView />);
    expect(screen.getByText("2 E-Mails erkannt")).toBeInTheDocument();
  });

  it('shows singular "E-Mail" for 1 email', () => {
    useEmailStore.setState({ spam: [makeSpam({ email_id: "s1" })] });
    render(<SpamView />);
    expect(screen.getByText("1 E-Mail erkannt")).toBeInTheDocument();
  });
});

// ===========================================================================
// Selection and action buttons
// ===========================================================================

describe("selection", () => {
  it("does not show action buttons without selection", () => {
    useEmailStore.setState({ spam: [makeSpam({ email_id: "s1" })] });
    render(<SpamView />);
    expect(screen.queryByText(/ausgewählt/)).not.toBeInTheDocument();
  });

  it("shows selection count and action buttons after selecting", async () => {
    useEmailStore.setState({
      spam: [makeSpam({ email_id: "s1", subject: "Spam 1" })],
    });
    render(<SpamView />);
    const user = userEvent.setup();

    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is "select all", second is the row checkbox
    await user.click(checkboxes[1]);

    expect(screen.getByText("1 ausgewählt")).toBeInTheDocument();
    expect(screen.getByText(/ausgewählte löschen/i)).toBeInTheDocument();
    expect(screen.getByText(/in posteingang/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// Delete
// ===========================================================================

describe("delete", () => {
  it("removes selected emails from store on delete", async () => {
    const { emitAuditEvent } = await import("@/lib/api/audit");
    useEmailStore.setState({
      spam: [makeSpam({ email_id: "s1" }), makeSpam({ email_id: "s2" })],
    });
    render(<SpamView />);
    const user = userEvent.setup();

    // Select first email
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    // Click delete
    await user.click(screen.getByText(/ausgewählte löschen/i));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().spam).toHaveLength(1);
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "email_deleted" }),
    );
  });
});

// ===========================================================================
// Retriage
// ===========================================================================

describe("retriage", () => {
  it("removes emails from store on successful retriage", async () => {
    const { retriage } = await import("@/lib/api/webhooks");
    const { toast } = await import("sonner");
    const retriageMock = retriage as ReturnType<typeof vi.fn>;
    retriageMock.mockResolvedValue(undefined);

    useEmailStore.setState({
      spam: [
        makeSpam({
          email_id: "s1",
          subject: "Spam 1",
          sender_email: "a@b.com",
        }),
      ],
    });
    render(<SpamView />);
    const user = userEvent.setup();

    // Select email
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    // Click retriage
    await user.click(screen.getByText(/in posteingang/i));

    // Wait for async operation
    await vi.waitFor(() => {
      expect(useEmailStore.getState().spam).toHaveLength(0);
    });

    expect(retriageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email_id: "s1",
        original_category: "SPAM",
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps failed emails in store on partial retriage failure", async () => {
    const { retriage } = await import("@/lib/api/webhooks");
    const { toast } = await import("sonner");
    const retriageMock = retriage as ReturnType<typeof vi.fn>;

    retriageMock
      .mockResolvedValueOnce(undefined) // s1 succeeds
      .mockRejectedValueOnce(new Error("Network error")); // s2 fails

    useEmailStore.setState({
      spam: [makeSpam({ email_id: "s1" }), makeSpam({ email_id: "s2" })],
    });
    render(<SpamView />);
    const user = userEvent.setup();

    // Select all
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]); // select all

    // Click retriage
    await user.click(screen.getByText(/in posteingang/i));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().spam).toHaveLength(1);
    });

    expect(useEmailStore.getState().spam[0].email_id).toBe("s2");
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("handles non-Error rejection in retriage failure path", async () => {
    const { retriage } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const retriageMock = retriage as ReturnType<typeof vi.fn>;
    retriageMock.mockRejectedValue("string rejection");

    useEmailStore.setState({ spam: [makeSpam({ email_id: "s1" })] });
    render(<SpamView />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByText(/in posteingang/i));

    await vi.waitFor(() => {
      expect(emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "email_retriaged",
          result: "failure",
          error: "Unknown error",
        }),
      );
    });
  });

  it("shows plural toast for multiple successful retriages", async () => {
    const { retriage } = await import("@/lib/api/webhooks");
    const { toast } = await import("sonner");
    const retriageMock = retriage as ReturnType<typeof vi.fn>;
    retriageMock.mockResolvedValue(undefined);

    useEmailStore.setState({
      spam: [makeSpam({ email_id: "s1" }), makeSpam({ email_id: "s2" })],
    });
    render(<SpamView />);
    const user = userEvent.setup();

    // Select all
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByText(/in posteingang/i));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().spam).toHaveLength(0);
    });

    expect(toast.success).toHaveBeenCalledWith(
      "2 E-Mails zurück in den Posteingang",
    );
  });
});

describe("select all toggle", () => {
  it("deselects all when all are already selected", async () => {
    useEmailStore.setState({
      spam: [makeSpam({ email_id: "s1" }), makeSpam({ email_id: "s2" })],
    });
    render(<SpamView />);
    const user = userEvent.setup();

    // Select all
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(screen.getByText("2 ausgewählt")).toBeInTheDocument();

    // Deselect all
    await user.click(checkboxes[0]);
    expect(screen.queryByText(/ausgewählt/)).not.toBeInTheDocument();
  });

  it("deselects individual email after selecting", async () => {
    useEmailStore.setState({ spam: [makeSpam({ email_id: "s1" })] });
    render(<SpamView />);
    const user = userEvent.setup();

    const checkboxes = screen.getAllByRole("checkbox");
    // Select
    await user.click(checkboxes[1]);
    expect(screen.getByText("1 ausgewählt")).toBeInTheDocument();

    // Deselect
    await user.click(checkboxes[1]);
    expect(screen.queryByText(/ausgewählt/)).not.toBeInTheDocument();
  });
});
