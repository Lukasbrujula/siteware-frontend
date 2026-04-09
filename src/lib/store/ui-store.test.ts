import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui-store";

beforeEach(() => {
  useUiStore.setState({
    activeTab: "urgent",
    selectedEmailId: null,
    draftEditorContent: "",
  });
});

describe("initial state", () => {
  it("starts with urgent as active tab", () => {
    expect(useUiStore.getState().activeTab).toBe("urgent");
  });

  it("starts with no selected email", () => {
    expect(useUiStore.getState().selectedEmailId).toBeNull();
  });

  it("starts with empty draft editor content", () => {
    expect(useUiStore.getState().draftEditorContent).toBe("");
  });
});

describe("setActiveTab", () => {
  it("changes the active tab", () => {
    useUiStore.getState().setActiveTab("spam");
    expect(useUiStore.getState().activeTab).toBe("spam");
  });

  it("resets selectedEmailId when tab changes", () => {
    useUiStore.getState().setSelectedEmailId("email-123");
    useUiStore.getState().setActiveTab("ads");
    expect(useUiStore.getState().selectedEmailId).toBeNull();
  });

  it("resets draftEditorContent when tab changes", () => {
    useUiStore.getState().setDraftEditorContent("some draft");
    useUiStore.getState().setActiveTab("escalations");
    expect(useUiStore.getState().draftEditorContent).toBe("");
  });
});

describe("setSelectedEmailId", () => {
  it("sets the selected email id", () => {
    useUiStore.getState().setSelectedEmailId("email-456");
    expect(useUiStore.getState().selectedEmailId).toBe("email-456");
  });

  it("clears the selected email id with null", () => {
    useUiStore.getState().setSelectedEmailId("email-456");
    useUiStore.getState().setSelectedEmailId(null);
    expect(useUiStore.getState().selectedEmailId).toBeNull();
  });
});

describe("setDraftEditorContent", () => {
  it("sets the draft editor content", () => {
    useUiStore.getState().setDraftEditorContent("Hello World");
    expect(useUiStore.getState().draftEditorContent).toBe("Hello World");
  });

  it("clears with empty string", () => {
    useUiStore.getState().setDraftEditorContent("content");
    useUiStore.getState().setDraftEditorContent("");
    expect(useUiStore.getState().draftEditorContent).toBe("");
  });
});
