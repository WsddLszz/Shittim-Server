import { el, frag, clear, button } from '../ui.js';
import { store, targetAccount } from '../api.js';

export function gate(root, opts, renderFn) {
  let prevOnline = store.get().online;
  let prevTarget = store.get().targetId;

  function paint() {
    clear(root);
    const s = store.get();
    if (opts.needServer && !s.online) { root.appendChild(offlinePanel()); return; }
    if (opts.needTarget && !targetAccount()) { root.appendChild(noTargetPanel()); return; }
    renderFn(root, s);
  }

  const unsub = store.subscribe((s) => {
    if (s.online !== prevOnline || s.targetId !== prevTarget) {
      prevOnline = s.online;
      prevTarget = s.targetId;
      paint();
    }
  });
  paint();
  return unsub;
}

export function offlinePanel() {
  const go = button('前往总览', { variant: 'primary', iconName: 'server', onClick: () => (location.hash = '#/overview') });
  // soft-navigate by triggering hashchange handler is overkill; reuse nav click
  go.addEventListener('click', () => document.querySelector('.nav-item[data-id="overview"]')?.click());
  return el('div.card', { style: { maxWidth: '560px', margin: '40px auto' } },
    el('div.card-body', { style: { textAlign: 'center', padding: '36px' } },
      el('h3', { text: '服务器未运行', style: { marginBottom: '6px' } }),
      el('p', { text: '请从底部状态栏启动服务器。', style: { color: 'var(--ink-2)', fontSize: '13.5px', margin: '0 auto 18px', maxWidth: '380px', lineHeight: '1.6' } }),
      go));
}

export function noTargetPanel() {
  return el('div.card', { style: { maxWidth: '520px', margin: '40px auto' } },
    el('div.card-body', { style: { textAlign: 'center', padding: '34px' } },
      el('h3', { text: '未选择账号', style: { marginBottom: '6px' } }),
      el('p', { text: '请先在“账号”页面创建账号，然后在页面顶部的选择器中选中它。', style: { color: 'var(--ink-2)', fontSize: '13.5px', lineHeight: '1.6' } })));
}

export async function loadInto(container, loader, render) {
  container.innerHTML = `<div class="empty"><div class="spinner"></div></div>`;
  try {
    const data = await loader();
    clear(container);
    render(container, data);
  } catch (e) {
    container.innerHTML = `<div class="empty"><b>加载失败</b><span>${String(e.message || e)}</span></div>`;
  }
}
