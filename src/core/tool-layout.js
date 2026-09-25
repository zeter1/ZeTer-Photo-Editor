export function sanitizeToolOrder(order, availableIds) {
  const available = [...new Set((Array.isArray(availableIds) ? availableIds : []).map(String).filter(Boolean))];
  const allowed = new Set(available);
  const result = [];
  for (const id of Array.isArray(order) ? order : []) {
    const key = String(id);
    if (allowed.has(key) && !result.includes(key)) result.push(key);
  }
  for (const id of available) if (!result.includes(id)) result.push(id);
  return result;
}

export function moveToolInOrder(order, draggedId, targetId = null, placeAfter = false) {
  const ids = [...new Set((Array.isArray(order) ? order : []).map(String).filter(Boolean))];
  const dragged = String(draggedId || '');
  if (!dragged || !ids.includes(dragged)) return ids;
  const target = targetId == null ? null : String(targetId);
  if (target === dragged) return ids;
  const result = ids.filter(id => id !== dragged);
  if (!target || !result.includes(target)) {
    result.push(dragged);
    return result;
  }
  const targetIndex = result.indexOf(target);
  result.splice(targetIndex + (placeAfter ? 1 : 0), 0, dragged);
  return result;
}
