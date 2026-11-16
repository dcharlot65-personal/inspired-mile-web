"""Generate card art with FLUX 3 Image Klein through mflux on Apple Silicon.

    python gen_cards.py prompts.json out/ [--only ID,ID] [--seed N] [--model PATH]

The weights are the owner's local copy (model_library/flux-3-image-klein on the
MacBook host, 10.10.10.1), run with the mflux 0.24 venv there. The model loads
once; cards whose image exists are skipped, so a run can be resumed. Each PNG is
kept beside its WebP. Licence: FLUX Kommunity License; every image must be
looked at by a person before it is published.
"""
import argparse, json, time
from pathlib import Path
from PIL import Image
from mflux.models.flux3.variants import Flux3Klein

ap = argparse.ArgumentParser()
ap.add_argument('prompts'); ap.add_argument('out')
ap.add_argument('--only', default=''); ap.add_argument('--seed', type=int, default=7)
ap.add_argument('--model', default='/Volumes/macos_4tb_external_1/model_library/flux-3-image-klein')
a = ap.parse_args()

cards = json.loads(Path(a.prompts).read_text())
only = {x for x in a.only.split(',') if x}
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
t0 = time.time()
model = Flux3Klein(model_path=a.model)
print(f'model loaded in {time.time() - t0:.0f}s', flush=True)
for card in cards:
    if only and card['id'] not in only:
        continue
    stem = card['id'].lower()
    webp = out / f'{stem}.webp'
    if webp.exists():
        continue
    t = time.time()
    image = model.generate_image(seed=a.seed, prompt=card['prompt'], width=768, height=1024)
    png = out / f'{stem}.png'
    image.save(path=str(png))
    Image.open(png).convert('RGB').save(webp, 'WEBP', quality=88, method=6)
    print(f"{card['id']} {card['name']}: {time.time() - t:.0f}s", flush=True)
print(f'done in {time.time() - t0:.0f}s', flush=True)
