"""Build prompts.json for every card from src/lib/cards.ts.

Owner direction (2026-11-16): "we are a global planet and represent everyone", "we want full
representation", and "represent all styles", meaning the world's art traditions.
So each house is painted in its own tradition, and each character is played by an actor whose
background is named (a rotation across the world's peoples; the Sonnet Man is Black), because
an image model paints everyone white unless told otherwise.

Traditions are historical and widely shared. Styles that are sacred to, or owned by, living
Indigenous communities are deliberately not imitated.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRADITION = {
    'Legendary': 'a contemporary street-art mural: bold spray-paint colour fields, crisp stencil edges and painterly oil highlights',
    'Montague': 'an Italian Renaissance fresco: soft plaster texture, balanced figures, gentle earth pigments and architectural depth',
    'Capulet': 'an Art Nouveau poster: flowing whiplash lines, flat decorative colour, floral ornament within the scene and elegant outlined figures, the picture filling the whole image with no ornamental border',
    'Danish Court': 'a German Expressionist woodcut: stark angular shapes, heavy black cuts, raw emotion and limited colour',
    'Forest of Arden': 'the Haitian painting tradition: vivid saturated colour, lush stylised foliage, flattened perspective and joyful pattern',
    'Verona Court': 'an Ethiopian Orthodox icon painting: bold flat colour, strong dark outlines, large expressive eyes and patterned borders within the scene',
    'The Tempest': 'a Japanese ukiyo-e woodblock print: flat colour areas, bold flowing outlines, stylised waves and weather, visible wood grain',
    'Scottish Court': 'a Celtic illuminated manuscript: interlaced knotwork, jewel-like colour, gold leaf and stylised figures',
    'Illyria': 'a Persian miniature painting: fine detail, flat jewel colour, gold accents, ornamental gardens and tilted perspective',
    'Rome': 'Mexican muralism: monumental rounded figures, warm earth colour, strong rhythm and public-wall scale',
    'Lake District': 'a Chinese shan shui ink-wash landscape: misty mountains, soft graded ink, empty space and small figures with light touches of colour',
    'Gothic Circle': 'a Russian lacquer miniature: glossy black ground, fine gold linework and luminous tempera colour',
    'Olympus': 'ancient Greek red-figure vase painting: terracotta figures on black, elegant contour lines and patterned bands within the scene',
    'Underworld': 'an ancient Egyptian tomb wall painting: figures in profile, flat mineral colour, ordered registers and a sandstone ground',
    'Relic': 'a Mughal miniature painting: exquisite detail, flat rich colour, gold highlights and a decorative floral ground',
    'Potion': 'a West African textile-inspired illustration: bold geometric kente and adinkra-like pattern, strong colour blocks and confident flat shapes',
}
CASTS = ['a Black actor of African descent with deep brown skin', 'an East Asian actor', 'a South Asian actor', 'a Latino actor',
         'a Middle Eastern actor', 'a Native American actor', 'a Pacific Islander actor', 'a white European actor', 'a Southeast Asian actor']
PAL = {'gold': 'gold and amber', 'crimson': 'deep crimson', 'rose': 'rose red', 'blue': 'midnight blue', 'indigo': 'indigo', 'purple': 'violet purple',
       'violet': 'violet', 'cyan': 'teal and cyan', 'teal': 'teal', 'orange': 'burnt orange', 'amber': 'amber', 'emerald': 'emerald green',
       'green': 'forest green', 'lime': 'spring green', 'gray': 'ash grey', 'slate': 'slate grey', 'pink': 'soft pink', 'red': 'deep red',
       'yellow': 'pale gold', 'sky': 'sky blue', 'stone': 'stone grey', 'zinc': 'iron grey', 'fuchsia': 'magenta', 'neutral': 'charcoal'}
STYLE = ('Painted in the tradition of {tradition}. Portrait orientation, colour dominated by {palette}. '
         '{subject} {scene} {cast}'
         'Everyone wears long, modest clothing that covers shoulders, chest, midriff and legs; the image is suitable for all ages. '
         'Every surface is clean and dry; drama comes from light, shadow and expression. No weapon appears unless the scene itself names one. {era}'
         'No writing appears on any object, label, page or wall. The painting runs to all four edges of the image. '
         'No text, no lettering, no border, no rounded corners, no frame, no watermark, no signature.')

src = (ROOT / 'src/lib/cards.ts').read_text()
body = src[src.index('export const CARD_CATALOG'):]
def val(o, k):
    m = re.search(r"\b%s: (?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")" % k, o)
    return (m.group(1) or m.group(2)).replace("\\'", "'") if m else None

out, turn = [], 0
for o in re.findall(r"\{\s*\n\s*id: '[^']+'.*?\n  \},", body, re.S):
    c = {k: val(o, k) for k in ('id', 'name', 'type', 'house', 'scene', 'gradient')}
    cols = [PAL[x] for x in re.findall(r'(?:from|to)-([a-z]+)-\d+', c['gradient'] or '') if x in PAL]
    # Quoted words in a scene description get painted as lettering, so they are taken out.
    scene = re.sub(r'\s*["\u201c][^"\u201d]{1,60}["\u201d]', '', c['scene'])
    # Sentences about inscriptions, labels or messages get painted as garbled lettering: drop them.
    scene = ' '.join(x for x in re.split(r'(?<=[.!?])\s+', scene) if not re.search(r'\b(inscri\w+|labell?ed|label|reads?|written|message|letters?|words?|vow)\b', x, re.I)) or scene
    scene = re.sub(r'\b[Bb]lood-?stained\b', 'shadowed', scene)
    scene = re.sub(r'\b(dripping|drips?|gore|wounds?|bleeding)\b', 'gleaming', scene)
    scene = re.sub(r'\b[Bb]lood(y|ied)?\b', 'crimson light', scene)
    cast = who = ''
    if c['type'] == 'Character':
        if c['id'] == 'SM-001':
            who = CASTS[0]
            subject = 'The subject is the Sonnet Man: a hip-hop poet and teaching artist on a stage, microphone in hand, in a sharp modern jacket.'
        else:
            who = CASTS[turn % len(CASTS)]; turn += 1
            subject = f"The subject is {c['name']}, a literary character."
        cast = (f"Casting: {c['name']} is the main figure, large in the frame, and is played by {who}; their face, skin and hair "
                f"show this clearly. Show only the people the scene itself describes: do not add a crowd or onlookers. "
                f"Anyone else the scene does include comes from a different part of the world than {c['name']}. ")
    else:
        subject = f"The subject is an object: {c['name']}, shown as a still life with no people."
        # Lore sentences about an object get painted onto it as a label, so only the first, visual sentence is kept.
        scene = re.split(r'(?<=[.!?])\s+', scene)[0] + ' The object is plain: it carries no label, tag, engraving or inscription.'
    out.append({'id': c['id'], 'name': c['name'], 'house': c['house'], 'cast': who,
                'prompt': STYLE.format(tradition=TRADITION[c['house']], palette=' and '.join(dict.fromkeys(cols)) or 'deep jewel tones',
                                       subject=subject, scene=scene, cast=cast,
                                       era='' if c['id'] == 'SM-001' else "The setting belongs to the character's own historical or mythic era, with no modern objects. ")})
(ROOT / 'scripts/art/prompts.json').write_text(json.dumps(out, indent=1, ensure_ascii=False))
print(len(out), 'prompts;', len({c['house'] for c in out}), 'houses')
