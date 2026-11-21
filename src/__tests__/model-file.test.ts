import { planModelSave } from "@/utils/model-file";

const DIR = "file:///data/docs/Models/";

test("copies a newly picked model and removes the one it replaces", () => {
  expect(planModelSave("content://pick/qwen.gguf", `${DIR}llama.gguf`, "qwen.gguf", DIR)).toEqual({
    kind: "copy", from: "content://pick/qwen.gguf", dest: `${DIR}qwen.gguf`, remove: `${DIR}llama.gguf`,
  });
});

test("saving the model already in place copies nothing", () => {
  expect(planModelSave(`${DIR}llama.gguf`, `${DIR}llama.gguf`, "llama.gguf", DIR)).toEqual({ kind: "unchanged" });
});

test("never deletes a file Seishin didn't copy, nor the destination itself", () => {
  expect(planModelSave("content://pick/a.gguf", "file:///sdcard/a.gguf", "a.gguf", DIR)).toMatchObject({ remove: null });
  expect(planModelSave("content://pick/a.gguf", `${DIR}a.gguf`, "a.gguf", DIR)).toMatchObject({ kind: "copy", remove: null });
});

test("clearing forgets the model and deletes our copy", () => {
  expect(planModelSave("", `${DIR}a.gguf`, "", DIR)).toEqual({ kind: "clear", remove: `${DIR}a.gguf` });
  expect(planModelSave("", null, "", DIR)).toEqual({ kind: "clear", remove: null });
});

test("file names can't escape the Models folder", () => {
  expect(planModelSave("content://x", null, "../../evil.gguf", DIR)).toMatchObject({ dest: `${DIR}.._.._evil.gguf` });
});
