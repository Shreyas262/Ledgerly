import type { UserSettings } from "../types/settings";

const SETTINGS_STORAGE_KEY = "ledgerly.settings";

const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  currency: "INR",
  expenseNotifications: true,
};

const SETTINGS_CHANGE_EVENT = "ledgerly-settings-change";

export function getSettings(): UserSettings {
  const storedSettings = localStorage.getItem(
    SETTINGS_STORAGE_KEY,
  );

  if (!storedSettings) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsedSettings = JSON.parse(
      storedSettings,
    ) as Partial<UserSettings>;

    return {
      ...DEFAULT_SETTINGS,
      ...parsedSettings,
    };
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);

    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(
  settings: UserSettings,
): void {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );

  window.dispatchEvent(
    new Event(SETTINGS_CHANGE_EVENT),
  );
}

export function resetSettings(): UserSettings {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);

  window.dispatchEvent(
    new Event(SETTINGS_CHANGE_EVENT),
  );

  return DEFAULT_SETTINGS;
}