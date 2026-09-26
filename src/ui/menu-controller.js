export function createMenuController({
  menu,
  viewport,
  menuButtons = [],
  getItems = () => [],
  escapeHtml = value => String(value ?? ''),
  toast = () => {},
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
} = {}) {
  if (!menu) throw new Error('Menu controller requires a menu element');

  const buttons = [...menuButtons];
  let openMenuKey = null;
  let menuReturnFocus = null;
  let initialized = false;

  function closeMenu({ restoreFocus = false } = {}) {
    const active = buttons.find(button => button.classList.contains('active'));
    const focusTarget = menuReturnFocus || active;
    openMenuKey = null;
    menuReturnFocus = null;
    menu.hidden = true;
    menu.replaceChildren();
    buttons.forEach(button => {
      button.classList.remove('active');
      button.setAttribute('aria-expanded', 'false');
    });
    if (restoreFocus) (focusTarget?.isConnected ? focusTarget : viewport)?.focus();
  }

  function populateMenu(items) {
    menu.replaceChildren();
    for (const item of items) {
      if (item[0] === 'sep') {
        const separator = documentTarget.createElement('div');
        separator.className = 'menu-sep';
        separator.setAttribute('role', 'separator');
        menu.append(separator);
        continue;
      }
      const [label, shortcut, action, enabled] = item;
      const button = documentTarget.createElement('button');
      button.type = 'button';
      button.className = 'menu-item';
      button.setAttribute('role', 'menuitem');
      button.disabled = enabled ? !enabled() : false;
      button.innerHTML = `<span>${escapeHtml(label)}</span><span class="menu-shortcut">${escapeHtml(shortcut)}</span>`;
      button.onclick = () => {
        if (button.disabled) return;
        closeMenu();
        Promise.resolve(action()).catch(error => {
          console.error(error);
          toast(error?.message || 'Ошибка команды', 'error');
        });
      };
      menu.append(button);
    }
  }

  function positionMenu(x, y, { focusFirst = false } = {}) {
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(6, Math.min(x, windowTarget.innerWidth - rect.width - 6))}px`;
    menu.style.top = `${Math.max(6, Math.min(y, windowTarget.innerHeight - rect.height - 6))}px`;
    if (focusFirst) menu.querySelector('.menu-item:not(:disabled)')?.focus();
  }

  function openMenu(button, key, { focusFirst = false } = {}) {
    openMenuKey = key;
    menuReturnFocus = button;
    buttons.forEach(candidate => {
      const active = candidate === button;
      candidate.classList.toggle('active', active);
      candidate.setAttribute('aria-expanded', String(active));
    });
    populateMenu(getItems(key) || []);
    const rect = button.getBoundingClientRect();
    positionMenu(rect.left, rect.bottom + 3, { focusFirst });
  }

  function openContextMenu(key, items, event, focusTarget = event.target) {
    openMenuKey = key;
    menuReturnFocus = focusTarget;
    buttons.forEach(button => {
      button.classList.remove('active');
      button.setAttribute('aria-expanded', 'false');
    });
    populateMenu(items);
    const keyboard = event.clientX === 0 && event.clientY === 0;
    const rect = focusTarget?.getBoundingClientRect?.();
    positionMenu(
      keyboard && rect ? rect.left + 8 : event.clientX,
      keyboard && rect ? rect.bottom : event.clientY,
      { focusFirst: keyboard },
    );
  }

  function init() {
    if (initialized) return;
    initialized = true;

    buttons.forEach((button, index) => {
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (openMenuKey === button.dataset.menu) closeMenu();
        else openMenu(button, button.dataset.menu);
      });
      button.addEventListener('mouseenter', () => {
        if (openMenuKey && openMenuKey !== button.dataset.menu) openMenu(button, button.dataset.menu);
      });
      button.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          openMenu(button, button.dataset.menu, { focusFirst: true });
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const delta = event.key === 'ArrowRight' ? 1 : -1;
          const next = buttons[(index + delta + buttons.length) % buttons.length];
          next?.focus();
          if (openMenuKey && next) openMenu(next, next.dataset.menu);
        }
      });
    });

    menu.setAttribute('role', 'menu');
    menu.addEventListener('keydown', event => {
      const items = [...menu.querySelectorAll('.menu-item:not(:disabled)')];
      const index = items.indexOf(documentTarget.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu({ restoreFocus: true });
        return;
      }
      if (event.key === 'ArrowDown' && items.length) {
        event.preventDefault();
        items[(index + 1 + items.length) % items.length].focus();
      }
      if (event.key === 'ArrowUp' && items.length) {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
      }
    });

    documentTarget.addEventListener('pointerdown', event => {
      if (openMenuKey && !menu.contains(event.target) && !event.target.closest?.('.menu-button')) closeMenu();
    });
  }

  return {
    init,
    closeMenu,
    openMenu,
    openContextMenu,
    isOpen: () => Boolean(openMenuKey),
  };
}
