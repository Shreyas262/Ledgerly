/**
 * Development-only compatibility export. The session cookie transport helper
 * is application infrastructure, not mock-specific domain logic.
 */
export {
  clearSessionCookie,
  getSessionCookie,
  getSessionCookieHeader,
  setSessionCookie,
} from "../services/auth/sessionCookie";
