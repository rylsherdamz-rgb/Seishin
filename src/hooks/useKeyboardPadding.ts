import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Height of the on-screen keyboard (0 when hidden).
 *
 * Expo SDK 54+ runs edge-to-edge on Android, where windowSoftInputMode
 * adjustResize no longer shrinks the window, so the keyboard overlays
 * bottom inputs and the JS side must pad for it.
 */
export function useKeyboardPadding(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const showSub = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}
