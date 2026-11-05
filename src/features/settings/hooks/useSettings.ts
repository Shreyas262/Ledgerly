import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { UserSettings } from "../types/settings";
import {
  getSettings,
  getSettingsSnapshot,
  saveSettings,
  subscribeToSettings,
} from "../utils/settingsStorage";

/** The signed-in user's preferences, updated live when they change. */
export function useSettings() {
  const snapshot = useSyncExternalStore(subscribeToSettings, getSettingsSnapshot);
  // The snapshot identifies the stored value; re-read only when it changes.
  const settings = useMemo(() => getSettings(), [snapshot]);
  const update = useCallback((updates: Partial<UserSettings>) => saveSettings({ ...getSettings(), ...updates }), []);
  return { settings, update };
}
