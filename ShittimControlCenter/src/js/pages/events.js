import { el, frag, clear, button, input, field, toast, confirmDialog, notifyRestart, shortDate, escapeHtml, emptyState } from '../ui.js';
import { api, targetAccount } from '../api.js';
import { gate, loadInto } from './_util.js';

const TYPES = [
  { key: 'total', title: '总力战', icon: 'shield' },
  { key: 'grand', title: '大决战', icon: 'bolt' },
  { key: 'drill', title: '综合战术考试', icon: 'clock' },
  { key: 'final', title: '制约解除决战', icon: 'flask' },
];

export default {
  id: 'events',
  title: '周期战斗',  icon: 'events',
  needsTarget: true,

  mount(root) {
    return gate(root, { needServer: true, needTarget: true }, (root) => {
      const acc = targetAccount();
      const uid = acc.serverId;

      root.appendChild(frag(`<div class="row wrap" style="margin:-2px 0 16px;gap:8px">
        <span class="pill blue"><span class="dot"></span>当前账号：${escapeHtml(acc.nickname)} · #${uid}</span></div>`));

      // 199 seasons across four scrollers, so the boss name is the only way anyone finds the one they want.
      const search = input({ placeholder: '赛季编号或首领名称' });
      root.appendChild(el('div', { style: { maxWidth: '320px', margin: '0 0 14px' } }, field('查找', search)));

      const grid = el('div.grid-2', { style: { alignItems: 'start' } });
      root.appendChild(grid);

      loadInto(grid, () => api.eventSeasons(uid), (grid, data) => {
        const filters = [];
        search.addEventListener('input', () => filters.forEach((f) => f()));

        for (const t of TYPES) {
          const seasons = data[t.key] || [];
          const live = data.current ? data.current[t.key] : null;
          const body = el('div.list-scroll', { style: { maxHeight: '40vh' } });
          const card = el('div.card', { style: { minWidth: '0' } },
            el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: t.title }),
              el('div.spacer', {}), live ? frag(`<span class="pill good"><span class="dot"></span>当前赛季 ${live}</span>`) : null),
            body);

          if (!seasons.length) {
            body.appendChild(emptyState('暂无赛季数据'));
          } else {
            // Window 132px fits the nowrap date lines; 94px fits the Apply button (box-sizing includes the 28px cell padding) - anything narrower paints the button over the date column and past the card edge.
            const tbl = frag('<table class="tbl" style="table-layout:fixed"><thead><tr><th>赛季</th><th style="width:132px">开放时间</th><th style="width:94px"></th></tr></thead><tbody></tbody></table>');
            const tb = tbl.querySelector('tbody');
            for (const s of seasons) {
              const tr = frag(`<tr>
                <td style="max-width:0"><b style="font-family:var(--font-round)" data-selectable>#${escapeHtml(String(s.seasonId))}</b><div class="muted" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.boss || '')}</div></td>
                <td class="muted" style="font-size:11.5px;white-space:nowrap">${fmt(s.start)}<br>→ ${fmt(s.end)}</td>
                <td style="text-align:right;white-space:nowrap"></td></tr>`);
              const apply = button('应用', { variant: 'primary', sm: true });
              apply.style.height = '28px'; apply.style.padding = '0 12px';
              apply.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = await confirmDialog({ title: `${t.title} → 赛季 ${s.seasonId}`, confirmLabel: '应用赛季',
                  message: `将 ${acc.nickname} 的${t.title}设置为赛季 ${s.seasonId}？该玩法中尚未结束的战斗将被关闭。` });
                if (!ok) return;
                try {
                  // the bridge answers 200 even when the command bailed ("Season ID does not exist", "Invalid type!"), so trust the command's own confirmation line rather than the status code
                  const out = String((await api.command(uid, `setseason ${t.key} ${s.seasonId}`))?.output || '');
                  if (!out.includes(`set to ${s.seasonId}`)) { toast(out.trim().split('\n').pop() || '赛季未更改', 'bad'); return; }
                  toast(`${t.title}已设置为赛季 ${s.seasonId}`, 'good'); notifyRestart();
                }
                catch (err) { toast(err.message, 'bad'); }
              });
              tr.lastElementChild.appendChild(apply);
              if (s.seasonId === live) tr.firstElementChild.querySelector('b').appendChild(frag('<span class="pill good" style="margin-left:6px">当前</span>'));
              tb.appendChild(tr);
            }
            body.appendChild(tbl);

            const empty = emptyState('没有匹配的赛季');
            empty.style.display = 'none';
            body.appendChild(empty);
            filters.push(() => {
              const q = search.value.trim().toLowerCase();
              let hits = 0;
              for (let i = 0; i < seasons.length; i++) {
                const show = !q || String(seasons[i].seasonId).includes(q) || (seasons[i].boss || '').toLowerCase().includes(q);
                tb.children[i].style.display = show ? '' : 'none';
                if (show) hits++;
              }
              tbl.style.display = hits ? '' : 'none';
              empty.style.display = hits ? 'none' : '';
            });
          }
          grid.appendChild(card);
        }
      });
    });
  },
};

function fmt(s) {
  if (!s) return '-';
  // season excel dates may be ISO or "yyyy-MM-dd HH:mm:ss"
  return shortDate(String(s).replace(' ', 'T'));
}
