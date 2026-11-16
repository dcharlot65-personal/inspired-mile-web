import re,json,urllib.parse,time
from search import get
LANGS='en es fr de it pt pl ru ar hi zh ja ko vi th id'.split()
T={
'romeo':'Romeo','juliet':'Juliet','hamlet':'Prince Hamlet','ophelia':'Ophelia','mercutio':'Mercutio','puck':"Puck (A Midsummer Night's Dream)",'titania':'Q2332221','escalus':'Q15829750','friar':'Friar Laurence','nurse':'Nurse (Romeo and Juliet)','prospero':'Prospero','ariel':'Ariel (The Tempest)','caliban':'Caliban','benvolio':'Benvolio','tybalt':'Tybalt','claudius':'King Claudius','oberon':'Oberon','macbeth':'Macbeth (character)','ladymacbeth':'Lady Macbeth','banquo':'Banquo','viola':'Viola (Twelfth Night)','malvolio':'Malvolio','olivia':'Olivia (Twelfth Night)','brutus':'Q172248','cassius':'Gaius Cassius Longinus','antony':'Mark Antony','horatio':'Horatio (Hamlet)','bottom':'Nick Bottom','paris':'Count Paris','miranda':'Miranda (The Tempest)','yorick':'Yorick','portia':'Portia (The Merchant of Venice)','cordelia':'Cordelia (King Lear)',
'caesar':'Julius Caesar',
'wordsworth':'William Wordsworth','coleridge':'Samuel Taylor Coleridge','keats':'John Keats','byron':'Lord Byron','maryshelley':'Mary Shelley','poe':'Edgar Allan Poe','blake':'William Blake','shelley':'Percy Bysshe Shelley','browning':'Elizabeth Barrett Browning','rossetti':'Christina Rossetti','shakespeare':'William Shakespeare',
'zeus':'Zeus','athena':'Athena','apollo':'Apollo','aphrodite':'Aphrodite','hermes':'Hermes','hades':'Hades','persephone':'Persephone','odysseus':'Odysseus','medusa':'Medusa','achilles':'Achilles',
'verona':'Verona','denmark':'Denmark','scotland':'Scotland','illyria':'Illyria','rome':'Rome','lakedistrict':'Lake District','arden':'Arden, Warwickshire','olympus':'Mount Olympus','underworld':'Greek underworld',
'w_rj':'Romeo and Juliet','w_hamlet':'Hamlet','w_mnd':"A Midsummer Night's Dream",'w_tempest':'The Tempest','w_macbeth':'Macbeth','w_tn':'Twelfth Night','w_jc':'Julius Caesar (play)','w_mov':'The Merchant of Venice','w_h4p2':'Henry IV, Part 2','w_lear':'King Lear','w_othello':'Othello','w_sonnet18':'Sonnet 18','w_sonnets':"Shakespeare's sonnets",'w_daffodils':'I Wandered Lonely as a Cloud','w_mariner':'The Rime of the Ancient Mariner','w_endymion':'Endymion (poem)','w_shewalks':'She Walks in Beauty','w_frankenstein':'Frankenstein','w_raven':'The Raven','w_auguries':'Auguries of Innocence','w_westwind':'Ode to the West Wind','w_sfp':'Sonnets from the Portuguese','w_odyssey':'Odyssey','w_iliad':'Iliad',
}
titles=[t for t in T.values() if not re.fullmatch(r'Q\d+',t)]; qids=[t for t in T.values() if re.fullmatch(r'Q\d+',t)]; ents={}; norm={}
LL='|'.join(LANGS+['zh-hans','zh-cn','zh-hant','mul'])
for i in range(0,len(titles),40):
    r=get('https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(dict(action='wbgetentities',sites='enwiki',titles='|'.join(titles[i:i+40]),props='labels|aliases|sitelinks|descriptions|info',languages=LL,sitefilter='|'.join(l+'wiki' for l in LANGS),format='json')))
    print(str(r)[:300]) if 'entities' not in r else ents.update(r['entities']); time.sleep(2)
r=get('https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(dict(action='wbgetentities',ids='|'.join(qids),props='labels|aliases|sitelinks|descriptions|info',languages=LL,sitefilter='|'.join(l+'wiki' for l in LANGS),format='json')))
ents.update(r['entities'])
by={ (e.get('sitelinks',{}).get('enwiki',{}).get('title')):e for e in ents.values() if 'missing' not in e}
out={}
for k,t in T.items():
    e=ents.get(t) if re.fullmatch(r'Q\d+',t) else by.get(t)
    if not e: out[k]={'enwikiTitle':t,'missing':True}; continue
    out[k]={'enwikiTitle':t,'id':e['id'],'lastrevid':e.get('lastrevid'),'description':e.get('descriptions',{}).get('en',{}).get('value'),
      'labels':{l:v['value'] for l,v in e.get('labels',{}).items()},
      'aliases':{l:[a['value'] for a in v] for l,v in e.get('aliases',{}).items() if l in LANGS},
      'sitelinks':{s[:-4]:v['title'] for s,v in e.get('sitelinks',{}).items()}}
json.dump({'fetched':time.strftime('%Y-%m-%d'),'api':'https://www.wikidata.org/w/api.php?action=wbgetentities','licence':'Wikidata labels and aliases: CC0 1.0. Wikipedia article titles: used as names only.','entities':out},open('wikidata-names.json','w'),ensure_ascii=False,indent=1)
for k,v in out.items():
    if v.get('missing'): print('MISSING',k,v['enwikiTitle']); continue
    lab=v['labels']; miss=[l for l in LANGS if l not in lab and not (l=='zh' and ('zh-hans' in lab or 'zh-cn' in lab)) and not (l in 'es fr de it pt pl vi id en'.split() and 'mul' in lab) and l not in v['sitelinks']]
    print(k,v['id'],'|',lab.get('en'),'|',(v['description'] or '')[:50],'| ja:',lab.get('ja'),'| nolabel:',','.join(miss))
