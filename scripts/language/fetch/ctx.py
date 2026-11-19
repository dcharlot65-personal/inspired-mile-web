"""ctx.py <lang> <W> 'work|regex' ... : show up to 3 hits with W chars of context."""
import sys,re
lang=sys.argv[1]; W=int(sys.argv[2])
for a in sys.argv[3:]:
    work,rx=a.split('|',1)
    t=open(f'cache/{lang}/{work}.txt',encoding='utf8').read().replace('\ufeff','')
    ms=list(re.finditer(rx.replace(' ',r'\s+'),t,re.S))
    print(f'## {a} [{len(ms)}]')
    for m in ms[:3]:
        print('   ',t[max(0,m.start()-W):m.end()+W].replace('\n','⏎'))
