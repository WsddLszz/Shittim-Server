'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('the renderer declares simplified Chinese and exposes Chinese page titles', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  assert.match(html, /<html\s+lang="zh-CN"(?:\s[^>]*)?>/);
  assert.match(html, /<title>什亭控制中心<\/title>/);

  const expected = new Map([
    ['overview.js', '概览'], ['accounts.js', '账号'], ['inventory.js', '仓库'],
    ['mail.js', '邮件'], ['events.js', '周期战斗'], ['schedule.js', '活动'],
    ['rates.js', '招募'], ['notices.js', '通知与维护'], ['mods.js', '模组'],
    ['config.js', '配置'], ['updates.js', '更新'],
  ]);
  for (const [file, title] of expected) {
    const source = fs.readFileSync(path.join(root, 'src', 'js', 'pages', file), 'utf8');
    assert.ok(source.includes(`title: '${title}'`), `${file} should expose the Chinese title ${title}`);
  }
});

test('dynamic game-name localization is shipped with the server build', () => {
  const project = fs.readFileSync(path.join(root, '..', 'Shittim-Server', 'Shittim-Server.csproj'), 'utf8');
  assert.match(project, /Data\\Localization\\zh-CN\.json/);
  const catalog = JSON.parse(fs.readFileSync(path.join(root, '..', 'Shittim-Server', 'Data', 'Localization', 'zh-CN.json'), 'utf8'));
  assert.equal(catalog.students['10000'], '爱露');
  assert.ok(Object.keys(catalog.items).length >= 1000);
  assert.ok(Object.keys(catalog.events).length >= 30);
});
