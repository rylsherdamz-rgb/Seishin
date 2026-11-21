import { addToolCallDeltas, finishToolCalls } from "@/utils/tool-call-deltas";

test("joins argument fragments per index", () => {
  const acc: Parameters<typeof addToolCallDeltas>[0] = [];
  addToolCallDeltas(acc, [{ index: 0, id: "a", function: { name: "add_todo", arguments: '{"tit' } }]);
  addToolCallDeltas(acc, [{ index: 0, function: { arguments: 'le":"x"}' } }, { index: 1, id: "b", function: { name: "list_todos" } }]);
  expect(finishToolCalls(acc)).toEqual([
    { id: "a", name: "add_todo", arguments: '{"title":"x"}' },
    { id: "b", name: "list_todos", arguments: "{}" },
  ]);
});

test("keeps no-argument calls and fills a missing id", () => {
  const acc: Parameters<typeof addToolCallDeltas>[0] = [];
  addToolCallDeltas(acc, [{ function: { name: "list_events", arguments: "" } }]);
  expect(finishToolCalls(acc)).toEqual([{ id: "call_0", name: "list_events", arguments: "{}" }]);
});

test("drops fragments that never got a name", () => {
  const acc: Parameters<typeof addToolCallDeltas>[0] = [];
  addToolCallDeltas(acc, [{ index: 2, function: { arguments: "{}" } }]);
  expect(finishToolCalls(acc)).toEqual([]);
});
