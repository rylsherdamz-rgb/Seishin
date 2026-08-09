import { useAlarmStore } from "@/stores/alarm-store";

describe("alarm store", () => {
  test("trigger sets the active alarm, dismiss clears it", () => {
    useAlarmStore.getState().trigger({ title: "Dentist", startTime: "2026-08-10T09:00:00.000Z", snoozed: false });
    const alarm = useAlarmStore.getState().alarm;
    expect(alarm?.title).toBe("Dentist");
    expect(alarm?.startTime).toBe("2026-08-10T09:00:00.000Z");

    useAlarmStore.getState().dismiss();
    expect(useAlarmStore.getState().alarm).toBeNull();
  });

  test("snoozed flag survives trigger", () => {
    useAlarmStore.getState().trigger({ title: "Standup", snoozed: true });
    expect(useAlarmStore.getState().alarm?.snoozed).toBe(true);
    useAlarmStore.getState().dismiss();
  });
});