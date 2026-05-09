import { create } from "zustand";
import type { CategorySlice, Inbox } from "@/types/email";

type UiState = {
  readonly activeTab: CategorySlice;
  readonly selectedEmailId: string | null;
  readonly draftEditorContent: string;
  readonly inboxes: readonly Inbox[];
  readonly selectedInboxId: string | null;
};

type UiActions = {
  readonly setActiveTab: (tab: CategorySlice) => void;
  readonly setSelectedEmailId: (emailId: string | null) => void;
  readonly setDraftEditorContent: (content: string) => void;
  readonly setInboxes: (inboxes: readonly Inbox[]) => void;
  readonly setSelectedInboxId: (inboxId: string | null) => void;
};

type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>((set) => ({
  // State
  activeTab: "urgent",
  selectedEmailId: null,
  draftEditorContent: "",
  inboxes: [],
  selectedInboxId: null,

  // Actions
  setActiveTab: (tab) =>
    set({ activeTab: tab, selectedEmailId: null, draftEditorContent: "" }),
  setSelectedEmailId: (emailId) => set({ selectedEmailId: emailId }),
  setDraftEditorContent: (content) => set({ draftEditorContent: content }),
  setInboxes: (inboxes) => set({ inboxes }),
  setSelectedInboxId: (inboxId) => set({ selectedInboxId: inboxId }),
}));
