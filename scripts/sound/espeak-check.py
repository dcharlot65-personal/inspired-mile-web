"""Write the independent check of the sound tables: common words and how espeak-ng says them.

    python3 -I scripts/sound/espeak-check.py <folder of frequency lists> > src/lib/verse/sound/corpus/espeak.json

The tables in src/lib/verse/sound/data come from Wiktionary, and the test sets that measure
them mostly do too. This file comes from neither: the words are the commonest of each
language in film and television subtitles (OpenSubtitles 2018, as counted by hermitdave's
FrequencyWords), and their pronunciation is what espeak-ng, a rule-and-dictionary
phonemiser with its own data, makes of them. The unit tests (sound.test.ts, "against
espeak-ng") count how often the engine agrees with it on syllables and stress.

The folder holds <lang>_50k.txt for es it pt fr de pl ru id and hi_full.txt, fetched from
https://github.com/hermitdave/FrequencyWords/tree/<commit>/content/2018/ (licence and
commit in docs/language/PHONETICS.md). espeak-ng must be on PATH. A light script: one
espeak-ng process per language, a few seconds in all.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

PER_LANG = 1500
LIST_COMMIT = "525f9b560de45753a5ea01069454e72e9aa541c6"

# Language: (list file, espeak-ng voice, the letters a word of the language is written in).
LANGS = {
    "es": ("es_50k.txt", "es", r"[a-záéíóúüñ]+"),
    "it": ("it_50k.txt", "it", r"[a-zàèéìíòóùú]+"),
    # Brazilian: verse counts the vowels the spelling has, and European Portuguese drops many of them in speech.
    "pt": ("pt_50k.txt", "pt-br", r"[a-záàâãéêíóôõúüç]+"),
    "fr": ("fr_50k.txt", "fr-fr", r"[a-zàâäçéèêëîïôöùûüÿœæ]+"),
    "de": ("de_50k.txt", "de", r"[a-zäöüß]+"),
    "pl": ("pl_50k.txt", "pl", r"[a-ząćęłńóśźż]+"),
    "ru": ("ru_50k.txt", "ru", r"[а-яё]+"),
    "id": ("id_50k.txt", "id", r"[a-z]+"),
    "hi": ("hi_full.txt", "hi", r"[ऀ-ॣ०-ॿ]+"),
}


def words_of(path: Path, letters: str) -> list[str]:
    pattern = re.compile(letters)
    out: list[str] = []
    seen: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        word = line.split(" ")[0].strip().lower()
        if len(word) < 2 or word in seen or not pattern.fullmatch(word):
            continue
        # Devanagari digits and signs that stand alone are not words.
        if letters.startswith("[\\u0900") and not re.search(r"[अ-ह]", word):
            continue
        seen.add(word)
        out.append(word)
        if len(out) == PER_LANG:
            break
    return out


def espeak(voice: str, words: list[str]) -> list[str]:
    """One line of phonemes, separated by "_", per word."""
    run = subprocess.run(
        ["espeak-ng", "-q", "--ipa", "--sep=_", "-v", voice],
        input="\n".join(words) + "\n",
        capture_output=True,
        text=True,
        check=True,
    )
    lines = [l.strip() for l in run.stdout.splitlines()]
    if len(lines) == len(words):
        return lines
    if len(words) == 1:
        return [" ".join(lines)]
    # The lines did not come back one for one: ask word by word.
    return [espeak(voice, [w])[0] for w in words]


def main() -> None:
    folder = Path(sys.argv[1])
    version = subprocess.run(["espeak-ng", "--version"], capture_output=True, text=True, check=True).stdout.split("  ")[0].strip()
    out = {
        "about": "Common words and how espeak-ng says them: an independent check of the sound tables (scripts/sound/espeak-check.py).",
        "tool": version,
        "toolLicence": "GPL-3.0-or-later (used to make this file; nothing of it ships)",
        "command": "espeak-ng -q --ipa --sep=_ -v <voice>, one word a line",
        "words": f"the first {PER_LANG} words of each list written wholly in the language's letters, two characters or more",
        "wordList": f"OpenSubtitles 2018 frequency lists, github.com/hermitdave/FrequencyWords commit {LIST_COMMIT}, content/2018/<lang>",
        "wordListLicence": "CC BY-SA 4.0 (content); MIT (code)",
        "made": "2026-11-16",
        "langs": {},
    }
    for lang, (file, voice, letters) in LANGS.items():
        words = words_of(folder / file, letters)
        ipa = espeak(voice, words)
        out["langs"][lang] = {"voice": voice, "words": [[w, p] for w, p in zip(words, ipa)]}
        print(lang, len(words), file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
