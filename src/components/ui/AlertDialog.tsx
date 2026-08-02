import { Modal, View, Text, TouchableOpacity } from "react-native";

interface AlertDialogProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  confirmDestructive?: boolean;
  onConfirm?: () => void;
}

/**
 * Centered modal dialog for confirmations and alerts.
 * Use for destructive confirms and simple notices — not for action menus
 * (those belong in a bottom sheet).
 */
export function AlertDialog({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  confirmDestructive,
  onConfirm,
}: AlertDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 items-center justify-center px-10"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
      >
        <View className="w-full max-w-[320px] bg-white rounded-2xl p-5 shadow-float">
          {title && (
            <Text className="text-base font-semibold text-black text-center mb-1.5">
              {title}
            </Text>
          )}
          {message && (
            <Text className="text-sm text-ink-500 text-center leading-5 mb-5">
              {message}
            </Text>
          )}
          {onConfirm ? (
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 h-11 border border-ink-200 rounded-xl items-center justify-center"
                activeOpacity={0.7}
              >
                <Text className="text-sm font-medium text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { onClose(); onConfirm(); }}
                className={`flex-1 h-11 rounded-xl items-center justify-center ${
                  confirmDestructive ? "bg-danger" : "bg-black"
                }`}
                activeOpacity={0.85}
              >
                <Text className="text-sm font-medium text-white">
                  {confirmLabel || "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onClose}
              className="h-11 bg-black rounded-xl items-center justify-center"
              activeOpacity={0.85}
            >
              <Text className="text-sm font-medium text-white">OK</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
