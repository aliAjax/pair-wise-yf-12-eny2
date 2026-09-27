// 本地存档:仅负责 localStorage 读写,与盘点规则、界面解耦。

export function loadRecords<T>(storageKey: string, seed: () => T[]): T[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return seed();
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function saveRecords<T>(storageKey: string, records: T[]): void {
  localStorage.setItem(storageKey, JSON.stringify(records));
}
