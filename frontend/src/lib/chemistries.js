const STORAGE_KEY = "powerprobe:batteryChemistries";

export const DEFAULT_CHEMISTRIES = ["LiPo", "LiFe", "Li-Ion", "NiMH", "NiCd", "Pb"];

export function loadChemistries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_CHEMISTRIES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_CHEMISTRIES];
    const merged = [...DEFAULT_CHEMISTRIES];
    for (const item of parsed) {
      const trimmed = String(item).trim();
      if (trimmed && !merged.includes(trimmed)) {
        merged.push(trimmed);
      }
    }
    return merged;
  } catch {
    return [...DEFAULT_CHEMISTRIES];
  }
}

export function saveCustomChemistry(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return loadChemistries();
  const current = loadChemistries();
  if (current.includes(trimmed)) return current;
  const customOnly = current.filter((c) => !DEFAULT_CHEMISTRIES.includes(c));
  customOnly.push(trimmed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  return loadChemistries();
}
