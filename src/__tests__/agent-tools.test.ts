jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
jest.mock("@/services/task-reminders", () => ({ scheduleTaskReminders: jest.fn(async () => 0), cancelTaskReminders: jest.fn(async () => {}) }));
jest.mock("expo-mlkit-ocr", () => ({ recognizeText: jest.fn() }));
jest.mock("expo-notifications", () => ({ scheduleNotificationAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { DATE: "date" } }));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("openai", () => jest.fn());
jest.mock("@/services/local-llama", () => ({ generateResponse: jest.fn(), isModelLoaded: () => false, getModelState: () => ({}), abortGeneration: jest.fn() }));
import { createDefaultTools } from "@/services/agent-engine";
import { useTodoStore } from "@/stores/todo-store";

const tool = (name: string) => createDefaultTools().tools.find((t) => t.name === name)!;
const run = async (name: string, args: Record<string, unknown>) => (await tool(name).call(args)).toString();

beforeEach(() => useTodoStore.getState().clearAll());

describe("agent task tools", () => {
  it("add_todo saves checklist + persistent reminders and rejects bad dates", async () => {
    const out = await run("add_todo", { title: "Essay", dueDate: "2026-10-16T23:59", reminder: "persistent", items: ["Outline", "Draft", ""] });
    expect(out).toMatch(/keep reminding/);
    const t = useTodoStore.getState().todos[0];
    expect(t.reminder).toBe("persistent");
    expect(t.items?.map((i) => i.text)).toEqual(["Outline", "Draft"]);
    expect(await run("add_todo", { title: "Bad", dueDate: "next-ish" })).toMatch(/ISO date/);
    expect(useTodoStore.getState().todos).toHaveLength(1);
  });

  it("list_todos sorts by deadline and flags overdue and progress", async () => {
    await run("add_todo", { title: "Later", dueDate: new Date(Date.now() + 5 * 86400000).toISOString() });
    await run("add_todo", { title: "Late", dueDate: new Date(Date.now() - 86400000).toISOString(), items: ["a", "b"] });
    const out = await run("list_todos", {});
    expect(out.indexOf("Late")).toBeLessThan(out.indexOf("Later"));
    expect(out).toMatch(/Late.*OVERDUE.*0\/2 items done/);
    expect(await run("list_todos", { withinDays: 1 })).not.toMatch(/Later/);
  });

  it("array parameters get a valid JSON schema", () => {
    const p = tool("add_todo").toParam() as unknown as { function: { parameters: { properties: Record<string, { type: string; items?: unknown }> } } };
    expect(p.function.parameters.properties.items).toMatchObject({ type: "array", items: { type: "string" } });
  });
});
