import { useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Sheet } from "@/components/ui/Sheet";
import { TierBadge } from "@/components/ui/TierBadge";
import { useColors } from "@/theme/ThemeProvider";

const SNAP = ["40%", "50%"];

/** Searchable list of NIM model ids in a bottom sheet. */
export function ModelPicker({ open, loading, models, selected, onSelect, onClose }: {
  open: boolean;
  loading: boolean;
  models: string[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const T = useColors();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => models.filter((m) => m.toLowerCase().includes(search.toLowerCase())), [models, search]);
  const close = useCallback(() => { setSearch(""); onClose(); }, [onClose]);

  const renderItem = useCallback(({ item }: { item: string }) => {
    const on = item === selected;
    return (
      <TouchableOpacity onPress={() => { onSelect(item); close(); }} className={`flex-row items-center gap-3 py-3 px-3 rounded-lg mb-1 ${on ? "bg-black" : "bg-ink-100"}`}>
        <Feather name="cpu" size={14} color={on ? T.white : T.ink300} />
        <Text className={`text-sm flex-1 ${on ? "text-white font-medium" : "text-black"}`} numberOfLines={1}>{item}</Text>
        <TierBadge modelId={item} />
        {on && <Feather name="check" size={14} color={T.white} />}
      </TouchableOpacity>
    );
  }, [selected, onSelect, close, T]);

  return (
    <Sheet open={open} onClose={close} snapPoints={SNAP} contentStyle={{ flex: 1, paddingHorizontal: 20, paddingTop: 0, paddingBottom: 40 }}>
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold tracking-tightest text-black">Select Model</Text>
        <TouchableOpacity onPress={close} accessibilityLabel="Close" className="w-8 h-8 bg-ink-100 rounded-full items-center justify-center">
          <Feather name="x" size={16} color={T.ink500} />
        </TouchableOpacity>
      </View>
      <TextInput
        className="h-12 bg-ink-50 rounded-xl px-4 text-sm text-black mb-4"
        placeholder="Search models..."
        placeholderTextColor={T.ink300}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={T.black} />
          <Text className="text-sm text-ink-400 mt-3">Loading models...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Feather name="search" size={24} color={T.ink200} />
          <Text className="text-sm text-ink-300 mt-2">{models.length === 0 ? "No models found" : "No matches"}</Text>
        </View>
      ) : (
        <FlatList data={filtered} keyExtractor={(m) => m} showsVerticalScrollIndicator={false} removeClippedSubviews maxToRenderPerBatch={20} windowSize={10} renderItem={renderItem} />
      )}
    </Sheet>
  );
}
