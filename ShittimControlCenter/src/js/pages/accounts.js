import { el, frag, clear, button, input, select, field, toast, modal, confirmDialog, notifyRestart, num, escapeHtml, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { api, store, reloadAccounts, CURRENCY_ID, CURRENCY_NAME, PRIMARY_CURRENCIES } from '../api.js';
import { gate, loadInto } from './_util.js';

function normalizeCurrencies(dict) {
  const out = {};
  for (const [k, v] of Object.entries(dict || {})) {
    let id = Number(k);
    if (Number.isNaN(id)) id = CURRENCY_ID[k];
    if (id != null) out[id] = Number(v) || 0;
  }
  return out;
}

export default {
  id: 'accounts',
  title: '账号',  icon: 'users',
  needsTarget: false,

  mount(root) {
    return gate(root, { needServer: true }, (root) => {
      const gameSel = select([], { style: { minWidth: '220px' } });
      gameSel.addEventListener('change', async () => {
        const id = Number(gameSel.value);
        try {
          await api.selectAccount(id);
          gameAccountId = id || null;
          const picked = allRows.find((a) => a.serverId === id);
          toast(id ? `下次启动时，游戏将登录“${picked ? picked.nickname : id}”` : '游戏将重新跟随 Steam 账号登录', 'good');
          paintList();
        } catch (e) { toast(e.message, 'bad'); fillGameSel(); }
      });
      root.appendChild(el('div.card', { style: { marginBottom: '18px' } },
        el('div.card-body', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
          el('b', { text: '游戏账号', style: { fontFamily: 'var(--font-round)', fontSize: '13px' } }),
          gameSel,
          el('span.muted', { text: '下次启动游戏时生效。', style: { fontSize: '12px' } }))));

      const layout = el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: '18px', alignItems: 'start' } });
      const listCard = el('div.card', { style: { minWidth: '0' } });
      const detailCard = el('div.card', { style: { minWidth: '0' } });
      layout.appendChild(listCard);
      layout.appendChild(detailCard);
      root.appendChild(layout);

      const searchInput = input({ placeholder: '筛选…', className: 'input btn-sm', style: { height: '32px', width: '130px', minWidth: '0', flex: '0 1 130px' } });
      const createBtn = button('新建', { variant: 'primary', sm: true, iconName: 'plus', onClick: openCreate });
      const refreshBtn = button('', { variant: 'ghost', sm: true, iconName: 'refresh', onClick: loadList });

      listCard.appendChild(el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '账号列表' }),
        el('div.spacer', {}), searchInput, refreshBtn, createBtn));
      const listBody = el('div.list-scroll', { style: { maxHeight: '64vh' } });
      listCard.appendChild(listBody);

      let allRows = [];
      let gameAccountId = null;
      searchInput.addEventListener('input', () => paintList());

      function paintList() {
        const q = searchInput.value.trim().toLowerCase();
        const rows = allRows.filter((a) => !q || a.nickname.toLowerCase().includes(q) || String(a.serverId).includes(q));
        clear(listBody);
        if (!rows.length) { listBody.appendChild(emptyState(q ? '没有匹配的账号' : '暂无账号')); return; }
        const tbl = frag('<table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:74px">ID</th><th>昵称</th><th style="width:54px">等级</th></tr></thead><tbody></tbody></table>');
        const tb = tbl.querySelector('tbody');
        for (const a of rows) {
          const inGame = a.serverId === gameAccountId ? '<span class="tag" style="flex:none">游戏当前账号</span>' : '';
          const tr = frag(`<tr><td class="num" data-selectable>${a.serverId}</td><td style="max-width:0"><div style="display:flex;align-items:center;gap:6px;min-width:0"><b data-selectable style="font-family:var(--font-round);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.nickname)}</b>${inGame}</div></td><td class="num">${a.level}</td></tr>`);
          if (a.serverId === store.get().targetId) tr.classList.add('sel');
          tr.addEventListener('click', () => { store.set({ targetId: a.serverId }); paintList(); loadDetail(a.serverId); });
          tb.appendChild(tr);
        }
        listBody.appendChild(tbl);
      }

      function fillGameSel() {
        clear(gameSel);
        for (const o of [{ value: 0, label: '跟随 Steam 账号' }, ...allRows.map((a) => ({ value: a.serverId, label: `${a.nickname} (#${a.serverId})` }))]) {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          gameSel.appendChild(opt);
        }
        gameSel.value = String(gameAccountId || 0);
      }

      async function loadList() {
        listBody.innerHTML = `<div class="empty"><div class="spinner"></div></div>`;
        allRows = await reloadAccounts();
        gameAccountId = await api.selectedAccount().then((r) => r.selectedAccountId || null).catch(() => null);
        fillGameSel();
        paintList();
        const t = store.get().targetId;
        if (t) loadDetail(t); else showDetailPlaceholder();
      }

      function showDetailPlaceholder() {
        clear(detailCard);
        detailCard.appendChild(el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '账号详情' })));
        detailCard.appendChild(emptyState('请选择一个账号'));
      }

      async function loadDetail(id) {
        clear(detailCard);
        detailCard.appendChild(el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '账号详情' }),
          el('span.sub', { text: `#${id}`, 'data-selectable': '' })));
        const body = el('div.card-body', {});
        detailCard.appendChild(body);
        await loadInto(body, () => api.accountDetail(id), (body, d) => renderDetail(body, d));
      }

      function renderDetail(body, d) {
        const fNick = input({ value: d.nickname || '' });
        const fComment = input({ value: d.comment || '' });
        const fLevel = input({ value: d.level ?? 1, type: 'number' });
        const fExp = input({ value: d.exp ?? 0, type: 'number' });
        const fVip = input({ value: d.vipLevel ?? 0, type: 'number' });

        const idGrid = el('div.grid-2', {},
          field('昵称', fNick),
          field('签名', fComment),
          field('等级', fLevel),
          field('经验值', fExp),
          field('VIP 等级', fVip));
        body.appendChild(idGrid);
        const saveId = button('保存账号信息', { variant: 'primary', iconName: 'save', onClick: async () => {
          const r = await api.accountUpdate({ serverId: d.serverId, nickname: fNick.value, comment: fComment.value, level: Number(fLevel.value), exp: Number(fExp.value), vipLevel: Number(fVip.value) }).then(() => ({ ok: true })).catch((e) => ({ ok: false, error: e.message }));
          toast(r.ok ? '账号信息已更新' : r.error, r.ok ? 'good' : 'bad');
          if (r.ok) { notifyRestart(); reloadAccounts().then((rows) => { allRows = rows; paintList(); }); }
        }});
        body.appendChild(el('div', { style: { marginTop: '4px' } }, saveId));

        body.appendChild(frag('<div class="hazard" style="margin:20px 0 16px"></div>'));
        body.appendChild(el('div', { text: '货币', style: { fontSize: '12px', fontWeight: '600', color: 'var(--ink-2)', margin: '0 0 10px' } }));
        const cur = normalizeCurrencies(d.currencies);
        const curGrid = el('div.grid-2', {});
        const edits = {};
        for (const cid of PRIMARY_CURRENCIES) {
          const i = input({ value: cur[cid] ?? 0, type: 'number' });
          edits[cid] = { input: i, orig: cur[cid] ?? 0 };
          curGrid.appendChild(field(CURRENCY_NAME[cid], i));
        }
        body.appendChild(curGrid);
        const saveCur = button('应用货币修改', { variant: 'primary', iconName: 'coin', onClick: async () => {
          let n = 0;
          for (const [cid, e] of Object.entries(edits)) {
            const val = Number(e.input.value);
            if (val !== e.orig) { await api.setCurrency({ accountServerId: d.serverId, currencyType: Number(cid), amount: val }); e.orig = val; n++; }
          }
          toast(n ? `已更新 ${n} 种货币` : '没有改动', n ? 'good' : 'warn');
          if (n) notifyRestart();
        }});
        body.appendChild(el('div.row.wrap', { style: { marginTop: '4px', gap: '10px' } },
          saveCur,
          button('全部货币设为最大值', { variant: 'ghost', onClick: () => maxCurrencies(d.serverId, edits) })));

        body.appendChild(frag('<div class="hazard" style="margin:20px 0 16px"></div>'));
        body.appendChild(el('div', { text: '快捷操作', style: { fontSize: '12px', fontWeight: '600', color: 'var(--ink-2)', margin: '0 0 10px' } }));
        const tools = el('div.row.wrap', { style: { gap: '10px' } });
        tools.appendChild(cmdButton(d.serverId, '所有学生满练度', 'max all'));
        tools.appendChild(cmdButton(d.serverId, '解锁所有学生', 'giveall'));
        tools.appendChild(cmdButton(d.serverId, '解锁任务关卡与剧情', ['unlockall campaign', 'unlockall story']));
        tools.appendChild(cmdButton(d.serverId, '解锁通行证', 'unlockall battlepass'));
        body.appendChild(tools);

        const stateName = ({ WaitingSignIn: '等待登录', Normal: '正常', Dormant: '休眠', Comeback: '回归', Newbie: '新账号' })[d.state] || d.state || '';
        body.appendChild(frag(`<div class="muted" style="font-size:12px;margin-top:18px">${d.itemCount} 个物品 · ${d.characterCount} 名学生 · ${d.mailCount} 封邮件 · ${escapeHtml(stateName)}</div>`));
        const del = button('删除账号', { variant: 'danger', iconName: 'trash', onClick: async () => {
          const ok = await confirmDialog({ title: '删除账号', danger: true, confirmLabel: '永久删除',
            message: `这会永久删除“${d.nickname}”(#${d.serverId}) 及其全部数据。` });
          if (!ok) return;
          try { await api.accountDelete(d.serverId); toast('账号已删除', 'warn'); store.set({ targetId: null }); loadList(); }
          catch (e) { toast(e.message, 'bad'); }
        }});
        body.appendChild(el('div', { style: { marginTop: '16px' } }, del));
      }

      function cmdButton(uid, label, command) {
        const commands = Array.isArray(command) ? command : [command];
        return button(label, { variant: 'ghost', sm: true, onClick: async () => {
          try { for (const c of commands) await api.command(uid, c); toast(label, 'good'); notifyRestart(); }
          catch (e) { toast(e.message, 'bad'); }
        }});
      }
      async function maxCurrencies(id, edits) {
        const MAX = 999999999;
        for (const [cid, e] of Object.entries(edits)) { await api.setCurrency({ accountServerId: id, currencyType: Number(cid), amount: MAX }); e.input.value = MAX; e.orig = MAX; }
        toast('已将当前显示的货币全部设为最大值', 'good');
        notifyRestart();
      }

      function openCreate() {
        const nick = input({ value: 'Sensei' });
        const create = button('创建账号', { variant: 'primary', iconName: 'plus' });
        const cancel = button('取消', { variant: 'ghost' });
        const ref = modal({ title: '新建账号', body: el('div', {}, field('昵称', nick)),
          footer: [cancel, create] });
        cancel.addEventListener('click', ref.close);
        create.addEventListener('click', async () => {
          create.disabled = true;
          try {
            const r = await api.accountCreate({ nickname: nick.value.trim() || 'Sensei' });
            ref.close(); toast(`已创建“${nick.value}”(#${r.serverId})`, 'good');
            store.set({ targetId: r.serverId });
            await loadList();
          } catch (e) { toast(e.message, 'bad'); create.disabled = false; }
        });
      }

      loadList();
    });
  },
};
