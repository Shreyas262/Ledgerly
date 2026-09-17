import { getMockSession } from "../../../mocks/session";

export function getCurrentUserId(): string | null {
  return getMockSession()?.userId ?? null;
}