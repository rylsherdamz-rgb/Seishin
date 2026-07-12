import { View, Text, TouchableOpacity, Modal } from "react-native";
import Feather from "@expo/vector-icons/Feather";

interface SheetOption {
  icon?: React.ComponentProps<typeof Feather>["name"];
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
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 justify-end bg-black/40" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} className="bg-white rounded-t-2xl px-4 pb-8 pt-2" onPress={() => {}}>
          <View className="w-10 h-1 bg-ink-200 rounded-full self-center mb-5" />
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
                onPress={() => { onClose(); opt.onPress(); }}
              >
                {opt.icon && (
                  <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                    <Feather name={opt.icon} size={16} color={opt.destructive ? "#ff3b30" : "#000"} />
                  </View>
                )}
                <Text className={`text-base ${opt.destructive ? "text-danger" : "text-black"}`}>{opt.label}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {confirmLabel && onConfirm && (
            <TouchableOpacity
              className={`h-12 rounded-xl items-center justify-center ${confirmDestructive ? "bg-danger" : "bg-black"}`}
              onPress={() => { onClose(); onConfirm(); }}
            >
              <Text className="text-sm font-medium text-white">{confirmLabel}</Text>
            </TouchableOpacity>
          )}
          {!options && !confirmLabel && (
            <TouchableOpacity
              className="h-12 items-center justify-center"
              onPress={onClose}
            >
              <Text className="text-sm text-ink-500">OK</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
