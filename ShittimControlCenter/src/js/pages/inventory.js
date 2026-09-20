import { el, frag, clear, button, input, field, toast, modal, confirmDialog, notifyRestart, openPicker, promptAmount, num, stars, escapeHtml, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { api, targetAccount } from '../api.js';
import { gate, loadInto } from './_util.js';

export default {
  id: 'inventory',
  title: '仓库',  icon: 'inventory',
  needsTarget: true,

  mount(root) {
    return gate(root, { needServer: true, needTarget: true }, (root) => {
      const acc = targetAccount();
      const uid = acc.serverId;

      const bulk = el('div.card', { style: { marginBottom: '18px' } },
        el('div.card-head', { style: { flexWrap: 'wrap', rowGap: '4px' } }, el('span.tab-mark', {}), el('h3', { text: '批量发放' }),
          el('span.sub', { style: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            `发放给 ${acc.nickname} - `,
            el('span.mono', { text: `#${uid}`, 'data-selectable': '' }))),
        el('div.card-body', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', minWidth: '0' } },
          cmdBtn(uid, '所有物品', 'box', 'inventory add items', 'ghost', () => reloadItems()),
          cmdBtn(uid, '所有装备', 'shield', 'giveallequip', 'ghost'),
          cmdBtn(uid, '所有学生', 'users', 'giveall', 'ghost', () => reloadChars()),
          cmdBtn(uid, '学生全部满练度', 'star', 'max all', 'ghost', () => reloadChars()),
          dangerCmd(uid, '清空仓库', 'trash', 'clearinventory', () => reloadItems())));
      root.appendChild(bulk);

      const grid = el('div.grid-2', { style: { alignItems: 'start' } });
      root.appendChild(grid);

      const itemSearch = input({ placeholder: '筛选…', className: 'input btn-sm', style: { height: '32px', width: '120px', minWidth: '0', flex: '0 1 120px' } });
      const giveItemBtn = button('发放物品', { variant: 'primary', sm: true, iconName: 'plus', onClick: giveItem });
      const itemsCard = el('div.card', {},
        el('div.card-head', { style: { flexWrap: 'wrap', rowGap: '8px' } }, el('span.tab-mark', {}), el('h3', { text: '物品' }),
          el('div.spacer', {}), itemSearch, giveItemBtn));
      const itemsBody = el('div.list-scroll', { style: { maxHeight: '58vh' } });
      itemsCard.appendChild(itemsBody);
      grid.appendChild(itemsCard);
      let itemRows = [];
      itemSearch.addEventListener('input', paintItems);

      function paintItems() {
        const q = itemSearch.value.trim().toLowerCase();
        const rows = itemRows.filter((r) => !q || r.name.toLowerCase().includes(q) || String(r.uniqueId).includes(q));
        clear(itemsBody);
        if (!rows.length) { itemsBody.appendChild(emptyState('暂无物品')); return; }
        // 64px = 36px trash button + the 28px of cell padding (border-box) - narrower and the button overflows the fixed column, dragging a horizontal scrollbar into the list
        const tbl = frag('<table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:74px">ID</th><th>名称</th><th style="width:72px">数量</th><th style="width:64px"></th></tr></thead><tbody></tbody></table>');
        const tb = tbl.querySelector('tbody');
        for (const r of rows) {
          const tr = frag(`<tr><td class="num mono" data-selectable>${r.uniqueId}</td><td style="min-width:0;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</td><td class="num">${num(r.stackCount)}</td><td></td></tr>`);
          const x = button('', { variant: 'ghost', sm: true, iconName: 'trash' });
          x.style.height = '26px'; x.style.padding = '0 8px';
          x.addEventListener('click', async (e) => { e.stopPropagation(); await api.removeItem({ accountServerId: uid, uniqueId: r.uniqueId }); toast('物品已移除', 'warn'); notifyRestart(); reloadItems(); });
          tr.lastElementChild.appendChild(x);
          tb.appendChild(tr);
        }
        itemsBody.appendChild(tbl);
      }
      async function reloadItems() { await loadInto(itemsBody, () => api.items(uid), (_b, rows) => { itemRows = rows; paintItems(); }); }

      function giveItem() {
        openPicker({ title: '选择物品', loader: (q) => api.staticItems(q).then((r) => r.map((x) => ({ id: x.id, name: x.name, sub: x.icon }))),
          onPick: (it) => promptAmount({ title: `发放 ${it.name}`, confirmLabel: '发放', onConfirm: async (amount) => {
            await api.giveItem({ accountServerId: uid, uniqueId: it.id, amount });
            toast(`已发放 ${num(amount)}× ${it.name}`, 'good'); notifyRestart(); reloadItems();
          } }) });
      }

      const charSearch = input({ placeholder: '筛选…', className: 'input btn-sm', style: { height: '32px', width: '120px', minWidth: '0', flex: '0 1 120px' } });
      const addCharBtn = button('添加学生', { variant: 'primary', sm: true, iconName: 'plus', onClick: addChar });
      const charsCard = el('div.card', {},
        el('div.card-head', { style: { flexWrap: 'wrap', rowGap: '8px' } }, el('span.tab-mark', {}), el('h3', { text: '学生' }),
          el('div.spacer', {}), charSearch, addCharBtn));
      const charsBody = el('div.list-scroll', { style: { maxHeight: '58vh' } });
      charsCard.appendChild(charsBody);
      grid.appendChild(charsCard);
      let charRows = [];
      charSearch.addEventListener('input', paintChars);

      function paintChars() {
        const q = charSearch.value.trim().toLowerCase();
        const rows = charRows.filter((r) => !q || r.name.toLowerCase().includes(q) || String(r.uniqueId).includes(q));
        clear(charsBody);
        if (!rows.length) { charsBody.appendChild(emptyState('暂无学生')); return; }
        const tbl = frag('<table class="tbl" style="table-layout:fixed"><thead><tr><th style="width:74px">ID</th><th>名称</th><th style="width:84px">星级</th><th style="width:54px">等级</th></tr></thead><tbody></tbody></table>');
        const tb = tbl.querySelector('tbody');
        for (const r of rows) {
          const tr = frag(`<tr><td class="num mono" data-selectable>${r.uniqueId}</td><td style="min-width:0;max-width:0"><b style="font-family:var(--font-round);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</b></td><td class="stars"></td><td class="num">${r.level}</td></tr>`);
          tr.title = '点击将这名学生设为满练度';
          const starCell = tr.querySelector('.stars');
          for (let i = 1; i <= 5; i++) {
            const s = el('span', { text: i <= r.starGrade ? '★' : '☆', title: `设为 ${i}★`, style: { cursor: 'pointer' } });
            s.addEventListener('click', async (e) => {
              e.stopPropagation();
              try { await api.command(uid, `character modify ${r.uniqueId} star ${i}`); toast(`${r.name} 已设为 ${i}★`, 'good'); notifyRestart(); reloadChars(); }
              catch (err) { toast(err.message, 'bad'); }
            });
            starCell.appendChild(s);
          }
          tr.addEventListener('click', async () => {
            const ok = await confirmDialog({ title: '学生满练度', confirmLabel: '设为满练度', message: `将 ${r.name} 设为满练度（90 级、最高星级、技能和装备全满）？` });
            if (!ok) return;
            const target = r.devName || r.name;
            try { await api.command(uid, `max ${target}`); toast(`${r.name} 已设为满练度`, 'good'); notifyRestart(); reloadChars(); }
            catch (e) { toast(e.message, 'bad'); }
          });
          tb.appendChild(tr);
        }
        charsBody.appendChild(tbl);
      }
      async function reloadChars() { await loadInto(charsBody, () => api.characters(uid), (_b, rows) => { charRows = rows; paintChars(); }); }

      function addChar() {
        openPicker({ title: '选择学生', loader: (q) => api.staticCharacters(q).then((r) => r.map((x) => ({ id: x.id, name: x.name, sub: `★${x.maxStar}` }))),
          onPick: (it) => {
            const lvl = input({ value: 'max' });
            const add = button('添加', { variant: 'primary', iconName: 'plus' });
            const cancel = button('取消', { variant: 'ghost' });
            const ref = modal({ title: `添加 ${it.name}`, body: el('div', {}, field('培养预设', lvl, 'barebone（裸卡）/ basic（基础）/ ue30 / ue50 / max（满练度）')), footer: [cancel, add] });
            cancel.addEventListener('click', ref.close);
            add.addEventListener('click', async () => {
              const opt = (lvl.value.trim() || 'max').toLowerCase();
              try { await api.command(uid, `character add ${it.id} ${opt}`); ref.close(); toast(`已添加 ${it.name}`, 'good'); notifyRestart(); reloadChars(); }
              catch (e) { toast(e.message, 'bad'); }
            });
          } });
      }

      reloadItems();
      reloadChars();

      function cmdBtn(uid, label, ic, command, variant, after) {
        return button(label, { variant, sm: true, iconName: ic, onClick: async () => {
          try { await api.command(uid, command); toast(label, 'good'); notifyRestart(); after && after(); }
          catch (e) { toast(e.message, 'bad'); }
        }});
      }
      function dangerCmd(uid, label, ic, command, after) {
        return button(label, { variant: 'danger', sm: true, iconName: ic, onClick: async () => {
          const ok = await confirmDialog({ title: label, danger: true, confirmLabel: label, message: '这会清空该账号的仓库物品和未绑定装备。' });
          if (!ok) return;
          try { await api.command(uid, command); toast(label, 'warn'); notifyRestart(); after && after(); }
          catch (e) { toast(e.message, 'bad'); }
        }});
      }
    });
  },
};
