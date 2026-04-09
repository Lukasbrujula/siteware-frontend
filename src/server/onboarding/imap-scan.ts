import { ImapFlow } from "imapflow";
import type { Readable } from "node:stream";

export type ImapConfig = {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly tls: boolean;
};

export type ScannedEmail = {
  readonly subject: string;
  readonly body: string;
  readonly date: string;
};

export type ScanDebug = {
  readonly folderMessageCount: number;
  readonly searchUids: number;
  readonly envelopesFetched: number;
  readonly afterForwarded: number;
  readonly afterSelfSent: number;
  readonly afterSubjectDedup: number;
  readonly afterRecipientDedup: number;
  readonly sampleEnvelopes: readonly {
    readonly subject: string;
    readonly to: readonly string[];
    readonly cc: readonly string[];
  }[];
};

export type ScanResult = {
  readonly emails: readonly ScannedEmail[];
  readonly detectedSignature: string | null;
  readonly _debug?: ScanDebug;
};

export type FilterableEmail = {
  readonly subject: string;
  readonly toAddresses: readonly string[];
  readonly ccAddresses: readonly string[];
};

const SENT_FOLDER_CANDIDATES = [
  "[Gmail]/Sent Mail",
  "Sent",
  "Sent Items",
  "Sent Messages",
  "Gesendet",
  "INBOX.Sent",
  "INBOX.Sent Items",
  "INBOX.Gesendet",
  "[Gmail]/Gesendet",
] as const;

const INITIAL_FETCH_LIMIT = 100;
const FINAL_CAP = 10;
const INITIAL_LOOKBACK_DAYS = 30;
const EXTENDED_LOOKBACK_DAYS = 365;
const MIN_DIVERSE_EMAILS = 5;
const MAX_PER_RECIPIENT = 2;
const CONNECTION_TIMEOUT_MS = 30_000;
const MAX_BODY_LENGTH = 5_000;

/**
 * Detects the Sent folder path on the given IMAP account.
 *
 * Strategy:
 * 1. Check for \Sent special-use flag (RFC 6154) — most reliable.
 * 2. Fall back to matching known folder name candidates.
 */
export async function detectSentFolder(
  client: ImapFlow,
): Promise<string | null> {
  const mailboxes = await client.list();
  const allPaths = mailboxes.map((b) => b.path);
  console.log("[imap-scan] Available mailboxes:", allPaths);

  // Strategy 1: special-use flag (RFC 6154)
  for (const box of mailboxes) {
    if (box.specialUse === "\\Sent") {
      console.log(
        `[imap-scan] Detected Sent folder via \\Sent flag: "${box.path}"`,
      );
      return box.path;
    }
  }

  // Strategy 2: name matching (case-insensitive)
  const pathSet = new Map(mailboxes.map((b) => [b.path.toLowerCase(), b.path]));
  for (const candidate of SENT_FOLDER_CANDIDATES) {
    const match = pathSet.get(candidate.toLowerCase());
    if (match) {
      console.log(
        `[imap-scan] Detected Sent folder via name match: "${match}" (candidate: "${candidate}")`,
      );
      return match;
    }
  }

  console.log("[imap-scan] Could not detect Sent folder. Available:", allPaths);
  return null;
}

/**
 * Strip quoted reply blocks.
 *
 * Removes lines that start with ">" (standard quoting) and common
 * "On ... wrote:" / "Am ... schrieb:" markers along with everything after.
 */
export function stripQuotedReplies(text: string): string {
  // First, cut at "On ... wrote:" / "Am ... schrieb:" markers
  const markerIndex = text.search(/^(On .+ wrote:|Am .+ schrieb\b.*:)/im);
  const beforeMarker = markerIndex === -1 ? text : text.slice(0, markerIndex);

  // Then remove individual quoted lines
  const lines = beforeMarker.split("\n");
  const result = lines.filter((line) => !/^\s*>/.test(line));

  return result.join("\n").trim();
}

/**
 * Strip email signature blocks.
 *
 * Detects "-- " (RFC 3676 sig separator) or common German patterns.
 */
export function stripSignature(text: string): string {
  const lines = text.split("\n");

  // Search from the end for the signature delimiter
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trimEnd();
    if (trimmed === "--" || trimmed === "-- ") {
      return lines.slice(0, i).join("\n").trim();
    }
  }

  return text.trim();
}

/**
 * Extract the signature block from an email body.
 *
 * Does the opposite of stripSignature() — returns the content
 * after the last "-- " / "--" delimiter, or null if no signature found.
 */
export function extractSignature(text: string): string | null {
  const lines = text.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trimEnd();
    if (trimmed === "--" || trimmed === "-- ") {
      const sig = lines
        .slice(i + 1)
        .join("\n")
        .trim();
      return sig.length > 0 ? sig : null;
    }
  }

  return null;
}

/**
 * Normalize an email subject by stripping Re:/Fwd:/AW:/WG: prefixes.
 */
export function normalizeSubject(subject: string): string {
  return subject.replace(/^(\s*(Re|Fwd|AW|WG)\s*:\s*)+/i, "").trim();
}

/**
 * Detect whether an email subject indicates a forwarded message.
 *
 * Forwarded emails live in the Sent folder but the body was written
 * by someone else — they must not be used for tone analysis.
 */
const FORWARDED_PREFIX = /^\s*(Fwd|WG|Wg)\s*:/i;

export function isForwarded(subject: string): boolean {
  return FORWARDED_PREFIX.test(subject);
}

/**
 * Remove forwarded emails from the sample.
 * Forwards are in the Sent folder but their body is not the user's writing.
 */
export function filterForwarded<T extends FilterableEmail>(
  emails: readonly T[],
): readonly T[] {
  return emails.filter((e) => !isForwarded(e.subject));
}

/**
 * Remove emails where the user is the ONLY recipient (notes-to-self).
 *
 * Previous version dropped any email where the user appeared in To/CC,
 * which incorrectly filtered Reply-All threads where Gmail keeps the
 * sender's own address in the CC list.
 */
export function filterSelfSent<T extends FilterableEmail>(
  emails: readonly T[],
  userEmail: string,
): readonly T[] {
  const normalized = userEmail.toLowerCase();
  return emails.filter((e) => {
    const allRecipients = [...e.toAddresses, ...e.ccAddresses];
    // No recipient data available — keep the email (not provably self-sent)
    if (allRecipients.length === 0) return true;
    const others = allRecipients.filter(
      (addr) => addr.toLowerCase() !== normalized,
    );
    // Drop only if the user is the sole recipient (note-to-self)
    return others.length > 0;
  });
}

/**
 * Keep only the first (most recent) email per unique normalized subject.
 * Prevents one long thread from consuming all slots.
 */
export function deduplicateBySubject<T extends FilterableEmail>(
  emails: readonly T[],
): readonly T[] {
  const seen = new Set<string>();
  return emails.filter((e) => {
    const key = normalizeSubject(e.subject).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Limit to maxPerRecipient emails per unique recipient address.
 * Ensures variety in tone across different contacts.
 */
export function deduplicateByRecipient<T extends FilterableEmail>(
  emails: readonly T[],
  maxPerRecipient: number,
): readonly T[] {
  const counts = new Map<string, number>();
  return emails.filter((e) => {
    const recipients = e.toAddresses.map((a) => a.toLowerCase());
    if (recipients.some((r) => (counts.get(r) ?? 0) >= maxPerRecipient))
      return false;
    for (const r of recipients) {
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    return true;
  });
}

/**
 * Strip HTML tags and decode basic HTML entities.
 */
export function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Full cleaning pipeline: strip HTML → strip quotes → strip signature → truncate.
 */
export function cleanEmailBody(raw: string): string {
  const noHtml = stripHtml(raw);
  const noQuotes = stripQuotedReplies(noHtml);
  const noSig = stripSignature(noQuotes);
  const trimmed = noSig.replace(/\n{3,}/g, "\n\n").trim();

  if (trimmed.length > MAX_BODY_LENGTH) {
    return trimmed.slice(0, MAX_BODY_LENGTH);
  }

  return trimmed;
}

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Connect to an IMAP account, find the Sent folder, and fetch
 * diverse representative emails for tone analysis.
 *
 * Applies three diversity filters (self-sent, subject dedup, recipient dedup)
 * to avoid one thread or one recipient dominating the sample.
 *
 * Credentials are used only for this scan and are NOT stored.
 */
export async function scanSentEmails(config: ImapConfig): Promise<ScanResult> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
  });

  try {
    await client.connect();

    const sentFolder = await detectSentFolder(client);
    if (!sentFolder) {
      throw new Error("Could not find Sent folder on this IMAP account");
    }

    console.log(`[imap-scan] Opening Sent folder: "${sentFolder}"`);
    const lock = await client.getMailboxLock(sentFolder);

    try {
      console.log(
        `[imap-scan] Mailbox status: ${client.mailbox?.exists ?? "unknown"} messages in folder`,
      );

      const folderMessageCount = client.mailbox?.exists ?? 0;

      // First pass: 30 days
      let pass = await searchAndFilter(
        client,
        config.user,
        INITIAL_LOOKBACK_DAYS,
      );

      // Expand to 365 days if too few diverse emails
      if (pass.results.length < MIN_DIVERSE_EMAILS) {
        console.log(
          `[imap-scan] Only ${pass.results.length} diverse emails found, expanding to ${EXTENDED_LOOKBACK_DAYS} days`,
        );
        pass = await searchAndFilter(
          client,
          config.user,
          EXTENDED_LOOKBACK_DAYS,
        );
      }

      const debugInfo: ScanDebug = {
        folderMessageCount:
          typeof folderMessageCount === "number" ? folderMessageCount : 0,
        ...pass.debug,
      };

      // Cap at FINAL_CAP
      const selected = pass.results.slice(0, FINAL_CAP);

      // Download bodies only for selected emails
      const emails: ScannedEmail[] = [];
      let detectedSignature: string | null = null;

      for (const info of selected) {
        let body = "";
        try {
          const download = await client.download(String(info.uid), undefined, {
            uid: true,
          });
          const raw = await streamToString(download.content);
          body = extractPlainText(raw);

          if (detectedSignature === null) {
            const noHtml = stripHtml(body);
            const noQuotes = stripQuotedReplies(noHtml);
            detectedSignature = extractSignature(noQuotes);
          }
        } catch (downloadErr) {
          console.error(
            `Failed to download body for UID ${info.uid}:`,
            downloadErr,
          );
          body = info.subject;
        }

        emails.push({
          subject: info.subject,
          body: cleanEmailBody(body),
          date: info.date,
        });
      }

      return { emails, detectedSignature, _debug: debugInfo };
    } finally {
      lock.release();
    }
  } catch (err) {
    const wrapped = new Error(formatImapError("IMAP scan failed", err));
    (wrapped as unknown as Record<string, unknown>).cause = err;
    throw wrapped;
  } finally {
    try {
      await client.logout();
    } catch (logoutErr) {
      console.error("IMAP logout failed:", logoutErr);
      client.close();
    }
  }
}

type EnvelopeInfo = FilterableEmail & {
  readonly uid: number;
  readonly date: string;
};

type FilterDebug = Omit<ScanDebug, "folderMessageCount">;

async function searchAndFilter(
  client: ImapFlow,
  userEmail: string,
  lookbackDays: number,
): Promise<{
  readonly results: readonly EnvelopeInfo[];
  readonly debug: FilterDebug;
}> {
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  console.log(
    `[imap-scan] SINCE date: ${since.toISOString().split("T")[0]} (${lookbackDays} days)`,
  );

  const sinceUids = await client.search({ since }, { uid: true });
  console.log(`[imap-scan] SINCE search returned ${sinceUids.length} UIDs`);

  let effectiveUids: number[];

  // Gmail IMAP SEARCH SINCE is unreliable — it can return far fewer
  // results than expected. Fall back to ALL when SINCE returns too few.
  if (sinceUids.length >= INITIAL_FETCH_LIMIT) {
    effectiveUids = sinceUids;
  } else {
    const allUids = await client.search({ all: true }, { uid: true });
    console.log(
      `[imap-scan] SINCE returned only ${sinceUids.length}, fallback ALL returned ${allUids.length} UIDs`,
    );

    if (allUids.length === 0) {
      console.log("[imap-scan] Folder is truly empty");
      return {
        results: [],
        debug: {
          searchUids: 0,
          envelopesFetched: 0,
          afterForwarded: 0,
          afterSelfSent: 0,
          afterSubjectDedup: 0,
          afterRecipientDedup: 0,
          sampleEnvelopes: [],
        },
      };
    }

    effectiveUids = allUids;
  }

  const sortedUids = [...effectiveUids]
    .sort((a, b) => b - a)
    .slice(0, INITIAL_FETCH_LIMIT);
  const uidRange = sortedUids.join(",");
  console.log(
    `[imap-scan] Selected ${sortedUids.length} UIDs: ${sortedUids.slice(0, 5).join(",")}...`,
  );

  const messages = await client.fetchAll(
    uidRange,
    { envelope: true, uid: true },
    { uid: true },
  );

  const extractAddresses = (list: unknown): readonly string[] =>
    (Array.isArray(list) ? list : [])
      .map((addr: { address?: string }) => addr.address ?? "")
      .filter((a: string) => a.length > 0);

  const envelopes: EnvelopeInfo[] = [...messages]
    .sort((a, b) => b.uid - a.uid)
    .map((msg) => ({
      uid: msg.uid,
      subject: msg.envelope?.subject ?? "(no subject)",
      date: msg.envelope?.date
        ? new Date(msg.envelope.date).toISOString()
        : new Date().toISOString(),
      toAddresses: extractAddresses(msg.envelope?.to),
      ccAddresses: extractAddresses(msg.envelope?.cc),
    }));

  // --- DEBUG: log every envelope so we can see what IMAP returns ---
  console.log(
    `[imap-scan] DEBUG envelopes (${envelopes.length}):`,
    JSON.stringify(
      envelopes.slice(0, 15).map((e) => ({
        uid: e.uid,
        subj: e.subject.slice(0, 60),
        to: e.toAddresses,
        cc: e.ccAddresses,
      })),
    ),
  );

  const afterForwarded = filterForwarded(envelopes);
  const afterSelfSend = filterSelfSent(afterForwarded, userEmail);
  const afterSubjectDedup = deduplicateBySubject(afterSelfSend);
  const afterRecipientDedup = deduplicateByRecipient(
    afterSubjectDedup,
    MAX_PER_RECIPIENT,
  );

  console.log(
    `[imap-scan] Diversity filter: ${envelopes.length} fetched → ${afterForwarded.length} after forwarded → ${afterSelfSend.length} after self-send → ${afterSubjectDedup.length} after subject dedup → ${afterRecipientDedup.length} after recipient dedup`,
  );

  return {
    results: afterRecipientDedup,
    debug: {
      searchUids: sortedUids.length,
      envelopesFetched: envelopes.length,
      afterForwarded: afterForwarded.length,
      afterSelfSent: afterSelfSend.length,
      afterSubjectDedup: afterSubjectDedup.length,
      afterRecipientDedup: afterRecipientDedup.length,
      sampleEnvelopes: envelopes.slice(0, 15).map((e) => ({
        subject: e.subject.slice(0, 80),
        to: e.toAddresses,
        cc: e.ccAddresses,
      })),
    },
  };
}

/**
 * Extract the plain-text portion from a raw RFC 822 message.
 *
 * Handles both single-part and multipart messages. For multipart,
 * looks for the text/plain boundary.
 */
function extractPlainText(raw: string): string {
  // Find the header/body separator
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    const altEnd = raw.indexOf("\n\n");
    if (altEnd === -1) return raw;
    return raw.slice(altEnd + 2);
  }

  const headers = raw.slice(0, headerEnd).toLowerCase();
  const body = raw.slice(headerEnd + 4);

  // Simple single-part text message
  if (
    headers.includes("content-type: text/plain") ||
    !headers.includes("content-type:")
  ) {
    return decodeBody(body, headers);
  }

  // Multipart: extract boundary
  const boundaryMatch = headers.match(/boundary="?([^";\r\n]+)"?/i);
  if (!boundaryMatch) {
    return body;
  }

  const boundary = boundaryMatch[1].trim();
  const parts = body.split(`--${boundary}`);

  // Find the text/plain part
  for (const part of parts) {
    const partLower = part.toLowerCase();
    if (
      partLower.includes("content-type: text/plain") ||
      partLower.includes("content-type:text/plain")
    ) {
      const partBodyStart = part.indexOf("\r\n\r\n");
      if (partBodyStart !== -1) {
        return decodeBody(part.slice(partBodyStart + 4), partLower);
      }
      const altStart = part.indexOf("\n\n");
      if (altStart !== -1) {
        return decodeBody(part.slice(altStart + 2), partLower);
      }
    }
  }

  // No text/plain found, try text/html
  for (const part of parts) {
    const partLower = part.toLowerCase();
    if (
      partLower.includes("content-type: text/html") ||
      partLower.includes("content-type:text/html")
    ) {
      const partBodyStart = part.indexOf("\r\n\r\n");
      if (partBodyStart !== -1) {
        return stripHtml(decodeBody(part.slice(partBodyStart + 4), partLower));
      }
    }
  }

  return body;
}

/**
 * Decode body content based on transfer encoding.
 */
function decodeBody(body: string, headers: string): string {
  // Handle quoted-printable encoding
  if (headers.includes("content-transfer-encoding: quoted-printable")) {
    return decodeQuotedPrintable(body);
  }

  // Handle base64 encoding
  if (headers.includes("content-transfer-encoding: base64")) {
    try {
      const cleaned = body.replace(/[\r\n\s]/g, "");
      return Buffer.from(cleaned, "base64").toString("utf-8");
    } catch {
      return body;
    }
  }

  return body;
}

/**
 * Test IMAP connection and detect the Sent folder without fetching emails.
 *
 * Credentials are used only for this check and are NOT stored.
 */
export async function testImapConnection(
  config: ImapConfig,
): Promise<
  | { readonly success: true; readonly folder: string }
  | { readonly success: false; readonly error: string }
> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
  });

  try {
    await client.connect();

    const sentFolder = await detectSentFolder(client);
    if (!sentFolder) {
      return {
        success: false,
        error: "Could not find Sent folder on this IMAP account",
      };
    }

    return { success: true, folder: sentFolder };
  } catch (err) {
    return {
      success: false,
      error: formatImapError("Connection test failed", err),
    };
  } finally {
    try {
      await client.logout();
    } catch (logoutErr) {
      console.error("IMAP logout failed:", logoutErr);
      client.close();
    }
  }
}

/**
 * Build a descriptive error message from an ImapFlow error.
 *
 * ImapFlow often wraps the real failure in `responseStatus`, `code`,
 * or a generic "Command failed" message. This extracts the useful parts.
 */
function formatImapError(context: string, err: unknown): string {
  if (!(err instanceof Error)) {
    return `${context}: ${String(err)}`;
  }

  const parts: string[] = [context];

  // ImapFlow attaches extra details on the error object
  const imapErr = err as unknown as Record<string, unknown>;
  if (typeof imapErr.responseStatus === "string") {
    parts.push(`[${imapErr.responseStatus}]`);
  }
  if (typeof imapErr.responseText === "string" && imapErr.responseText !== "") {
    parts.push(imapErr.responseText);
  } else {
    parts.push(err.message);
  }
  if (typeof imapErr.code === "string") {
    parts.push(`(code: ${imapErr.code})`);
  }

  return parts.join(" — ");
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}
