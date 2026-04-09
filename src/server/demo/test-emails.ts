import type {
  SpamAdEmail,
  DraftEmail,
  EscalationAlert,
  UnsubscribeStatus,
} from "../../types/email.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DemoScenario =
  | "all"
  | "spam"
  | "ad"
  | "urgent"
  | "other"
  | "escalation"
  | "unsubscribe";

export type DemoEmail = {
  readonly dbCategory: string;
  readonly payload: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// SPAM — English lottery scam
// ---------------------------------------------------------------------------

const spamEmail: SpamAdEmail = {
  workflow: "email_inbox",
  category: "SPAM",
  email_id: "demo-spam-001",
  sender_name: "Prize Center International",
  sender_email: "winner@prize-center-intl.xyz",
  sender_domain: "prize-center-intl.xyz",
  subject: "Congratulations! You have won $5,000,000 in our Global Prize Draw!",
  preview:
    "Dear valued customer, we are delighted to inform you that your email address was randomly selected in our annual Global Prize Draw. To claim your prize of $5,000,000, please reply with your full name, address, and bank details within 48 hours.",
  date: "2026-03-03T09:15:00Z",
  confidence: 0.98,
  low_confidence: false,
  reasoning:
    "Classic lottery/prize scam pattern: unsolicited monetary claims, suspicious .xyz domain, requests personal banking details, artificial urgency with 48-hour deadline, no prior sender relationship.",
  list_unsubscribe_url: null,
  list_unsubscribe_mailto: null,
  unsubscribe_available: false,
};

// ---------------------------------------------------------------------------
// AD — SaaS newsletter with List-Unsubscribe headers
// ---------------------------------------------------------------------------

const adEmail: SpamAdEmail = {
  workflow: "email_inbox",
  category: "AD",
  email_id: "demo-ad-001",
  sender_name: "CloudStack Newsletter",
  sender_email: "newsletter@cloudstack.io",
  sender_domain: "cloudstack.io",
  subject: "CloudStack Monthly: Neue Features & Fruehjahrs-Aktion",
  preview:
    "Entdecken Sie unsere neuesten Plattform-Updates: KI-gestuetzte Analytics, verbesserte CI/CD-Pipelines und 50% Rabatt auf Jahresplaene im Maerz. Jetzt upgraden und von den neuen Features profitieren.",
  date: "2026-03-02T14:30:00Z",
  confidence: 0.92,
  low_confidence: false,
  reasoning:
    "Marketing newsletter with promotional content, sent from newsletter subdomain, contains pricing offers and feature announcements. Matches SaaS promotional email pattern.",
  list_unsubscribe_url: "https://cloudstack.io/unsubscribe?token=demo-abc123",
  list_unsubscribe_mailto:
    "mailto:unsubscribe@cloudstack.io?subject=unsubscribe",
  unsubscribe_available: true,
};

// ---------------------------------------------------------------------------
// URGENT — German deadline email with placeholder in draft
// ---------------------------------------------------------------------------

const urgentEmail: DraftEmail = {
  workflow: "email_inbox",
  category: "URGENT",
  email_id: "demo-urgent-001",
  sender_name: "Thomas Mueller",
  sender_email: "thomas.mueller@bauhaus-gmbh.de",
  subject: "Re: Angebot Projekt Neubau Muenchen",
  original_subject: "Angebot Projekt Neubau Muenchen - Frist 05.03.2026",
  original_preview:
    "Sehr geehrte Damen und Herren, bezugnehmend auf unser Telefonat vom Montag moechte ich Sie dringend bitten, das aktualisierte Angebot bis spaetestens Mittwoch, den 05.03.2026 einzureichen. Ohne fristgerechte Abgabe koennen wir Ihr Unternehmen leider nicht beruecksichtigen.",
  draft_html:
    '<p>Sehr geehrter Herr Mueller,</p><p>vielen Dank fuer Ihre Nachricht und die Erinnerung an die Frist. Wir arbeiten derzeit an der Finalisierung des aktualisierten Angebots und werden es Ihnen bis <mark style="background:#fef08a">[BITTE ERGAENZEN: konkretes Datum/Uhrzeit]</mark> zukommen lassen.</p><p>Sollten Sie vorab Rueckfragen haben, stehe ich Ihnen gerne zur Verfuegung.</p><p>Mit freundlichen Gruessen</p>',
  draft_plain:
    "Sehr geehrter Herr Mueller,\n\nvielen Dank fuer Ihre Nachricht und die Erinnerung an die Frist. Wir arbeiten derzeit an der Finalisierung des aktualisierten Angebots und werden es Ihnen bis [BITTE ERGAENZEN: konkretes Datum/Uhrzeit] zukommen lassen.\n\nSollten Sie vorab Rueckfragen haben, stehe ich Ihnen gerne zur Verfuegung.\n\nMit freundlichen Gruessen",
  placeholders: ["[BITTE ERGAENZEN: konkretes Datum/Uhrzeit]"],
  reply_language: "de",
  confidence: 0.85,
  review_reason:
    "Fristsetzung im Originaltext erkannt (05.03.2026). Platzhalter erfordert manuelle Eingabe des konkreten Lieferdatums.",
  requires_human_review: true,
  low_confidence: false,
  is_escalated: false,
  sentiment_score: 0.1,
  date: "2026-03-03T08:45:00Z",
  timestamp: "2026-03-03T08:45:00Z",
};

// ---------------------------------------------------------------------------
// OTHER — German meeting follow-up (no placeholders, clean draft)
// ---------------------------------------------------------------------------

const otherEmail: DraftEmail = {
  workflow: "email_inbox",
  category: "OTHER",
  email_id: "demo-other-001",
  sender_name: "Anna Schmidt",
  sender_email: "anna.schmidt@partner-ag.de",
  subject: "Re: Besprechungsprotokoll KW 09",
  original_subject: "Besprechungsprotokoll KW 09 - Naechste Schritte",
  original_preview:
    "Hallo zusammen, anbei das Protokoll unserer Besprechung vom Dienstag. Koennten Sie bitte die offenen Punkte zu den Meilensteinen Q2 pruefen und mir bis Freitag Rueckmeldung geben, ob die Zeitplaene realistisch sind?",
  draft_html:
    "<p>Hallo Frau Schmidt,</p><p>vielen Dank fuer das Protokoll. Ich habe die offenen Punkte und die Meilensteine fuer Q2 geprueft. Die vorgeschlagenen Zeitplaene sind aus unserer Sicht realistisch und umsetzbar.</p><p>Ich gebe Ihnen bis Freitag eine finale Rueckmeldung mit den detaillierten Aufwandsschaetzungen unseres Teams.</p><p>Viele Gruesse</p>",
  draft_plain:
    "Hallo Frau Schmidt,\n\nvielen Dank fuer das Protokoll. Ich habe die offenen Punkte und die Meilensteine fuer Q2 geprueft. Die vorgeschlagenen Zeitplaene sind aus unserer Sicht realistisch und umsetzbar.\n\nIch gebe Ihnen bis Freitag eine finale Rueckmeldung mit den detaillierten Aufwandsschaetzungen unseres Teams.\n\nViele Gruesse",
  placeholders: [],
  reply_language: "de",
  confidence: 0.91,
  review_reason:
    "Standardmaessige Besprechungs-Nachverfolgung, automatisch generierte Antwort zur Freigabe.",
  requires_human_review: false,
  low_confidence: false,
  is_escalated: false,
  sentiment_score: 0.4,
  date: "2026-03-02T16:20:00Z",
  timestamp: "2026-03-02T16:20:00Z",
};

// ---------------------------------------------------------------------------
// ESCALATION — Angry German complaint with legal language
// ---------------------------------------------------------------------------

const escalationEmail: EscalationAlert = {
  workflow: "email_inbox",
  category: "ESCALATION",
  email_id: "demo-escalation-001",
  sender_name: "Dr. Markus Weber",
  sender_email: "weber@kanzlei-weber-partner.de",
  subject: "DRINGEND: Vertragsverletzung und Schadensersatzforderung",
  sentiment_score: -0.85,
  urgency: 9,
  complaint_risk: true,
  legal_threat: true,
  churn_risk: "high",
  summary:
    "Rechtsanwalt droht mit Klage wegen angeblicher Vertragsverletzung (Lieferverzoegerung Projekt #2026-0142). Fordert schriftliche Stellungnahme innerhalb von 7 Werktagen und beziffert Schadensersatz auf 45.000 EUR. Bezieht sich auf Vertrag vom 15.01.2026, Paragraph 8 (Lieferfristen) und Paragraph 12 (Vertragsstrafen).",
  timestamp: "2026-03-03T07:30:00Z",
};

// ---------------------------------------------------------------------------
// UNSUBSCRIBE — Result for the AD email above
// ---------------------------------------------------------------------------

const unsubscribeEmail: UnsubscribeStatus = {
  email_id: "demo-ad-001",
  sender: "CloudStack Newsletter <newsletter@cloudstack.io>",
  unsubscribe_method: "one-click",
  status: "erfolgreich",
  reason:
    "Abmeldung ueber One-Click List-Unsubscribe Header erfolgreich durchgefuehrt.",
  timestamp: "2026-03-03T10:00:00Z",
};

// ---------------------------------------------------------------------------
// Scenario → email mapping
// ---------------------------------------------------------------------------

const allDemoEmails: readonly DemoEmail[] = [
  {
    dbCategory: "SPAM",
    payload: spamEmail as unknown as Record<string, unknown>,
  },
  { dbCategory: "AD", payload: adEmail as unknown as Record<string, unknown> },
  {
    dbCategory: "URGENT",
    payload: urgentEmail as unknown as Record<string, unknown>,
  },
  {
    dbCategory: "OTHER",
    payload: otherEmail as unknown as Record<string, unknown>,
  },
  {
    dbCategory: "ESCALATION",
    payload: escalationEmail as unknown as Record<string, unknown>,
  },
  {
    dbCategory: "UNSUBSCRIBE",
    payload: unsubscribeEmail as unknown as Record<string, unknown>,
  },
];

const scenarioMap: Record<DemoScenario, readonly DemoEmail[]> = {
  all: allDemoEmails,
  spam: allDemoEmails.filter((e) => e.dbCategory === "SPAM"),
  ad: allDemoEmails.filter((e) => e.dbCategory === "AD"),
  urgent: allDemoEmails.filter((e) => e.dbCategory === "URGENT"),
  other: allDemoEmails.filter((e) => e.dbCategory === "OTHER"),
  escalation: allDemoEmails.filter((e) => e.dbCategory === "ESCALATION"),
  unsubscribe: allDemoEmails.filter((e) => e.dbCategory === "UNSUBSCRIBE"),
};

const validScenarios = new Set<string>(Object.keys(scenarioMap));

export function isValidScenario(value: unknown): value is DemoScenario {
  return typeof value === "string" && validScenarios.has(value);
}

export function getDemoEmails(scenario: DemoScenario): readonly DemoEmail[] {
  return scenarioMap[scenario];
}
