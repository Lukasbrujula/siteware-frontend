export type ApproveDraftRequest = {
  readonly email_id: string;
  readonly draft_html: string;
  readonly draft_plain: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly reply_language: "de" | "en";
};

export type RejectDraftRequest = {
  readonly email_id: string;
  readonly reason?: string;
};

/**
 * Retriage sends minimal data. n8n must look up the full email body by
 * email_id from its own storage for re-classification — the dashboard only
 * has a 150-char preview, not body_plain/body_html.
 */
export type RetriageRequest = {
  readonly email_id: string;
  readonly sender_email: string;
  readonly sender_name: string;
  readonly subject: string;
  readonly original_category: "SPAM" | "AD";
};

export type UnsubscribeRequest = {
  readonly email_id: string;
  readonly sender_email: string;
  readonly list_unsubscribe_url?: string | null;
  readonly list_unsubscribe_mailto?: string | null;
};

export type WebhookResponse = {
  readonly success: boolean;
  readonly message?: string;
  readonly error?: string;
};
