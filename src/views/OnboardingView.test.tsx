import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OnboardingView } from "./OnboardingView";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <OnboardingView />
    </MemoryRouter>,
  );
}

describe("OnboardingView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders step 1 (connection) by default", () => {
    renderWithRouter();
    expect(
      screen.getByText("Schritt 1 von 3 — Verbindung"),
    ).toBeInTheDocument();
    expect(screen.getByText("IMAP-Verbindung einrichten")).toBeInTheDocument();
  });

  it("renders IMAP form fields", () => {
    renderWithRouter();
    expect(screen.getByLabelText("IMAP-Host")).toBeInTheDocument();
    expect(screen.getByLabelText("Port")).toBeInTheDocument();
    expect(screen.getByLabelText("Benutzername / E-Mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
  });

  it("disables test button when form is empty", () => {
    renderWithRouter();
    const button = screen.getByRole("button", { name: /Verbindung testen/i });
    expect(button).toBeDisabled();
  });

  it("enables test button when required fields are filled", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(screen.getByLabelText("IMAP-Host"), "imap.example.com");
    await user.type(
      screen.getByLabelText("Benutzername / E-Mail"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");

    const button = screen.getByRole("button", { name: /Verbindung testen/i });
    expect(button).not.toBeDisabled();
  });

  it("shows error when test-connection fetch fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    renderWithRouter();

    await user.type(screen.getByLabelText("IMAP-Host"), "imap.example.com");
    await user.type(
      screen.getByLabelText("Benutzername / E-Mail"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    expect(await screen.findByText(/Netzwerkfehler/)).toBeInTheDocument();
  });

  it("shows success and Weiter button on successful connection test", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, folder: "Sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRouter();

    await user.type(screen.getByLabelText("IMAP-Host"), "imap.example.com");
    await user.type(
      screen.getByLabelText("Benutzername / E-Mail"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    expect(
      await screen.findByText(/Verbindung erfolgreich/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Gesendet-Ordner: Sent/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });

  it("transitions to step 2 (analysis) after clicking Weiter", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, folder: "Sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRouter();

    await user.type(screen.getByLabelText("IMAP-Host"), "imap.example.com");
    await user.type(
      screen.getByLabelText("Benutzername / E-Mail"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    await screen.findByText(/Verbindung erfolgreich/);
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(screen.getByText("Schritt 2 von 3 — Analyse")).toBeInTheDocument();
    expect(screen.getByText("Tonprofil-Analyse")).toBeInTheDocument();
  });

  it("shows API error message from test-connection", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, error: "Invalid credentials" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderWithRouter();

    await user.type(screen.getByLabelText("IMAP-Host"), "imap.example.com");
    await user.type(
      screen.getByLabelText("Benutzername / E-Mail"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("Passwort"), "secret");
    await user.click(
      screen.getByRole("button", { name: /Verbindung testen/i }),
    );

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });
});
