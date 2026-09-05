// Credit cost of one generation = app base cost + per-parameter modifiers. Shared by server and client.
export function computeCost(parsedConfig, values = {}) {
  const params = Array.isArray(parsedConfig?.userParams) ? parsedConfig.userParams : [];
  let total = Number(parsedConfig?.creditCost);
  if (!Number.isFinite(total)) total = 0;

  for (const p of params) {
    if (!p || !p.key) continue;
    const val = values[p.key] !== undefined ? values[p.key] : p.defaultValue;

    if (p.type === "enum") {
      if (Array.isArray(p.costModifiers) && Array.isArray(p.options)) {
        const i = p.options.indexOf(val);
        if (i !== -1 && p.costModifiers[i] !== undefined) total += Number(p.costModifiers[i]) || 0;
      } else if (p.costModifiers && typeof p.costModifiers === "object" && p.costModifiers[val] !== undefined) {
        total += Number(p.costModifiers[val]) || 0;
      }
    } else if (p.type === "boolean") {
      const on = val === true || val === "true" || val === 1 || val === "1";
      if (on && p.costIfTrue !== undefined) total += Number(p.costIfTrue) || 0;
    } else if (p.type === "number" || p.type === "slider") {
      if (p.costPerUnit !== undefined) total += (Number(val) || 0) * (Number(p.costPerUnit) || 0);
    }
  }

  return Math.max(0, Math.round(total));
}
