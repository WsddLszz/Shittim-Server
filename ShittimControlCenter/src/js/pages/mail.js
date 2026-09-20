import { el, frag, clear, button, input, textarea, select, field, toast, confirmDialog, openPicker, promptAmount, num, shortDate, escapeHtml, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { api, targetAccount } from '../api.js';
import { gate, loadInto } from './_util.js';

const PARCEL_KINDS = [
  { value: 'Item', label: '物品', loader: (q) => api.staticItems(q), amount: true },
  { value: 'Currency', label: '货币', loader: () => api.staticCurrencies(), amount: true },
  { value: 'Equipment', label: '装备', loader: (q) => api.staticEquipment(q), amount: true },
  { value: 'Character', label: '学生', loader: (q) => api.staticCharacters(q), amount: false },
];
const PARCEL_LABEL = Object.fromEntries(PARCEL_KINDS.map((x) => [x.value, x.label]));

export default {
  id: 'mail',
  title: '邮件',  icon: 'mail',
  needsTarget: true,

  mount(root) {
    return gate(root, { needServer: true, needTarget: true }, (root) => {
      const acc = targetAccount();
      const uid = acc.serverId;
      const rewards = [];

      const layout = el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px', alignItems: 'start' } });
      root.appendChild(layout);

      const fSender = input({ value: '普拉娜' });
      const fComment = textarea({ value: '来自管理团队的礼物。' });
      const fExpire = input({ value: 30, type: 'number' });

      const kindSel = select(PARCEL_KINDS.map((k) => ({ value: k.value, label: k.label })));
      const addReward = button('添加附件', { variant: 'ghost', sm: true, iconName: 'plus', onClick: pickReward });
      const chipList = el('div.chips', {});
      paintChips();

      const sendBtn = button('发送邮件', { variant: 'primary', iconName: 'send', onClick: send });

      const composer = el('div.card', { style: { minWidth: '0' } },
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '撰写邮件' }),
          el('span.sub', { text: `发送给 ${acc.nickname} · #${uid}`, style: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } })),
        el('div.card-body', {},
          field('发件人', fSender),
          field('正文', fComment),
          field('有效期（天）', fExpire),
          frag('<div class="hazard" style="margin:6px 0 14px"></div>'),
          el('div', { text: '附件', style: { fontSize: '12px', fontWeight: '600', color: 'var(--ink-2)', margin: '0 0 10px' } }),
          el('div.input-row', { style: { marginBottom: '12px' } }, kindSel, addReward),
          chipList,
          el('div', { style: { marginTop: '16px' } }, sendBtn)));
      layout.appendChild(composer);

      function pickReward() {
        const kind = PARCEL_KINDS.find((k) => k.value === kindSel.value);
        openPicker({ title: `选择${kind.label}`,
          loader: (q) => kind.loader(q).then((r) => r.map((x) => ({ id: x.id, name: x.name, sub: x.icon || x.devName }))),
          onPick: (it) => {
            const add = (amount) => { rewards.push({ type: kind.value, id: it.id, name: it.name, amount }); paintChips(); };
            if (kind.amount) promptAmount({ title: `添加 ${it.name}`, confirmLabel: '添加', onConfirm: add });
            else add(1);
          } });
      }
      function paintChips() {
        clear(chipList);
        if (!rewards.length) { chipList.appendChild(frag('<div class="muted" style="font-size:12.5px;padding:6px 2px">暂无附件</div>')); return; }
        rewards.forEach((r, i) => {
          const chip = frag(`<div class="chip"><div class="chip-ic">${icon(r.type === 'Currency' ? 'coin' : r.type === 'Character' ? 'users' : r.type === 'Equipment' ? 'shield' : 'box')}</div>
            <div class="chip-main"><b>${escapeHtml(r.name)}</b><span data-selectable>${PARCEL_LABEL[r.type] || r.type} · ID ${r.id} · ×${num(r.amount)}</span></div></div>`);
          const x = frag('<button class="chip-x">✕</button>');
          x.addEventListener('click', () => { rewards.splice(i, 1); paintChips(); });
          chip.appendChild(x);
          chipList.appendChild(chip);
        });
      }
      async function send() {
        if (!rewards.length) { toast('请至少添加一个附件', 'warn'); return; }
        const days = Math.max(1, Number(fExpire.value) || 30);
        const expireDate = new Date(Date.now() + days * 86400000).toISOString();
        sendBtn.disabled = true;
        try {
          await api.sendMail({ accountServerId: uid, sender: fSender.value || '普拉娜', comment: fComment.value,
            parcels: rewards.map((r) => ({ type: r.type, id: r.id, amount: r.amount })), expireDate });
          toast('邮件已发送', 'good');
          rewards.length = 0; paintChips(); reloadInbox();
        } catch (e) { toast(e.message, 'bad'); }
        sendBtn.disabled = false;
      }

      const clearBtn = button('全部清空', { variant: 'ghost', sm: true, iconName: 'trash', onClick: async () => {
        const ok = await confirmDialog({ title: '清空收件箱', danger: true, confirmLabel: '全部删除', message: '确定删除此账号的全部邮件吗？' });
        if (!ok) return;
        try { await api.deleteMail({ accountServerId: uid, clearAll: true }); toast('收件箱已清空', 'warn'); reloadInbox(); }
        catch (e) { toast(e.message, 'bad'); }
      }});
      const refreshBtn = button('', { variant: 'ghost', sm: true, iconName: 'refresh', onClick: () => reloadInbox() });
      const inboxCard = el('div.card', { style: { minWidth: '0' } },
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '收件箱' }), el('div.spacer', {}), refreshBtn, clearBtn));
      const inboxBody = el('div.list-scroll', { style: { maxHeight: '66vh' } });
      inboxCard.appendChild(inboxBody);
      layout.appendChild(inboxCard);

      async function reloadInbox() {
        await loadInto(inboxBody, () => api.mails(uid), (body, mails) => {
          if (!mails.length) { body.appendChild(emptyState('收件箱为空')); return; }
          const wrap = el('div', { style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' } });
          for (const m of mails) {
            const parcels = (m.parcels || []).map((p) => `<span class="tag grey" data-selectable>${escapeHtml(PARCEL_LABEL[p.type] || p.type)} ${p.id} ×${num(p.amount)}</span>`).join(' ');
            const card = frag(`<div class="banner-card" style="gap:8px">
              <div class="bc-top"><b style="font-family:var(--font-round);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.sender)}</b>
                <span class="bc-id mono" data-selectable>#${m.serverId}</span><div class="spacer" style="flex:1"></div>
                <span class="pill ${m.collected ? '' : 'blue'}" style="flex:none"><span class="dot"></span>${m.collected ? '已领取' : '未读'}</span></div>
              <div style="font-size:12.5px;color:var(--ink-2);min-width:0;overflow-wrap:anywhere">${escapeHtml(m.comment || '')}</div>
              <div class="bc-feat">${parcels || '<span class="muted" style="font-size:12px">无附件</span>'}</div>
              <div class="muted" style="font-size:11.5px;min-width:0;overflow-wrap:anywhere">发送于 ${shortDate(m.sendDate)} · 到期于 ${shortDate(m.expireDate)}</div></div>`);
            // delete sits in the flex row after the status pill - absolutely positioning it overlapped the pill at every window size
            const del = frag(`<button class="chip-x" style="flex:none">✕</button>`);
            del.addEventListener('click', async () => { await api.deleteMail({ accountServerId: uid, mailServerId: m.serverId }); toast('邮件已删除', 'warn'); reloadInbox(); });
            card.querySelector('.bc-top').appendChild(del);
            wrap.appendChild(card);
          }
          body.appendChild(wrap);
        });
      }
      reloadInbox();
    });
  },
};
