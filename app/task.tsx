import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useTodoStore } from "@/stores/todo-store";
import { useNotesStore } from "@/stores/notes-store";
import { useColors } from "@/theme/ThemeProvider";
import { Photo } from "@/components/ui/Photo";
import { dueLabel, type ReminderLevel } from "@/services/reminder-plan";
import { levelOf } from "@/services/task-reminders";

const LEVELS: { value: ReminderLevel; label: string }[] = [
  { value: "persistent", label: "Until done" },
  { value: "normal", label: "Before due" },
  { value: "off", label: "Off" },
];

/** Task detail: countdown, checklist of what to answer, reminders, source photos. */
export default function TaskScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const todo = useTodoStore((s) => s.todos.find((t) => t.id === id));
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const toggleItem = useTodoStore((s) => s.toggleItem);
  const updateTodo = useTodoStore((s) => s.updateTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const note = useNotesStore((s) => (todo?.noteId ? s.notes.find((n) => n.id === todo.noteId) : undefined));

  if (!todo) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-base font-semibold text-black">This task no longer exists</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 h-11 px-5 rounded-full bg-ink-50 justify-center">
          <Text className="text-sm font-semibold text-black">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const due = todo.dueDate ? new Date(todo.dueDate) : null;
  const items = todo.items ?? [];
  const doneCount = items.filter((i) => i.done).length;
  const overdue = !!due && !todo.completed && due.getTime() < Date.now();
  const photos = (note?.attachments ?? []).filter((a) => a.type === "image");
  const level = levelOf(todo);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center h-14 px-1">
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" className="w-12 h-12 items-center justify-center">
          <Feather name="arrow-left" size={22} color={C.ink800} />
        </TouchableOpacity>
        <View className="flex-1" />
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Delete task?", "Its reminders stop too. The source note is kept. This can't be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => { deleteTodo(todo.id); router.back(); } },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel="Delete task"
          className="w-12 h-12 items-center justify-center"
        >
          <Feather name="trash-2" size={20} color={C.ink700} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        {todo.subject ? <Text className="text-xs font-bold tracking-wide text-accent">{todo.subject.toUpperCase()}</Text> : null}
        <Text className={`text-[26px] font-bold leading-8 mt-1 ${todo.completed ? "text-ink-400 line-through" : "text-black"}`}>{todo.title}</Text>

        {due ? (
          <View className={`self-start flex-row items-center gap-2 mt-3 h-9 px-3.5 rounded-full ${overdue ? "bg-danger-soft" : "bg-ink-50"}`}>
            <Feather name="clock" size={14} color={overdue ? C.danger : C.ink700} />
            <Text className={`text-[13px] font-semibold ${overdue ? "text-danger" : "text-ink-800"}`}>
              {todo.completed ? "Done" : dueLabel(due, new Date())} · {due.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </Text>
          </View>
        ) : null}

        {items.length > 0 ? (
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold tracking-wide text-ink-500">TO ANSWER</Text>
              <Text className="text-xs font-semibold text-ink-500">{doneCount} of {items.length}</Text>
            </View>
            <View className="h-1.5 rounded-full bg-ink-75 overflow-hidden mb-2">
              <View className="h-full bg-accent rounded-full" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </View>
            {items.map((it, n) => (
              <TouchableOpacity
                key={it.id}
                onPress={() => toggleItem(todo.id, it.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: it.done }}
                className="flex-row items-start gap-3 py-3 border-b border-ink-75"
              >
                <View className={`w-6 h-6 rounded-md border-2 items-center justify-center mt-0.5 ${it.done ? "bg-accent border-accent" : "border-ink-300"}`}>
                  {it.done ? <Feather name="check" size={14} color={C.onAccent} /> : null}
                </View>
                <Text className={`flex-1 text-[15px] leading-[21px] ${it.done ? "text-ink-400 line-through" : "text-black"}`}>
                  {n + 1}. {it.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text className="text-xs font-bold tracking-wide text-ink-500 mt-6 mb-2">REMIND ME</Text>
        <View className="flex-row bg-ink-50 rounded-2xl p-1">
          {LEVELS.map((l) => {
            const on = level === l.value;
            return (
              <TouchableOpacity
                key={l.value}
                onPress={() => updateTodo(todo.id, { reminder: l.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                className={`flex-1 h-10 rounded-xl items-center justify-center ${on ? "bg-white shadow-subtle" : ""}`}
              >
                <Text className={`text-[13px] font-semibold ${on ? "text-black" : "text-ink-500"}`}>{l.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {note ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/note", params: { id: note.id } })}
            accessibilityRole="button"
            className="mt-6 rounded-2xl border border-ink-100 overflow-hidden"
          >
            {photos.length ? (
              <View className="flex-row" style={{ gap: 2 }}>
                {photos.slice(0, 3).map((p) => (
                  <View key={p.id} className="flex-1"><Photo uri={p.uri} width="100%" height={110} radius={0} /></View>
                ))}
              </View>
            ) : null}
            <View className="flex-row items-center gap-2 p-3.5">
              <Feather name="file-text" size={16} color={C.ink700} />
              <Text className="flex-1 text-sm font-semibold text-black">Open source note & scanned text</Text>
              <Feather name="chevron-right" size={16} color={C.ink400} />
            </View>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View className="px-5 pt-3 border-t border-ink-75" style={{ paddingBottom: insets.bottom + 12 }}>
        <TouchableOpacity
          onPress={() => toggleTodo(todo.id)}
          accessibilityRole="button"
          className={`h-14 rounded-2xl items-center justify-center flex-row gap-2 ${todo.completed ? "bg-ink-50" : "bg-accent"}`}
        >
          <Feather name={todo.completed ? "rotate-ccw" : "check"} size={18} color={todo.completed ? C.black : C.onAccent} />
          <Text className={`text-base font-bold ${todo.completed ? "text-black" : "text-accent-on"}`}>
            {todo.completed ? "Mark as not done" : "Mark as done — stop reminders"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
