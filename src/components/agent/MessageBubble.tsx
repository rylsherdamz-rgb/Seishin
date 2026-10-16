import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { AgentMessage, AgentAttachment } from "@/stores/agent-store";
import { Markdown } from "@/components/Markdown";
import { Photo } from "@/components/ui/Photo";
import { useColors } from "@/theme/ThemeProvider";
import { useFormatTime } from "@/stores/theme-store";

/** "On-device · qwen2.5-1.5b" / "NVIDIA NIM · llama-3.1-8b-instruct". */
function providerLabel(m: AgentMessage): string {
  const name = m.model?.split("/").pop();
  const brain = m.provider === "local" ? "On-device" : "NVIDIA NIM";
  return name ? `${brain} · ${name}` : brain;
}

interface Props {
  item: AgentMessage;
  copied: boolean;
  onCopy: (text: string, id: string) => void;
}

/**
 * One chat message. Memoized on the message object: the store replaces only
 * the streaming message on each token, so every other bubble (and its
 * Markdown parse) is skipped while a reply streams in.
 */
export const MessageBubble = memo(function MessageBubble({ item, copied, onCopy }: Props) {
  const C = useColors();
  const fmt = useFormatTime();
  const isUser = item.role === "user";
  if (!isUser && !item.content) return null;
  const time = fmt(new Date(item.timestamp));

  return (
    <View className={`mb-3 ${isUser ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[86%] px-4 py-3 ${
          isUser
            ? "bg-accent rounded-[20px] rounded-br-md"
            : item.role === "tool"
              ? "bg-ink-25 rounded-[20px] rounded-bl-md border border-ink-100"
              : "bg-ink-50 rounded-[20px] rounded-bl-md"
        }`}
      >
        {item.toolName ? (
          <View className="flex-row items-center gap-1.5 mb-2 pb-2 border-b border-ink-100">
            <Feather name="check-circle" size={12} color={C.success} />
            <Text className="text-xs font-semibold text-ink-500 flex-1" numberOfLines={1}>{item.toolName}</Text>
          </View>
        ) : null}
        {isUser ? (
          <Text className="text-[15px] leading-[21px] text-accent-on">{item.content}</Text>
        ) : (
          <Markdown content={item.content} />
        )}
        {item.attachments && item.attachments.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5 mt-2">
            {item.attachments.map((att: AgentAttachment, i: number) =>
              att.type === "image" ? (
                <Photo key={i} uri={att.uri} width={80} height={80} radius={10} />
              ) : (
                <View key={i} className="flex-row items-center gap-1 bg-white/60 rounded-lg px-2 py-1.5">
                  <Feather name="file" size={12} color={C.ink500} />
                  <Text className="text-xs text-ink-600">{att.name || "File"}</Text>
                </View>
              ),
            )}
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center gap-3 mt-1 px-1">
        <Text className="text-[11px] text-ink-400">{time}</Text>
        {item.role === "assistant" && item.provider ? (
          <View className="flex-row items-center gap-1 shrink" accessibilityLabel={`Answered by ${providerLabel(item)}`}>
            <Feather name={item.provider === "local" ? "smartphone" : "cloud"} size={11} color={C.ink400} />
            <Text className="text-[11px] text-ink-400 shrink" numberOfLines={1}>{providerLabel(item)}</Text>
          </View>
        ) : null}
        {!isUser ? (
          <TouchableOpacity
            onPress={() => onCopy(item.content, item.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={copied ? "Copied" : "Copy message"}
            className="flex-row items-center gap-1"
          >
            <Feather name={copied ? "check" : "copy"} size={12} color={C.ink400} />
            <Text className="text-[11px] font-semibold text-ink-400">{copied ? "Copied" : "Copy"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});
