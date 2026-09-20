import { el, frag, clear, button, toast } from '../ui.js';

function diagRow(name, info, fixBtn) {
  const status = info?.status || 'missing';
  const row = frag(`<div class="diag-row">
    <span class="d-led ${status}"></span>
    <span class="d-name">${name}</span>
    <span class="d-detail">${(info?.detail || '').replace(/</g, '&lt;')}</span>
  </div>`);
  if (fixBtn) row.appendChild(fixBtn);
  return row;
}

export default {
  id: 'overview',
  title: '概览',
  icon: 'dashboard',
  needsTarget: false,

  mount(root) {
    const diagBody = el('div.diag', { style: { minWidth: '0' } });

    let busy = false;
    const refreshBtn = button('重新检查', { variant: 'ghost', sm: true, iconName: 'refresh', onClick: () => loadDiag() });
    const setupBtn = button('安装缺失组件', { variant: 'primary', sm: true, iconName: 'download', onClick: () => runSetup('all') });
    const readiness = cardWith('运行环境', null, [setupBtn, refreshBtn], diagBody);

    const shortcutBody = el('div.row.wrap', { style: { gap: '10px', minWidth: '0' } });
    const shortcuts = [
      ['服务器目录', 'folder', (p) => p.serverDir],
      ['代理脚本', 'folder', (p) => p.scriptsDir],
      ['配置文件', 'config', (p) => p.configPath],
      ['数据库', 'inventory', (p) => p.dbPath],
    ];
    for (const [label, ic, pick] of shortcuts) {
      shortcutBody.appendChild(button(label, { variant: 'ghost', sm: true, iconName: ic, onClick: async () => {
        const p = await window.host.paths();
        window.host.openPath(pick(p));
      }}));
    }
    const shortcutsCard = cardWith('快捷方式', null, [], shortcutBody);

    const hostsLine = el('p', { style: { fontSize: '12.5px', color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: '1.6' } });
    const offlineBtn = button('离线启动', { variant: 'primary', iconName: 'play', onClick: () => startOffline() });
    const hostsBtn = button('还原 hosts 文件', { variant: 'ghost', sm: true, iconName: 'x', onClick: () => clearHosts() });
    const offlineCard = cardWith('离线模式', '不连接外网，也不使用域名解析', [],
      el('div', {},
        el('div.row.wrap', { style: { gap: '10px', minWidth: '0' } }, offlineBtn, hostsBtn),
        el('p', { text: '以离线参数启动服务器和代理，并把客户端访问的所有域名指向本机，因此无需 DNS 或外网连接。Steam 仍需运行（可处于离线模式），否则客户端无法读取 SDK 版本并启动。', style: { fontSize: '12.5px', color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: '1.6' } }),
        hostsLine));

    const exportBtn = button('导出日志', { variant: 'ghost', iconName: 'save', onClick: async () => {
      exportBtn.disabled = true;
      try {
        const r = await window.host.exportLogs();
        if (!r || r.canceled) return;
        if (r.ok) {
          toast(`已将 ${r.count} 个文件打包为 ${r.name}。`, 'good', '日志已导出');
          window.host.revealPath(r.path);
        } else {
          toast(r.error || '无法导出日志。', 'bad', '导出失败');
        }
      } catch (e) {
        toast(String(e.message || e), 'bad', '导出失败');
      } finally {
        exportBtn.disabled = false;
      }
    }});
    const diagnostics = cardWith('诊断', null, [],
      el('div', {}, exportBtn,
        el('p', { text: '将服务器日志和诊断快照打包为 ZIP，便于提交问题报告。', style: { fontSize: '12.5px', color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: '1.6' } })));

    const right = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px', minWidth: '0' } }, offlineCard, shortcutsCard, diagnostics);
    root.appendChild(el('div.grid-2', { style: { gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', alignItems: 'start' } }, readiness, right));

    function fixBtn(step, info) {
      if (busy) return null;
      const ready = (info?.status || 'missing') === 'ready';
      if (ready) return null;
      const label = step === 'certificate' ? '信任证书' : 'Install';
      return button(label, { variant: 'ghost', sm: true, iconName: 'download', onClick: () => runSetup(step) });
    }

    async function loadDiag() {
      diagBody.innerHTML = `<div class="empty"><div class="spinner"></div></div>`;
      try {
        const env = await window.host.envCheck();
        clear(diagBody);
        diagBody.appendChild(diagRow('.NET SDK', env.dotnet, fixBtn('dotnet', env.dotnet)));
        diagBody.appendChild(diagRow('服务器构建', env.server));
        diagBody.appendChild(diagRow('游戏数据库', env.database));
        diagBody.appendChild(diagRow('mitmproxy', env.mitmproxy, fixBtn('mitmproxy', env.mitmproxy)));
        diagBody.appendChild(diagRow('CA 证书', env.certificate, fixBtn('certificate', env.certificate)));
        diagBody.appendChild(diagRow('网关密钥', env.gateway));
        diagBody.appendChild(diagRow('重定向脚本', env.redirect));
        const anyMissing = ['dotnet', 'mitmproxy', 'certificate'].some((k) => (env[k]?.status || 'missing') !== 'ready');
        setupBtn.disabled = busy || !anyMissing;
      } catch (e) {
        diagBody.innerHTML = `<div class="empty"><b>检查失败</b><span>${String(e.message || e)}</span></div>`;
      }
    }

    async function loadOffline() {
      try {
        const s = await window.host.offlineStatus();
        hostsBtn.style.display = s.hosts ? '' : 'none';
        hostsLine.textContent = s.hosts
          ? `${s.hostnames.length} 个域名已指向 127.0.0.2；停止服务器时会自动还原。`
          : 'hosts 文件尚未修改。';
      } catch (e) {
        hostsLine.textContent = String(e.message || e);
      }
    }

    async function startOffline() {
      offlineBtn.disabled = true;
      try {
        const r = await window.host.systemStartOffline();
        if (r.ok) toast('服务器和代理正在以离线模式启动。', 'good', '离线模式');
        else toast(r.error || '无法以离线模式启动。', 'bad', '离线模式');
      } catch (e) {
        toast(String(e.message || e), 'bad', '离线模式');
      } finally {
        offlineBtn.disabled = false;
        loadOffline();
      }
    }

    async function clearHosts() {
      hostsBtn.disabled = true;
      try {
        const r = await window.host.offlineHosts(false);
        if (!r.ok) toast(r.error || '无法修改 hosts 文件。', 'bad', '离线模式');
      } catch (e) {
        toast(String(e.message || e), 'bad', '离线模式');
      } finally {
        hostsBtn.disabled = false;
        loadOffline();
      }
    }

    // The .NET SDK download (~250 MB) is silent for minutes, so a spinner plus an always-ticking elapsed counter is what stops it reading as "hung".
    function setupPanel() {
      const titleEl = el('div', { style: { fontWeight: '700', fontSize: '13.5px' } });
      const subEl = el('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '3px' } });
      const logEl = el('div.mono', { style: { fontSize: '11px', color: 'var(--ink-3)', marginTop: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0' } });
      const wrap = el('div', { style: { display: 'flex', gap: '13px', alignItems: 'flex-start', padding: '16px 4px' } },
        frag('<div class="spinner"></div>'),
        el('div', { style: { minWidth: '0', flex: '1' } }, titleEl, subEl, logEl));
      return { wrap, titleEl, subEl, logEl };
    }

    function fmtMB(n) { return `${(n / (1024 * 1024)).toFixed(0)} MB`; }

    // mitmproxy/.NET install per-user (silent); trusting the CA raises one Windows elevation prompt.
    async function runSetup(which) {
      if (busy) return;
      busy = true;
      setupBtn.disabled = true; refreshBtn.disabled = true;
      const labels = { dotnet: '.NET 10 SDK', mitmproxy: 'mitmproxy', certificate: 'CA 证书' };

      clear(diagBody);
      const panel = setupPanel();
      diagBody.appendChild(panel.wrap);

      let curStep = which === 'all' ? 'dotnet' : which;
      let msg = '正在开始…';
      const t0 = Date.now();
      const elapsed = () => { const s = Math.floor((Date.now() - t0) / 1000); const m = Math.floor(s / 60); return m ? `${m}m ${s % 60}s` : `${s}s`; };
      const render = () => {
        panel.titleEl.textContent = `正在安装 ${labels[curStep] || curStep}…`;
        panel.subEl.textContent = `${msg} · 已用时 ${elapsed()}`;
      };
      render();
      // tick every second so the elapsed time always moves, even while a step is mid-download and emitting nothing
      const timer = setInterval(render, 1000);

      const unsub = window.host.onSetupProgress((d) => {
        if (d.step && labels[d.step]) curStep = d.step;
        if (typeof d.recv === 'number' && d.total) msg = `正在下载… ${fmtMB(d.recv)} / ${fmtMB(d.total)}`;
        else if (d.status === 'running' && d.message) msg = d.message;
        if (d.line) panel.logEl.textContent = d.line;
        if (d.status === 'done') { msg = d.message || `${labels[d.step] || d.step} 已就绪`; toast(msg, 'good'); }
        if (d.status === 'failed') { msg = d.message || `${labels[d.step] || d.step} 安装失败`; toast(msg, 'bad'); }
        render();
      });

      try {
        const res = await window.host.setupInstall(which);
        if (res.ok) toast('所有必需组件均已就绪。', 'good', '环境配置完成');
        else {
          const failed = Object.entries(res.results || {}).filter(([, r]) => r && !r.ok).map(([k]) => labels[k] || k);
          toast(failed.length ? `未能完成： ${failed.join(', ')}.` : (res.error || '环境配置未完成。'), 'bad', '环境配置不完整');
        }
      } catch (e) {
        toast(String(e.message || e), 'bad', '环境配置失败');
      } finally {
        clearInterval(timer);
        unsub();
        busy = false;
        refreshBtn.disabled = false;
        await loadDiag();
      }
    }

    loadDiag();
    loadOffline();
  },
};

function cardWith(title, sub, actions, body) {
  const head = el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: title }),
    sub ? el('span.sub', { text: sub }) : null, el('div.spacer', {}), ...actions);
  return el('div.card', {}, head, el('div.card-body', {}, body));
}
