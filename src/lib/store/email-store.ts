import { create } from "zustand";
import type {
  SpamAdEmail,
  DraftEmail,
  EscalationAlert,
  UnsubscribeStatus,
  SentEmail,
  IncomingEmail,
  CategorySlice,
  SliceEmailMap,
} from "@/types/email";

type EmailState = {
  readonly spam: readonly SpamAdEmail[];
  readonly ads: readonly SpamAdEmail[];
  readonly urgent: readonly DraftEmail[];
  readonly other: readonly DraftEmail[];
  readonly escalations: readonly EscalationAlert[];
  readonly unsubscribes: readonly UnsubscribeStatus[];
  readonly sent: readonly SentEmail[];
};

// Excludes structural keys that must never be mutated
type MutableFields<T> = Omit<T, "email_id" | "category" | "workflow">;

type HydrationData = {
  readonly spam?: readonly Record<string, unknown>[];
  readonly ad?: readonly Record<string, unknown>[];
  readonly urgent?: readonly Record<string, unknown>[];
  readonly other?: readonly Record<string, unknown>[];
  readonly escalation?: readonly Record<string, unknown>[];
  readonly unsubscribe?: readonly Record<string, unknown>[];
};

type EmailActions = {
  readonly addEmail: (email: IncomingEmail) => void;
  readonly removeEmail: (slice: CategorySlice, emailId: string) => void;
  readonly removeEmailById: (emailId: string) => void;
  readonly updateEmail: <S extends CategorySlice>(
    slice: S,
    emailId: string,
    updates: Partial<MutableFields<SliceEmailMap[S]>>,
  ) => void;
  readonly clearCategory: (slice: CategorySlice) => void;
  readonly getActionCount: () => number;
  readonly hydrateFromServer: (data: HydrationData) => void;
  readonly mergeFromServer: (data: HydrationData) => boolean;
  readonly setSentEmails: (emails: readonly SentEmail[]) => void;
};

type EmailStore = EmailState & EmailActions;

const MAX_EMAILS_PER_SLICE = 500;

function isDuplicate(
  list: readonly { readonly email_id: string }[],
  emailId: string,
): boolean {
  return list.some((e) => e.email_id === emailId);
}

function capSlice<T>(items: readonly T[]): readonly T[] {
  return items.length > MAX_EMAILS_PER_SLICE
    ? items.slice(items.length - MAX_EMAILS_PER_SLICE)
    : items;
}

function normalizeKeys(data: Record<string, unknown>): HydrationData {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key.toLowerCase()] = value;
  }
  return result as HydrationData;
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  // State
  spam: [],
  ads: [],
  urgent: [],
  other: [],
  escalations: [],
  unsubscribes: [],
  sent: [],

  // Actions
  addEmail: (email) => {
    // UnsubscribeStatus has no `category` field — route by structural check
    if (!("category" in email)) {
      set((state) => {
        if (isDuplicate(state.unsubscribes, email.email_id)) return state;
        return { unsubscribes: capSlice([...state.unsubscribes, email]) };
      });
      return;
    }

    switch (email.category) {
      case "SPAM":
        set((state) => {
          if (isDuplicate(state.spam, email.email_id)) return state;
          return { spam: capSlice([...state.spam, email]) };
        });
        break;
      case "AD":
        set((state) => {
          if (isDuplicate(state.ads, email.email_id)) return state;
          return { ads: capSlice([...state.ads, email]) };
        });
        break;
      case "URGENT":
        set((state) => {
          if (isDuplicate(state.urgent, email.email_id)) return state;
          return { urgent: capSlice([...state.urgent, email]) };
        });
        break;
      case "OTHER":
        set((state) => {
          if (isDuplicate(state.other, email.email_id)) return state;
          return { other: capSlice([...state.other, email]) };
        });
        break;
      case "ESCALATION":
        set((state) => {
          if (isDuplicate(state.escalations, email.email_id)) return state;
          return { escalations: capSlice([...state.escalations, email]) };
        });
        break;
      default: {
        const _exhaustive: never = email;
        void _exhaustive;
      }
    }
  },

  removeEmail: (slice, emailId) => {
    set((state) => {
      switch (slice) {
        case "spam":
          return { spam: state.spam.filter((e) => e.email_id !== emailId) };
        case "ads":
          return { ads: state.ads.filter((e) => e.email_id !== emailId) };
        case "urgent":
          return { urgent: state.urgent.filter((e) => e.email_id !== emailId) };
        case "other":
          return { other: state.other.filter((e) => e.email_id !== emailId) };
        case "escalations":
          return {
            escalations: state.escalations.filter(
              (e) => e.email_id !== emailId,
            ),
          };
        case "unsubscribes":
          return {
            unsubscribes: state.unsubscribes.filter(
              (e) => e.email_id !== emailId,
            ),
          };
        case "sent":
          return { sent: state.sent.filter((e) => e.email_id !== emailId) };
        default: {
          const _exhaustive: never = slice;
          void _exhaustive;
          return {};
        }
      }
    });
  },

  removeEmailById: (emailId) => {
    const currentState = get();
    console.log(
      "removeEmailById called with:",
      emailId,
      "current state keys:",
      {
        spam: currentState.spam.map((e) => e.email_id),
        ads: currentState.ads.map((e) => e.email_id),
        urgent: currentState.urgent.map((e) => e.email_id),
        other: currentState.other.map((e) => e.email_id),
        escalations: currentState.escalations.map((e) => e.email_id),
        unsubscribes: currentState.unsubscribes.map((e) => e.email_id),
        sent: currentState.sent.map((e) => e.email_id),
      },
    );
    set((state) => ({
      spam: state.spam.filter((e) => e.email_id !== emailId),
      ads: state.ads.filter((e) => e.email_id !== emailId),
      urgent: state.urgent.filter((e) => e.email_id !== emailId),
      other: state.other.filter((e) => e.email_id !== emailId),
      escalations: state.escalations.filter((e) => e.email_id !== emailId),
      unsubscribes: state.unsubscribes.filter((e) => e.email_id !== emailId),
      sent: state.sent.filter((e) => e.email_id !== emailId),
    }));
  },

  updateEmail: (slice, emailId, updates) => {
    set((state) => {
      switch (slice) {
        case "spam":
          return {
            spam: state.spam.map((e) =>
              e.email_id === emailId ? { ...e, ...updates } : e,
            ),
          };
        case "ads":
          return {
            ads: state.ads.map((e) =>
              e.email_id === emailId ? { ...e, ...updates } : e,
            ),
          };
        case "urgent":
          return {
            urgent: state.urgent.map((e) =>
              e.email_id === emailId ? { ...e, ...updates } : e,
            ),
          };
        case "other":
          return {
            other: state.other.map((e) =>
              e.email_id === emailId ? { ...e, ...updates } : e,
            ),
          };
        case "escalations":
          return {
            escalations: state.escalations.map((e) =>
              e.email_id === emailId ? { ...e, ...updates } : e,
            ),
          };
        case "unsubscribes":
          return {
            unsubscribes: state.unsubscribes.map((e) =>
              e.email_id === emailId ? { ...e, ...updates } : e,
            ),
          };
        case "sent":
          return {
            sent: state.sent.map((e) =>
              e.email_id === emailId ? { ...e, ...updates } : e,
            ),
          };
        default: {
          const _exhaustive: never = slice;
          void _exhaustive;
          return {};
        }
      }
    });
  },

  clearCategory: (slice) => {
    set(() => {
      switch (slice) {
        case "spam":
          return { spam: [] };
        case "ads":
          return { ads: [] };
        case "urgent":
          return { urgent: [] };
        case "other":
          return { other: [] };
        case "escalations":
          return { escalations: [] };
        case "unsubscribes":
          return { unsubscribes: [] };
        case "sent":
          return { sent: [] };
        default: {
          const _exhaustive: never = slice;
          void _exhaustive;
          return {};
        }
      }
    });
  },

  getActionCount: () => {
    const state = get();
    return (
      state.spam.length +
      state.ads.length +
      state.urgent.length +
      state.other.length +
      state.escalations.length +
      state.unsubscribes.filter((u) => u.status === "nicht erfolgreich").length
    );
  },

  hydrateFromServer: (raw) => {
    const data = normalizeKeys(raw as unknown as Record<string, unknown>);
    set(() => ({
      spam: (data.spam ?? []) as unknown as readonly SpamAdEmail[],
      ads: (data.ad ?? []) as unknown as readonly SpamAdEmail[],
      urgent: (data.urgent ?? []) as unknown as readonly DraftEmail[],
      other: (data.other ?? []) as unknown as readonly DraftEmail[],
      escalations: (data.escalation ??
        []) as unknown as readonly EscalationAlert[],
      unsubscribes: (data.unsubscribe ??
        []) as unknown as readonly UnsubscribeStatus[],
    }));
  },

  mergeFromServer: (raw) => {
    const data = normalizeKeys(raw as unknown as Record<string, unknown>);
    let added = 0;

    function mergeSlice<T extends { readonly email_id: string }>(
      existing: readonly T[],
      incoming: readonly Record<string, unknown>[],
    ): readonly T[] {
      const existingIds = new Set(existing.map((e) => e.email_id));
      const newItems = incoming.filter(
        (e) => typeof e.email_id === "string" && !existingIds.has(e.email_id),
      ) as unknown as readonly T[];
      added += newItems.length;
      return newItems.length > 0
        ? capSlice([...existing, ...newItems])
        : existing;
    }

    set((state) => ({
      spam: mergeSlice(state.spam, data.spam ?? []),
      ads: mergeSlice(state.ads, data.ad ?? []),
      urgent: mergeSlice(state.urgent, data.urgent ?? []),
      other: mergeSlice(state.other, data.other ?? []),
      escalations: mergeSlice(state.escalations, data.escalation ?? []),
      unsubscribes: mergeSlice(state.unsubscribes, data.unsubscribe ?? []),
    }));

    return added > 0;
  },

  setSentEmails: (emails) => {
    set({ sent: emails });
  },
}));
