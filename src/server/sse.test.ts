import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  addClient,
  broadcast,
  getClientCount,
  __resetClientsForTest,
} from "./sse.ts";
import type { SseEvent } from "./sse.ts";

// ---------------------------------------------------------------------------
// Mock Response objects
// ---------------------------------------------------------------------------

function createMockResponse() {
  const writtenData: string[] = [];
  return {
    write: vi.fn((data: string) => {
      writtenData.push(data);
      return true;
    }),
    on: vi.fn(),
    writtenData,
  };
}

beforeEach(() => {
  __resetClientsForTest();
  vi.useFakeTimers();
});

afterEach(() => {
  __resetClientsForTest();
  vi.useRealTimers();
});

const sampleEvent: SseEvent = {
  type: "email:new",
  data: {
    workflow: "email_inbox",
    category: "SPAM",
    email_id: "spam-001",
    sender_name: "Spammer",
    sender_email: "spam@example.com",
    sender_domain: "example.com",
    subject: "Win!",
    preview: "Click here",
    date: "2025-06-01T10:00:00Z",
    confidence: 0.9,
    low_confidence: false,
    reasoning: "Spam",
    list_unsubscribe_url: null,
    list_unsubscribe_mailto: null,
    unsubscribe_available: false,
  },
};

// ===========================================================================
// addClient
// ===========================================================================

describe("addClient", () => {
  it("returns a UUID string", () => {
    const res = createMockResponse();
    const id = addClient(res as never);
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("increments client count", () => {
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    addClient(res1 as never);
    expect(getClientCount()).toBe(1);
    addClient(res2 as never);
    expect(getClientCount()).toBe(2);
  });

  it("returns null when at max capacity (50)", () => {
    for (let i = 0; i < 50; i++) {
      addClient(createMockResponse() as never);
    }
    expect(getClientCount()).toBe(50);
    const result = addClient(createMockResponse() as never);
    expect(result).toBeNull();
    expect(getClientCount()).toBe(50);
  });

  it("registers close event handler", () => {
    const res = createMockResponse();
    addClient(res as never);
    expect(res.on).toHaveBeenCalledWith("close", expect.any(Function));
  });
});

// ===========================================================================
// broadcast
// ===========================================================================

describe("broadcast", () => {
  it("writes SSE format to all clients", () => {
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    addClient(res1 as never);
    addClient(res2 as never);

    broadcast(sampleEvent);

    expect(res1.write).toHaveBeenCalled();
    expect(res2.write).toHaveBeenCalled();

    const lastCall1 = res1.writtenData[res1.writtenData.length - 1];
    expect(lastCall1).toContain("event: email\n");
    expect(lastCall1).toContain("data: ");
    expect(lastCall1).toContain('"email_id":"spam-001"');
  });

  it("removes dead clients on write failure", () => {
    const goodRes = createMockResponse();
    const deadRes = createMockResponse();
    deadRes.write.mockReturnValue(false);

    addClient(goodRes as never);
    addClient(deadRes as never);
    expect(getClientCount()).toBe(2);

    broadcast(sampleEvent);
    expect(getClientCount()).toBe(1);
  });

  it("removes clients that throw on write", () => {
    const throwRes = createMockResponse();
    throwRes.write.mockImplementation(() => {
      throw new Error("Connection reset");
    });

    addClient(throwRes as never);
    expect(getClientCount()).toBe(1);

    broadcast(sampleEvent);
    expect(getClientCount()).toBe(0);
  });
});

// ===========================================================================
// heartbeat
// ===========================================================================

describe("heartbeat", () => {
  it("sends heartbeat after 30 seconds", () => {
    const res = createMockResponse();
    addClient(res as never);

    vi.advanceTimersByTime(30_000);

    const heartbeats = res.writtenData.filter((d) => d.includes(": heartbeat"));
    expect(heartbeats.length).toBeGreaterThanOrEqual(1);
  });

  it("sends multiple heartbeats over time", () => {
    const res = createMockResponse();
    addClient(res as never);

    vi.advanceTimersByTime(90_000);

    const heartbeats = res.writtenData.filter((d) => d.includes(": heartbeat"));
    expect(heartbeats.length).toBe(3);
  });
});

// ===========================================================================
// getClientCount
// ===========================================================================

describe("getClientCount", () => {
  it("returns 0 with no clients", () => {
    expect(getClientCount()).toBe(0);
  });

  it("returns correct count", () => {
    addClient(createMockResponse() as never);
    addClient(createMockResponse() as never);
    addClient(createMockResponse() as never);
    expect(getClientCount()).toBe(3);
  });
});
