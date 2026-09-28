import type { UserSettings } from "../types/settings";

/**
 * Preferences are stored per user in this browser (§30.12), so people sharing
 * a browser keep their own. Before sign-in the device-level key is used.
 */
const DEVICE_KEY = "ledgerly.settings";
const userKey = (userId: string) => `${DEVICE_KEY}.${userId}`;

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  startPage: "/dashboard",
  notifications: {
    EXPENSE_UPDATES: true,
    REIMBURSEMENTS: true,
    REVIEW_QUEUE: true,
    POLICY_ALERTS: true,
    BUDGET_ALERTS: true,
  },
};

const SETTINGS_CHANGE_EVENT = "ledgerly-settings-change";

let currentUserId: string | null = null;

function read(key: string): Partial<UserSettings> | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as Partial<UserSettings>) : null;
  } catch {
    return null;
  }
}

function merge(stored: Partial<UserSettings> | null): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...stored?.notifications },
  };
}

const notifyChange = () => window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));

/**
 * Switches storage to the signed-in user (null when signed out). Pass
 * notify=false when called during render; subscribers read the new key anyway.
 */
export function setSettingsUser(userId: string | null, notify = true): void {
  if (userId === currentUserId) return;
  currentUserId = userId;
  // First use for this user: start from this browser's device preferences.
  if (userId && !read(userKey(userId))) {
    const device = read(DEVICE_KEY);
    if (device) {
      try {
        localStorage.setItem(userKey(userId), JSON.stringify({ theme: device.theme }));
      } catch {
        // Storage may be unavailable; defaults apply.
      }
    }
  }
  if (notify) notifyChange();
}

export function getSettings(): UserSettings {
  return merge(read(currentUserId ? userKey(currentUserId) : DEVICE_KEY));
}

/** A cheap, stable snapshot for useSyncExternalStore: the current key and its stored value. */
export function getSettingsSnapshot(): string {
  const key = currentUserId ? userKey(currentUserId) : DEVICE_KEY;
  try {
    return `${key}|${localStorage.getItem(key) ?? ""}`;
  } catch {
    return key;
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(currentUserId ? userKey(currentUserId) : DEVICE_KEY, JSON.stringify(settings));
    // Keep the sign-in page's theme in line with the last choice on this device.
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ theme: settings.theme }));
  } catch {
    // Storage may be unavailable; the choice applies for this visit only.
  }
  notifyChange();
}

/** Restores defaults, keeping which notifications have been read. */
export function resetSettings(): UserSettings {
  const next = { ...DEFAULT_SETTINGS, notificationsReadAt: getSettings().notificationsReadAt };
  saveSettings(next);
  return next;
}

export function subscribeToSettings(listener: () => void): () => void {
  window.addEventListener(SETTINGS_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SETTINGS_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
