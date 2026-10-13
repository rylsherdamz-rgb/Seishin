import { createRef } from "react";
import { Text } from "react-native";
import { create, act } from "react-test-renderer";

const render = (el: React.ReactElement) => {
  let r!: ReturnType<typeof create>;
  act(() => { r = create(el); });
  return { rerender: (next: React.ReactElement) => act(() => r.update(next)) };
};
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";

const mockPresent = jest.fn();
let mockDismissed: (() => void) | null = null;

jest.mock("@expo/ui/community/bottom-sheet", () => {
  const ReactMod = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    // Like the native sheet: close() animates, then reports -1 later.
    default: ({ ref, onChange, children }: { ref?: unknown; onChange?: (i: number) => void; children?: unknown }) => {
      ReactMod.useImperativeHandle(ref, () => ({
        present: mockPresent,
        close: () => { mockDismissed = () => onChange?.(-1); },
      }));
      return ReactMod.createElement(View, null, children);
    },
    BottomSheetView: ({ children }: { children?: unknown }) => ReactMod.createElement(View, null, children),
  };
});

jest.mock("@/theme/ThemeProvider", () => ({ useColors: () => ({ white: "#fff" }) }));

beforeEach(() => {
  mockPresent.mockClear();
  mockDismissed = null;
});

describe("Sheet", () => {
  it("presents when opened", () => {
    render(<Sheet open onClose={() => {}}><Text>hi</Text></Sheet>);
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });

  it("runs onClose and the follow-up only after the native sheet is gone", () => {
    const ref = createRef<SheetHandle>();
    const order: string[] = [];
    render(<Sheet ref={ref} open onClose={() => order.push("closed")}><Text>hi</Text></Sheet>);

    act(() => ref.current?.close(() => order.push("then")));
    expect(order).toEqual([]); // still animating — parent must not unmount yet

    act(() => mockDismissed?.());
    expect(order).toEqual(["closed", "then"]);
  });

  it("falls back if the native sheet never reports dismissal", () => {
    jest.useFakeTimers();
    const ref = createRef<SheetHandle>();
    const onClose = jest.fn();
    render(<Sheet ref={ref} open onClose={onClose}><Text>hi</Text></Sheet>);

    act(() => ref.current?.close());
    act(() => { jest.advanceTimersByTime(1000); });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => mockDismissed?.()); // late report is ignored
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("closes with animation when the parent flips open to false", () => {
    const onClose = jest.fn();
    const { rerender } = render(<Sheet open onClose={onClose}><Text>hi</Text></Sheet>);
    rerender(<Sheet open={false} onClose={onClose}><Text>hi</Text></Sheet>);
    expect(mockDismissed).not.toBeNull();
    act(() => mockDismissed?.());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
