import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnsubscribeView } from "./UnsubscribeView";
import { useEmailStore } from "@/lib/store/email-store";
import type { UnsubscribeStatus } from "@/types/email";

vi.mock("@/lib/api/webhooks", () => ({
  unsubscribe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/audit", () => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeUnsub(
  overrides: Partial<UnsubscribeStatus> = {},
): UnsubscribeStatus {
  return {
    email_id: `unsub-${Math.random().toString(36).slice(2, 8)}`,
    sender: "newsletter@example.com",
    unsubscribe_method: "one-click",
    status: "erfolgreich",
    reason: "Unsubscribe link found",
    timestamp: "2025-06-15T12:00:00Z",
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
    render(<UnsubscribeView />);
    expect(screen.getByText("Keine Abmeldungen vorhanden")).toBeInTheDocument();
  });
});

describe("with entries", () => {
  it("shows total count", () => {
    useEmailStore.setState({
      unsubscribes: [
        makeUnsub({ email_id: "u1" }),
        makeUnsub({ email_id: "u2" }),
      ],
    });
    render(<UnsubscribeView />);
    expect(screen.getByText(/2 gesamt/)).toBeInTheDocument();
  });

  it("shows failed count", () => {
    useEmailStore.setState({
      unsubscribes: [
        makeUnsub({ email_id: "u1", status: "erfolgreich" }),
        makeUnsub({ email_id: "u2", status: "nicht erfolgreich" }),
      ],
    });
    render(<UnsubscribeView />);
    expect(screen.getByText(/1 fehlgeschlagen/)).toBeInTheDocument();
  });

  it("shows table with sender information", () => {
    useEmailStore.setState({
      unsubscribes: [makeUnsub({ email_id: "u1", sender: "test@example.com" })],
    });
    render(<UnsubscribeView />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("shows description without failed count when all successful", () => {
    useEmailStore.setState({
      unsubscribes: [
        makeUnsub({ email_id: "u1", status: "erfolgreich" }),
        makeUnsub({ email_id: "u2", status: "erfolgreich" }),
      ],
    });
    render(<UnsubscribeView />);
    expect(screen.getByText("2 gesamt")).toBeInTheDocument();
    expect(screen.queryByText(/fehlgeschlagen/)).not.toBeInTheDocument();
  });
});

describe("retry", () => {
  it("calls unsubscribe webhook and emits audit on success", async () => {
    const { unsubscribe: unsubscribeMock } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const { toast } = await import("sonner");
    (unsubscribeMock as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    useEmailStore.setState({
      unsubscribes: [
        makeUnsub({
          email_id: "u1",
          sender: "news@example.com",
          status: "nicht erfolgreich",
        }),
      ],
    });
    render(<UnsubscribeView />);
    const user = userEvent.setup();

    // Find and click the retry button
    const retryBtn = screen.getByRole("button", { name: /erneut versuchen/i });
    await user.click(retryBtn);

    await vi.waitFor(() => {
      expect(emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "unsubscribe_retried",
          result: "success",
        }),
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows error toast on retry failure", async () => {
    const { unsubscribe: unsubscribeMock } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    const { toast } = await import("sonner");
    (unsubscribeMock as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    useEmailStore.setState({
      unsubscribes: [
        makeUnsub({
          email_id: "u1",
          sender: "news@example.com",
          status: "nicht erfolgreich",
        }),
      ],
    });
    render(<UnsubscribeView />);
    const user = userEvent.setup();

    const retryBtn = screen.getByRole("button", { name: /erneut versuchen/i });
    await user.click(retryBtn);

    await vi.waitFor(() => {
      expect(emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "unsubscribe_retried",
          result: "failure",
          error: "Network error",
        }),
      );
    });
    expect(toast.error).toHaveBeenCalled();
  });

  it("handles non-Error rejection in retry", async () => {
    const { unsubscribe: unsubscribeMock } = await import("@/lib/api/webhooks");
    const { emitAuditEvent } = await import("@/lib/api/audit");
    (unsubscribeMock as ReturnType<typeof vi.fn>).mockRejectedValue(
      "string error",
    );

    useEmailStore.setState({
      unsubscribes: [
        makeUnsub({
          email_id: "u1",
          sender: "news@example.com",
          status: "nicht erfolgreich",
        }),
      ],
    });
    render(<UnsubscribeView />);
    const user = userEvent.setup();

    const retryBtn = screen.getByRole("button", { name: /erneut versuchen/i });
    await user.click(retryBtn);

    await vi.waitFor(() => {
      expect(emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Unbekannter Fehler" }),
      );
    });
  });
});
