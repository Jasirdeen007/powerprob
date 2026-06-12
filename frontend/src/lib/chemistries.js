const STORAGE_KEY = "powerprobe:batteryChemistries";

export const DEFAULT_CHEMISTRIES = ["LiPo", "LiFe", "Li-Ion", "NiMH", "NiCd", "Pb"];

function storageKeyForUser(userId) {
  const scopedUser = String(userId || "local-demo-user").trim() || "local-demo-user";
  return `${STORAGE_KEY}:${scopedUser}`;
}

function normalizeChemistries(items) {
  const merged = [...DEFAULT_CHEMISTRIES];
  for (const item of items ?? []) {
    const trimmed = String(item).trim();
    if (trimmed && !merged.includes(trimmed)) {
      merged.push(trimmed);
    }
  }
  return merged;
}

export function loadChemistries(userId) {
  try {
    const userRaw = localStorage.getItem(storageKeyForUser(userId));
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    const raw = userRaw || legacyRaw;
    if (!raw) return [...DEFAULT_CHEMISTRIES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_CHEMISTRIES];
    return normalizeChemistries(parsed);
  } catch {
    return [...DEFAULT_CHEMISTRIES];
  }
}

export function saveCustomChemistry(name, userId) {
  const trimmed = String(name).trim();
  if (!trimmed) return loadChemistries(userId);
  const current = loadChemistries(userId);
  if (current.includes(trimmed)) return current;
  const customOnly = current.filter((c) => !DEFAULT_CHEMISTRIES.includes(c));
  customOnly.push(trimmed);
  localStorage.setItem(storageKeyForUser(userId), JSON.stringify(customOnly));
  return loadChemistries(userId);
}
