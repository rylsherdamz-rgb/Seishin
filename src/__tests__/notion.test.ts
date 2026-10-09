jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
import { parseNotionId, detectProps } from "@/services/connectors/notion";

describe("parseNotionId", () => {
  it("extracts the id from share links and raw ids", () => {
    expect(parseNotionId("https://www.notion.so/myspace/Homework-1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6?v=abc")).toBe("1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6");
    expect(parseNotionId("1a2b3c4d-5e6f-47a8-b9c0-d1e2f3a4b5c6")).toBe("1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6");
    expect(parseNotionId("not a link")).toBeNull();
  });
});

describe("detectProps", () => {
  it("prefers a Due date and a Status column's Complete group", () => {
    const p = detectProps({
      Name: { type: "title" },
      Created: { type: "date" },
      Due: { type: "date" },
      Status: { type: "status", status: { options: [{ id: "a", name: "Not started" }, { id: "b", name: "Done" }, { id: "c", name: "Submitted" }], groups: [{ name: "To-do", option_ids: ["a"] }, { name: "Complete", option_ids: ["b", "c"] }] } },
    });
    expect(p).toEqual({ titleProp: "Name", dateProp: "Due", doneProp: "Status", doneType: "status", doneNames: ["Done", "Submitted"] });
  });

  it("falls back to a done checkbox", () => {
    expect(detectProps({ Task: { type: "title" }, "Done?": { type: "checkbox" } })).toMatchObject({ titleProp: "Task", dateProp: null, doneProp: "Done?", doneType: "checkbox" });
  });
});
