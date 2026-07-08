import { useState } from "react";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { getDocumentAsync } from "expo-document-picker";
import { recognizeText, cacheOcrResult, parseScheduleText } from "@/services/ocr";
import { useCalendarStore, CalendarEvent } from "@/stores/calendar-store";
import Feather from "@expo/vector-icons/Feather";

export default function ScanScreen() {
  const [uri, setUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { addEvent } = useCalendarStore();

  async function pickImage(fromCamera: boolean) {
    const picker = fromCamera ? launchCameraAsync : launchImageLibraryAsync;
    const result = await picker({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const selectedUri = result.assets[0].uri;
      setUri(selectedUri);
      setFileName(null);
      await runOcr(selectedUri);
    }
  }

  async function pickFile() {
    try {
      setLoading(true);
      const result = await getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        setUri(file.uri);
        setFileName(file.name || null);
        await runOcr(file.uri);
      }
    } catch {
      Alert.alert("Error", "Could not open file.");
    } finally {
      setLoading(false);
    }
  }

  async function runOcr(imageUri: string) {
    setLoading(true);
    setOcrText("");
    try {
      const text = await recognizeText(imageUri);
      setOcrText(text);
      cacheOcrResult(imageUri, text, []);
    } catch {
      Alert.alert("OCR Failed", "Could not recognize text in this image.");
    } finally {
      setLoading(false);
    }
  }

  function saveToCalendar() {
    const parsed = parseScheduleText(ocrText);
    if (parsed.length === 0) {
      Alert.alert("No Events Found", "Could not detect any dates or times in the text.");
      return;
    }

    parsed.forEach((p, i) => {
      const event: CalendarEvent = {
        id: `ocr-${Date.now()}-${i}`,
        title: p.title || "Untitled Event",
        startDate: p.startDate || new Date().toISOString(),
        endDate: p.endDate || new Date().toISOString(),
        source: "ocr",
        description: p.description,
      };
      addEvent(event);
    });

    Alert.alert("Saved", `${parsed.length} event${parsed.length > 1 ? "s" : ""} added to calendar.`);
    setUri(null);
    setOcrText("");
    setFileName(null);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-4">
        <Text className="text-2xl font-semibold tracking-tight text-black">Scan Schedule</Text>
        <Text className="text-sm text-ink-500 mt-0.5">
          Capture, select, or upload a file to extract schedule data
        </Text>
      </View>

      {!uri ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-ink-100 rounded-full items-center justify-center mb-6">
            <Feather name="camera" size={24} color="#999999" />
          </View>
          <Text className="text-sm text-ink-500 text-center mb-8 max-w-[240px]">
            Take a photo of your schedule, choose from gallery, or upload a file
          </Text>

          <TouchableOpacity
            onPress={() => pickImage(true)}
            className="bg-black h-12 w-full items-center justify-center rounded-lg mb-3 flex-row gap-2"
          >
            <Feather name="camera" size={16} color="#ffffff" />
            <Text className="text-white text-base font-medium">Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => pickImage(false)}
            className="bg-transparent border border-black h-12 w-full items-center justify-center rounded-lg mb-3 flex-row gap-2"
          >
            <Feather name="image" size={16} color="#000000" />
            <Text className="text-black text-base font-medium">Choose from Gallery</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-3 w-full mb-3">
            <View className="flex-1 h-px bg-ink-200" />
            <Text className="text-xs text-ink-300">or</Text>
            <View className="flex-1 h-px bg-ink-200" />
          </View>

          <TouchableOpacity
            onPress={pickFile}
            className="bg-transparent border border-ink-300 h-12 w-full items-center justify-center rounded-lg flex-row gap-2"
          >
            <Feather name="paperclip" size={16} color="#666666" />
            <Text className="text-ink-500 text-base font-medium">Upload File</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 px-4">
          {uri && (fileName ? (
            <View className="flex-row items-center gap-3 bg-ink-100 rounded-lg p-4 mb-4">
              <Feather name="file-text" size={20} color="#666666" />
              <View className="flex-1">
                <Text className="text-sm text-black font-medium" numberOfLines={1}>{fileName}</Text>
                <Text className="text-xs text-ink-300">Imported file</Text>
              </View>
            </View>
          ) : (
            <Image
              source={{ uri }}
              className="w-full h-48 rounded-lg mb-4 bg-ink-100"
              resizeMode="contain"
            />
          ))}

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <Feather name="loader" size={24} color="#999999" />
              <Text className="text-sm text-ink-500 mt-3">Processing image...</Text>
            </View>
          ) : (
            <View className="flex-1">
              <Text className="text-xs font-medium text-ink-500 uppercase tracking-wider mb-2">
                Extracted Text
              </Text>
              <View className="flex-1 bg-ink-100 rounded-lg p-4">
                <Text className="text-sm text-black leading-5">
                  {ocrText || "No text detected"}
                </Text>
              </View>

              <View className="flex-row gap-3 py-4">
                <TouchableOpacity
                  onPress={() => { setUri(null); setOcrText(""); setFileName(null); }}
                  className="flex-1 h-12 items-center justify-center rounded-lg border border-ink-200 flex-row gap-2"
                >
                  <Feather name="refresh-cw" size={14} color="#666666" />
                  <Text className="text-ink-500 text-sm font-medium">Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={saveToCalendar}
                  disabled={!ocrText}
                  className={`flex-1 h-12 items-center justify-center rounded-lg flex-row gap-2 ${
                    ocrText ? "bg-black" : "bg-ink-200"
                  }`}
                >
                  <Feather
                    name="calendar"
                    size={14}
                    color={ocrText ? "#ffffff" : "#999999"}
                  />
                  <Text
                    className={`text-sm font-medium ${
                      ocrText ? "text-white" : "text-ink-300"
                    }`}
                  >
                    Save to Calendar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
