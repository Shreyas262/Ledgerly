import type { User } from "../types/auth";

let currentUser: User | null = null;

export function getMockSession() {
  return currentUser;
}

export function setMockSession(user: User) {
  currentUser = user;
}

export function clearMockSession() {
  currentUser = null;
}