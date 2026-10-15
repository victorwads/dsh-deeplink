// Hand-authored DSH module-loader bundle; no build step or cross-plugin imports.
window.__ModuleLoader__.load({
  id: 'dsh-deeplink',
  factory: (require) => {
    const React = require('react');
    const inject = ['slots', 'sessions', 'workspaces', 'uiWorkspace', 'layout'];
    const PACKAGE = 'dsh-deeplink';
    const JUMP_KEY = 'dsh-deeplink.jump';
    const FOLLOW_KEY = 'dsh-deeplink.follow';
    const flagListeners = new Set();

    function readFlag(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : raw !== '0' && raw !== 'false';
      } catch { return fallback; }
    }

    function writeFlag(key, value) {
      try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* storage unavailable */ }
      for (const listener of flagListeners) listener();
    }

    function readTarget() {
      const params = new URLSearchParams(location.search);
      const session = params.get('session');
      if (session) return { kind: 'session', id: session };
      const workspace = params.get('workspace');
      return workspace ? { kind: 'workspace', id: workspace } : null;
    }

    // Catalog membership is not selection. The UI owns the mainView reference;
    // background agents, sidebars, and inspector references must not change links.
    function currentSession(list) {
      return Object.values(list.byId).find(row => (row.retainedBy.mainView ?? 0) > 0)?.id;
    }

    function apply(ctx) {
      const { sessions, workspaces, uiWorkspace, layout } = ctx;
      const target = readFlag(JUMP_KEY, true) ? readTarget() : null;
      let phase = target === null ? 'done' : 'waiting';
      let disposed = false;

      const syncUrl = () => {
        if (disposed || phase !== 'done' || !readFlag(FOLLOW_KEY, true)) return;
        const list = sessions.list.getSnapshot();
        if (list.phase !== 'ready' || workspaces.list.getSnapshot().phase !== 'ready') return;
        try {
          const url = new URL(location.href);
          url.searchParams.delete('session');
          url.searchParams.delete('workspace');
          url.searchParams.delete('new'); // retired plugin parameter
          const current = currentSession(list);
          if (current !== undefined) url.searchParams.set('session', current);
          const next = url.pathname + url.search + url.hash;
          if (next !== location.pathname + location.search + location.hash) {
            history.replaceState(history.state, '', next);
          }
        } catch { /* unavailable history or same-origin restriction */ }
      };

      const reconcile = () => {
        if (disposed) return;
        if (phase === 'done') { syncUrl(); return; }
        if (phase === 'opening') return;
        const list = sessions.list.getSnapshot();
        const workspaceList = workspaces.list.getSnapshot();
        // Archive facts and the session catalog arrive independently.
        if (list.phase !== 'ready' || workspaceList.phase !== 'ready') return;
        phase = 'opening'; // one attempt, including synchronous reentrant notifications
        const finish = () => { phase = 'done'; syncUrl(); };
        if (target.kind === 'session') {
          if (list.ids.includes(target.id) && !workspaceList.archivedSessionIds.includes(target.id)) {
            try {
              // Supersede any asynchronous default restoration before selecting.
              layout.beginNavigation();
              uiWorkspace.openSession(target.id);
            } catch (error) { console.warn('[dsh-deeplink] Cannot open session:', error); }
          }
          finish();
          return;
        }
        if (!workspaceList.items.some(item => item.workspaceId === target.id)) {
          finish();
          return;
        }
        // Do not let default restoration overwrite the requested URL while the
        // new/reusable blank is being resolved. The UI handles supersession.
        try {
          Promise.resolve(uiWorkspace.openWorkspace(target.id, () => {
            if (disposed) throw new Error('Deep-link plugin was disposed');
          })).catch(error => {
            if (!disposed) console.warn('[dsh-deeplink] Cannot open workspace:', error);
          }).finally(finish);
        } catch (error) {
          console.warn('[dsh-deeplink] Cannot open workspace:', error);
          finish();
        }
      };
      const onList = reconcile;
      ctx.effect(() => {
        const offSessions = sessions.list.subscribe(onList);
        const offWorkspaces = workspaces.list.subscribe(onList);
        flagListeners.add(syncUrl);
        window.addEventListener('storage', syncUrl);
        onList();
        return () => {
          disposed = true;
          offSessions();
          offWorkspaces();
          flagListeners.delete(syncUrl);
          window.removeEventListener('storage', syncUrl);
        };
      }, 'dsh-deeplink: navigation subscriptions');

      // Current Plugins detail-page API, not the removed settings.plugin.item.
      ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config', key: PACKAGE,
      }, DeeplinkSettings)), 'dsh-deeplink: settings page');

      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.pluginCss = PACKAGE;
        style.textContent = [
          '.dshdl-settings{color:var(--dsw-alias-label-primary);padding:16px}',
          '.dshdl-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0}',
          '.dshdl-text{display:flex;flex-direction:column;gap:4px}',
          '.dshdl-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
          '.dshdl-switch{position:relative;flex:none;width:40px;height:22px;border:0;border-radius:11px;background:var(--dsw-alias-interactive-bg-hover);cursor:pointer;padding:0}',
          '.dshdl-switch[aria-checked=true]{background:var(--dsw-alias-state-business-primary)}',
          '.dshdl-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff}',
          '.dshdl-switch[aria-checked=true] .dshdl-knob{left:20px}',
        ].join('\n');
        document.head.appendChild(style);
        return () => style.remove();
      }, 'dsh-deeplink: styles');
    }

    function DeeplinkSettings() {
      const [jump, setJump] = React.useState(() => readFlag(JUMP_KEY, true));
      const [follow, setFollow] = React.useState(() => readFlag(FOLLOW_KEY, true));
      const row = (title, description, checked, toggle) => React.createElement('div', { className: 'dshdl-row' },
        React.createElement('div', { className: 'dshdl-text' }, title,
          React.createElement('span', { className: 'dshdl-desc' }, description)),
        React.createElement('button', {
          type: 'button', role: 'switch', 'aria-label': title, 'aria-checked': checked,
          className: 'dshdl-switch', onClick: toggle,
        }, React.createElement('span', { className: 'dshdl-knob', 'aria-hidden': true })));
      return React.createElement('section', { className: 'dshdl-settings' },
        React.createElement('h3', null, 'Deep links'),
        React.createElement('p', { className: 'dshdl-desc' }, 'Saved immediately in this browser only.'),
        row('Open linked conversation', 'Read ?session= / ?workspace= when the page loads.', jump, () => {
          writeFlag(JUMP_KEY, !jump); setJump(!jump);
        }),
        row('Follow current conversation', 'Keep the address bar ready to copy or bookmark.', follow, () => {
          writeFlag(FOLLOW_KEY, !follow); setFollow(!follow);
        }));
    }

    return { apply, inject };
  },
});
