// Eski tek belgeyi (lojix_data/1) kayıt başına belgelere (fleets/lojix/{tür}/{id}) taşır ve doğrular.
// Dönüşümü uygulamanın kendi normalize() koduyla yapar (ilk girişteki içe alma ile aynı sonuç).
// Firebase CLI oturumunun erişim anahtarını kullanır (önce: npx firebase-tools login).
// Kullanım: node scripts/migrate.js --backup <dosya.json> [--dry-run]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2), DRY = args.includes('--dry-run');
const backup = args[args.indexOf('--backup') + 1];
if (!args.includes('--backup') || !backup) { console.error('--backup <dosya.json> gerekli'); process.exit(2); }
const TOKEN = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8')).tokens.access_token;
const DOCS = 'https://firestore.googleapis.com/v1/projects/lojix-pro/databases/(default)/documents';
const KINDS = { vehicles: 'vehicles', clients: 'clients', trips: 'trips', fuels: 'fuels', expenses: 'expenses', payments: 'payments', companies: 'intermediaryCompanies' };
const BY = 'yBvvM9DhzXaOzq77zh64mwIdF3l2';  // taşıma kaydını yapan: hesap sahibi

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${url} ${r.status} ${t}`); return t ? JSON.parse(t) : {};
}
// Firestore REST değeri <-> düz JSON
const fromV = v => 'nullValue' in v ? null : 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue
  : 'stringValue' in v ? v.stringValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(fromV) : 'mapValue' in v ? fromF(v.mapValue.fields || {}) : (() => { throw new Error('Bilinmeyen değer ' + JSON.stringify(v)); })();
const fromF = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromV(v)]));
const toV = v => v === null || v === undefined ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(toV) } } : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toV(x)])) } }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v);
async function listAll(kind) {
  let out = [], tok = '';
  do { const r = await api('GET', `${DOCS}/fleets/lojix/${kind}?pageSize=300${tok ? '&pageToken=' + tok : ''}`); out = out.concat(r.documents || []); tok = r.nextPageToken || ''; } while (tok);
  return out;
}

async function normalizeInApp(data) {
  const dir = path.join(__dirname, '..', 'public');
  const srv = http.createServer((q, res) => fs.readFile(path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0]), (e, b) => { res.writeHead(e ? 404 : 200); res.end(b); })).listen(0);
  const b = await chromium.launch(), p = await b.newPage();
  await p.route(/gstatic\.com/, r => r.abort());   // Firebase gerekmez; yalnızca normalize() çalışsın
  await p.goto(`http://localhost:${srv.address().port}/`, { waitUntil: 'load' });
  const n = await p.evaluate(d => normalize(d), data);
  await b.close(); srv.close();
  return n;
}

(async () => {
  const raw = await api('GET', `${DOCS}/lojix_data/1`);
  fs.writeFileSync(backup, JSON.stringify(raw, null, 1));
  console.log(`Eski kayıt yedeklendi: ${backup} (son güncelleme ${raw.fields.updated_at && raw.fields.updated_at.stringValue})`);
  const legacy = fromV(raw.fields.data);
  const n = await normalizeInApp(legacy);
  if (!n) throw new Error('Eski veri okunamadı');
  // hedef boş olmalı: üzerine yazma ya da karışma olmasın
  for (const k of Object.keys(KINDS)) { const c = (await listAll(k)).length; if (c) throw new Error(`fleets/lojix/${k} boş değil (${c} belge). Taşıma durduruldu.`); }
  const writes = [], want = {};
  for (const [k, sk] of Object.entries(KINDS)) for (const r of n[sk]) {
    const id = String(r.id); if (!id || id.includes('/')) throw new Error(`Geçersiz kimlik: ${k}/${id}`);
    want[`${k}/${id}`] = canon(r);
    writes.push({ update: { name: `projects/lojix-pro/databases/(default)/documents/fleets/lojix/${k}/${id}`, fields: { data: toV(r), updatedBy: toV(BY) } },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }], currentDocument: { exists: false } });
  }
  console.log('Aktarılacak:', Object.entries(KINDS).map(([k, sk]) => `${k} ${n[sk].length}`).join(', '), `(toplam ${writes.length})`);
  if (DRY) { console.log('Prova: hiçbir şey yazılmadı.'); return; }
  for (let i = 0; i < writes.length; i += 400) await api('POST', `${DOCS}:commit`, { writes: writes.slice(i, i + 400) });
  // doğrulama: her belgeyi geri oku, birebir karşılaştır
  const got = {};
  for (const k of Object.keys(KINDS)) for (const d of await listAll(k)) got[`${k}/${d.name.split('/').pop()}`] = canon(fromV(d.fields.data));
  const miss = Object.keys(want).filter(x => got[x] !== want[x]), extra = Object.keys(got).filter(x => !(x in want));
  if (miss.length || extra.length) { console.error('DOĞRULAMA BAŞARISIZ', { miss, extra }); process.exit(1); }
  console.log(`Doğrulandı: ${Object.keys(got).length} belge eski kayıtla birebir aynı.`);
})().catch(e => { console.error(e.message); process.exit(1); });
