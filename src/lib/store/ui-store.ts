import { create } from "zustand";
import type { CategorySlice } from "@/types/email";

type UiState = {
  readonly activeTab: CategorySlice;
  readonly selectedEmailId: string | null;
  readonly draftEditorContent: string;
};

type UiActions = {
  readonly setActiveTab: (tab: CategorySlice) => void;
  readonly setSelectedEmailId: (emailId: string | null) => void;
  readonly setDraftEditorContent: (content: string) => void;
};

type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>((set) => ({
  // State
  activeTab: "urgent",
  selectedEmailId: null,
  draftEditorContent: "",

  // Actions
  setActiveTab: (tab) =>
    set({ activeTab: tab, selectedEmailId: null, draftEditorContent: "" }),
  setSelectedEmailId: (emailId) => set({ selectedEmailId: emailId }),
  setDraftEditorContent: (content) => set({ draftEditorContent: content }),
}));
