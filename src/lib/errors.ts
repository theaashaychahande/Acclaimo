const NETWORK_MESSAGE = /failed to fetch|fetch failed|networkerror|network request failed|load failed|err_network|err_internet_disconnected/i;

export const OFFLINE_MESSAGE = "You appear to be offline. Reconnect and try again.";
export const MAINTENANCE_MESSAGE =
  "Acclaimo is waking up or under maintenance. Please try again in a minute.";

/**
 * Turns a fetch failure into a message a student or organizer can act on.
 * Specific API messages are passed through so form errors stay precise.
 */
export function describeError(error: unknown, fallback: string): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return OFFLINE_MESSAGE;
  }

  if (error instanceof Error && error.message) {
    return NETWORK_MESSAGE.test(error.message) ? MAINTENANCE_MESSAGE : error.message;
  }

  return fallback;
}
