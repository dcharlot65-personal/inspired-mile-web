// hstem: ask Hunspell what each word is, one per line (UTF-8 in, UTF-8 out).
//
//   hstem <file.aff> <file.dic>  < words   > word<TAB>accepted (1 or 0)<TAB>stem|stem|...
//
// The declined forms of the game's character names (check.py forms) are put to it: a form that the
// dictionary knows as an ordinary word (Russian «Банки», "banks", which the rule would make of «Банко»)
// is not a name. Hunspell's stem() gives the dictionary entries a word is a form of; written next to
// hspell.cpp (which only says whether a word is accepted) and built the same way, against this host's
// Hunspell 1.7.2 library. Like hspell, it converts to and from the dictionary's encoding (Polish is
// ISO 8859-2), and a dictionary that declares none but holds UTF-8 is asked as given.
#include <hunspell/hunspell.hxx>
#include <iconv.h>
#include <iostream>
#include <string>
#include <vector>

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
    std::cerr << "usage: hstem <aff> <dic>\n";
    return 2;
  }
  Hunspell h(argv[1], argv[2]);
  const std::string enc = h.get_dict_encoding();
  const bool utf8 = enc == "UTF-8" || enc == "utf-8" || enc == "UTF8";
  iconv_t to = utf8 ? (iconv_t)-1 : iconv_open(enc.c_str(), "UTF-8");
  iconv_t from = utf8 ? (iconv_t)-1 : iconv_open("UTF-8", enc.c_str());
  std::string word, conv, back;
  while (std::getline(std::cin, word)) {
    if (word.empty()) continue;
    // As given first (a dictionary that holds UTF-8 whatever it declares), then in the dictionary's encoding.
    std::string asked = word;
    bool ok = h.spell(word);
    bool converted = false;
    if (!ok && !utf8 && convert(to, word, conv)) {
      asked = conv;
      converted = true;
      ok = h.spell(conv);
    }
    std::vector<std::string> stems = h.stem(asked);
    if (stems.empty() && converted) {
      stems = h.stem(word);
      converted = false;
    }
    std::cout << word << "\t" << (ok ? 1 : 0) << "\t";
    for (size_t i = 0; i < stems.size(); i++) {
      std::string s = stems[i];
      if (converted && convert(from, s, back)) s = back;
      std::cout << (i ? "|" : "") << s;
    }
    std::cout << "\n";
  }
  return 0;
}
