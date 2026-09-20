import { el, frag, clear, button, input, field, toast, confirmDialog, modal, openPicker, escapeHtml } from '../ui.js';
import { api } from '../api.js';
import { gate } from './_util.js';

const SECTIONS = [
  { id: 'characters', name: '自定义学生', desc: '将学生克隆到空闲 ID，并编辑档案、属性与学校。' },
];

export default {
  id: 'mods',
  title: '模组',  icon: 'flask',
  needsTarget: false,

  mount(root) {
    let view = 'menu';
    let openId = null;
    let host = null;

    return gate(root, { needServer: true }, (r) => { host = r; paint(); });

    function paint() {
      clear(host);
      if (view === 'menu') menu();
      else if (view === 'characters') characters();
      else editor(openId);
    }

    function go(next, id) { view = next; openId = id; paint(); }

    function menu() {
      const list = el('div.picker-list', {});
      for (const s of SECTIONS) {
        const row = frag(`<div class="picker-item"><span class="pi-name">${escapeHtml(s.name)}</span><span class="muted" style="font-size:12px;flex:2;min-width:0">${escapeHtml(s.desc)}</span></div>`);
        row.addEventListener('click', () => go(s.id));
        list.appendChild(row);
      }
      host.appendChild(el('div.card', {},
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '模组' }), el('span.sub', { text: '修改游戏数据，而非账号存档' })),
        el('div.card-body', {}, list,
          frag('<p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6">这里的改动会同时写入服务器读取的 ExcelDB 和游戏安装目录中的副本。修改后需重启服务器并重新启动游戏才会生效。</p>'))));
    }

    function characters() {
      const back = button('返回', { variant: 'ghost', sm: true, iconName: 'x', onClick: () => go('menu') });
      const add = button('添加学生', { variant: 'primary', sm: true, iconName: 'plus', onClick: importFlow });
      const body = el('div.card-body', {});
      host.appendChild(el('div.card', {},
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '自定义学生' }), el('div.spacer', {}), back, add),
        body));

      body.innerHTML = '<div class="empty"><div class="spinner"></div></div>';
      api.modsCharacters().then((data) => {
        clear(body);
        if (!data.characters.length) {
          body.appendChild(frag('<div class="empty"><b>暂无自定义学生</b><span>从 ZIP 添加后会克隆到一个空闲学生 ID。</span></div>'));
        } else {
          const list = el('div.picker-list', {});
          for (const c of data.characters) {
            const row = frag(`<div class="picker-item"><span class="pi-id">${c.id}</span><span class="pi-name">${escapeHtml(c.name || '未命名')}</span><span class="tag grey">来源 ${c.donorId}</span>${c.assets.length ? `<span class="tag">${c.assets.length} 个文件</span>` : ''}</div>`);
            row.addEventListener('click', () => go('editor', c.id));
            list.appendChild(row);
          }
          body.appendChild(list);
        }
        body.appendChild(frag(`<p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6">正在写入 ${data.databases} 份 ExcelDB。首次安装模组时会在每份数据库旁创建备份。</p>`));
      }).catch((e) => { body.innerHTML = `<div class="empty"><b>加载失败</b><span>${escapeHtml(String(e.message || e))}</span></div>`; });
    }

    async function importFlow() {
      const zipPath = await window.host.pickFile([{ name: '学生模组', extensions: ['zip'] }]);
      if (!zipPath) return;

      let info;
      try { info = await api.modsInspect(zipPath); }
      catch (e) { toast(e.message, 'bad'); return; }

      let donorId = info.donorId || null;
      let donorName = null;

      const name = input({ value: info.name || '', placeholder: 'Shirakami Suzu' });
      const id = input({ type: 'number', placeholder: '下一个空闲 ID' });
      const donorLabel = el('div', {});
      const pickDonor = button('选择模板学生', { variant: 'ghost', sm: true, iconName: 'users', onClick: () => {
        openPicker({ title: '选择模板', loader: (q) => api.staticCharacters(q).then((r) => r.map((x) => ({ id: x.id, name: x.name, sub: `★${x.maxStar}` }))),
          onPick: (it) => { donorId = it.id; donorName = it.name; paintDonor(); } });
      }});
      function paintDonor() {
        clear(donorLabel);
        if (donorId) donorLabel.appendChild(frag(`<div class="chip"><div class="chip-ic">${'★'}</div><div class="chip-main"><b>${escapeHtml(donorName || ('学生 ' + donorId))}</b><span>id ${donorId}</span></div></div>`));
        else donorLabel.appendChild(frag('<div class="muted" style="font-size:12.5px">请选择用于构建新学生数据的模板学生</div>'));
      }
      paintDonor();

      const staged = info.assets.length
        ? `<p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6">ZIP 中的 ${info.assets.length} 个美术/音频文件会复制到模组目录，但<b>不会</b>安装。若不重新打包游戏的 Addressables 目录就无法注册新资源路径，因此仍会使用模板学生的素材。</p>`
        : '<p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6">ZIP 中没有美术资源，因此会使用模板学生的素材。</p>';

      const install = button('安装', { variant: 'primary', iconName: 'download' });
      const cancel = button('取消', { variant: 'ghost' });
      const ref = modal({
        title: '添加自定义学生', wide: true,
        body: el('div', {},
          field('名称', name, '显示在卡片和学生列表中'),
          el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', margin: '0 0 14px' } }, donorLabel, el('div.spacer', {}), pickDonor),
          field('学生 ID', id, '留空则使用下一个空闲 ID'),
          frag(`<div class="muted mono" data-selectable style="font-size:11px;overflow-wrap:anywhere">${escapeHtml(zipPath)}</div>`),
          frag(staged)),
        footer: [cancel, install],
      });
      cancel.addEventListener('click', ref.close);
      install.addEventListener('click', async () => {
        if (!donorId) { toast('请先选择模板学生', 'warn'); return; }
        install.disabled = true;
        try {
          const made = await api.modsImport({ zipPath, donorId, id: id.value ? parseInt(id.value, 10) : null, name: name.value.trim(), overrides: info.overrides || {} });
          ref.close();
          toast(`${made.name} 已安装为 ${made.id}`, 'good', '请重启服务器');
          paint();
        } catch (e) { install.disabled = false; toast(e.message, 'bad'); }
      });
    }

    function editor(id) {
      const back = button('返回', { variant: 'ghost', sm: true, iconName: 'x', onClick: () => go('characters') });
      const body = el('div.card-body', {});
      const head = el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '学生 ' + id }), el('div.spacer', {}), back);
      host.appendChild(el('div.card', {}, head, body));

      body.innerHTML = '<div class="empty"><div class="spinner"></div></div>';
      api.modsCharacter(id).then((d) => {
        clear(body);
        head.querySelector('h3').textContent = `${d.name || '未命名'} - ${id}`;

        const name = input({ value: d.name || '' });
        const inputs = { character: {}, profile: {}, stat: {} };

        function group(title, values, bag, numeric) {
          if (!values) return null;
          const grid = el('div.grid-3', {});
          for (const [key, value] of Object.entries(values)) {
            const box = input({ value: value == null ? '' : value, type: numeric ? 'number' : 'text' });
            bag[key] = { box, was: value == null ? '' : String(value) };
            grid.appendChild(field(key, box));
          }
          return el('div', {}, el('div', { text: title, style: { fontSize: '13px', fontWeight: '600', margin: '18px 0 10px' } }), grid);
        }

        body.appendChild(field('显示名称', name, '该学生指向的 LocalizeEtc 条目'));
        body.appendChild(el('div', {},
          group('学生基础数据', d.character, inputs.character, false),
          group('档案', d.profile, inputs.profile, false),
          group('属性', d.stat, inputs.stat, true)));

        const save = button('保存', { variant: 'primary', iconName: 'save', onClick: async () => {
          const payload = { name: name.value.trim() };
          for (const part of ['character', 'profile', 'stat']) {
            const changed = {};
            for (const [key, held] of Object.entries(inputs[part])) {
              if (held.box.value !== held.was) changed[key] = held.box.value;
            }
            if (Object.keys(changed).length) payload[part] = changed;
          }
          save.disabled = true;
          try {
            await api.modsUpdate(id, payload);
            toast('已保存；重启服务器后生效', 'good');
            go('characters');
          } catch (e) { save.disabled = false; toast(e.message, 'bad'); }
        }});
        const remove = button('删除学生', { variant: 'danger', iconName: 'trash', onClick: async () => {
          const ok = await confirmDialog({ title: '删除学生', confirmLabel: '删除', danger: true,
            message: `将从所有 ExcelDB 副本中删除为 ${id} 克隆的全部条目。已拥有该学生的账号仍会保留一个指向无效 ID 的记录。` });
          if (!ok) return;
          try { await api.modsRemove(id); toast('已删除', 'warn'); go('characters'); }
          catch (e) { toast(e.message, 'bad'); }
        }});

        body.appendChild(el('div.row.wrap', { style: { gap: '10px', marginTop: '20px' } }, save, remove, el('div.spacer', {}),
          d.assets.length ? frag(`<span class="tag grey">${d.assets.length} 个暂存文件</span>`) : null,
          d.donorId ? frag(`<span class="tag">克隆自 ${d.donorId}</span>`) : null));
      }).catch((e) => { body.innerHTML = `<div class="empty"><b>加载失败</b><span>${escapeHtml(String(e.message || e))}</span></div>`; });
    }
  },
};
