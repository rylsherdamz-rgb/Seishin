import { useEffect, useState } from "react";
import { Dimensions, Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from "react-native";

export interface KeyboardInset {
  /** Pixels of the window covered by the keyboard (0 when hidden). */
  inset: number;
  /** Window Y of the keyboard's top edge (window height when hidden). */
  top: number;
}

/**
 * Keyboard overlap for screens that lay themselves out above the keyboard.
 *
 * Android runs edge-to-edge (SDK 54+), so `adjustResize` no longer shrinks the
 * window and `endCoordinates.height` may or may not include the navigation
 * bar depending on device. Measuring from the keyboard's top edge
 * (`window height − screenY`) is correct either way, so content padded by
 * `inset` ends exactly where the keyboard begins.
 */
export function useKeyboardInset(): KeyboardInset {
  const [state, setState] = useState<KeyboardInset>(() => ({ inset: 0, top: Dimensions.get("window").height }));

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const apply = (e: KeyboardEvent | null) => {
      const winH = Dimensions.get("window").height;
      const top = e ? e.endCoordinates.screenY : winH;
      const inset = Math.max(0, winH - top);
      if (ios && e?.duration) {
        // Match the keyboard's own animation so the layout glides with it.
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setState((s) => (s.inset === inset && s.top === top ? s : { inset, top }));
    };
    const subs = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", apply),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => apply(null)),
      // Suggestion strip / emoji panel / floating keyboard resize the IME.
      Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidChangeFrame", apply),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return state;
}
