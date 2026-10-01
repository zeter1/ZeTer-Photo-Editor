export function createHistoryPanelController({
  container,
  state,
  commands,
  documentRef = globalThis.document,
} = {}) {
  if (!container || typeof container.replaceChildren !== 'function' || typeof container.append !== 'function') {
    throw new Error('history panel container is required');
  }
  if (typeof state?.getHistory !== 'function') {
    throw new Error('history panel history bridge is required');
  }
  if (typeof commands?.jumpToHistory !== 'function') {
    throw new Error('history panel jump command is required');
  }
  if (!documentRef || typeof documentRef.createElement !== 'function') {
    throw new Error('history panel document bridge is required');
  }

  function render() {
    const history = state.getHistory();
    if (!history || !Array.isArray(history.entries)) {
      throw new Error('history panel current history is required');
    }

    container.replaceChildren();
    history.entries.forEach((entry, index) => {
      const current = index === history.index;
      const row = documentRef.createElement('button');
      row.type = 'button';
      row.className = `history-row${current ? ' current' : ''}`;
      row.textContent = `${current ? '● ' : ''}${entry.label}`;
      row.title = current ? 'Текущее состояние' : 'Перейти к этому состоянию';
      row.disabled = current;
      row.onclick = () => commands.jumpToHistory(index);
      container.append(row);
    });
    container.scrollTop = container.scrollHeight;
  }

  return { render };
}
