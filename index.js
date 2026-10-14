// App entry: expo-router plus the Android home-screen widget handler, which
// must be registered at startup so the launcher can draw widgets even when
// the app isn't open.
import "expo-router/entry";
import { Platform } from "react-native";

if (Platform.OS === "android") {
  try {
    const { registerWidgetTaskHandler } = require("react-native-android-widget");
    registerWidgetTaskHandler((props) => require("./src/widgets/task-handler").widgetTaskHandler(props));
  } catch {
    // Build without the widget module (e.g. not rebuilt yet): app runs, no widgets.
  }
}
