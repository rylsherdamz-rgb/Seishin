import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useTodoStore } from "@/stores/todo-store";
import { useThemeStore } from "@/stores/theme-store";
import { uid } from "@/utils/id";
import { groupTasks, type TaskListRow } from "@/utils/task-groups";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { TaskComposer } from "@/components/tasks/TaskComposer";
import { useColors } from "@/theme/ThemeProvider";

type TaskRow = Extract<TaskListRow, { kind: "task" }>;

/** One task: round checkbox (as on the widget), title, due line. Memoized so ticking one task re-renders one row. */
const TaskItem = memo(function TaskItem({ row, onToggle }: { row: TaskRow; onToggle: (id: string) => void }) {
  const C = useColors();
  const { todo } = row;
  const sub = [row.due, row.progress ? `${row.progress} done` : ""].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: "/task", params: { id: todo.id } })}
      activeOpacity={0.7}
      accessibilityRole="button"
      className="flex-row items-center min-h-[56px] pr-4"
    >
      <TouchableOpacity
        onPress={() => onToggle(todo.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.completed }}
        accessibilityLabel={`Mark ${todo.title} ${todo.completed ? "not done" : "done"}`}
        className="w-14 h-14 items-center justify-center"
      >
        <View className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${todo.completed ? "bg-accent border-accent" : row.overdue ? "border-danger" : "border-ink-300"}`}>
          {todo.completed ? <Feather name="check" size={13} color={C.onAccent} /> : null}
        </View>
      </TouchableOpacity>
      <View className="flex-1 py-2">
        <Text className={`text-[15px] ${todo.completed ? "line-through text-ink-400" : "text-black"}`} numberOfLines={2}>
          {todo.title}
        </Text>
        {sub ? <Text className={`text-xs mt-0.5 ${row.overdue ? "text-danger" : "text-ink-500"}`} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </TouchableOpacity>
  );
});

export default function TodoScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { eventId, add } = useLocalSearchParams<{ eventId?: string; add?: string }>();
  const todos = useTodoStore((s) => s.todos);
  const loadTodos = useTodoStore((s) => s.loadTodos);
  const addTodo = useTodoStore((s) => s.addTodo);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const clearCompleted = useTodoStore((s) => s.clearCompleted);
  const timeFormat = useThemeStore((s) => s.timeFormat);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const keyboardPadding = useKeyboardPadding();

  useEffect(() => { loadTodos(); }, [loadTodos]);
  const rows = useMemo(() => groupTasks(todos, new Date(), { showCompleted, timeFormat }), [todos, showCompleted, timeFormat]);
  const openCount = useMemo(() => todos.reduce((n, t) => n + (t.completed ? 0 : 1), 0), [todos]);
  const doneCount = todos.length - openCount;

  const handleAdd = useCallback((title: string, due: Date | null) => {
    addTodo({
      id: uid("todo"),
      title,
      completed: false,
      priority: "medium",
      category: "general",
      tags: [],
      createdAt: new Date().toISOString(),
      dueDate: due ? due.toISOString() : undefined,
      eventId: eventId || undefined,
    });
  }, [eventId, addTodo]);

  const onToggle = useCallback((id: string) => { toggleTodo(id); }, [toggleTodo]);

  const renderItem = useCallback(({ item }: { item: TaskListRow }) => {
    if (item.kind === "task") return <TaskItem row={item} onToggle={onToggle} />;
    const completed = item.section === "completed";
    return (
      <View className="flex-row items-center justify-between px-4 pt-5 pb-1">
        <TouchableOpacity
          disabled={!completed}
          onPress={() => setShowCompleted((v) => !v)}
          accessibilityRole={completed ? "button" : "header"}
          accessibilityState={completed ? { expanded: showCompleted } : undefined}
          className="flex-row items-center gap-1 h-8"
        >
          <Text className={`text-xs font-bold tracking-widest ${item.section === "overdue" ? "text-danger" : "text-ink-500"}`}>
            {item.label.toUpperCase()} · {item.count}
          </Text>
          {completed ? <Feather name={showCompleted ? "chevron-up" : "chevron-down"} size={14} color={C.ink500} /> : null}
        </TouchableOpacity>
        {completed ? (
          <TouchableOpacity onPress={() => setShowClearConfirm(true)} accessibilityRole="button" hitSlop={8} className="h-8 justify-center">
            <Text className="text-xs font-semibold text-ink-500">Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [onToggle, showCompleted, C]);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center h-14 px-1">
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" className="w-12 h-12 items-center justify-center">
          <Feather name="arrow-left" size={22} color={C.ink800} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-black">Tasks</Text>
        <Text className="text-sm text-ink-500 pr-4">{openCount} open</Text>
      </View>

      {/* `add=1` when opened from the Tasks / Quick add widget. */}
      <TaskComposer onAdd={handleAdd} autoFocus={add === "1"} />

      {rows.length > 0 ? (
        <FlashList
          data={rows}
          keyExtractor={(r) => r.id}
          getItemType={(r) => r.kind}
          renderItem={renderItem}
          extraData={showCompleted}
          contentContainerStyle={{ paddingBottom: insets.bottom + keyboardPadding + 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      ) : (
        <EmptyState icon="check-square" title="No tasks yet" subtitle="Type above to add your first task" />
      )}

      <AlertDialog
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear completed"
        message={`Delete ${doneCount} completed task${doneCount === 1 ? "" : "s"}? This can't be undone.`}
        confirmLabel="Clear"
        confirmDestructive
        onConfirm={clearCompleted}
      />
    </View>
  );
}
