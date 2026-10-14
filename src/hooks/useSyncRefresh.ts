import { useCallback, useState } from "react";

/** Pull-to-refresh that runs a full sync of every connector (calendars, Todoist, Notion, feeds). */
export function useSyncRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { syncEverything } = await import("@/services/connectors/sync-all");
      await syncEverything("pull");
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}
