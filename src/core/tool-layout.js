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

export function moveToolToIndex(order, draggedId, targetIndex) {
  const ids = [...new Set((Array.isArray(order) ? order : []).map(String).filter(Boolean))];
  const dragged = String(draggedId || '');
  if (!dragged || !ids.includes(dragged)) return ids;
  const result = ids.filter(id => id !== dragged);
  const numericIndex = Number(targetIndex);
  const index = Number.isFinite(numericIndex)
    ? Math.max(0, Math.min(result.length, Math.round(numericIndex)))
    : result.length;
  result.splice(index, 0, dragged);
  return result;
}

export function gridCellIndexFromPoint(point, layout) {
  const columns = Math.max(1, Math.trunc(Number(layout?.columns) || 1));
  const cellWidth = Math.max(1, Number(layout?.cellWidth) || 1);
  const cellHeight = Math.max(1, Number(layout?.cellHeight) || 1);
  const columnGap = Math.max(0, Number(layout?.columnGap) || 0);
  const rowGap = Math.max(0, Number(layout?.rowGap) || 0);
  const left = Number(layout?.left) || 0;
  const top = Number(layout?.top) || 0;
  const scrollTop = Math.max(0, Number(layout?.scrollTop) || 0);
  const maxIndex = Math.max(0, Math.trunc(Number(layout?.maxIndex) || 0));
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  const localX = x - left;
  const localY = y - top + scrollTop;
  const column = Math.max(0, Math.min(
    columns - 1,
    Math.round((localX - cellWidth / 2) / (cellWidth + columnGap)),
  ));
  const row = Math.max(0, Math.round((localY - cellHeight / 2) / (cellHeight + rowGap)));
  return Math.max(0, Math.min(maxIndex, row * columns + column));
}
