import { el, frag, clear, button, toast, escapeHtml } from '../ui.js';
import { icon } from '../icons.js';

// Git-free updater. "Check" compares the locally recorded commit (a download marker, or - for a real git checkout - HEAD) against origin/<branch> through the GitHub API and lists the incoming changelog.
export default {
  id: 'updates',
  title: '更新',  icon: 'download',
  needsTarget: false,

  mount(root) {
    let last = null;
    let progUnsub = null;

    const headInfo = el('div', { style: { minWidth: '0' } });
    const resultBody = el('div', { style: { minWidth: '0', marginTop: '14px' } });

    const checkBtn = button('检查更新', { variant: 'primary', sm: true, iconName: 'refresh', onClick: doCheck });

    const versionCard = el('div.card', {},
      el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '版本' }),
        el('span.sub', { text: 'Neoexm/Shittim-Server - main' }), el('div.spacer', {}), checkBtn),
      el('div.card-body', {}, headInfo, resultBody));

    const rebuildBtn = button('重新构建服务器', { variant: 'ghost', iconName: 'bolt', onClick: doRebuild });
    const selfBtn = button('检查控制中心更新', { variant: 'ghost', iconName: 'refresh', onClick: doSelfCheck });
    const maintCard = el('div.card', { style: { marginTop: '18px' } },
      el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '维护' })),
      el('div.card-body', {},
        el('p', {
          html: '安装更新时会自动重新构建服务器，因此只有在手动修改源码或构建失败时才需要使用此按钮。构建时会停止正在运行的服务器，完成后再启动，输出会实时显示在控制台。控制中心应用通过 GitHub Releases 独立更新：启动时会自动检查并提示。',
          style: { fontSize: '13px', color: 'var(--ink-2)', margin: '0 0 14px', lineHeight: '1.6' },
        }),
        el('div.row.wrap', { style: { gap: '10px' } }, rebuildBtn, selfBtn)));

    root.appendChild(versionCard);
    root.appendChild(maintCard);

    paintHead(null);
    clear(resultBody);
    resultBody.appendChild(spinnerRow('正在检查 origin/main…'));
    doCheck();

    function sourceTag(info) {
      if (!info || !info.localSource) return null;
      const label = info.localSource === 'git' ? 'Git 检出' : '下载版';
      return el('span.tag.grey', { text: label });
    }

    function paintHead(info) {
      clear(headInfo);
      const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: '0' } });
      if (!info || !info.ok) {
        row.appendChild(el('span', { text: '当前项目', style: { fontSize: '13px', color: 'var(--ink-2)' } }));
      } else if (info.versionKnown === false) {
        row.appendChild(el('span', { text: '已安装副本', style: { fontSize: '12.5px', color: 'var(--ink-3)' } }));
        if (info.branch) row.appendChild(el('span.tag', { text: info.branch }));
        row.appendChild(el('span.tag.gold', { text: '版本未知' }));
        const st = sourceTag(info); if (st) row.appendChild(st);
      } else {
        row.appendChild(el('span', { text: '所在分支', style: { fontSize: '12.5px', color: 'var(--ink-3)' } }));
        row.appendChild(el('span.tag', { text: info.branch || 'main' }));
        if (info.head) row.appendChild(el('span.mono', { text: info.head, 'data-selectable': true, style: { fontSize: '12.5px', color: 'var(--blue-ink)' } }));
        const st = sourceTag(info); if (st) row.appendChild(st);
        if (info.headSubject) {
          row.appendChild(el('span', {
            text: info.headSubject,
            style: { fontSize: '12.5px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0' },
          }));
        }
      }
      headInfo.appendChild(row);
    }

    function spinnerRow(text) {
      const label = el('span', { text, style: { color: 'var(--ink-3)', fontSize: '13px' } });
      const row = el('div.row', { style: { gap: '10px', padding: '6px 0' } }, el('div.spinner', {}), label);
      row._label = label;
      return row;
    }

    function remoteLine(r) {
      return frag(`<div style="display:flex;gap:11px;padding:10px 13px;margin-top:12px;border:1px solid var(--line);border-radius:var(--r-sm);min-width:0">
        <span class="mono" data-selectable style="font-size:11px;color:var(--ink-3);flex:none;width:58px">${escapeHtml(r.remoteShort || '')}</span>
        <div style="min-width:0;flex:1">
          <div style="font-size:13px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.remoteSubject || '')}</div>
          <div style="font-size:11px;color:var(--ink-3)">origin/${escapeHtml(r.branch || 'main')}${r.remoteWhen ? ` - ${escapeHtml(r.remoteWhen)}` : ''}</div>
        </div>
      </div>`);
    }

    function updateNote(r) {
      const text = r.localSource === 'git'
        ? '通过 Git 安装：更新仅执行快进拉取，不会覆盖本地修改。'
        : '更新会从 GitHub 重新下载最新源码。<b>Config</b>、数据库和构建输出不会更改，但源码文件中的本地修改会被替换。';
      return el('p', {
        html: text,
        style: { fontSize: '12px', color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: '1.6' },
      });
    }

    function renderResult(r) {
      clear(resultBody);
      if (!r || !r.ok) {
        resultBody.appendChild(statusRow('bad', '检查失败', (r && r.error) || '未知错误'));
        return;
      }
      paintHead(r);

      // Can't quantify the gap (no marker, or a commit GitHub can't diff). Offer a clean re-download of the latest source.
      if (r.versionKnown === false || r.compareFailed) {
        const why = r.versionKnown === false
          ? '此副本没有版本标记，无法确定准确提交。'
          : '此副本所在提交无法与 GitHub 分支比较（可能是本地构建或历史已分叉）。';
        resultBody.appendChild(statusRow('warn', '无法比较版本',
          `${why} Latest on origin/${r.branch} is ${r.remoteShort}${r.remoteWhen ? ` - ${r.remoteWhen}` : ''}.`));
        if (r.remoteSubject) resultBody.appendChild(remoteLine(r));
        resultBody.appendChild(updateNote(r));
        const btn = button('下载最新版', { variant: 'primary', iconName: 'download', onClick: () => doInstall(r) });
        resultBody.appendChild(el('div', { style: { marginTop: '16px' } }, btn));
        return;
      }

      if ((r.behind || 0) <= 0) {
        resultBody.appendChild(statusRow('good', '已是最新版本',
          r.ahead > 0
            ? `本地比 origin/${r.branch} 超前 ${r.ahead} 个提交。`
            : ''));
        return;
      }

      resultBody.appendChild(statusRow('warn', `有 ${r.behind} 项更新可用`));
      resultBody.appendChild(updateNote(r));

      if (r.commits && r.commits.length) {
        const list = el('div', { style: { marginTop: '14px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', overflow: 'hidden', maxHeight: '40vh', overflowY: 'auto' } });
        for (const c of r.commits) {
          list.appendChild(frag(`<div style="display:flex;gap:11px;padding:10px 13px;border-bottom:1px solid var(--line-2);min-width:0">
            <span class="mono" data-selectable style="font-size:11px;color:var(--ink-3);flex:none;width:58px">${escapeHtml(c.hash || '')}</span>
            <div style="min-width:0;flex:1">
              <div style="font-size:13px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.subject || '')}</div>
              <div style="font-size:11px;color:var(--ink-3)">${escapeHtml(c.author || '')}${c.when ? ` - ${escapeHtml(c.when)}` : ''}</div>
            </div>
          </div>`));
        }
        if (list.lastElementChild) list.lastElementChild.style.borderBottom = 'none';
        resultBody.appendChild(list);
      }

      const installBtn = button(`安装 ${r.behind} 项更新`, { variant: 'primary', iconName: 'download', onClick: () => doInstall(r) });
      resultBody.appendChild(el('div', { style: { marginTop: '16px' } }, installBtn));
    }

    function statusRow(kind, title, detail) {
      const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
      wrap.appendChild(frag(`<span class="pill ${kind}" style="align-self:flex-start"><span class="dot"></span>${escapeHtml(title)}</span>`));
      if (detail) wrap.appendChild(el('p', { text: detail, style: { fontSize: '13px', color: 'var(--ink-2)', margin: '0', lineHeight: '1.6' } }));
      return wrap;
    }

    async function doCheck() {
      checkBtn.disabled = true;
      clear(resultBody);
      resultBody.appendChild(spinnerRow('正在检查 origin/main…'));
      try {
        last = await window.host.updatesCheck();
        renderResult(last);
      } catch (e) {
        clear(resultBody);
        resultBody.appendChild(statusRow('bad', '检查失败', String(e.message || e)));
      } finally {
        checkBtn.disabled = false;
      }
    }

    function fmtBytes(n) {
      if (!n) return '0 MB';
      const mb = n / (1024 * 1024);
      return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
    }

    async function doInstall(r) {
      clear(resultBody);
      const prog = spinnerRow(r.localSource === 'git' ? '正在拉取 origin/main…' : '正在从 GitHub 更新…');
      resultBody.appendChild(prog);

      if (r.localSource !== 'git') {
        progUnsub = window.host.onProjectProgress((d) => {
          if (d.phase === 'download') prog._label.textContent = d.total ? `正在下载… ${fmtBytes(d.recv)} / ${fmtBytes(d.total)}` : `正在下载… ${fmtBytes(d.recv)}`;
          else if (d.phase === 'resolve') prog._label.textContent = '正在解析最新提交…';
          else if (d.phase === 'extract') prog._label.textContent = '正在解压…';
          else if (d.phase === 'install') prog._label.textContent = '正在安装文件…';
          else if (d.phase === 'done') prog._label.textContent = '正在完成…';
        });
      }

      try {
        const res = await window.host.updatesApply();
        if (progUnsub) { progUnsub(); progUnsub = null; }
        clear(resultBody);
        if (res.ok) {
          toast(`已更新到 ${res.head || '最新版'}，正在重新构建`, 'good', '更新已安装');
          // The update only writes source. Without the build the server keeps launching the old bin/Debug exe and the update looks like it did nothing.
          resultBody.appendChild(spinnerRow('正在重新构建服务器…（输出见控制台）'));
          const built = await window.host.updatesRebuild();
          clear(resultBody);
          if (built.ok) {
            toast('服务器重新构建成功', 'good');
            resultBody.appendChild(statusRow('good', '更新已安装', `现已更新到 ${res.head || '最新版'}并完成构建${built.restarted ? '，服务器已重新启动' : ''}。请在方便时重启控制中心。`));
          } else {
            toast(built.error || `构建失败（代码 ${built.code}）`, 'bad', '重新构建失败');
            resultBody.appendChild(statusRow('warn', '更新成功，但重新构建失败', `源码现已更新到 ${res.head || '最新版'}，但当前运行的仍是旧构建。${built.error || `dotnet build 退出代码为 ${built.code}`}；完整输出见控制台。`));
            const rb = button('重试构建', { variant: 'ghost', iconName: 'bolt', onClick: doRebuild });
            resultBody.appendChild(el('div', { style: { marginTop: '14px' } }, rb));
          }
        } else {
          toast('无法应用更新', 'bad');
          const detail = res.method === 'git'
            ? '本地修改或分叉分支阻止了快进拉取。没有文件被更改；请提交或暂存本地修改后重试。'
            : (res.error || '下载未能完成，文件没有更改。');
          resultBody.appendChild(statusRow('bad', res.method === 'git' ? '无法快进更新' : '更新失败', detail));
          if (res.output) resultBody.appendChild(el('pre.mono', { text: res.output, 'data-selectable': true, style: { marginTop: '12px', padding: '12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontSize: '11.5px', color: 'var(--ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '30vh', overflow: 'auto' } }));
          const retry = button('重新检查', { variant: 'ghost', iconName: 'refresh', onClick: doCheck });
          resultBody.appendChild(el('div', { style: { marginTop: '14px' } }, retry));
        }
      } catch (e) {
        if (progUnsub) { progUnsub(); progUnsub = null; }
        toast(String(e.message || e), 'bad');
        clear(resultBody);
        resultBody.appendChild(statusRow('bad', '更新失败', String(e.message || e)));
      }
    }

    async function doSelfCheck() {
      selfBtn.disabled = true;
      try {
        const r = await window.host.updatesCheckSelf();
        if (r.dev) { toast('当前从源码运行；请拉取仓库并重启应用以更新。', 'warn', '开发版本'); return; }
        if (!r.ok) { toast(r.error || '更新检查失败。', 'bad', '应用更新'); return; }
        if (r.portable) {
          if (r.available) toast(`控制中心 ${r.version} 已发布；此版本无法原地更新，请使用提示中的下载页面。`, 'good', '有可用更新');
          else toast(`控制中心已是最新版本（v${r.current}）。`, 'good', '应用更新');
          return;
        }
        if (r.available) toast(`控制中心 ${r.version} 已发布，请按提示安装。`, 'good', '有可用更新');
        else toast(`控制中心已是最新版本（v${r.current}）。`, 'good', '应用更新');
      } catch (e) {
        toast(String(e.message || e), 'bad', '应用更新');
      } finally {
        selfBtn.disabled = false;
      }
    }

    async function doRebuild() {
      rebuildBtn.disabled = true;
      toast('正在重新构建服务器…（输出见控制台）', 'good', 'dotnet build');
      try {
        const res = await window.host.updatesRebuild();
        toast(res.ok ? '服务器重新构建成功' : (res.error || `构建失败（代码 ${res.code}）`), res.ok ? 'good' : 'bad');
      } catch (e) {
        toast(String(e.message || e), 'bad');
      } finally {
        rebuildBtn.disabled = false;
      }
    }

    // detach the progress listener if the user navigates away mid-install
    return () => { if (progUnsub) { progUnsub(); progUnsub = null; } };
  },
};
