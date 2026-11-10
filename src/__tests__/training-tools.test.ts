jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
jest.mock("@/services/task-reminders", () => ({ scheduleTaskReminders: jest.fn(async () => 0), cancelTaskReminders: jest.fn(async () => {}) }));
jest.mock("expo-mlkit-ocr", () => ({ recognizeText: jest.fn() }));
jest.mock("expo-notifications", () => ({ scheduleNotificationAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { DATE: "date" } }));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("openai", () => jest.fn());
jest.mock("@/services/local-llama", () => ({ generateResponse: jest.fn(), isModelLoaded: () => false, getModelState: () => ({}), abortGeneration: jest.fn() }));
import { createDefaultTools, LOCAL_TOOL_NAMES } from "@/services/agent-engine";
import trainingTools from "../../training/tools.json";

// The Colab fine-tune (training/) teaches the on-device model these exact schemas.
// If this fails: UPDATE_TRAINING_TOOLS=1 npx jest training-tools, then retrain (training/README.md).
describe("training/tools.json", () => {
  it("matches the on-device agent's tool schemas", () => {
    const live = createDefaultTools()
      .toParams()
      .filter((t) => t.type === "function" && LOCAL_TOOL_NAMES.includes(t.function.name));
    if (process.env.UPDATE_TRAINING_TOOLS) {
      require("fs").writeFileSync(`${__dirname}/../../training/tools.json`, `${JSON.stringify(live, null, 2)}\n`);
      return;
    }
    expect(trainingTools).toEqual(JSON.parse(JSON.stringify(live)));
  });
});
