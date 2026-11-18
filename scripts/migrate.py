#!/usr/bin/env python3
"""Eski tek belgelik kaydı (users/{uid}/appData/main) kayıt başına ayrı belgelere taşır ve doğrular.

Kullanım:
  python3 scripts/migrate.py --uid UID [--emulator] [--dry-run]
Canlıda Firebase CLI girişinin erişim anahtarını kullanır (güvenlik kurallarını aşan sahip yetkisi).
Eski belgeye dokunmaz; yeniden çalıştırmak güvenlidir (aynı kimlikli belgeler üzerine yazılır).
"""
import argparse, json, sys, urllib.request
from datetime import datetime, timezone

KINDS = ['sales', 'purchases', 'expenses', 'cards', 'cardPays', 'cashMoves']
PROJECT = 'karacaahmet-tarim'


def enc(v):
    if v is None: return {'nullValue': None}
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, float): return {'doubleValue': v}
    if isinstance(v, str): return {'stringValue': v}
    if isinstance(v, list): return {'arrayValue': {'values': [enc(x) for x in v]}}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
    raise TypeError(type(v))


def dec(v):
    t, x = next(iter(v.items()))
    if t == 'mapValue': return {k: dec(w) for k, w in x.get('fields', {}).items()}
    if t == 'arrayValue': return [dec(w) for w in x.get('values', [])]
    if t == 'integerValue': return int(x)
    if t == 'nullValue': return None
    return x  # string, double, boolean, timestamp


def canon(v):
    """Uygulamadaki canon() ile aynı: anahtar sırasından bağımsız; 12.0 ile 12 aynı sayılır."""
    if isinstance(v, float) and v.is_integer(): v = int(v)
    if isinstance(v, list): return '[' + ','.join(canon(x) for x in v) + ']'
    if isinstance(v, dict): return '{' + ','.join(json.dumps(k, ensure_ascii=False) + ':' + canon(v[k]) for k in sorted(v)) + '}'
    return json.dumps(v, ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--uid', required=True)
    ap.add_argument('--emulator', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    if a.emulator:
        host, token = 'http://localhost:8080', 'owner'
    else:
        host = 'https://firestore.googleapis.com'
        token = json.load(open('/root/.config/configstore/firebase-tools.json'))['tokens']['access_token']
    root = f'{host}/v1/projects/{PROJECT}/databases/(default)/documents'

    def call(method, url, body=None):
        req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as r: return json.load(r)

    old = call('GET', f'{root}/users/{a.uid}/appData/main')
    rev = int(old['fields']['revision']['integerValue'])
    payload = dec(old['fields']['payload'])
    want = {}
    for k in KINDS:
        for r in payload.get(k, []):
            assert isinstance(r.get('id'), str) and r['id'] and '/' not in r['id'], f'geçersiz kimlik: {k} {r.get("id")}'
            want[f'{k}/{r["id"]}'] = r
    want['meta/settings'] = {'biz': payload.get('biz') if isinstance(payload.get('biz'), str) else ''}
    print(f'Eski belge revizyon {rev}: ' + ', '.join(f'{k} {len(payload.get(k, []))}' for k in KINDS))
    if a.dry_run: return

    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    writes = [{'update': {'name': f'projects/{PROJECT}/databases/(default)/documents/users/{a.uid}/{key}',
                          'fields': {'ownerUid': enc(a.uid), 'data': enc(rec), 'updatedAt': {'timestampValue': now}}}}
              for key, rec in want.items()]
    for i in range(0, len(writes), 400):
        call('POST', f'{root}:commit', {'writes': writes[i:i + 400]})
    print(f'{len(writes)} belge yazıldı.')

    # Doğrulama: her belgeyi geri oku, içerik birebir aynı mı?
    got = {}
    for k in KINDS + ['meta']:
        url = f'{root}/users/{a.uid}/{k}?pageSize=300'
        while url:
            res = call('GET', url)
            for d in res.get('documents', []):
                got[f'{k}/{d["name"].rsplit("/", 1)[1]}'] = dec(d['fields']['data'])
            url = f'{root}/users/{a.uid}/{k}?pageSize=300&pageToken={res["nextPageToken"]}' if res.get('nextPageToken') else None
    missing = [k for k in want if k not in got]
    diff = [k for k in want if k in got and canon(want[k]) != canon(got[k])]
    extra = [k for k in got if k not in want]
    after = int(call('GET', f'{root}/users/{a.uid}/appData/main')['fields']['revision']['integerValue'])
    print(f'Doğrulama: eksik {len(missing)}, farklı {len(diff)}, fazladan {len(extra)}; eski belge revizyonu {rev} -> {after}')
    if missing or diff or after != rev:
        print('HATA:', missing[:5], diff[:5], file=sys.stderr); sys.exit(1)
    print('TAŞIMA DOĞRULANDI')


if __name__ == '__main__':
    main()
