// Copied unchanged from the branch lang/qa-pipeline (scripts/lang/hspell.cpp), where it was written for the
// interface strings; built there by scripts/lang/host-setup.sh into the hunspell folder this check uses.
// hspell: ask Hunspell about whole words, one per line (UTF-8 in, UTF-8 out).
//
//   hspell <file.aff> <file.dic>  < words   > the words it rejects
//
// Two things the hunspell command gets wrong for this job. It splits its input
// into words by its own rules, which cut a Devanagari or Thai word at its vowel
// signs; this asks the library about each line as one word. And the library
// wants each word in the dictionary's own encoding (Polish is ISO 8859-2,
// German ISO 8859-1); this converts. Some dictionaries declare no encoding and
// hold UTF-8 bytes all the same (Hindi), so a word is accepted if the library
// accepts it either converted or as given.
#include <hunspell/hunspell.hxx>
#include <iconv.h>
#include <iostream>
#include <string>

static bool convert(iconv_t cd, const std::string &in, std::string &out) {
  if (cd == (iconv_t)-1) return false;
  iconv(cd, nullptr, nullptr, nullptr, nullptr);
  std::string buf(in.size() * 4 + 8, '\0');
  char *src = const_cast<char *>(in.data());
  size_t srcLeft = in.size();
  char *dst = &buf[0];
  size_t dstLeft = buf.size();
  if (iconv(cd, &src, &srcLeft, &dst, &dstLeft) == (size_t)-1 || srcLeft != 0) return false;
  out.assign(buf.data(), buf.size() - dstLeft);
  return true;
}

int main(int argc, char **argv) {
  if (argc != 3) {
    std::cerr << "usage: hspell <aff> <dic>\n";
    return 2;
  }
  Hunspell h(argv[1], argv[2]);
  const std::string enc = h.get_dict_encoding();
  const bool utf8 = enc == "UTF-8" || enc == "utf-8" || enc == "UTF8";
  iconv_t cd = utf8 ? (iconv_t)-1 : iconv_open(enc.c_str(), "UTF-8");
  std::string word, conv;
  while (std::getline(std::cin, word)) {
    if (word.empty()) continue;
    bool ok = h.spell(word);
    if (!ok && !utf8 && convert(cd, word, conv)) ok = h.spell(conv);
    if (!ok) std::cout << word << "\n";
  }
  return 0;
}
