export type EmailCategory =
  | "SPAM"
  | "AD"
  | "URGENT"
  | "OTHER"
  | "ESCALATION"
  | "UNSUB";

export type SpamAdEmail = {
  readonly workflow: "email_inbox";
  readonly category: "SPAM" | "AD";
  readonly email_id: string;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly sender_domain: string;
  readonly subject: string;
  readonly preview: string;
  readonly date: string;
  readonly confidence: number;
  readonly low_confidence: boolean;
  readonly reasoning: string;
  readonly list_unsubscribe_url: string | null;
  readonly list_unsubscribe_mailto: string | null;
  readonly unsubscribe_available: boolean;
};

export type DraftEmail = {
  readonly workflow: "email_inbox";
  readonly category: "URGENT" | "OTHER";
  readonly email_id: string;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly original_subject: string;
  readonly original_preview: string;
  readonly body_plain?: string;
  readonly draft_html: string;
  readonly draft_plain: string;
  readonly placeholders: readonly string[];
  readonly reply_language: "de" | "en";
  readonly confidence: number;
  readonly review_reason: string;
  readonly requires_human_review: boolean;
  readonly low_confidence: boolean;
  readonly is_escalated: boolean;
  readonly sentiment_score: number;
  readonly date: string;
  readonly timestamp: string;
};

export type EscalationAlert = {
  readonly workflow: "email_inbox";
  readonly category: "ESCALATION";
  readonly email_id: string;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly preview?: string;
  readonly body_plain?: string;
  readonly sentiment_score: number;
  readonly urgency: number;
  readonly complaint_risk: boolean;
  readonly legal_threat: boolean;
  readonly churn_risk: "low" | "medium" | "high";
  readonly summary: string;
  readonly timestamp: string;
  readonly draft_html?: string;
  readonly draft_plain?: string;
  readonly draft_subject?: string;
  readonly placeholders?: readonly string[];
};

export type UnsubscribeStatus = {
  readonly email_id: string;
  readonly sender: string;
  readonly unsubscribe_method: "one-click" | "mailto" | "not-found";
  readonly status: "erfolgreich" | "nicht erfolgreich";
  readonly reason: string;
  readonly timestamp: string;
};

export type IncomingEmail =
  | SpamAdEmail
  | DraftEmail
  | EscalationAlert
  | UnsubscribeStatus;

// Narrowed types per category (useful for type-safe store slices)
export type SpamEmail = SpamAdEmail & { readonly category: "SPAM" };
export type AdEmail = SpamAdEmail & { readonly category: "AD" };
export type UrgentDraft = DraftEmail & { readonly category: "URGENT" };
export type OtherDraft = DraftEmail & { readonly category: "OTHER" };

export type SentEmail = {
  readonly email_id: string;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly draft_plain: string;
  readonly timestamp: string;
};

// Store slice keys
export type CategorySlice =
  | "spam"
  | "ads"
  | "urgent"
  | "other"
  | "escalations"
  | "unsubscribes"
  | "sent";

// Maps slice keys to their email types
export type SliceEmailMap = {
  readonly spam: SpamAdEmail;
  readonly ads: SpamAdEmail;
  readonly urgent: DraftEmail;
  readonly other: DraftEmail;
  readonly escalations: EscalationAlert;
  readonly unsubscribes: UnsubscribeStatus;
  readonly sent: SentEmail;
};
