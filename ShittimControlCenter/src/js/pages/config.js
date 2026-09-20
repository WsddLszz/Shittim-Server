import { el, frag, clear, button, input, toggle, field, toast, modal, textarea, confirmDialog } from '../ui.js';
import { store } from '../api.js';

// Defaults mirror Shittim-Server/Configuration/ConfigType/ServerConfig.cs.
// Reset overwrites only these editable ServerConfiguration fields, preserving GameVersion, gateway keys, ClientPluginDirectory and the Irc/DataFetcher sibling sections in Config.json.
const DEFAULT_SERVER_CONFIG = {
  HostPort: '5000',
  GatewayPort: '5100',
  EnableGateway: true,
  ClientInstallDirectory: '',
  AutoPatchClientMetadata: true, ClientMetadataPath: '',
  AutoPatchClientGamescaleIas: true, ClientGamescaleCorePath: '',
  AutoPatchClientInfaceConfig: true, ClientInfaceConfigPath: '',
  AutoManageGrap64: true, ClientGrap64Path: '',
  AutoPatchClientBanners: true, ClientExcelDbPath: '',
  RegionDisplayText: '',
  SQLProvider: 'SQLite3',
  SQLConnectionString: 'Data Source=shittim.sqlite3',
  UseEncryption: false,
  BypassAuthentication: false,
  UseCustomExcel: false,
  KoyukiIncident: false,
  AutoCheckVersion: true,
  AutoUpdateVersion: true,
  AutoUpdateResources: false,
  OverrideVersionId: null,
  OverrideCdnBaseUrl: null,
  ExcelDbSqlCipherKey: 'ef0aaca06f34b4a4be3172a75a3ea565e815f9ece35b1fb12b7a166ba0807bc4',
  ExcelDbSqlCipherLicense: 'OmNpZDowMDFWSjAwMDAwY3pzaVlZQVE6cGxhdGZvcm06MjY6ZXhwaXJlOm5ldmVyOnZlcnNpb246MTpsaWJ2ZXI6NC4xMC4wOmhtYWM6ODQ1Y2JkMzQ0MDc3YjIxNmRlYTgyOWI3OTIyMzRkM2UwYmUyMzNhYw==',
  ServerInfoUrl: 'https://d2vaidpni345rp.cloudfront.net/com.nexon.bluearchivesteam/server_config/433063_Live_77acRXMErRIj8461BJ0KXJP3t.json',
  PacketLogging: { RequestPacket: true, ResponsePacket: false, ErrorPacket: false },
};

const GROUPS = [
  {
    title: '网络', icon: 'server',
    fields: [
      { key: 'HostPort', label: 'API 端口', type: 'text', hint: '默认 5000' },
      { key: 'GatewayPort', label: '网关端口', type: 'text', hint: '默认 5100' },
      { key: 'EnableGateway', label: '启用网关', type: 'bool' },
    ],
  },
  {
    title: '行为', icon: 'bolt',
    fields: [
      { key: 'UseEncryption', label: '数据包加密', type: 'bool' },
      { key: 'BypassAuthentication', label: '绕过身份验证', type: 'bool' },
      { key: 'UseCustomExcel', label: '自定义 Excel 表', type: 'bool' },
      { key: 'KoyukiIncident', label: '小雪事件', type: 'bool', desc: 'nihahaha' },
      { key: 'AutoCheckVersion', label: '自动检查版本', type: 'bool', desc: '启动时解析最新数据版本' },
      { key: 'AutoUpdateVersion', label: '自动更新版本', type: 'bool' },
      { key: 'AutoUpdateResources', label: '自动更新资源', type: 'bool', desc: '版本变化时重新下载游戏数据（Excel、HexaMap）' },
    ],
  },
  {
    title: '数据库', icon: 'inventory',
    fields: [
      { key: 'SQLProvider', label: 'SQL 提供程序', type: 'text' },
      { key: 'SQLConnectionString', label: '连接字符串', type: 'text' },
    ],
  },
  {
    title: '版本与数据源', icon: 'clock',
    fields: [
      { key: 'OverrideVersionId', label: '覆盖版本 ID', type: 'text', hint: '留空则自动' },
      { key: 'OverrideCdnBaseUrl', label: '覆盖 CDN 基础 URL', type: 'text', hint: '留空则自动' },
      { key: 'ServerInfoUrl', label: '服务器信息 URL', type: 'text' },
    ],
  },
  {
    title: '客户端自动补丁', icon: 'shield',
    fields: [
      { key: 'ClientInstallDirectory', label: '游戏安装目录', type: 'dir', hint: '留空时自动查找 Steam 安装目录；仅当某个文件位于其他位置时才需要填写下方单项路径' },
      { key: 'AutoPatchClientMetadata', label: '修补元数据', type: 'bool', path: 'ClientMetadataPath' },
      { key: 'AutoPatchClientGamescaleIas', label: '修补 gamescale.core IAS', type: 'bool', path: 'ClientGamescaleCorePath' },
      { key: 'AutoPatchClientInfaceConfig', label: '修补 inface 配置', type: 'bool', path: 'ClientInfaceConfigPath' },
      { key: 'AutoManageGrap64', label: '管理 grap64', type: 'bool', path: 'ClientGrap64Path' },
      { key: 'AutoPatchClientBanners', label: '修补招募卡池', type: 'bool', path: 'ClientExcelDbPath' },
      { key: 'RegionDisplayText', label: '地区标签', type: 'text', hint: '显示在标题画面；留空则使用原始地区名称' },
    ],
  },
  {
    title: '数据包日志', icon: 'edit', sub: 'PacketLogging',
    fields: [
      { key: 'RequestPacket', label: '记录请求', type: 'bool' },
      { key: 'ResponsePacket', label: '记录响应', type: 'bool' },
      { key: 'ErrorPacket', label: '记录错误', type: 'bool' },
    ],
  },
];

export default {
  id: 'config',
  title: '配置',  icon: 'config',
  needsTarget: false,

  async mount(root, { rerender }) {
    const cfg = await window.host.configRead();
    if (!cfg.ok) {
      root.appendChild(frag(`<div class="empty"><b>未找到配置文件</b><span><span class="mono" data-selectable style="word-break:break-all">${cfg.path}</span><br>服务器首次运行时会自动生成。</span></div>`));
      const b = button('打开所在文件夹', { variant: 'ghost', iconName: 'folder', onClick: async () => {
        const p = await window.host.paths(); window.host.openPath(p.exeBaseDir);
      }});
      root.appendChild(el('div', { style: { textAlign: 'center', marginTop: '14px' } }, b));
      return;
    }

    const data = cfg.data;
    const sc = data.ServerConfiguration = data.ServerConfiguration || {};
    const pl = sc.PacketLogging = sc.PacketLogging || {};

    const restartHint = store.get().online
      ? frag('<span class="pill warn"><span class="dot"></span>重启服务器后生效</span>')
      : frag('<span class="pill"><span class="dot"></span>服务器离线</span>');

    const saveBtn = button('保存配置', { variant: 'primary', iconName: 'save', onClick: save });
    const reloadBtn = button('重新加载', { variant: 'ghost', iconName: 'refresh', onClick: rerender });
    const rawBtn = button('编辑原始 JSON', { variant: 'ghost', iconName: 'edit', onClick: editRaw });
    const openBtn = button('打开文件', { variant: 'ghost', iconName: 'external', onClick: () => window.host.openPath(cfg.path) });
    const resetBtn = button('恢复默认值', { variant: 'ghost', iconName: 'refresh', onClick: resetDefaults });

    const bar = el('div.card', { style: { marginBottom: '18px' } },
      el('div.card-body', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
        saveBtn, reloadBtn, rawBtn, openBtn, resetBtn, el('div.spacer', {}), restartHint));
    root.appendChild(bar);
    root.appendChild(frag(`<div class="row wrap" style="margin:-4px 0 16px;min-width:0"><span class="mono" data-selectable style="font-size:11.5px;color:var(--ink-2);min-width:0;word-break:break-all;line-height:1.5">${cfg.path}</span></div>`));

    const grid = el('div.grid-2', { style: { alignItems: 'start' } });

    for (const g of GROUPS) {
      const target = g.sub === 'PacketLogging' ? pl : sc;
      const body = el('div', {});
      for (const f of g.fields) {
        if (f.type === 'bool') {
          const row = buildToggleRow(target, f);
          body.appendChild(row);
          if (f.path) body.appendChild(buildPathField(sc, f));
        } else if (f.type === 'dir') {
          body.appendChild(field(f.label, buildDirRow(target, f.key), f.hint));
        } else {
          body.appendChild(field(f.label, bindInput(target, f.key), f.hint));
        }
      }
      grid.appendChild(el('div.card', { style: { minWidth: '0' } },
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: g.title }),
          g.sub ? el('span.sub', { text: g.sub } ) : null),
        el('div.card-body', { style: { minWidth: '0' } }, body)));
    }
    root.appendChild(grid);

    const advBody = el('div', {});
    advBody.appendChild(field('Excel DB SQLCipher 密钥', bindInput(sc, 'ExcelDbSqlCipherKey')));
    advBody.appendChild(field('Excel DB SQLCipher 许可证', bindInput(sc, 'ExcelDbSqlCipherLicense')));
    root.appendChild(el('div.card', { style: { marginTop: '18px' } },
      el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '高级 · Excel 解密' }),
        el('span.sub', { text: '仅在数据转储不同时修改' })),
      el('div.card-body', {}, advBody)));

    function bindInput(obj, key) {
      const i = input({ value: obj[key] ?? '', placeholder: '-' });
      i.addEventListener('input', () => { obj[key] = i.value; });
      return i;
    }
    function buildToggleRow(obj, f) {
      const row = el('div.toggle-row', {},
        el('div.tr-text', {}, el('b', { text: f.label }), f.desc ? el('span', { text: f.desc }) : null));
      const t = toggle(!!obj[f.key], (on) => { obj[f.key] = on; });
      row.appendChild(t);
      return row;
    }
    function buildDirRow(obj, key) {
      const row = el('div.input-row', { style: { minWidth: '0' } });
      const i = input({ value: obj[key] ?? '', placeholder: '-' });
      i.addEventListener('input', () => { obj[key] = i.value; });
      const browse = button('...', { variant: 'ghost', onClick: async () => {
        const picked = await window.host.pickFolder();
        if (picked) { i.value = picked; obj[key] = picked; }
      }});
      browse.style.flex = '0 0 auto';
      row.appendChild(i); row.appendChild(browse);
      return row;
    }
    function buildPathField(obj, f) {
      const wrap = el('div', { style: { margin: '-4px 0 8px', paddingLeft: '2px', minWidth: '0' } });
      const row = el('div.input-row', { style: { minWidth: '0' } });
      const i = input({ value: obj[f.path] ?? '', placeholder: '路径（可选覆盖）' });
      i.addEventListener('input', () => { obj[f.path] = i.value; });
      const browse = button('...', { variant: 'ghost', onClick: async () => {
        const picked = await window.host.pickFile();
        if (picked) { i.value = picked; obj[f.path] = picked; }
      }});
      browse.style.flex = '0 0 auto';
      row.appendChild(i); row.appendChild(browse);
      wrap.appendChild(row);
      return wrap;
    }

    async function save() {
      const r = await window.host.configWrite(data);
      toast(r.ok ? '配置已保存' : (r.error || '保存失败'), r.ok ? 'good' : 'bad');
    }
    async function resetDefaults() {
      const ok = await confirmDialog({ title: '恢复默认值', confirmLabel: '重置并保存',
        message: '将此页全部设置恢复默认值并保存到 Config.json？GameVersion、网关密钥和数据库不会更改。' });
      if (!ok) return;
      Object.assign(sc, DEFAULT_SERVER_CONFIG, { PacketLogging: { ...DEFAULT_SERVER_CONFIG.PacketLogging } });
      const r = await window.host.configWrite(data);
      if (r.ok) { toast('配置已恢复默认值', 'good'); rerender(); }
      else toast(r.error || '重置失败', 'bad');
    }

    function editRaw() {
      const ta = textarea({ value: JSON.stringify(data, null, 2), style: { minHeight: '52vh', maxWidth: '100%', fontFamily: 'var(--font-mono)', fontSize: '12.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } });
      const apply = button('应用', { variant: 'primary', iconName: 'check' });
      const cancel = button('取消', { variant: 'ghost' });
      const ref = modal({ title: '原始配置', wide: true, body: ta, footer: [cancel, apply] });
      cancel.addEventListener('click', ref.close);
      apply.addEventListener('click', async () => {
        try {
          const parsed = JSON.parse(ta.value);
          const r = await window.host.configWrite(parsed);
          if (r.ok) { ref.close(); toast('配置已保存', 'good'); rerender(); }
          else toast(r.error, 'bad');
        } catch (e) { toast('JSON 无效：' + e.message, 'bad'); }
      });
    }
  },
};
