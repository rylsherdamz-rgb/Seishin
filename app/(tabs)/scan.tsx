import { useState } from "react";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { recognizeText, cacheOcrResult, parseScheduleText } from "@/services/ocr";
import { useCalendarStore, CalendarEvent } from "@/stores/calendar-store";

export default function ScanScreen() {
  const [uri, setUri] = useState<string | null>(null);
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
      await runOcr(selectedUri);
    }
  }

  async function runOcr(imageUri: string) {
    setLoading(true);
    setOcrText("");
    try {
      const text = await recognizeText(imageUri);
      setOcrText(text);
      cacheOcrResult(imageUri, text, []);
    } catch (e) {
      Alert.alert("OCR Failed", "Could not recognize text in this image.");
    } finally {
      setLoading(false);
    }
  }

  function saveToCalendar() {
    const parsed = parseScheduleText(ocrText);
    if (parsed.length === 0) {
      Alert.alert("No events found", "Could not detect any dates/times in the text.");
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
  }

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-4">
        <Text className="text-2xl font-semibold text-black">Scan Schedule</Text>
      </View>

      {!uri ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-gray-500 text-center mb-8">
            Take a photo of your schedule or choose from your gallery
          </Text>

          <TouchableOpacity
            onPress={() => pickImage(true)}
            className="bg-black h-14 w-full items-center justify-center rounded-lg mb-4"
          >
            <Text className="text-white text-base font-medium">Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => pickImage(false)}
            className="bg-transparent border border-black h-14 w-full items-center justify-center rounded-lg"
          >
            <Text className="text-black text-base font-medium">Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 px-4">
          {uri && (
            <Image
              source={{ uri }}
              className="w-full h-48 rounded-lg mb-4 bg-ink-100"
              resizeMode="contain"
            />
          )}

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-base text-gray-500">Processing...</Text>
            </View>
          ) : (
            <View className="flex-1">
              <Text className="text-sm text-gray-500 mb-2">Extracted Text:</Text>
              <View className="flex-1 bg-ink-100 p-4 rounded-lg">
                <Text className="text-sm text-black">
                  {ocrText || "No text detected"}
                </Text>
              </View>

              <View className="flex-row gap-3 py-4">
                <TouchableOpacity
                  onPress={() => { setUri(null); setOcrText(""); }}
                  className="flex-1 h-12 items-center justify-center rounded-lg border border-black"
                >
                  <Text className="text-black text-sm font-medium">Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={saveToCalendar}
                  disabled={!ocrText}
                  className={`flex-1 h-12 items-center justify-center rounded-lg ${
                    ocrText ? "bg-black" : "bg-gray-200"
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    ocrText ? "text-white" : "text-gray-500"
                  }`}>
                    Save to Calendar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
