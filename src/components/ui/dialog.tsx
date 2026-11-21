/**
 * Themed replacement for React Native's Alert.alert. The native dialog follows
 * the system theme, not Seishin's, so a dark app showed bright system boxes
 * (and vice versa). Same call shape: showAlert(title, message?, buttons?).
 * <DialogHost /> is mounted once in app/_layout.tsx; alerts queue in order.
 */
import { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, type AlertButton } from "react-native";

interface Pending { id: number; title: string; message?: string; buttons: AlertButton[] }

let nextId = 1;
let queue: Pending[] = [];
const listeners = new Set<(q: Pending[]) => void>();
const emit = () => listeners.forEach((l) => l(queue));

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  queue = [...queue, { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] }];
  emit();
}

/** Test hook: what's on screen right now. */
export const currentAlert = (): Pending | undefined => queue[0];

function dismiss(id: number, press?: AlertButton) {
  queue = queue.filter((p) => p.id !== id);
  emit();
  press?.onPress?.();
}

const tone = (b: AlertButton) =>
  b.style === "destructive"
    ? { box: "bg-danger", text: "text-white" }
    : b.style === "cancel"
      ? { box: "border border-ink-200", text: "text-black" }
      : { box: "bg-black", text: "text-white" };

export function DialogHost() {
  const [q, setQ] = useState(queue);
  useEffect(() => {
    listeners.add(setQ);
    return () => { listeners.delete(setQ); };
  }, []);
  const top = q[0];
  if (!top) return null;
  // Cancel sits first (left / top), the way Android orders dialog actions.
  const buttons = [...top.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"));
  const stacked = buttons.length > 2;
  // Back button / outside tap = the cancel action, if the alert has one.
  const back = () => dismiss(top.id, top.buttons.find((b) => b.style === "cancel"));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={back} statusBarTranslucent>
      <View className="flex-1 items-center justify-center px-10" style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}>
        <View className="w-full max-w-[320px] bg-white rounded-2xl p-5 shadow-float" accessibilityViewIsModal>
          <Text className="text-base font-semibold text-black text-center mb-1.5" accessibilityRole="header">{top.title}</Text>
          {top.message ? <Text className="text-sm text-ink-500 text-center leading-5 mb-5">{top.message}</Text> : <View className="h-3" />}
          <View className={stacked ? "gap-2" : "flex-row gap-2.5"}>
            {buttons.map((b, i) => {
              const t = tone(b);
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  onPress={() => dismiss(top.id, b)}
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  className={`${stacked ? "" : "flex-1"} h-11 rounded-xl items-center justify-center px-3 ${t.box}`}
                >
                  <Text className={`text-sm font-medium ${t.text}`} numberOfLines={1}>{b.text ?? "OK"}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
