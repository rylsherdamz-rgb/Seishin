import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRef, type ComponentProps } from "react";
import { useColors } from "@/theme/ThemeProvider";
import { Sheet, type SheetHandle } from "./Sheet";

interface SheetOption {
  icon?: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  options?: SheetOption[];
  confirmLabel?: string;
  confirmDestructive?: boolean;
  onConfirm?: () => void;
}

export function SheetModal({ visible, onClose, title, message, options, confirmLabel, confirmDestructive, onConfirm }: SheetModalProps) {
  const T = useColors();
  const sheet = useRef<SheetHandle>(null);
  // Actions run after the sheet has animated away, so one that opens another
  // sheet, dialog or screen never stacks on top of a closing sheet.
  const then = (fn?: () => void) => sheet.current?.close(fn);
  // No snapPoints: the sheet sizes itself to its content (fitToContents).
  // Fixed snap points bypass content measurement and can present blank.
  return (
    <Sheet ref={sheet} open={visible} onClose={onClose} contentStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}>
        {title && (
          <Text className="text-base font-medium text-black mb-1">{title}</Text>
        )}
        {message && (
          <Text className="text-sm text-ink-400 mb-5">{message}</Text>
        )}
        {options?.map((opt, i) => (
          <View key={i}>
            {i > 0 && <View className="h-px bg-ink-100" />}
            <TouchableOpacity
              className="flex-row items-center gap-3 py-3.5"
              onPress={() => then(opt.onPress)}
            >
              {opt.icon && (
                <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                  <Feather name={opt.icon} size={16} color={opt.destructive ? T.danger : T.black} />
                </View>
              )}
              <Text className={`text-base ${opt.destructive ? "text-danger" : "text-black"}`}>{opt.label}</Text>
            </TouchableOpacity>
          </View>
        ))}
        {confirmLabel && onConfirm && (
          <TouchableOpacity
            className={`h-12 rounded-xl items-center justify-center ${confirmDestructive ? "bg-danger" : "bg-black"}`}
            onPress={() => then(onConfirm)}
          >
            <Text className="text-sm font-medium text-white">{confirmLabel}</Text>
          </TouchableOpacity>
        )}
        {!options && !confirmLabel && (
          <TouchableOpacity
            className="h-12 items-center justify-center"
            onPress={() => then()}
          >
            <Text className="text-sm text-ink-500">OK</Text>
          </TouchableOpacity>
        )}
    </Sheet>
  );
}
