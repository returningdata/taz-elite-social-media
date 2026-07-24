type NavigationWindow = Window & {
  __tazNavigationReady?: boolean;
  __tazLockedScroll?: number;
};

const navigationWindow = window as NavigationWindow;

const getToggle = (menu: HTMLElement) => {
  if (!menu.id) return null;
  return document.querySelector<HTMLButtonElement>(`[data-site-menu-toggle][aria-controls="${menu.id}"]`);
};

const unlockPage = (restoreScroll: boolean) => {
  const lockedScroll = navigationWindow.__tazLockedScroll;
  document.body.classList.remove('menu-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  delete navigationWindow.__tazLockedScroll;
  if (restoreScroll && typeof lockedScroll === 'number') window.scrollTo(0, lockedScroll);
};

const setMenuOpen = (menu: HTMLElement, open: boolean, options: { focus?: boolean; restoreScroll?: boolean } = {}) => {
  const toggle = getToggle(menu);
  const close = menu.querySelector<HTMLButtonElement>('[data-site-menu-close]');
  toggle?.setAttribute('aria-expanded', String(open));
  toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.setAttribute('aria-hidden', String(!open));
  menu.toggleAttribute('inert', !open);
  menu.classList.toggle('open', open);

  if (open) {
    navigationWindow.__tazLockedScroll = window.scrollY;
    document.body.classList.add('menu-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${navigationWindow.__tazLockedScroll}px`;
    document.body.style.width = '100%';
    if (options.focus !== false) close?.focus();
    return;
  }

  unlockPage(options.restoreScroll !== false);
  if (options.focus) toggle?.focus();
};

const resetNavigation = () => {
  document.querySelectorAll<HTMLElement>('[data-site-menu]').forEach((menu) => {
    setMenuOpen(menu, false, { restoreScroll: false });
  });
  unlockPage(false);
};

if (!navigationWindow.__tazNavigationReady) {
  navigationWindow.__tazNavigationReady = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toggle = target.closest<HTMLButtonElement>('[data-site-menu-toggle]');
    if (toggle) {
      const menuId = toggle.getAttribute('aria-controls');
      const menu = menuId ? document.getElementById(menuId) : null;
      if (menu) setMenuOpen(menu, toggle.getAttribute('aria-expanded') !== 'true');
      return;
    }

    const menu = target.closest<HTMLElement>('[data-site-menu]');
    if (!menu) return;
    if (target.closest('[data-site-menu-close]')) {
      setMenuOpen(menu, false, { focus: true });
      return;
    }
    if (target.closest('a') || target === menu) setMenuOpen(menu, false, { restoreScroll: target === menu });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menu = document.querySelector<HTMLElement>('[data-site-menu].open');
    if (menu) setMenuOpen(menu, false, { focus: true });
  });

  document.addEventListener('astro:before-swap', resetNavigation);
  document.addEventListener('astro:page-load', resetNavigation);
}

resetNavigation();
