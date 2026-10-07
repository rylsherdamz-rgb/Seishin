import { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import BottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { COPY, LIMITS } from "@/constants/copy";
import { PickerModal } from "@/components/ui/PickerModal";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { dateKey } from "@/utils/recurrence";
import {
  atMinutes, DURATION_PRESETS, formatClock, formatDuration, REMINDER_OPTIONS, REPEAT_OPTIONS, type RepeatMode,
} from "./calendar-utils";
import { FieldCard, FieldLabel, NotesBox, PillRow, SwitchRow, WeekdayPicker } from "./EventFormParts";
import { useEventForm, type EventPrefill } from "./useEventForm";

type PickerTarget = "date" | "start" | "end" | null;

interface EventFormSheetProps {
  prefill: EventPrefill;
  onClose: () => void;
}

/** Create / edit an event. Mount it to open; it calls `onClose` when dismissed. */
export function EventFormSheet({ prefill, onClose }: EventFormSheetProps) {
  const C = useColors();
  const f = useEventForm(prefill);
  const sheetRef = useRef<BottomSheet>(null);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [notesOpen, setNotesOpen] = useState(!!(f.notes || f.attachments.length));
  const keyboardPad = useKeyboardPadding();
  const androidPad = Platform.OS === "android" ? keyboardPad : 0;
  const canSave = f.title.trim().length > 0;

  const close = () => {
    f.flushDraft();
    sheetRef.current?.close();
    onClose();
  };
  const submit = () => {
    if (f.save()) {
      sheetRef.current?.close();
      onClose();
    }
  };

  const key = dateKey(f.date);
  const pickerValue = picker === "date" ? f.date : atMinutes(key, picker === "end" ? f.endMin : f.startMin);
  const applyPicker = (d: Date) => {
    if (picker === "date") f.setDate(d);
    else if (picker === "start") f.changeStart(d.getHours() * 60 + d.getMinutes());
    else if (picker === "end") f.setEndMin(d.getHours() * 60 + d.getMinutes());
  };

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={["92%"]}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: C.white }}
        onChange={(i: number) => { if (i === -1) { f.flushDraft(); onClose(); } }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4 }}>
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity
              onPress={close}
              hitSlop={8}
              className="w-10 h-10 rounded-full bg-ink-50 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel={COPY.form.close}
            >
              <Feather name="x" size={18} color={C.ink600} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-black">{f.editingId ? COPY.form.editTitle : COPY.form.newTitle}</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              className={`px-4 h-10 rounded-full items-center justify-center ${canSave ? "bg-accent" : "bg-ink-100"}`}
            >
              <Text className={`text-sm font-bold ${canSave ? "text-accent-on" : "text-ink-300"}`}>{COPY.form.save}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 72 + androidPad }}
          >
            <TextInput
              className="text-2xl font-bold text-black py-2"
              placeholder={COPY.form.titlePlaceholder}
              maxLength={LIMITS.title}
              accessibilityLabel={COPY.form.titlePlaceholder}
              placeholderTextColor={C.ink200}
              value={f.title}
              onChangeText={f.setTitle}
              autoFocus={!f.editingId && !f.title}
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            <SwitchRow icon="sun" label={COPY.form.allDay} value={f.allDay} onChange={f.setAllDay} />

            <FieldCard
              className="mt-3"
              icon="calendar"
              label={COPY.form.date}
              value={f.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
              onPress={() => setPicker("date")}
            />

            {!f.allDay && (
              <>
                <View className="flex-row gap-3 mt-3">
                  <FieldCard className="flex-1" icon="clock" label={COPY.form.starts} value={formatClock(atMinutes(key, f.startMin))} onPress={() => setPicker("start")} />
                  <FieldCard className="flex-1" icon="flag" label={COPY.form.ends} value={formatClock(atMinutes(key, f.endMin))} onPress={() => setPicker("end")} />
                </View>
                {f.endsNextDay && (
                  <Text className="text-[11px] font-semibold text-ink-400 mt-2 ml-1">{COPY.form.endsNextDay}</Text>
                )}
                <FieldLabel>{COPY.form.duration}</FieldLabel>
                <PillRow
                  options={DURATION_PRESETS.map((d) => ({ value: d, label: formatDuration(d) }))}
                  value={DURATION_PRESETS.includes(f.duration) ? f.duration : null}
                  onChange={f.setDuration}
                />
              </>
            )}

            <FieldLabel>{COPY.form.repeat}</FieldLabel>
            <PillRow<RepeatMode>
              options={REPEAT_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
              value={f.repeat.mode === "everyday" ? "daily" : f.repeat.mode}
              onChange={(mode) => f.setRepeat((r) => ({ mode, weekdays: mode === "custom" ? r.weekdays : [] }))}
            />
            {f.repeat.mode === "custom" && <WeekdayPicker value={f.repeat.weekdays} onToggle={f.toggleWeekday} />}

            <FieldLabel>{COPY.form.reminder}</FieldLabel>
            <PillRow options={REMINDER_OPTIONS} value={f.reminder} onChange={f.setReminder} />

            <TouchableOpacity
              onPress={() => setNotesOpen((v) => !v)}
              activeOpacity={0.7}
              className="flex-row items-center justify-between"
              accessibilityRole="button"
              accessibilityState={{ expanded: notesOpen }}
            >
              <FieldLabel>{COPY.form.notes}</FieldLabel>
              <Feather name={notesOpen ? "chevron-up" : "chevron-down"} size={16} color={C.ink300} style={{ marginTop: 12 }} />
            </TouchableOpacity>
            {notesOpen && (
              <NotesBox
                notes={f.notes}
                onChangeNotes={f.setNotes}
                attachments={f.attachments}
                onRemove={(id) => f.setAttachments((prev) => prev.filter((a) => a.id !== id))}
                onCamera={() => f.attach(true)}
                onGallery={() => f.attach(false)}
                onScan={f.scan}
                ocrBusy={f.ocrBusy}
              />
            )}

            <TouchableOpacity
              onPress={submit}
              disabled={!canSave}
              activeOpacity={0.85}
              className={`h-14 rounded-2xl items-center justify-center mt-6 ${canSave ? "bg-accent shadow-raised" : "bg-ink-100"}`}
            >
              <Text className={`text-base font-bold ${canSave ? "text-accent-on" : "text-ink-300"}`}>
                {f.editingId ? COPY.form.saveEdit : COPY.form.saveNew}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>

      {Platform.OS === "android" && picker && (
        <DateTimePicker
          value={pickerValue}
          mode={picker === "date" ? "date" : "time"}
          onChange={(_, d) => { const target = picker; setPicker(null); if (d && target) applyPicker(d); }}
        />
      )}
      <PickerModal
        visible={Platform.OS !== "android" && picker !== null}
        title={picker === "date" ? COPY.form.selectDate : picker === "end" ? COPY.form.endTime : COPY.form.startTime}
        mode={picker === "date" ? "date" : "time"}
        value={pickerValue}
        onConfirm={applyPicker}
        onClose={() => setPicker(null)}
      />
    </>
  );
}
