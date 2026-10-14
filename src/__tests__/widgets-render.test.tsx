jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
jest.mock("@/services/task-reminders", () => ({ scheduleTaskReminders: jest.fn(async () => 0), cancelTaskReminders: jest.fn(async () => {}) }));
// Internal helper the library uses to turn JSX into the native widget tree.
const { buildWidgetTree } = require("react-native-android-widget/lib/commonjs/api/build-widget-tree") as { buildWidgetTree: (el: React.JSX.Element) => unknown };
import { renderSeishinWidget, WIDGET_NAMES, setMonthOffset } from "@/widgets/render";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { settingsStorage } from "@/stores/mmkv";

const soon = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

beforeEach(() => {
  useCalendarStore.setState({ events: [{ id: "e", title: "Lab", startDate: soon(1), endDate: soon(2), source: "manual" }] });
  useTodoStore.setState({ todos: [{ id: "t", title: "Essay", completed: false, priority: "medium", createdAt: new Date().toISOString(), dueDate: soon(-2) } as never] });
});

describe("home-screen widgets", () => {
  it.each(WIDGET_NAMES)("%s builds a valid native tree in light and dark", (name) => {
    settingsStorage.set("settings:theme:mode", "system");
    const r = renderSeishinWidget(name, 1) as { light: React.JSX.Element; dark: React.JSX.Element };
    const light = JSON.stringify(buildWidgetTree(r.light));
    expect(light.length).toBeGreaterThan(50);
    expect(r.dark).toBeTruthy();
    expect(JSON.stringify(buildWidgetTree(r.dark))).not.toBe(light);
  });

  it("task rows carry the in-widget complete action and deep links", () => {
    const tree = JSON.stringify(buildWidgetTree((renderSeishinWidget("Tasks", 1) as { light: React.JSX.Element }).light));
    expect(tree).toContain("TOGGLE_TASK");
    expect(tree).toContain("seishin://open?to=task&id=t");
  });

  it("a fixed theme draws one version; month paging is per widget", () => {
    settingsStorage.set("settings:theme:mode", "paper");
    setMonthOffset(7, 2);
    const r = renderSeishinWidget("Month", 7) as { dark: unknown };
    expect(r.dark).toBeNull();
    setMonthOffset(7, null);
  });
});
