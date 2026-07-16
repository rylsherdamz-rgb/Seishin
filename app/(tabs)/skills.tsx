import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, ActivityIndicator,
} from "react-native";
import { fetchCategories, fetchSkillBatch, NPXSkill } from "@/services/npxskills";
import { addCustomSkill, getSkills } from "@/services/skills";
import Feather from "@expo/vector-icons/Feather";

const PAGE_SIZE = 5;

export default function SkillsScreen() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [skills, setSkills] = useState<NPXSkill[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalInCategory, setTotalInCategory] = useState(0);
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [localSkillIds, setLocalSkillIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    setLocalSkillIds(getSkills().map((s) => s.id));
    fetchCategories()
      .then(setCategories)
      .catch((e) => setError(e.message || "Could not load skills catalog"));
  }, []);

  const handleCategoryPress = useCallback(async (cat: string) => {
    if (selectedCategory === cat) {
      setSelectedCategory(null);
      setSkills([]);
      return;
    }
    setSelectedCategory(cat);
    setSkills([]);
    setError(null);
    setLoadingCat(true);
    offsetRef.current = 0;
    try {
      const { skills: batch, total } = await fetchSkillBatch(cat, 0, PAGE_SIZE);
      setSkills(batch);
      setTotalInCategory(total);
      offsetRef.current = batch.length;
    } catch (e: any) {
      setError(e.message || "Failed to load skills");
    } finally {
      setLoadingCat(false);
    }
  }, [selectedCategory]);

  const handleLoadMore = useCallback(async () => {
    if (!selectedCategory || loadingMore) return;
    setLoadingMore(true);
    try {
      const { skills: batch } = await fetchSkillBatch(selectedCategory, offsetRef.current, PAGE_SIZE);
      setSkills((prev) => [...prev, ...batch]);
      offsetRef.current += batch.length;
    } finally {
      setLoadingMore(false);
    }
  }, [selectedCategory, loadingMore]);

  const handleInstall = useCallback(async (skill: NPXSkill) => {
    setInstalling(skill.id);
    try {
      const updated = addCustomSkill({
        id: `npx-${skill.id}`,
        name: skill.name,
        description: skill.description,
        content: skill.content,
        enabled: true,
      });
      setLocalSkillIds(updated.map((s) => s.id));
    } finally {
      setInstalling(null);
    }
  }, []);

  const filtered = useMemo(() => {
    if (!search) return skills;
    const q = search.toLowerCase();
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [search, skills]);

  const hasMore = offsetRef.current < totalInCategory;

  const renderSkill = useCallback(({ item }: { item: NPXSkill }) => {
    const installed = localSkillIds.includes(`npx-${item.id}`);
    return (
      <View className="bg-white border border-ink-100 rounded-xl p-4 mb-3">
        <View className="flex-row items-start gap-2 mb-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-black">{item.name}</Text>
              <View className="px-1.5 py-0.5 bg-ink-100 rounded">
                <Text className="text-[9px] text-ink-500 font-medium uppercase">{item.category}</Text>
              </View>
            </View>
            <Text className="text-xs text-ink-400 mt-1 leading-4" numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        </View>
        {installed ? (
          <View className="flex-row items-center gap-1.5">
            <Feather name="check-circle" size={12} color="#22c55e" />
            <Text className="text-xs text-green-600 font-medium">Installed</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => handleInstall(item)}
            disabled={installing === item.id}
            className="bg-black rounded-lg px-4 py-2 self-start"
          >
            {installing === item.id ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-xs text-white font-semibold">Install</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }, [handleInstall, installing, localSkillIds]);

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2">
        <Text className="text-2xl font-semibold tracking-tightest text-black mb-1">Skills</Text>
        <Text className="text-sm text-ink-400 mb-3">
          Browse & install skills from npxskills.xyz
        </Text>
        <TextInput
          className="h-10 bg-ink-50 rounded-xl px-4 text-sm text-black mb-3"
          placeholder="Search skills..."
          placeholderTextColor="#999999"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => handleCategoryPress(cat)}
              className={`px-3 py-1.5 rounded-full mr-2 ${
                selectedCategory === cat ? "bg-black" : "bg-ink-100"
              }`}
            >
              <Text className={`text-xs font-medium ${
                selectedCategory === cat ? "text-white" : "text-ink-600"
              }`}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Feather name="alert-circle" size={32} color="#ff3b30" />
          <Text className="text-sm text-danger mt-3 text-center">{error}</Text>
        </View>
      ) : loadingCat ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#000000" />
          <Text className="text-sm text-ink-400 mt-3">Loading skills...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Feather name="search" size={32} color="#cccccc" />
          <Text className="text-sm text-ink-300 mt-3 text-center">
            {search ? "No skills match your search" : selectedCategory ? "No skills in this category" : "Select a category above"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-8"
          showsVerticalScrollIndicator={false}
          renderItem={renderSkill}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                onPress={handleLoadMore}
                disabled={loadingMore}
                className="bg-ink-100 rounded-xl py-3 items-center justify-center mt-2"
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#666666" />
                ) : (
                  <Text className="text-sm text-ink-600 font-medium">
                    Load more ({totalInCategory - skills.length} remaining)
                  </Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}
