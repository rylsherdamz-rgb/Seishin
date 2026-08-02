import { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

interface PickerModalProps {
  visible: boolean;
  title: string;
  mode: "date" | "time";
  value: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
}

/**
 * Centered modal for picking a date or time (iOS inline picker).
 * Android uses the native dialog picker directly instead of this modal.
 */
export function PickerModal({ visible, title, mode, value, onConfirm, onClose }: PickerModalProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        className="flex-1 items-center justify-center px-10"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
      >
        <View className="w-full max-w-[320px] bg-white rounded-2xl p-5 shadow-float">
          <Text className="text-base font-semibold text-black text-center mb-4">{title}</Text>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="inline"
            onChange={(_, d) => { if (d) setDraft(d); }}
          />
          <View className="flex-row gap-2.5 mt-4">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 h-11 border border-ink-200 rounded-xl items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-sm font-medium text-black">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { onConfirm(draft); onClose(); }}
              className="flex-1 h-11 bg-black rounded-xl items-center justify-center"
              activeOpacity={0.85}
            >
              <Text className="text-sm font-medium text-white">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
