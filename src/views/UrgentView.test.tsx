import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UrgentView } from "./UrgentView";
import { useEmailStore } from "@/lib/store/email-store";

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

describe("UrgentView", () => {
  it('renders with "Dringend" title', () => {
    render(<UrgentView />);
    expect(screen.getByText("Dringend")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<UrgentView />);
    expect(
      screen.getByText("Keine E-Mails zur Prüfung vorhanden"),
    ).toBeInTheDocument();
  });
});
