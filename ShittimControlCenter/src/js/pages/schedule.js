import { el, frag, clear, button, input, select, toggle, field, toast, confirmDialog, escapeHtml, emptyState, shortDate, notifyRestart, modal, num } from '../ui.js';
import { api, targetAccount } from '../api.js';
import { gate, loadInto } from './_util.js';

// EventContentType values that are their own minigame rather than a stage/shop/mission attached to one.
const MINIGAME_TYPES = {
  MiniGameRhythm: '节奏游戏',
  MinigameRhythmEvent: '节奏游戏',
  MiniGameShooting: '射击游戏',
  MiniGameTBG: '桌游',
  MiniGameDefense: '塔防',
  MinigameDreamMaker: '梦境制造机',
  MiniGameRoad: '道路解谜',
  MiniGameCCG: '卡牌战斗',
  DiceRace: '骰子竞速',
  Treasure: '寻宝',
  Conquest: '占领战',
  Field: '战场',
  EventLocation: '区域',
  CardShop: '卡牌商店',
  BoxGacha: '无限池',
  FortuneGachaShop: '占卜招募',
};

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'minigame', label: '包含小游戏' },
  { value: 'on', label: '当前强制开放' },
  { value: 'rerun', label: '复刻活动' },
  { value: 'rail', label: '显示大厅图标' },
  { value: 'unnamed', label: '缺少本地化名称' },
];

const SORTS = [
  { value: 'new', label: '最新优先' },
  { value: 'old', label: '最早优先' },
  { value: 'name', label: '名称' },
];

// Past this many lobby icons the dot bar under the rail keeps growing at a fixed pixel per dot and walks off the edge of the screen.
const RAIL_COMFORTABLE = 8;

// The event's own item names already read well enough ("Baddie's Apology Letter"), so the type is only there to say which of the three token slots it is.
const ITEM_TYPES = {
  EventPoint: '活动点数',
  EventToken1: '代币 1',
  EventToken2: '代币 2',
  EventToken3: '代币 3',
  EventToken4: '代币 4',
  EventToken5: '代币 5',
  EventMeetUpTicket: '外出券',
  EventEtcItem: '物品',
  Concentration: '专注力',
};

export default {
  id: 'schedule',
  title: '活动',  icon: 'play',
  needsTarget: false,

  mount(root) {
    return gate(root, { needServer: true }, (root) => {
      const body = el('div', {});
      root.appendChild(body);

      loadInto(body, () => api.eventSchedule(), (body, data) => {
        const events = data.events || [];
        const on = new Set(data.enabled || []);
        const byId = new Map(events.map((e) => [e.id, e]));

        // A rerun and the run it repeats are the same event to a player and only differ by which dates they carry, so they belong on adjacent rows under one heading rather than 89 ids apart in an id-sorted list.
        const families = new Map();
        for (const e of events) {
          const head = byId.has(e.original) ? e.original : e.id;
          if (!families.has(head)) families.set(head, []);
          families.get(head).push(e);
        }
        for (const members of families.values()) members.sort((a, b) => a.iconOrder - b.iconOrder || a.id - b.id);

        const search = input({ placeholder: '名称、ID、学生或小游戏' });
        const filter = select(FILTERS);
        const sort = select(SORTS);
        const count = el('span', {});
        const tb = el('tbody', {});
        // ticking a box must not re-run the filter under the cursor, so the only thing a toggle repaints is the count and the both-halves-on warnings
        const warns = [];

        const tbl = frag('<table class="tbl" style="table-layout:fixed"><thead><tr><th>活动</th><th style="width:200px">精选</th><th style="width:170px">内容</th><th style="width:118px">原开放时间</th><th style="width:58px">大厅</th><th style="width:64px">开放</th></tr></thead></table>');
        tbl.appendChild(tb);

        const list = el('div.list-scroll', { style: { maxHeight: '52vh' } }, tbl);
        const applyBtn = button('应用', { variant: 'primary', iconName: 'save', sm: true, onClick: apply });
        const clearBtn = button('全部关闭', { variant: 'ghost', iconName: 'refresh', sm: true, onClick: closeAll });
        const card = el('div.card', {},
          el('div.card-head', { style: { flexWrap: 'wrap', rowGap: '8px' } }, el('span.tab-mark', {}), el('h3', { text: '活动与小游戏' }),
            el('span.sub', { text: `此客户端版本包含 ${events.length} 个` }), el('div.spacer', {}), count, applyBtn, clearBtn),
          el('div.card-body', { style: { paddingBottom: '8px' } },
            el('div.row.wrap', { style: { gap: '10px' } },
              el('div', { style: { flex: '1', minWidth: '220px' } }, field('查找', search)),
              el('div', { style: { width: '190px' } }, field('显示', filter)),
              el('div', { style: { width: '160px' } }, field('排序', sort)))),
          list);

        body.appendChild(card);
        body.appendChild(frag('<p class="muted" style="font-size:12px;margin:14px 2px 0;line-height:1.6">游戏会在启动时读取活动表，因此应用后请重启客户端。活动档期不通过网络传输，客户端会自行比较本地表中的日期。此处开启活动会改写已安装游戏中的日期，使其永久开放；关闭则恢复原始日期。可同时开放任意数量的活动；开放后会出现大厅图标和活动菜单，但不会占用首页轮播横幅。服务器每次启动都会重新应用活动计划，因此游戏更新替换数据表后也不会悄悄关闭活动。</p>'));

        search.addEventListener('input', paint);
        filter.addEventListener('change', paint);
        sort.addEventListener('change', paint);
        paint();

        function matches(e) {
          const q = search.value.trim().toLowerCase();
          const f = filter.value;
          if (f === 'minigame' && !minigames(e).length) return false;
          if (f === 'on' && !on.has(e.id)) return false;
          if (f === 'rerun' && !e.isReturn) return false;
          if (f === 'rail' && !e.rail) return false;
          if (f === 'unnamed' && !(e.name.startsWith('活动 #') || e.name.startsWith('Event #'))) return false;
          if (!q) return true;
          return String(e.id).includes(q)
            || String(e.original || '').includes(q)
            || (e.name || '').toLowerCase().includes(q)
            || (e.key || '').toLowerCase().includes(q)
            || (e.students || []).some((s) => s.toLowerCase().includes(q))
            || (e.currency || []).some((c) => c.toLowerCase().includes(q))
            || e.types.some((t) => t.toLowerCase().includes(q) || (MINIGAME_TYPES[t] || '').toLowerCase().includes(q));
        }

        function paint() {
          clear(tb);
          warns.length = 0;

          const shown = [];
          for (const [rootId, members] of families) {
            const hit = members.filter(matches);
            if (hit.length) shown.push([rootId, hit]);
          }

          const dir = sort.value;
          shown.sort(([, a], [, b]) => {
            if (dir === 'name') return (a[0].name || '').localeCompare(b[0].name || '');
            // IconOrder counts down as events get newer, so ascending is newest-first.
            const key = (m) => Math.min(...m.map((x) => x.iconOrder));
            return dir === 'old' ? key(b) - key(a) : key(a) - key(b);
          });

          paintCount();

          if (!shown.length) { tb.appendChild(el('tr', {}, el('td', { colSpan: 6 }, emptyState('没有匹配结果')))); return; }

          for (const [, members] of shown) {
            members.forEach((e, i) => tb.appendChild(row(e, i > 0, members)));
          }
        }

        function row(e, indented, family) {
          const mg = minigames(e);
          const contents = mg.length ? mg : (e.stages ? [`${e.stages} 个关卡`] : []);
          const featured = (e.students || []).length ? e.students.join(', ') : (e.currency || []).join(', ');
          const tag = e.isReturn ? '复刻' : e.releaseType !== 'None' ? '常驻' : '';

          const tr = frag(`<tr>
            <td style="max-width:0;${indented ? 'padding-left:26px' : ''}"><b style="font-family:var(--font-round);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${escapeHtml(e.name)}</b><div class="muted" data-sub style="font-size:11px"><span data-selectable>#${e.id}</span>${tag ? ` - ${tag}` : ''}</div></td>
            <td class="muted" style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(featured || '-')}</td>
            <td class="muted" style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(contents.length ? [...new Set(contents)].join(', ') : '仅剧情')}</td>
            <td class="muted" style="font-size:11.5px;white-space:nowrap">${fmt(e.open)}<br>→ ${fmt(e.close)}</td>
            <td style="font-size:11px">${e.rail ? '<span class="pill">图标</span>' : '<span class="muted">仅菜单</span>'}</td>
            <td style="text-align:right"></td></tr>`);

          if (!indented && family.length > 1) {
            const warn = el('span', {});
            tr.querySelector('[data-sub]').appendChild(warn);
            const refresh = () => {
              clear(warn);
              if (family.filter((m) => on.has(m.id)).length > 1)
                warn.appendChild(frag('<span class="pill warn" style="margin-left:6px">同一活动同时开放两个版本</span>'));
            };
            refresh();
            warns.push(refresh);
          }

          const sw = toggle(on.has(e.id), (isOn) => {
            if (isOn) on.add(e.id); else on.delete(e.id);
            warns.forEach((f) => f());
            paintCount();
          });
          sw.addEventListener('click', (ev) => ev.stopPropagation());
          tr.lastElementChild.appendChild(sw);

          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => openUnlock(e, on.has(e.id)));
          return tr;
        }

        function railCount() {
          let n = 0;
          for (const id of on) { const e = byId.get(id); if (e && e.rail) n++; }
          return n;
        }

        function paintCount() {
          clear(count);
          const rail = railCount();
          const crowded = rail > RAIL_COMFORTABLE;
          count.appendChild(frag(`<span class="pill ${crowded ? 'warn' : on.size ? 'good' : ''}" title="${crowded ? '大厅图标下方每个圆点对应一个活动；超过约十个后可能超出屏幕' : ''}"><span class="dot"></span>${on.size ? `已强制开放 ${on.size} 个${rail ? `，大厅栏 ${rail} 个` : ''}` : '全部使用原始日期'}</span>`));
        }

        async function apply() {
          try {
            const out = await api.setEventSchedule({ enabled: [...on] });
            toast(on.size ? `已在 ${out.rows} 行数据中强制开放 ${on.size} 个活动` : '所有活动均已恢复原始日期', 'good', '客户端数据表已重写');
            notifyRestart();
          } catch (e) { toast(e.message, 'bad'); }
        }

        async function closeAll() {
          const ok = await confirmDialog({ title: '全部关闭', confirmLabel: '全部关闭',
            message: '所有活动都会恢复原本的开放日期，已长期结束的活动将再次从客户端消失。服务器中已保存的进度不会受到影响。' });
          if (!ok) return;
          on.clear();
          try {
            await api.setEventSchedule({ enabled: [] });
            toast('所有活动均已恢复原始日期', 'good');
            notifyRestart();
            paint();
          } catch (e) { toast(e.message, 'bad'); }
        }
      });
    });
  },
};

// Everything in here is written straight into one account's save, so it is the only part of this page that needs a target - the schedule itself is client-side and account-independent.
function openUnlock(e, isOn) {
  const acc = targetAccount();
  const body = el('div', {});
  const go = button('解锁', { variant: 'primary', iconName: 'check' });
  const cancel = button('取消', { variant: 'ghost' });
  const ref = modal({ title: e.name, body, footer: [cancel, go] });
  cancel.addEventListener('click', ref.close);

  if (!acc) {
    body.appendChild(frag('<p class="muted" style="font-size:13.5px;line-height:1.6;margin:0">请先从顶部选择账号。活动点数、关卡通关和商店重置都属于单个账号存档。</p>'));
    go.disabled = true;
    return;
  }

  go.disabled = true;
  const amounts = new Map();
  const picks = { stages: false, missions: false, shop: false, collections: false, minigame: false, minigameStages: false };

  loadInto(body, () => api.eventUnlocks(e.id, acc.serverId), (body, d) => {
    go.disabled = false;

    body.appendChild(frag(`<p class="muted" style="font-size:12px;line-height:1.6;margin:0 0 14px">正在写入 <b>${escapeHtml(acc.nickname)}</b> · #${acc.serverId}。${isOn ? '' : ' 此活动尚未强制开放；启用并重启客户端前无法访问其内容。'}</p>`));

    if (d.currency.length) {
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' } });
      for (const c of d.currency) {
        const box = input({ type: 'number', min: '0', placeholder: '0' });
        amounts.set(c.itemId, box);
        const cost = c.costMax ? ` - 每次消耗 ${c.costMin === c.costMax ? num(c.costMin) : `${num(c.costMin)}-${num(c.costMax)}`}` : '';
        grid.appendChild(field(c.name || `物品 ${c.itemId}`, box, `${ITEM_TYPES[c.type] || c.type} - 持有 ${num(c.held)}${cost}`));
      }
      body.appendChild(el('div', { style: { marginBottom: '16px' } },
        el('h4', { text: '活动货币', style: { margin: '0 0 8px', fontSize: '13px' } }), grid));
    }

    const rows = [
      d.stages.total && ['stages', '通关所有关卡', `共 ${d.stages.total} 个关卡，已通关 ${d.stages.cleared} 个；依赖关卡进度的内容也会一并开放。`],
      d.missions.total && ['missions', '完成所有任务', `共 ${d.missions.total} 个任务，已完成 ${d.missions.done} 个；奖励仍需在游戏内领取。`],
      d.shop.total && ['shop', '重置商店购买限制', `共 ${d.shop.total} 件商品，其中 ${d.shop.bought} 件已有购买记录。`],
      d.collections.total && ['collections', '解锁收藏', `共 ${d.collections.total} 项，已拥有 ${d.collections.owned} 项。`],
      d.minigame.total && ['minigame', '解锁小游戏', `${d.minigame.names.map((n) => MINIGAME_TYPES[n] || n).join('、')} 被锁在活动复刻版本的剧情关卡之后，因此只通关本次活动关卡无法开放。共 ${d.minigame.total} 个前置条件，已完成 ${d.minigame.cleared} 个。`],
      d.minigameStages.total && ['minigameStages', '通关全部小游戏关卡', `${d.minigameStages.kinds.join('、')} · 共 ${d.minigameStages.total} 个关卡，已通关 ${d.minigameStages.cleared} 个。解锁小游戏只会打开入口，此选项会完成全部关卡。`],
    ].filter(Boolean);

    if (!rows.length && !d.currency.length) {
      body.appendChild(emptyState('没有可解锁内容', '此活动没有独立关卡、任务、商店或货币'));
      go.disabled = true;
      return;
    }

    for (const [key, label, hint] of rows) {
      const sw = toggle(false, (v) => { picks[key] = v; });
      body.appendChild(el('div.row', { style: { alignItems: 'flex-start', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--line)' } },
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('b', { text: label, style: { fontSize: '13.5px' } }),
          el('div', { text: hint, style: { color: 'var(--ink-2)', fontSize: '11.5px', lineHeight: '1.55', marginTop: '2px' } })),
        sw));
    }
  });

  go.addEventListener('click', async () => {
    const currency = {};
    for (const [id, box] of amounts) {
      const v = Number(box.value) || 0;
      if (v > 0) currency[id] = v;
    }
    if (!Object.keys(currency).length && !Object.values(picks).some(Boolean)) { toast('未选择任何项目', 'warn'); return; }

    go.disabled = true;
    try {
      const r = await api.eventUnlock({
        accountServerId: acc.serverId, eventContentId: e.id,
        clearStages: picks.stages, completeMissions: picks.missions,
        resetShop: picks.shop, unlockCollections: picks.collections, unlockMinigame: picks.minigame,
        clearMinigames: picks.minigameStages, currency,
      });
      ref.close();
      const done = [
        r.stages && `已通关 ${r.stages} 个关卡`,
        r.missions && `已完成 ${r.missions} 个任务`,
        r.shop && `已重置 ${r.shop} 项商店限制`,
        r.collections && `已解锁 ${r.collections} 项收藏`,
        r.items && `已添加 ${r.items} 组物品`,
        r.minigame && '小游戏已解锁',
        r.minigameStages && `已通关 ${r.minigameStages} 个小游戏关卡`,
      ].filter(Boolean);
      toast(done.length ? done.join(', ') : '未发生更改；所选内容均已解锁', done.length ? 'good' : 'warn', e.name);
    } catch (err) { go.disabled = false; toast(err.message, 'bad'); }
  });
}

// The server's minigames list is derived from the type name, which misses the ones whose type reads as a mode rather than a minigame (Conquest, Treasure, Field), so the label falls back to the full type list.
function minigames(e) {
  const named = (e.minigames || []).map((t) => MINIGAME_TYPES[t] || t);
  return named.length ? named : e.types.filter((t) => MINIGAME_TYPES[t]).map((t) => MINIGAME_TYPES[t]);
}

function fmt(s) {
  if (!s) return '-';
  // season excel dates may be ISO or "yyyy-MM-dd HH:mm:ss"
  return shortDate(String(s).replace(' ', 'T'));
}
