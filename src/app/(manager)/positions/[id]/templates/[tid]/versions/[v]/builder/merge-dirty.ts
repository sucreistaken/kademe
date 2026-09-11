/**
 * Keeps what the manager is typing when the server tree comes back.
 *
 * The builder autosaves on blur and refreshes from the server after every
 * save. A refresh that lands while the next field is being edited used to
 * reset the whole local tree from props and throw away those keystrokes. The
 * fix is a record of which fields are dirty (edited locally, not yet handed
 * to a save), and a merge that takes the server's copy of everything except
 * those fields.
 *
 * Pure and tested on its own; the screen only wires it to state.
 */

/** entity id -> names of its fields edited locally since the last save. */
export type DirtyMap = ReadonlyMap<string, ReadonlySet<string>>;

export const EMPTY_DIRTY: DirtyMap = new Map();

export function markDirty(map: DirtyMap, id: string, keys: string[]): DirtyMap {
  if (keys.length === 0) return map;
  const next = new Map(map);
  next.set(id, new Set([...(map.get(id) ?? []), ...keys]));
  return next;
}

export function clearDirty(map: DirtyMap, id: string, keys: string[]): DirtyMap {
  const current = map.get(id);
  if (!current) return map;
  const remaining = new Set([...current].filter((k) => !keys.includes(k)));
  if (remaining.size === current.size) return map;
  const next = new Map(map);
  if (remaining.size === 0) next.delete(id);
  else next.set(id, remaining);
  return next;
}

type WithId = { id: string };

/**
 * The incoming (server) tree with dirty fields overlaid from the local one.
 * Structure always comes from the server: stages and activities added,
 * removed or reordered elsewhere win, and a dirty entity the server no longer
 * has is simply gone. With nothing dirty the incoming array is returned as
 * is, so the identity check in the screen sees no change.
 */
export function mergeDirty<
  A extends WithId,
  S extends WithId & { activities: A[] },
>(incoming: S[], local: S[], dirty: DirtyMap): S[] {
  if (dirty.size === 0) return incoming;
  const localStages = new Map(local.map((s) => [s.id, s]));
  const localActivities = new Map(
    local.flatMap((s) => s.activities.map((a) => [a.id, a] as const)),
  );
  return incoming.map((stage) => {
    const merged = overlay(stage, localStages.get(stage.id), dirty.get(stage.id));
    const activities = stage.activities.map((activity) =>
      overlay(activity, localActivities.get(activity.id), dirty.get(activity.id)),
    );
    return activities.some((a, i) => a !== stage.activities[i])
      ? { ...merged, activities }
      : merged;
  });
}

function overlay<T extends WithId>(
  incoming: T,
  local: T | undefined,
  keys: ReadonlySet<string> | undefined,
): T {
  if (!local || !keys || keys.size === 0) return incoming;
  const patch: Partial<T> = {};
  for (const key of keys) {
    // "activities" is structure, never a field; it is merged separately.
    if (key === "activities" || !(key in local)) continue;
    patch[key as keyof T] = local[key as keyof T];
  }
  return Object.keys(patch).length ? { ...incoming, ...patch } : incoming;
}
