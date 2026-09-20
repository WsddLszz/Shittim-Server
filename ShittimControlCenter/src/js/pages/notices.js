import { el, frag, clear, button, input, select, toggle, field, toast, confirmDialog } from '../ui.js';
import { api } from '../api.js';
import { gate } from './_util.js';

// Blurbs keyed by ServerNotificationFlag member name. A bit the server enum grows past this list still gets a row, just without a description.
const FLAG_DESC = {
  NewMailArrived: '在大厅弹出新邮件提示。',
  HasUnreadMail: '点亮邮箱角标；账号存在未读邮件时服务器也会自动设置。',
  NewToastDetected: '客户端拉取并显示排队中的弹窗通知。',
  CanReceiveArenaDailyReward: '标记竞技场每日奖励可领取。',
  CanReceiveRaidReward: '标记总力战奖励可领取。',
  ServerMaintenance: '每次响应都会读取；真正的维护画面由右侧服务器门禁控制。',
  CannotReceiveMail: '邮箱已满，客户端将停止提供领取操作。',
  InventoryFullRewardMail: '提示玩家因仓库已满，奖励已发送到邮箱。',
  CanReceiveClanAttendanceReward: '标记社团签到奖励可领取。',
  HasClanApplicant: '社团有待处理的加入申请。',
  HasFriendRequest: '有待处理的好友申请。',
  CheckConquest: '占领战状态已变化，需要重新获取。',
  CanReceiveEliminateRaidReward: '标记大决战奖励可领取。',
  CanReceiveMultiFloorRaidReward: '标记制约解除决战奖励可领取。',
  CanReceiveProductDailyRecordReward: '标记月卡每日奖励可领取。',
  HasUnreadSemiPermanentMail: '长期保留邮箱中存在未读邮件。',
};

// The error codes the client has a dedicated screen for. Everything else in WebAPIErrorCode lands on its generic popup, which is what "Other error code" is for.
const GATE_CODES = [
  { value: 28001, name: 'ServerIsUnderMaintenance', desc: '显示完整维护画面，所有玩家都会停在标题界面。' },
  { value: 28002, name: 'ServerMaintenanceSoon', desc: '即将停服警告。' },
  { value: 28003, name: 'AccountIsNotInWhiteList', desc: '封闭测试门禁：玩家不在白名单中。' },
  { value: 28005, name: 'ServerContentsLock', desc: '内容已锁定。' },
  { value: 27000, name: 'AccountBanned', desc: '封禁画面。' },
  { value: 903, name: 'ClientUpdateRequire', desc: '强制更新提示。' },
  { value: 3, name: 'InvalidSession', desc: '返回标题画面并要求重新登录。' },
];

export default {
  id: 'notices',
  title: '通知与维护',  icon: 'info',
  needsTarget: false,

  mount(root, { rerender }) {
    return gate(root, { needServer: true }, async (root) => {
      const state = await api.notice();
      let flags = state.flags | 0;

      const flagTag = el('span', {});
      const gateTag = el('span', {});

      const flagBody = el('div', {});
      for (const f of state.availableFlags) {
        const row = el('div.toggle-row', {},
          el('div.tr-text', {}, el('b', { text: f.name }), el('span', { text: FLAG_DESC[f.name] || `位 ${f.value}` })));
        row.appendChild(toggle((flags & f.value) !== 0, (on) => {
          flags = on ? (flags | f.value) : (flags & ~f.value);
          paintFlags();
        }));
        flagBody.appendChild(row);
      }

      const flagCard = el('div.card', { style: { minWidth: '0' } },
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '通知标志' }),
          el('span.sub', { text: '附加到每次响应' }), el('div.spacer', {}), flagTag),
        el('div.card-body', { style: { minWidth: '0' } }, flagBody,
          frag('<p class="muted" style="font-size:12px;margin:10px 0 0;line-height:1.6">这些标志会与服务器根据实际游戏状态计算出的结果合并，因此此处未启用的标志仍可能被游戏状态触发。登录前请求及四种跳过通知的协议不会附加这些标志。</p>')));

      const codeSel = select(
        [{ value: '0', label: '关闭 · 正常提供服务' }]
          .concat(GATE_CODES.map((c) => ({ value: String(c.value), label: `${c.name} - ${c.value}` })))
          .concat([{ value: 'custom', label: '其他错误代码…' }]));
      const customCode = input({ type: 'number', value: '' });
      const customField = field('错误代码', customCode, '任意 WebAPIErrorCode 值');
      const msg = input({ value: state.gate消息 || '', placeholder: '服务器正在维护' });
      const codeNote = el('p.muted', { style: { fontSize: '12px', margin: '-2px 0 14px', lineHeight: '1.6' } });

      const known = GATE_CODES.some((c) => c.value === state.gateError);
      codeSel.value = state.gateError ? (known ? String(state.gateError) : 'custom') : '0';
      if (state.gateError && !known) customCode.value = state.gateError;

      codeSel.addEventListener('change', paintGate);
      customCode.addEventListener('input', paintGate);

      const gateCard = el('div.card', { style: { minWidth: '0' } },
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '关闭服务器' }),
          el('div.spacer', {}), gateTag),
        el('div.card-body', { style: { minWidth: '0' } },
          field('所有请求均返回', codeSel),
          codeNote,
          customField,
          field('消息', msg, '随错误数据包发送'),
          frag('<p class="muted" style="font-size:12px;margin:10px 0 0;line-height:1.6">客户端会为上述代码显示专用画面，因此消息主要出现在日志中。加密握手会保持开放；否则客户端无法解密错误，维护画面会退化为连接失败。</p>')));

      const applyBtn = button('应用', { variant: 'primary', iconName: 'save', onClick: apply });
      const clearBtn = button('全部清除', { variant: 'ghost', iconName: 'refresh', onClick: clearAll });
      const bar = el('div.card', { style: { marginTop: '18px' } },
        el('div.card-body', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
          applyBtn, clearBtn, el('div.spacer', {}),
          frag('<span class="pill blue"><span class="dot"></span>下次请求时生效</span>')));

      root.appendChild(el('div.grid-2', { style: { alignItems: 'start' } }, flagCard, gateCard));
      root.appendChild(bar);
      paintFlags();
      paintGate();

      function currentCode() {
        return parseInt(codeSel.value === 'custom' ? customCode.value : codeSel.value, 10) || 0;
      }
      function paintFlags() {
        clear(flagTag);
        const set = state.availableFlags.filter((f) => flags & f.value).length;
        flagTag.appendChild(frag(`<span class="pill ${flags ? 'blue' : ''}"><span class="dot"></span>ServerNotification = ${flags}${set ? ` - 已启用 ${set} 项` : ''}</span>`));
      }
      function paintGate() {
        const code = currentCode();
        customField.style.display = codeSel.value === 'custom' ? '' : 'none';
        const c = GATE_CODES.find((x) => x.value === code);
        codeNote.textContent = c ? c.desc
          : code ? '客户端没有此错误的专用画面，将改用通用错误弹窗。'
          : '';
        clear(gateTag);
        gateTag.appendChild(frag(`<span class="pill ${code ? 'warn' : 'good'}"><span class="dot"></span>${code ? '已关闭 · ' + code : '开放'}</span>`));
      }

      async function apply() {
        const code = currentCode();
        if (code && code !== state.gateError) {
          const c = GATE_CODES.find((x) => x.value === code);
          const ok = await confirmDialog({ title: '关闭服务器', confirmLabel: '关闭服务器', danger: true,
            message: `除加密握手外，所有账号的每个请求都将收到 ${c ? c.name : '错误 ' + code}，直到你关闭此设置；已在游戏中的玩家会在下次请求时触发。` });
          if (!ok) return;
        }
        try {
          await api.setNotice({ flags, gateError: code, gate消息: msg.value });
          state.gateError = code;
          toast(code ? '客户端现在会收到错误画面' : '通知设置已应用', code ? 'warn' : 'good', code ? '服务器已关闭' : '已保存');
        } catch (e) { toast(e.message, 'bad'); }
      }
      async function clearAll() {
        try {
          await api.setNotice({ flags: 0, gateError: 0, gate消息: msg.value });
          toast('已清除全部标志并重新开放服务器', 'good');
          rerender();
        } catch (e) { toast(e.message, 'bad'); }
      }
    });
  },
};
