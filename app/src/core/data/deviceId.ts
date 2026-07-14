// The cached id of THIS install — kept in a module with **no dependencies at all**.
//
// It lives apart from `deviceRepository` on purpose: the scheduler needs to ask "which phone am I?" on its hot
// path (`scheduleBlock`), and pulling the repository in would drag AsyncStorage, Firestore and expo-constants
// into every module that arms an alarm — including the ones that must keep working when none of those exist.
// One string, one setter, no imports.

let cached: string | null = null;

export function setSelfDeviceId(id: string): void {
  cached = id;
}

/** `null` until the app has identified itself (D70). Callers must treat that as "fire everywhere": an alarm on
 *  the wrong phone is an annoyance; an alarm on *no* phone is the product failing. */
export function selfDeviceIdSync(): string | null {
  return cached;
}
