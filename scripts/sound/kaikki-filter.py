import sys, json
out = open(sys.argv[1], 'w', encoding='utf8')
n = 0
for line in sys.stdin.buffer:
    if b'"ipa"' not in line:
        continue
    try:
        d = json.loads(line)
    except Exception:
        continue
    w = d.get('word')
    ipas = []
    for s in d.get('sounds') or []:
        ipa = s.get('ipa')
        if ipa and ipa not in ipas:
            ipas.append(ipa)
    if w and ipas:
        out.write(w + '\t' + '\t'.join(ipas[:4]) + '\n')
        n += 1
out.close()
print(n)
