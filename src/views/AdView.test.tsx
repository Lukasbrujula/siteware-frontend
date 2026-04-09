import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdView } from "./AdView";
import { useEmailStore } from "@/lib/store/email-store";
import type { SpamAdEmail } from "@/types/email";

vi.mock("@/lib/api/webhooks", () => ({
  retriage: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeAd(overrides: Partial<SpamAdEmail> = {}): SpamAdEmail {
  return {
    workflow: "email_inbox",
    category: "AD",
    email_id: `ad-${Math.random().toString(36).slice(2, 8)}`,
    sender_name: "Newsletter Co",
    sender_email: "news@example.com",
    sender_domain: "example.com",
    subject: "Special offer!",
    preview: "Check out our deals",
    date: "2025-06-01T10:00:00Z",
    confidence: 0.9,
    low_confidence: false,
    reasoning: "Ad pattern",
    list_unsubscribe_url: "https://example.com/unsub",
    list_unsubscribe_mailto: null,
    unsubscribe_available: true,
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
  vi.clearAllMocks();
});

describe("empty state", () => {
  it("shows empty message", () => {
    render(<AdView />);
    expect(screen.getByText("Keine Werbung erkannt")).toBeInTheDocument();
  });

  it("shows 0 count", () => {
    render(<AdView />);
    expect(screen.getByText("0 E-Mails erkannt")).toBeInTheDocument();
  });
});

describe("with emails", () => {
  it("shows email count", () => {
    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1" }), makeAd({ email_id: "a2" })],
    });
    render(<AdView />);
    expect(screen.getByText("2 E-Mails erkannt")).toBeInTheDocument();
  });

  it("shows unsubscribe indicator for available emails", () => {
    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1", unsubscribe_available: true })],
    });
    render(<AdView />);
    expect(screen.getByText("Abmeldung verfügbar")).toBeInTheDocument();
  });
});

describe("delete", () => {
  it("removes selected from store", async () => {
    const { emitAuditEvent } = await import("@/lib/api/audit");
    useEmailStore.setState({ ads: [makeAd({ email_id: "a1" })] });
    render(<AdView />);
    const user = userEvent.setup();

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(screen.getByText(/ausgewählte löschen/i));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().ads).toHaveLength(0);
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "email_deleted", category: "AD" }),
    );
  });
});

describe("retriage", () => {
  it("removes on success", async () => {
    useEmailStore.setState({ ads: [makeAd({ email_id: "a1" })] });
    render(<AdView />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByText(/in posteingang/i));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().ads).toHaveLength(0);
    });
  });
});

describe("unsubscribe", () => {
  it("removes from store on success and emits audit", async () => {
    const { unsubscribe: unsubscribeMock } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const { toast } = await import("sonner");
    (unsubscribeMock as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1", unsubscribe_available: true })],
    });
    render(<AdView />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Abmelden"));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().ads).toHaveLength(0);
    });

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unsubscribe_requested" }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows error toast when unsubscribe fails", async () => {
    const { unsubscribe: unsubscribeMock } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const { toast } = await import("sonner");
    (unsubscribeMock as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Unsubscribe failed"),
    );

    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1", unsubscribe_available: true })],
    });
    render(<AdView />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Abmelden"));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "unsubscribe_requested",
        result: "failure",
        error: "Unsubscribe failed",
      }),
    );
    // Email should stay in store on failure
    expect(useEmailStore.getState().ads).toHaveLength(1);
  });

  it("handles non-Error rejection in unsubscribe", async () => {
    const { unsubscribe: unsubscribeMock } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    (unsubscribeMock as ReturnType<typeof vi.fn>).mockRejectedValue(
      "string error",
    );

    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1", unsubscribe_available: true })],
    });
    render(<AdView />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Abmelden"));

    await vi.waitFor(() => {
      expect(emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Unbekannter Fehler" }),
      );
    });
  });
});

describe("unavailable unsubscribe", () => {
  it('shows "Keine Abmeldung" for unavailable emails', () => {
    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1", unsubscribe_available: false })],
    });
    render(<AdView />);
    expect(screen.getByText("Keine Abmeldung")).toBeInTheDocument();
  });

  it("does not show Abmelden button for unavailable emails", () => {
    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1", unsubscribe_available: false })],
    });
    render(<AdView />);
    expect(screen.queryByText("Abmelden")).not.toBeInTheDocument();
  });
});

describe("singular count", () => {
  it('shows singular "E-Mail" for 1 email', () => {
    useEmailStore.setState({ ads: [makeAd({ email_id: "a1" })] });
    render(<AdView />);
    expect(screen.getByText("1 E-Mail erkannt")).toBeInTheDocument();
  });
});

describe("select all toggle", () => {
  it("deselects all when all are selected", async () => {
    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1" }), makeAd({ email_id: "a2" })],
    });
    render(<AdView />);
    const user = userEvent.setup();

    // Select all
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(screen.getByText("2 ausgewählt")).toBeInTheDocument();

    // Click again to deselect all
    await user.click(checkboxes[0]);
    expect(screen.queryByText(/ausgewählt/)).not.toBeInTheDocument();
  });
});

describe("retriage partial failure", () => {
  it("shows both success and error toast on partial failure", async () => {
    const { retriage: retriageMock } = await import("@/lib/api/webhooks");
    const { toast } = await import("sonner");
    (retriageMock as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Failed"));

    useEmailStore.setState({
      ads: [makeAd({ email_id: "a1" }), makeAd({ email_id: "a2" })],
    });
    render(<AdView />);
    const user = userEvent.setup();

    // Select all
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByText(/in posteingang/i));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().ads).toHaveLength(1);
    });

    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("handles non-Error rejection in retriage failure path", async () => {
    const { retriage: retriageMock } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    (retriageMock as ReturnType<typeof vi.fn>).mockRejectedValue(
      "string rejection",
    );

    useEmailStore.setState({ ads: [makeAd({ email_id: "a1" })] });
    render(<AdView />);
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
});
