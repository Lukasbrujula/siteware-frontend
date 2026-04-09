import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscalationView } from "./EscalationView";
import { useEmailStore } from "@/lib/store/email-store";
import type { EscalationAlert } from "@/types/email";

// ---------------------------------------------------------------------------
// Mock audit
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/audit", () => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock("@/lib/api/emails", () => ({
  deleteEmailFromServer: vi.fn().mockImplementation(async (emailId: string) => {
    // Simulate SSE removal that the real server would broadcast
    useEmailStore.getState().removeEmailById(emailId);
  }),
  updateEmailStatus: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeEscalation(
  overrides: Partial<EscalationAlert> = {},
): EscalationAlert {
  return {
    workflow: "email_inbox",
    category: "ESCALATION",
    email_id: `esc-${Math.random().toString(36).slice(2, 8)}`,
    sender_name: "Angry Customer",
    sender_email: "angry@example.com",
    subject: "Unacceptable service",
    sentiment_score: -0.5,
    urgency: 3,
    complaint_risk: false,
    legal_threat: false,
    churn_risk: "low",
    summary: "Customer is unhappy with service.",
    timestamp: "2025-06-15T12:00:00Z",
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
  it("shows empty state card when no escalations", () => {
    render(<EscalationView />);
    expect(screen.getByText("Keine aktiven Eskalationen")).toBeInTheDocument();
  });
});

// ===========================================================================
// With escalations
// ===========================================================================

describe("with escalations", () => {
  it("shows escalation count", () => {
    useEmailStore.setState({
      escalations: [
        makeEscalation({ email_id: "e1" }),
        makeEscalation({ email_id: "e2" }),
      ],
    });
    render(<EscalationView />);
    expect(screen.getByText("2 Warnungen aktiv")).toBeInTheDocument();
  });

  it("shows singular for 1 escalation", () => {
    useEmailStore.setState({
      escalations: [makeEscalation({ email_id: "e1" })],
    });
    render(<EscalationView />);
    expect(screen.getByText("1 Warnung aktiv")).toBeInTheDocument();
  });

  it("sorts legal_threat first", () => {
    useEmailStore.setState({
      escalations: [
        makeEscalation({
          email_id: "e-normal",
          legal_threat: false,
          subject: "Normal Issue",
        }),
        makeEscalation({
          email_id: "e-legal",
          legal_threat: true,
          subject: "Legal Threat",
        }),
      ],
    });
    const { container } = render(<EscalationView />);
    // CardTitle renders the subject text — check DOM order
    const html = container.innerHTML;
    const legalIndex = html.indexOf("Legal Threat");
    const normalIndex = html.indexOf("Normal Issue");
    expect(legalIndex).toBeLessThan(normalIndex);
  });
});

// ===========================================================================
// Acknowledge
// ===========================================================================

describe("acknowledge", () => {
  it("disables acknowledge button after click", async () => {
    useEmailStore.setState({
      escalations: [makeEscalation({ email_id: "e1" })],
    });
    render(<EscalationView />);
    const user = userEvent.setup();

    const acknowledgeBtn = screen.getByRole("button", { name: "Bestätigen" });
    await user.click(acknowledgeBtn);

    // After acknowledge, button text changes to "Bestätigt" and is disabled
    const confirmedBtn = screen.getByRole("button", { name: "Bestätigt" });
    expect(confirmedBtn).toBeDisabled();
  });

  it("emits audit event on acknowledge", async () => {
    const { emitAuditEvent } = await import("@/lib/api/audit");
    useEmailStore.setState({
      escalations: [makeEscalation({ email_id: "e1" })],
    });
    render(<EscalationView />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "escalation_acknowledged",
        email_id: "e1",
      }),
    );
  });

  it("shows dismiss button after acknowledge", async () => {
    useEmailStore.setState({
      escalations: [makeEscalation({ email_id: "e1" })],
    });
    render(<EscalationView />);
    const user = userEvent.setup();

    // Before acknowledge, no dismiss button
    expect(
      screen.queryByRole("button", { name: /entfernen/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    // After acknowledge, dismiss button appears
    expect(
      screen.getByRole("button", { name: /entfernen/i }),
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// Assign
// ===========================================================================

describe("assign", () => {
  it("shows assign options on click", async () => {
    useEmailStore.setState({
      escalations: [makeEscalation({ email_id: "e1" })],
    });
    render(<EscalationView />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /zuweisen/i }));

    expect(screen.getByText("Teamleitung")).toBeInTheDocument();
    expect(screen.getByText("Rechtsabteilung")).toBeInTheDocument();
    expect(screen.getByText("Kundenbetreuer")).toBeInTheDocument();
    expect(screen.getByText("Geschäftsführung")).toBeInTheDocument();
  });

  it("shows assigned badge after selection", async () => {
    const { emitAuditEvent } = await import("@/lib/api/audit");
    useEmailStore.setState({
      escalations: [makeEscalation({ email_id: "e1" })],
    });
    render(<EscalationView />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /zuweisen/i }));
    await user.click(screen.getByText("Rechtsabteilung"));

    expect(
      screen.getByText(/zugewiesen: rechtsabteilung/i),
    ).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "escalation_assigned",
          email_id: "e1",
          context: { assigned_to: "Rechtsabteilung" },
        }),
      );
    });
  });
});

// ===========================================================================
// Dismiss
// ===========================================================================

describe("dismiss", () => {
  it("removes escalation from store", async () => {
    const { emitAuditEvent } = await import("@/lib/api/audit");
    useEmailStore.setState({
      escalations: [makeEscalation({ email_id: "e1" })],
    });
    render(<EscalationView />);
    const user = userEvent.setup();

    // First acknowledge
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    // Then dismiss
    await user.click(screen.getByRole("button", { name: /entfernen/i }));

    await vi.waitFor(() => {
      expect(useEmailStore.getState().escalations).toHaveLength(0);
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "escalation_dismissed",
        email_id: "e1",
      }),
    );
  });
});
