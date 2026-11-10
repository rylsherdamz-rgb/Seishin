jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
jest.mock("@/services/task-reminders", () => ({ scheduleTaskReminders: jest.fn(async () => 0), cancelTaskReminders: jest.fn(async () => {}) }));
jest.mock("expo-notifications", () => ({ scheduleNotificationAsync: jest.fn(async () => "") }));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const mockChat = jest.fn();
let mockVision = false;
jest.mock("@/services/local-llama", () => ({
  chatWithTools: (...a: unknown[]) => mockChat(...a),
  isVisionReady: () => mockVision,
  isLocalImageUri: (u: string) => u.startsWith("file://") || u.startsWith("/"),
  generationAborted: () => false,
  isModelLoaded: () => true,
  getModelState: () => ({ state: "ready", progress: 100, error: null }),
  abortGeneration: jest.fn(),
}));

import { runLocalAgent, MAX_LOCAL_STEPS } from "@/services/local-agent";
import { LOCAL_TOOL_NAMES } from "@/services/agent-engine";
import { completeText } from "@/services/ai-complete";
import { useAgentStore } from "@/stores/agent-store";
import { useTodoStore } from "@/stores/todo-store";
import { useSettingsStore } from "@/stores/settings-store";

beforeEach(() => {
  mockChat.mockReset();
  mockVision = false;
  useAgentStore.setState({ messages: [], currentProvider: "local" });
  useTodoStore.getState().clearAll();
  useSettingsStore.setState({ modelPath: "/models/qwen2.5-1.5b-instruct.gguf" });
});

describe("on-device agent", () => {
  it("runs a tool the local model calls, then answers in words", async () => {
    mockChat
      .mockResolvedValueOnce({ content: "", toolCalls: [{ id: "c1", name: "add_todo", arguments: JSON.stringify({ title: "Buy milk" }) }] })
      .mockResolvedValueOnce({ content: "Added “Buy milk”.", toolCalls: [] });

    const reply = await runLocalAgent("add a task to buy milk");

    expect(reply).toBe("Added “Buy milk”.");
    expect(useTodoStore.getState().todos.map((t) => t.title)).toContain("Buy milk");
    const msgs = useAgentStore.getState().messages;
    expect(msgs.some((m) => m.role === "tool" && m.toolName === "add_todo")).toBe(true);
    const last = msgs[msgs.length - 1];
    expect(last).toMatchObject({ role: "assistant", provider: "local", model: "qwen2.5-1.5b-instruct" });

    // Second turn sees the call and its result.
    const second = mockChat.mock.calls[1][0] as { role: string; tool_call_id?: string }[];
    expect(second.some((m) => m.role === "tool" && m.tool_call_id === "c1")).toBe(true);
  });

  it("offers only the everyday tool set to the phone model", async () => {
    mockChat.mockResolvedValueOnce({ content: "Hi!", toolCalls: [] });
    await runLocalAgent("hello");
    const tools = mockChat.mock.calls[0][1] as { function: { name: string } }[];
    expect(tools.map((t) => t.function.name).sort()).toEqual([...LOCAL_TOOL_NAMES].sort());
  });

  it("stops offering tools on the last step so it must reply", async () => {
    mockChat.mockResolvedValue({ content: "", toolCalls: [{ id: "x", name: "list_todos", arguments: "{}" }] });
    await runLocalAgent("loop forever");
    expect(mockChat).toHaveBeenCalledTimes(MAX_LOCAL_STEPS);
    expect(mockChat.mock.calls[MAX_LOCAL_STEPS - 1][1]).toBeUndefined();
  });
});

describe("completeText", () => {
  it("uses the on-device model first when it is the chosen brain", async () => {
    useSettingsStore.setState({ apiKeys: { ...useSettingsStore.getState().apiKeys, nim: "key" } });
    mockChat.mockResolvedValueOnce({ content: "{\"ok\":true}", toolCalls: [] });
    await expect(completeText("sys", "user")).resolves.toBe("{\"ok\":true}");
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});

describe("on-device agent with images", () => {
  const userTurn = () => {
    const convo = mockChat.mock.calls[0][0] as { role: string; content: unknown }[];
    return convo.filter((m) => m.role === "user").pop()!;
  };
  const send = async (uris: string[]) => {
    mockChat.mockResolvedValueOnce({ content: "It's a poster.", toolCalls: [] });
    useAgentStore.getState().addMessage({ id: "u1", role: "user", content: "add this", timestamp: new Date().toISOString() });
    await runLocalAgent("add this", "[Image: photo]\nAcoustic Night\nNov 21 7 PM", uris);
  };

  it("sends the image before the text (with its OCR) when a vision projector is loaded", async () => {
    mockVision = true;
    await send(["file:///cache/poster.jpg"]);
    expect(userTurn().content).toEqual([
      { type: "image_url", image_url: { url: "file:///cache/poster.jpg" } },
      { type: "text", text: "add this\n\n[Attached content]\n[Image: photo]\nAcoustic Night\nNov 21 7 PM" },
    ]);
  });

  it("falls back to OCR text only without a projector", async () => {
    await send(["file:///cache/poster.jpg"]);
    expect(userTurn().content).toBe("add this\n\n[Attached content]\n[Image: photo]\nAcoustic Night\nNov 21 7 PM");
  });

  it("skips images llama.rn can't open and caps the count", async () => {
    mockVision = true;
    await send(["content://media/1", "file:///a.jpg", "file:///b.jpg", "file:///c.jpg"]);
    const parts = userTurn().content as { type: string }[];
    expect(parts.filter((p) => p.type === "image_url")).toHaveLength(2);
  });
});
