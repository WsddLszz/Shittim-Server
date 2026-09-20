import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const sourceDir = path.resolve(process.argv[2] || 'D:/Ba/SchaleDB-data/data/cn');
const outputPath = path.resolve(process.argv[3] || 'Shittim-Server/Data/Localization/zh-CN.json');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(sourceDir, name), 'utf8'));
}

function idNameMap(rows) {
  return Object.fromEntries(rows
    .filter((row) => row.Id != null && typeof row.Name === 'string' && row.Name.trim())
    .map((row) => [String(row.Id), row.Name.trim()]));
}

const localization = read('localization.json');
const raids = read('raids.min.json');
const bossRows = [...(raids.Raid || []), ...(raids.WorldRaid || []), ...(raids.MultiFloorRaid || [])];

const payload = {
  source: {
    project: 'SchaleDB/SchaleDB',
    locale: 'cn',
    sourceCommit: '70a2c4b8982ca860687898e61848847a60ffe3b8',
    note: '名称按稳定的游戏内 ID 建立映射；较新内容会在运行时回退到客户端的 NameTw 字段。',
  },
  students: idNameMap(read('students.min.json')),
  items: idNameMap(read('items.min.json')),
  equipment: idNameMap(read('equipment.min.json')),
  currencies: idNameMap(read('currency.min.json')),
  events: Object.fromEntries(Object.entries(localization.EventName || {}).map(([id, name]) => [String(id), name])),
  bosses: Object.fromEntries(bossRows
    .filter((row) => row.PathName && row.Name)
    .map((row) => [String(row.PathName), row.Name])),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(Object.fromEntries(Object.entries(payload).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value)).map(([key, value]) => [key, Object.keys(value).length])));
