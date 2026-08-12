/** The scenario-management UI is intentionally kept to a small, predictable catalog. */
export const MAX_SCENARIO_ENTRIES = 16;

export interface ScenarioCatalogEntry {
  scenarioId: string;
  title: string;
}

/**
 * Produces the bounded, deterministic catalog shown by My Scenarios.
 * The active entry is retained when a legacy catalog contains more entries
 * than the supported UI limit, so a running scenario is never hidden.
 */
export function limitScenarioCatalogEntries<T extends ScenarioCatalogEntry>(
  entries: T[],
  activeScenarioId?: string,
  maxEntries = MAX_SCENARIO_ENTRIES,
): T[] {
  const limit = Math.max(1, Math.floor(maxEntries));
  const byId = new Map(entries.map(entry => [entry.scenarioId, entry]));
  const ordered = Array.from(byId.values()).sort((a, b) =>
    a.title.localeCompare(b.title, 'ja') || a.scenarioId.localeCompare(b.scenarioId),
  );
  if (ordered.length <= limit) return ordered;

  const active = activeScenarioId ? ordered.find(entry => entry.scenarioId === activeScenarioId) : undefined;
  const visible = ordered.slice(0, limit);
  if (!active || visible.some(entry => entry.scenarioId === active.scenarioId)) return visible;
  return [...visible.slice(0, -1), active];
}
