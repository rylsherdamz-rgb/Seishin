/**
 * Guards the --fs / --d CSS variables that ThemeProvider feeds into the
 * calc()-based type and spacing scale (tailwind.config.js). On native,
 * css-interop's calc() rejects string operands, so a stringified var drops
 * every padding/gap/font-size class and the whole UI collapses.
 */
import React from "react";
import { Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import postcss from "postcss";
import tailwind from "tailwindcss";
import { cssToReactNativeRuntime } from "react-native-css-interop/css-to-rn";
import { cssInterop, StyleSheet, vars } from "react-native-css-interop/dist/runtime/api.native";

const config = require("../../tailwind.config.js");

async function compile(classes: string) {
  const css = (
    await postcss([tailwind({ ...config, content: [{ raw: classes, extension: "html" }] })]).process(
      "@tailwind utilities;",
      { from: undefined },
    )
  ).css;
  StyleSheet.registerCompiled(cssToReactNativeRuntime(css, {}) as any);
}

const Box = cssInterop(View, { className: "style" }) as unknown as React.ComponentType<any>;
const Label = cssInterop(Text, { className: "style" }) as unknown as React.ComponentType<any>;

function render(fs: number | string, d: number | string) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <Box style={vars({ "--fs": fs, "--d": d } as any)}>
        <Box testID="box" className="p-4 gap-2 mt-4">
          <Label testID="label" className="text-base">x</Label>
        </Box>
      </Box>,
    );
  });
  // Read the host (native) node, not the cssInterop wrapper that shares its testID.
  const flat = (id: string) =>
    tree.root.findAll((n) => typeof n.type === "string" && n.props.testID === id)[0].props.style ?? {};
  return { box: flat("box"), label: flat("label") };
}

beforeAll(() => compile("p-4 gap-2 mt-4 text-base"));

test("numeric vars resolve padding, gap and font size", () => {
  const { box, label } = render(1.15, 1.15);
  expect(box.marginTop).toBe(14);
  expect(box.padding).toBeCloseTo(16.1);
  expect(box.gap).toBeCloseTo(8.05);
  expect(label.fontSize).toBeCloseTo(16.1);
});

test("string vars are dropped by native calc() (why ThemeProvider passes numbers)", () => {
  const { box, label } = render("1.15", "1.15");
  expect(box.padding).toBeUndefined();
  expect(label.fontSize).toBeUndefined();
});

test("exact-pixel tokens (text-15 …) follow the Text size setting", async () => {
  await compile("text-15 text-10");
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <Box style={vars({ "--fs": 1.25, "--d": 1 } as any)}>
        <Label testID="t15" className="text-15">x</Label>
        <Label testID="t10" className="text-10">x</Label>
      </Box>,
    );
  });
  const size = (id: string) => tree.root.findAll((n) => typeof n.type === "string" && n.props.testID === id)[0].props.style?.fontSize;
  expect(size("t15")).toBeCloseTo(18.75);
  expect(size("t10")).toBeCloseTo(12.5);
});
