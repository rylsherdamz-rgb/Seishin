import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { DialogHost, showAlert, currentAlert } from "@/components/ui/dialog";

const labels = (t: ReactTestRenderer) => t.root.findAllByType(TouchableOpacity).map((b) => b.findByType(Text).props.children);

it("shows queued alerts one at a time, cancel first, and runs the pressed action", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<DialogHost />); });
  const merge = jest.fn();
  act(() => {
    showAlert("Restore backup", "How?", [{ text: "Merge", onPress: merge }, { text: "Replace all", style: "destructive" }, { text: "Cancel", style: "cancel" }]);
    showAlert("Second");
  });
  expect(labels(tree)).toEqual(["Cancel", "Merge", "Replace all"]);
  act(() => tree.root.findAllByType(TouchableOpacity)[1].props.onPress());
  expect(merge).toHaveBeenCalled();
  expect(currentAlert()?.title).toBe("Second");
  expect(labels(tree)).toEqual(["OK"]);
  act(() => tree.root.findAllByType(TouchableOpacity)[0].props.onPress());
  expect(currentAlert()).toBeUndefined();
});

it("back button runs the cancel action", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<DialogHost />); });
  const cancel = jest.fn();
  act(() => showAlert("Delete?", undefined, [{ text: "Cancel", style: "cancel", onPress: cancel }, { text: "Delete", style: "destructive" }]));
  const { Modal } = require("react-native");
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(cancel).toHaveBeenCalled();
  expect(currentAlert()).toBeUndefined();
});
