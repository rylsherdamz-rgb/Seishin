import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import BottomSheet, { BottomSheetView, type BottomSheetMethods } from "@expo/ui/community/bottom-sheet";
import { useColors } from "@/theme/ThemeProvider";

export interface SheetHandle {
  /** Animate the sheet away, then run `then` (navigate, open another sheet…). */
  close: (then?: () => void) => void;
}

interface SheetProps {
  open: boolean;
  /** Called once the sheet has fully dismissed — safe to unmount it then. */
  onClose: () => void;
  snapPoints?: (string | number)[];
  dismissible?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

const CLOSE_FALLBACK_MS = 700;

/**
 * The one bottom sheet every screen uses. The native sheet lives in its own
 * Android window: unmounting it, or navigating, while it is still showing
 * leaves an empty sheet floating over the app. So this always animates the
 * sheet closed first and only then tells the parent (`onClose`) or runs the
 * follow-up action passed to `close(then)`.
 */
export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet(
  { open, onClose, snapPoints, dismissible = true, contentStyle, children },
  ref,
) {
  const C = useColors();
  const native = useRef<BottomSheetMethods>(null);
  const shown = useRef(false);
  const after = useRef<(() => void) | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finish = useCallback(() => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    const next = after.current;
    after.current = null;
    if (shown.current) {
      shown.current = false;
      onCloseRef.current();
    }
    next?.();
  }, []);

  const close = useCallback((then?: () => void) => {
    if (then) after.current = then;
    if (!shown.current) return finish();
    native.current?.close();
    // If the native sheet never reports back, don't strand the follow-up.
    if (!fallback.current) fallback.current = setTimeout(finish, CLOSE_FALLBACK_MS);
  }, [finish]);

  useImperativeHandle(ref, () => ({ close }), [close]);

  useEffect(() => {
    if (open && !shown.current) {
      shown.current = true;
      native.current?.present();
    } else if (!open && shown.current) {
      close();
    }
  }, [open, close]);

  useEffect(() => () => { if (fallback.current) clearTimeout(fallback.current); }, []);

  return (
    <BottomSheet
      ref={native}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={dismissible}
      backgroundStyle={{ backgroundColor: C.white }}
      onChange={(i: number) => { if (i === -1) finish(); }}
    >
      <BottomSheetView style={contentStyle}>{children}</BottomSheetView>
    </BottomSheet>
  );
});
