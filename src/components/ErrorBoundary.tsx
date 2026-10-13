import { Component, type ReactNode } from "react";
import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/theme/ThemeProvider";
import { createLogger } from "@/utils/logger";

const log = createLogger("ErrorBoundary");

function WarningIcon() {
  const C = useColors();
  return <Feather name="alert-triangle" size={28} color={C.danger} />;
}

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    log.error("caught:", error?.name, error?.message, error?.stack || "");
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-white items-center justify-center px-8">
          <View className="w-16 h-16 bg-ink-100 rounded-full items-center justify-center mb-4">
            <WarningIcon />
          </View>
          <Text className="text-lg font-semibold text-black text-center mb-2">
            {this.props.fallbackTitle || "Something went wrong"}
          </Text>
          <Text className="text-sm text-ink-400 text-center mb-6">
            {this.props.fallbackSubtitle || "This screen hit an unexpected error. Your data is saved on this device."}
          </Text>
          <Button title="Try again" onPress={this.handleReset} />
        </View>
      );
    }

    return this.props.children;
  }
}