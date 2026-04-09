import { describe, it, expect, vi } from "vitest";
import {
  stripQuotedReplies,
  stripSignature,
  stripHtml,
  cleanEmailBody,
  detectSentFolder,
  extractSignature,
  normalizeSubject,
  filterSelfSent,
  deduplicateBySubject,
  deduplicateByRecipient,
} from "./imap-scan.ts";
import type { ImapConfig } from "./imap-scan.ts";

// ===========================================================================
// stripQuotedReplies
// ===========================================================================

describe("stripQuotedReplies", () => {
  it('removes lines starting with ">"', () => {
    const input = "Hello\n\n> This is quoted\n> Another line\n\nMy reply";
    expect(stripQuotedReplies(input)).toBe("Hello\n\n\nMy reply");
  });

  it('strips everything after "On ... wrote:"', () => {
    const input =
      "Thanks for your email.\n\nOn Mon, Jan 1, 2026, John wrote:\n> Original text";
    expect(stripQuotedReplies(input)).toBe("Thanks for your email.");
  });

  it('strips everything after "Am ... schrieb:" (German)', () => {
    const input = "Vielen Dank.\n\nAm 01.01.2026 schrieb Max:\n> Originaltext";
    expect(stripQuotedReplies(input)).toBe("Vielen Dank.");
  });

  it("handles text with no quotes", () => {
    const input = "Just a plain email.\nWith multiple lines.";
    expect(stripQuotedReplies(input)).toBe(
      "Just a plain email.\nWith multiple lines.",
    );
  });

  it("handles empty string", () => {
    expect(stripQuotedReplies("")).toBe("");
  });

  it("handles indented quote markers", () => {
    const input = "Reply\n  > Quoted line\nMore reply";
    expect(stripQuotedReplies(input)).toBe("Reply\nMore reply");
  });
});

// ===========================================================================
// stripSignature
// ===========================================================================

describe("stripSignature", () => {
  it('strips standard RFC 3676 signature "-- "', () => {
    const input = "Email body here.\n\n-- \nJohn Doe\nCEO, Company";
    expect(stripSignature(input)).toBe("Email body here.");
  });

  it('strips signature with "--" (no trailing space)', () => {
    const input = "Email body.\n\n--\nSignature line";
    expect(stripSignature(input)).toBe("Email body.");
  });

  it("returns full text when no signature delimiter found", () => {
    const input = "No signature here.\nJust text.";
    expect(stripSignature(input)).toBe("No signature here.\nJust text.");
  });

  it("handles empty string", () => {
    expect(stripSignature("")).toBe("");
  });

  it("uses the last occurrence of the delimiter", () => {
    const input = "Line 1\n--\nMid content\n-- \nActual Sig";
    expect(stripSignature(input)).toBe("Line 1\n--\nMid content");
  });
});

// ===========================================================================
// extractSignature
// ===========================================================================

describe("extractSignature", () => {
  it('extracts signature after "-- " delimiter', () => {
    const input = "Email body here.\n\n-- \nJohn Doe\nCEO, Company";
    expect(extractSignature(input)).toBe("John Doe\nCEO, Company");
  });

  it('extracts signature after "--" delimiter', () => {
    const input = "Email body.\n\n--\nSignature line";
    expect(extractSignature(input)).toBe("Signature line");
  });

  it("returns null when no signature delimiter found", () => {
    expect(extractSignature("No signature here.\nJust text.")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractSignature("")).toBeNull();
  });

  it("returns null when delimiter exists but no content after it", () => {
    expect(extractSignature("Body text\n-- \n")).toBeNull();
  });

  it("uses the last occurrence of the delimiter", () => {
    const input = "Line 1\n--\nMid content\n-- \nActual Sig";
    expect(extractSignature(input)).toBe("Actual Sig");
  });
});

// ===========================================================================
// normalizeSubject
// ===========================================================================

describe("normalizeSubject", () => {
  it('strips "Re:" prefix', () => {
    expect(normalizeSubject("Re: Hello")).toBe("Hello");
  });

  it('strips "Fwd:" prefix', () => {
    expect(normalizeSubject("Fwd: Hello")).toBe("Hello");
  });

  it('strips "AW:" prefix (German reply)', () => {
    expect(normalizeSubject("AW: Hello")).toBe("Hello");
  });

  it('strips "WG:" prefix (German forward)', () => {
    expect(normalizeSubject("WG: Hello")).toBe("Hello");
  });

  it("strips multiple nested prefixes", () => {
    expect(normalizeSubject("Re: Fwd: AW: Hello")).toBe("Hello");
  });

  it("is case-insensitive", () => {
    expect(normalizeSubject("RE: FWD: Hello")).toBe("Hello");
    expect(normalizeSubject("re: fwd: Hello")).toBe("Hello");
  });

  it("returns original when no prefix", () => {
    expect(normalizeSubject("Hello World")).toBe("Hello World");
  });

  it("handles empty string", () => {
    expect(normalizeSubject("")).toBe("");
  });

  it("handles extra whitespace around colons", () => {
    expect(normalizeSubject("Re :  Hello")).toBe("Hello");
  });
});

// ===========================================================================
// filterSelfSent
// ===========================================================================

describe("filterSelfSent", () => {
  const emails = [
    {
      subject: "Test 1",
      toAddresses: ["other@example.com"],
      ccAddresses: [] as string[],
    },
    {
      subject: "Test 2",
      toAddresses: ["me@example.com"],
      ccAddresses: [] as string[],
    },
    {
      subject: "Test 3",
      toAddresses: ["other@example.com", "me@example.com"],
      ccAddresses: [] as string[],
    },
    {
      subject: "Test 4",
      toAddresses: ["someone@example.com"],
      ccAddresses: [] as string[],
    },
  ];

  it("removes emails sent to own address", () => {
    const result = filterSelfSent(emails, "me@example.com");
    expect(result).toHaveLength(2);
    expect(result[0].subject).toBe("Test 1");
    expect(result[1].subject).toBe("Test 4");
  });

  it("is case-insensitive", () => {
    const result = filterSelfSent(emails, "ME@EXAMPLE.COM");
    expect(result).toHaveLength(2);
  });

  it("returns all emails when none are self-sent", () => {
    const result = filterSelfSent(emails, "nobody@example.com");
    expect(result).toHaveLength(4);
  });

  it("handles empty list", () => {
    expect(filterSelfSent([], "me@example.com")).toHaveLength(0);
  });

  it("removes emails where own address is in CC", () => {
    const withCc = [
      {
        subject: "A",
        toAddresses: ["other@example.com"],
        ccAddresses: ["me@example.com"],
      },
      {
        subject: "B",
        toAddresses: ["other@example.com"],
        ccAddresses: ["someone@example.com"],
      },
    ];
    const result = filterSelfSent(withCc, "me@example.com");
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("B");
  });
});

// ===========================================================================
// deduplicateBySubject
// ===========================================================================

describe("deduplicateBySubject", () => {
  it("keeps first occurrence per normalized subject", () => {
    const emails = [
      {
        subject: "Re: Hello",
        toAddresses: ["a@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "Hello",
        toAddresses: ["b@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "Fwd: Hello",
        toAddresses: ["c@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "Different",
        toAddresses: ["d@x.com"],
        ccAddresses: [] as string[],
      },
    ];
    const result = deduplicateBySubject(emails);
    expect(result).toHaveLength(2);
    expect(result[0].subject).toBe("Re: Hello");
    expect(result[1].subject).toBe("Different");
  });

  it("is case-insensitive for dedup", () => {
    const emails = [
      {
        subject: "HELLO",
        toAddresses: ["a@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "hello",
        toAddresses: ["b@x.com"],
        ccAddresses: [] as string[],
      },
    ];
    expect(deduplicateBySubject(emails)).toHaveLength(1);
  });

  it("handles empty list", () => {
    expect(deduplicateBySubject([])).toHaveLength(0);
  });

  it("keeps all when subjects are unique", () => {
    const emails = [
      { subject: "A", toAddresses: ["a@x.com"], ccAddresses: [] as string[] },
      { subject: "B", toAddresses: ["b@x.com"], ccAddresses: [] as string[] },
      { subject: "C", toAddresses: ["c@x.com"], ccAddresses: [] as string[] },
    ];
    expect(deduplicateBySubject(emails)).toHaveLength(3);
  });
});

// ===========================================================================
// deduplicateByRecipient
// ===========================================================================

describe("deduplicateByRecipient", () => {
  it("limits emails per recipient", () => {
    const emails = [
      {
        subject: "E1",
        toAddresses: ["bob@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "E2",
        toAddresses: ["bob@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "E3",
        toAddresses: ["bob@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "E4",
        toAddresses: ["alice@x.com"],
        ccAddresses: [] as string[],
      },
    ];
    const result = deduplicateByRecipient(emails, 2);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.subject)).toEqual(["E1", "E2", "E4"]);
  });

  it("skips when any recipient is at limit", () => {
    const emails = [
      {
        subject: "E1",
        toAddresses: ["bob@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "E2",
        toAddresses: ["bob@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "E3",
        toAddresses: ["bob@x.com", "alice@x.com"],
        ccAddresses: [] as string[],
      },
    ];
    const result = deduplicateByRecipient(emails, 2);
    expect(result).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    const emails = [
      {
        subject: "E1",
        toAddresses: ["BOB@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "E2",
        toAddresses: ["bob@x.com"],
        ccAddresses: [] as string[],
      },
      {
        subject: "E3",
        toAddresses: ["Bob@X.COM"],
        ccAddresses: [] as string[],
      },
    ];
    const result = deduplicateByRecipient(emails, 2);
    expect(result).toHaveLength(2);
  });

  it("handles empty list", () => {
    expect(deduplicateByRecipient([], 2)).toHaveLength(0);
  });

  it("handles emails with multiple recipients under limit", () => {
    const emails = [
      {
        subject: "E1",
        toAddresses: ["a@x.com", "b@x.com"],
        ccAddresses: [] as string[],
      },
      { subject: "E2", toAddresses: ["a@x.com"], ccAddresses: [] as string[] },
      { subject: "E3", toAddresses: ["b@x.com"], ccAddresses: [] as string[] },
      { subject: "E4", toAddresses: ["c@x.com"], ccAddresses: [] as string[] },
    ];
    const result = deduplicateByRecipient(emails, 2);
    expect(result).toHaveLength(4);
  });
});

// ===========================================================================
// stripHtml
// ===========================================================================

describe("stripHtml", () => {
  it("strips HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toContain("Hello world");
  });

  it("converts <br> to newlines", () => {
    expect(stripHtml("Line 1<br>Line 2")).toBe("Line 1\nLine 2");
  });

  it("converts </p> to double newlines", () => {
    expect(stripHtml("<p>Para 1</p><p>Para 2</p>")).toContain(
      "Para 1\n\nPara 2",
    );
  });

  it("decodes &amp; entity", () => {
    expect(stripHtml("A &amp; B")).toBe("A & B");
  });

  it("decodes &lt; and &gt; entities", () => {
    expect(stripHtml("&lt;tag&gt;")).toBe("<tag>");
  });

  it("decodes &quot; entity", () => {
    expect(stripHtml("Say &quot;hello&quot;")).toBe('Say "hello"');
  });

  it("decodes &nbsp; entity", () => {
    expect(stripHtml("word&nbsp;word")).toBe("word word");
  });

  it("handles plain text without HTML", () => {
    expect(stripHtml("Just plain text")).toBe("Just plain text");
  });
});

// ===========================================================================
// cleanEmailBody
// ===========================================================================

describe("cleanEmailBody", () => {
  it("applies full cleaning pipeline", () => {
    const raw = "<p>Hello world.</p>\n\n> Quoted line\n\n-- \nSig";
    const result = cleanEmailBody(raw);
    expect(result).toBe("Hello world.");
  });

  it("truncates to 5000 characters", () => {
    const raw = "x".repeat(6000);
    expect(cleanEmailBody(raw).length).toBe(5000);
  });

  it("collapses multiple blank lines", () => {
    const raw = "Line 1\n\n\n\n\nLine 2";
    expect(cleanEmailBody(raw)).toBe("Line 1\n\nLine 2");
  });

  it("handles empty input", () => {
    expect(cleanEmailBody("")).toBe("");
  });

  it("strips HTML before processing quotes", () => {
    const raw = "<p>My reply.</p><br><blockquote>> Old text</blockquote>";
    const result = cleanEmailBody(raw);
    expect(result).not.toContain("Old text");
  });
});

// ===========================================================================
// detectSentFolder (mocked ImapFlow)
// ===========================================================================

describe("detectSentFolder", () => {
  function makeMailbox(path: string, specialUse?: string) {
    return { path, specialUse, name: path, flags: new Set<string>() };
  }

  it("finds folder by \\Sent special-use flag", async () => {
    const mockClient = {
      list: vi
        .fn()
        .mockResolvedValue([
          makeMailbox("INBOX"),
          makeMailbox("Sent Mail", "\\Sent"),
          makeMailbox("Trash", "\\Trash"),
        ]),
    };
    const result = await detectSentFolder(mockClient as never);
    expect(result).toBe("Sent Mail");
  });

  it('falls back to name matching for "Sent"', async () => {
    const mockClient = {
      list: vi
        .fn()
        .mockResolvedValue([
          makeMailbox("INBOX"),
          makeMailbox("Sent"),
          makeMailbox("Trash"),
        ]),
    };
    const result = await detectSentFolder(mockClient as never);
    expect(result).toBe("Sent");
  });

  it('matches "Gesendet" (German)', async () => {
    const mockClient = {
      list: vi
        .fn()
        .mockResolvedValue([makeMailbox("INBOX"), makeMailbox("Gesendet")]),
    };
    const result = await detectSentFolder(mockClient as never);
    expect(result).toBe("Gesendet");
  });

  it('matches "Sent Items" (Outlook)', async () => {
    const mockClient = {
      list: vi
        .fn()
        .mockResolvedValue([makeMailbox("INBOX"), makeMailbox("Sent Items")]),
    };
    const result = await detectSentFolder(mockClient as never);
    expect(result).toBe("Sent Items");
  });

  it("matches case-insensitively", async () => {
    const mockClient = {
      list: vi
        .fn()
        .mockResolvedValue([makeMailbox("INBOX"), makeMailbox("SENT")]),
    };
    const result = await detectSentFolder(mockClient as never);
    expect(result).toBe("SENT");
  });

  it("returns null when no Sent folder found", async () => {
    const mockClient = {
      list: vi
        .fn()
        .mockResolvedValue([makeMailbox("INBOX"), makeMailbox("Drafts")]),
    };
    const result = await detectSentFolder(mockClient as never);
    expect(result).toBeNull();
  });

  it("prefers special-use over name matching", async () => {
    const mockClient = {
      list: vi
        .fn()
        .mockResolvedValue([
          makeMailbox("Sent"),
          makeMailbox("Versendete Objekte", "\\Sent"),
        ]),
    };
    const result = await detectSentFolder(mockClient as never);
    expect(result).toBe("Versendete Objekte");
  });
});

// ===========================================================================
// scanSentEmails (mocked ImapFlow)
// ===========================================================================

let mockImapInstance: Record<string, ReturnType<typeof vi.fn>>;

vi.mock("imapflow", () => {
  return {
    ImapFlow: class MockImapFlow {
      constructor() {
        Object.assign(this, mockImapInstance);
      }
    },
  };
});

// ===========================================================================
// testImapConnection (mocked ImapFlow)
// ===========================================================================

describe("testImapConnection", () => {
  const defaultConfig: ImapConfig = {
    host: "imap.example.com",
    port: 993,
    user: "test@example.com",
    password: "secret",
    tls: true,
  };

  async function getTestFn() {
    const mod = await import("./imap-scan.ts");
    return mod.testImapConnection;
  }

  it("returns success with folder name when Sent folder is found", async () => {
    mockImapInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX", name: "INBOX", flags: new Set() },
        { path: "Sent", name: "Sent", flags: new Set(), specialUse: "\\Sent" },
      ]),
      logout: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    const testConnection = await getTestFn();
    const result = await testConnection(defaultConfig);
    expect(result).toEqual({ success: true, folder: "Sent" });
  });

  it("returns failure when no Sent folder exists", async () => {
    mockImapInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX", name: "INBOX", flags: new Set() },
        { path: "Drafts", name: "Drafts", flags: new Set() },
      ]),
      logout: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    const testConnection = await getTestFn();
    const result = await testConnection(defaultConfig);
    expect(result).toEqual({
      success: false,
      error: "Could not find Sent folder on this IMAP account",
    });
  });

  it("returns failure on connection error", async () => {
    mockImapInstance = {
      connect: vi.fn().mockRejectedValue(new Error("Connection refused")),
      logout: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    const testConnection = await getTestFn();
    const result = await testConnection(defaultConfig);
    expect(result).toEqual({
      success: false,
      error: "Connection test failed — Connection refused",
    });
  });

  it("returns failure on authentication error", async () => {
    mockImapInstance = {
      connect: vi.fn().mockRejectedValue(new Error("Invalid credentials")),
      logout: vi.fn().mockRejectedValue(new Error("not connected")),
      close: vi.fn(),
    };

    const testConnection = await getTestFn();
    const result = await testConnection(defaultConfig);
    expect(result).toEqual({
      success: false,
      error: "Connection test failed — Invalid credentials",
    });
    expect(mockImapInstance.close).toHaveBeenCalled();
  });
});

describe("scanSentEmails", () => {
  const defaultConfig: ImapConfig = {
    host: "imap.example.com",
    port: 993,
    user: "test@example.com",
    password: "secret",
    tls: true,
  };

  function createMockMessage(
    uid: number,
    subject: string,
    date: string,
    toAddress?: string,
  ) {
    return {
      uid,
      seq: uid,
      envelope: {
        subject,
        date: new Date(date),
        to: [
          { name: "", address: toAddress ?? `recipient-${uid}@example.com` },
        ],
        cc: [],
      },
    };
  }

  // Dynamic import so the mock is applied. Module is cached after first import.
  async function getScanFn() {
    const mod = await import("./imap-scan.ts");
    return mod.scanSentEmails;
  }

  it("throws when Sent folder is not found", async () => {
    mockImapInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      list: vi
        .fn()
        .mockResolvedValue([
          { path: "INBOX", name: "INBOX", flags: new Set() },
        ]),
      logout: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    const scan = await getScanFn();
    await expect(scan(defaultConfig)).rejects.toThrow(
      "Could not find Sent folder",
    );
  });

  it("returns emails sorted by UID descending with scan result shape", async () => {
    const messages = Array.from({ length: 7 }, (_, i) =>
      createMockMessage(
        i + 1,
        `Email ${i + 1}`,
        `2026-01-0${Math.min(i + 1, 9)}T10:00:00Z`,
      ),
    );

    const mockRelease = vi.fn();
    const { Readable } = await import("node:stream");

    const uids = Array.from({ length: 7 }, (_, i) => i + 1);

    mockImapInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        {
          path: "Sent",
          name: "Sent",
          flags: new Set(),
          specialUse: "\\Sent",
        },
      ]),
      getMailboxLock: vi
        .fn()
        .mockResolvedValue({ path: "Sent", release: mockRelease }),
      mailbox: { exists: 7 },
      search: vi.fn().mockResolvedValue(uids),
      fetchAll: vi.fn().mockResolvedValue(messages),
      download: vi.fn().mockImplementation(() => {
        const stream = Readable.from([
          Buffer.from("Subject: Test\r\n\r\nEmail body text here"),
        ]);
        return Promise.resolve({
          content: stream,
          meta: { expectedSize: 100 },
        });
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    const scan = await getScanFn();
    const result = await scan(defaultConfig);

    expect(result.emails).toHaveLength(7);
    expect(result.emails[0].subject).toBe("Email 7");
    expect(result.emails[6].subject).toBe("Email 1");
    expect(result.detectedSignature).toBeNull();
    expect(mockRelease).toHaveBeenCalled();
  });

  it("closes connection on error", async () => {
    const mockLogout = vi.fn().mockRejectedValue(new Error("already closed"));
    const mockClose = vi.fn();

    mockImapInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockRejectedValue(new Error("IMAP error")),
      logout: mockLogout,
      close: mockClose,
    };

    const scan = await getScanFn();
    await expect(scan(defaultConfig)).rejects.toThrow("IMAP error");
    expect(mockClose).toHaveBeenCalled();
  });

  it("handles connection timeout", async () => {
    mockImapInstance = {
      connect: vi.fn().mockRejectedValue(new Error("Connection timeout")),
      logout: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    const scan = await getScanFn();
    await expect(scan(defaultConfig)).rejects.toThrow("Connection timeout");
  });
});
