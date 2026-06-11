export type TrainingLogEntry = {
  epoch: number;
  loss: number;
  accuracy: number;
};

const STORAGE_KEY = "my-next-game-training-logs";

export function loadPersistedTrainingLogs(): TrainingLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrainingLogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        typeof row.epoch === "number" &&
        typeof row.loss === "number" &&
        typeof row.accuracy === "number",
    );
  } catch {
    return [];
  }
}

export function persistTrainingLogs(logs: TrainingLogEntry[]): void {
  if (typeof window === "undefined" || !logs.length) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // quota / private mode
  }
}
