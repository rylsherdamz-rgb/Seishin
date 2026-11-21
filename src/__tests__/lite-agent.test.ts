/** Agent tab: Seishin Lite answers day questions with no model at all; actions still reach the model path. */
jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
jest.mock("@/services/task-reminders", () => ({ scheduleTaskReminders: jest.fn(async () => 0), cancelTaskReminders: jest.fn(async () => {}) }));
jest.mock("expo-mlkit-ocr", () => ({ recognizeText: jest.fn() }));
jest.mock("expo-notifications", () => ({ scheduleNotificationAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { DATE: "date" } }));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("openai", () => jest.fn());
jest.mock("@/services/local-llama", () => ({ generateResponse: jest.fn(), isModelLoaded: () => false, getModelState: () => ({}), abortGeneration: jest.fn() }));

import { runAgentLoop } from "@/services/agent-engine";
import { useAgentStore } from "@/stores/agent-store";
import { useCalendarStore } from "@/stores/calendar-store";

beforeEach(() => {
  useAgentStore.setState({ messages: [], currentProvider: "local", isProcessing: false });
  const now = new Date();
  const at = (h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h).toISOString();
  useCalendarStore.setState({ events: [{ id: "e1", title: "Team sync", startDate: at(23), endDate: at(23), source: "manual" }] });
});

test("a day question is answered by Seishin Lite, no model loaded", async () => {
  await runAgentLoop("what's lined up today?");
  const [user, reply] = useAgentStore.getState().messages;
  expect(user.content).toBe("what's lined up today?");
  expect(reply.provider).toBe("lite");
  expect(reply.content).toContain("Team sync");
  expect(useAgentStore.getState().isProcessing).toBe(false);
});

test("an action skips Seishin Lite; with no model set up the reply explains what works", async () => {
  await runAgentLoop("add a meeting tomorrow at 3");
  const msgs = useAgentStore.getState().messages;
  const reply = msgs[msgs.length - 1];
  expect(reply.provider).not.toBe("lite");
  expect(reply.content).toContain("Settings → AI");
  expect(reply.content).toContain("What's lined up today");
});
