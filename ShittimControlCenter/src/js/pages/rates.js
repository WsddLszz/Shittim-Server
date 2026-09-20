import { el, frag, clear, button, input, field, toast, confirmDialog, openPicker, escapeHtml } from '../ui.js';
import { api } from '../api.js';
import { gate, loadInto } from './_util.js';

export default {
  id: 'rates',
  title: '招募',  icon: 'rates',
  needsTarget: false,

  mount(root) {
    return gate(root, { needServer: true }, async (root) => {
      const cfg = await api.gachaConfig();
      let guaranteed = cfg.guaranteed || null;
      let guaranteedName = null;

      const fSsr = input({ value: cfg.ssr || 0, type: 'number', step: '0.1' });
      const fSr = input({ value: cfg.sr || 0, type: 'number', step: '0.1' });
      const fR = input({ value: cfg.r || 0, type: 'number', step: '0.1' });

      const bar = el('div', { style: { display: 'flex', height: '14px', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)', margin: '4px 0 8px' } });
      const totalTag = el('span', {});
      function paintBar() {
        const ssr = +fSsr.value || 0, sr = +fSr.value || 0, r = +fR.value || 0;
        const total = ssr + sr + r;
        clear(bar);
        const seg = (pct, color) => { const d = el('div', { style: { width: `${total ? (pct / total) * 100 : 0}%`, background: color } }); return d; };
        bar.appendChild(seg(ssr, 'var(--gold)'));
        bar.appendChild(seg(sr, 'var(--blue)'));
        bar.appendChild(seg(r, 'var(--good)'));
        clear(totalTag);
        const ok = Math.abs(total - 100) < 0.001;
        totalTag.appendChild(frag(`<span class="pill ${ok ? 'good' : 'warn'}"><span class="dot"></span>合计 ${total.toFixed(1)}%</span>`));
      }
      [fSsr, fSr, fR].forEach((i) => i.addEventListener('input', paintBar));

      const normalize = button('归一化为 100%', { variant: 'ghost', sm: true, iconName: 'rates', onClick: () => {
        let ssr = +fSsr.value || 0, sr = +fSr.value || 0, r = +fR.value || 0;
        const t = ssr + sr + r;
        if (!t) { toast('请先填写概率', 'warn'); return; }
        fSsr.value = ((ssr / t) * 100).toFixed(2); fSr.value = ((sr / t) * 100).toFixed(2); fR.value = ((r / t) * 100).toFixed(2);
        paintBar();
      }});

      const ratesCard = el('div.card', {},
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '招募概率' }), el('div.spacer', {}), totalTag),
        el('div.card-body', {},
          el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', minWidth: 0 } }, frag('<span class="tag gold">★3 SSR</span>'), frag('<span class="tag grey">★2 SR</span>'), frag('<span class="tag">★1 R</span>')),
          bar,
          el('div.grid-3', { style: { marginTop: '14px' } },
            field('SSR (★3) %', fSsr), field('SR (★2) %', fSr), field('R (★1) %', fR)),
          el('div.row.wrap', { style: { gap: '10px' } }, normalize,
            frag('<span class="muted" style="font-size:12px;min-width:0;flex:1 1 200px">全部设为 0 并重置即可恢复游戏默认概率。</span>'))));

      const guaranteedLabel = el('div', {});
      function paintGuaranteed() {
        clear(guaranteedLabel);
        if (guaranteed) guaranteedLabel.appendChild(frag(`<div class="chip"><div class="chip-ic">${'★'}</div><div class="chip-main"><b>${escapeHtml(guaranteedName || ('学生 ' + guaranteed))}</b><span>id ${guaranteed}</span></div></div>`));
        else guaranteedLabel.appendChild(frag('<div class="muted" style="font-size:12.5px">未设置必出学生</div>'));
      }
      const pickGuaranteed = button('选择学生', { variant: 'ghost', sm: true, iconName: 'users', onClick: () => {
        openPicker({ title: '必出学生', loader: (q) => api.staticCharacters(q).then((r) => r.map((x) => ({ id: x.id, name: x.name, sub: `★${x.maxStar}` }))),
          onPick: (it) => { guaranteed = it.id; guaranteedName = it.name; paintGuaranteed(); } });
      }});
      const clearGuaranteed = button('清除', { variant: 'ghost', sm: true, iconName: 'x', onClick: () => { guaranteed = null; guaranteedName = null; paintGuaranteed(); } });

      const guaranteedCard = el('div.card', {},
        el('div.card-head', {}, el('span.tab-mark', {}), el('h3', { text: '必出学生' }), el('span.sub', { text: '可选 · 将覆盖概率设置' }), el('div.spacer', {}), pickGuaranteed, clearGuaranteed),
        el('div.card-body', {}, guaranteedLabel,
          frag('<p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6">若该学生不在当前卡池中，强制每抽必出可能导致客户端显示异常。</p>')));

      const saveBtn = button('保存概率', { variant: 'primary', iconName: 'save', onClick: save });
      const resetBtn = button('恢复默认值', { variant: 'ghost', iconName: 'refresh', onClick: reset });
      const saveBar = el('div.card', { style: { marginTop: '18px' } },
        el('div.card-body', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
          saveBtn, resetBtn, el('div.spacer', {}),
          frag(`<span class="muted mono" data-selectable style="font-size:11px;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(cfg.path || '')}">${escapeHtml(cfg.path || '')}</span>`),
          frag('<span class="pill blue"><span class="dot"></span>5 秒内热重载</span>')));

      root.appendChild(el('div.grid-2', { style: { alignItems: 'start' } }, ratesCard, guaranteedCard));
      root.appendChild(saveBar);
      paintBar();
      paintGuaranteed();

      // banners are read-only (defined in the Excel data), listed for reference
      root.appendChild(el('div', { text: '卡池', style: { fontSize: '14px', fontWeight: '600', color: 'var(--ink)', margin: '22px 0 12px' } }));
      const bannerGrid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '16px', minWidth: '0' } });
      root.appendChild(bannerGrid);
      loadInto(bannerGrid, () => api.gacha卡池(), (grid, banners) => {
        if (!banners.length) { grid.appendChild(frag('<div class="empty"><b>未找到卡池</b><span>Excel 招募数据不可用</span></div>')); return; }
        for (const b of banners) {
          const flags = [];
          if (b.is新手) flags.push('<span class="tag gold">新手</span>');
          if (b.isSelect) flags.push('<span class="tag">自选</span>');
          const feat = (b.featured || []).slice(0, 8)
            .map((f) => `<span class="tag">${escapeHtml(f.name)}</span>`).join(' ') || '<span class="muted" style="font-size:12px">无精选学生</span>';
          grid.appendChild(frag(`<div class="banner-card">
            <div class="bc-top">
              <b style="font-family:var(--font-round);font-size:14.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-selectable>卡池 ${escapeHtml(String(b.id))}</b>
              <span class="bc-id" data-selectable>顺序 ${escapeHtml(String(b.displayOrder))}</span>
              <div style="flex:1;min-width:8px"></div>${flags.join(' ')}
            </div>
            <div class="bc-feat">${feat}</div>
            <div class="muted" style="font-size:11.5px;color:var(--ink-3);overflow-wrap:anywhere" data-selectable>${b.saleFrom ? `${escapeHtml(b.saleFrom)} 至 ${escapeHtml(b.saleTo || '')}` : '无开放时间'}</div>
          </div>`));
        }
      });

      async function save() {
        const ssr = +fSsr.value || 0, sr = +fSr.value || 0, r = +fR.value || 0;
        const clearRates = ssr === 0 && sr === 0 && r === 0;
        try {
          await api.setGachaConfig({ ssr, sr, r, guaranteed, clearRates });
          toast('招募概率已保存', 'good');
        } catch (e) { toast(e.message, 'bad'); }
      }
      async function reset() {
        const ok = await confirmDialog({ title: '重置招募设置', confirmLabel: '重置', message: '清除自定义概率和必出学生并恢复游戏默认设置？' });
        if (!ok) return;
        try {
          await api.setGachaConfig({ ssr: 0, sr: 0, r: 0, guaranteed: null, clearRates: true });
          fSsr.value = 0; fSr.value = 0; fR.value = 0; guaranteed = null; guaranteedName = null;
          paintBar(); paintGuaranteed();
          toast('已恢复默认概率', 'warn');
        } catch (e) { toast(e.message, 'bad'); }
      }
    });
  },
};
