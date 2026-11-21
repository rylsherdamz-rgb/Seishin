import { useState } from "react";
import { View } from "react-native";
import { Card } from "@/components/ui/Card";
import { useSettingsStore } from "@/stores/settings-store";
import { CollapsibleHeader, SectionHeader, type Notice } from "./rows";
import { OnDeviceModel } from "./OnDeviceModel";
import { NimConfig } from "./NimConfig";

/** AI providers: the on-device model first, NVIDIA NIM as an optional cloud fallback. */
export function AiSection({ onNotice }: { onNotice: Notice }) {
  const modelPath = useSettingsStore((s) => s.modelPath);
  const hasNim = useSettingsStore((s) => !!s.apiKeys.nim);
  const [open, setOpen] = useState(false);
  const subtitle = `${modelPath ? `On-device: ${modelPath.split("/").pop()}` : "On-device: no model yet"}${hasNim ? " · NVIDIA NIM ready" : " · NVIDIA NIM optional"}`;

  return (
    <>
      <SectionHeader title="AI Configuration" />
      <CollapsibleHeader icon="cpu" title="AI · on-device first" subtitle={subtitle} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <Card className="mb-4">
          <OnDeviceModel onNotice={onNotice} />
          <View className="h-px bg-ink-100 my-4" />
          <NimConfig onNotice={onNotice} />
        </Card>
      )}
    </>
  );
}
