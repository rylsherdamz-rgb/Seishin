import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  ActivityIndicator,
} from "react-native";
import { fetchAllSkills, fetchSkillsByCategory, fetchCategories, NPXSkill } from "@/services/npxskills";
import { addCustomSkill, getSkills, Skill } from "@/services/skills";
import Feather from "@expo/vector-icons/Feather";

export default function SkillsScreen() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [skills, setSkills] = useState<NPXSkill[]>([]);
  const [allSkills, setAllSkills] = useState<NPXSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [localSkillIds, setLocalSkillIds] = useState<string[]>([]);

  useEffect(() => {
    setLocalSkillIds(getSkills().map((s) => s.id));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
        const all = await fetchAllSkills();
        setAllSkills(all);
        setSkills(all);
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCategoryPress = useCallback(async (cat: string) => {
    if (selectedCategory === cat) {
      setSelectedCategory(null);
      setSkills(allSkills);
      return;
    }
    setSelectedCategory(cat);
    setLoading(true);
    try {
      const filtered = allSkills.filter((s) => s.category === cat);
      if (filtered.length > 0) {
        setSkills(filtered);
      } else {
        const fetched = await fetchSkillsByCategory(cat);
        setSkills((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newOnes = fetched.filter((s) => !existingIds.has(s.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
        setAllSkills((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newOnes = fetched.filter((s) => !existingIds.has(s.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
        setSkills(fetched);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, allSkills]);

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

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#000000" />
          <Text className="text-sm text-ink-400 mt-3">Loading skills...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Feather name="search" size={32} color="#cccccc" />
          <Text className="text-sm text-ink-300 mt-3 text-center">
            {search ? "No skills match your search" : "No skills available"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-8"
          showsVerticalScrollIndicator={false}
          renderItem={renderSkill}
        />
      )}
    </View>
  );
}
