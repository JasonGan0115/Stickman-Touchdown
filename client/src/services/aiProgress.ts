import AsyncStorage from '@react-native-async-storage/async-storage';

export const AI_LEVEL_STORAGE_KEY = 'touchdown.aiLevel';
const AI_CLEARED_STORAGE_KEY = 'touchdown.aiClearedLevels';

export async function getClearedAiLevels(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(AI_CLEARED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 100);
  } catch {
    return [];
  }
}

export async function markAiLevelCleared(level: number): Promise<number[]> {
  const clamped = Math.round(Math.min(100, Math.max(1, level)));
  const current = await getClearedAiLevels();
  if (current.includes(clamped)) return current;
  const next = [...current, clamped].sort((a, b) => a - b);
  try {
    await AsyncStorage.setItem(AI_CLEARED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}
