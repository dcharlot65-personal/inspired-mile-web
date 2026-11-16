// hspell: ask Hunspell about whole words, one per line.
//
//   hspell <file.aff> <file.dic>  < words   > the words it rejects
//
// The hunspell command splits its input into words by its own rules, which cut
// a Devanagari or Thai word at its vowel signs. This asks the library about
// each line as one word, which is what the checks need.
#include <hunspell/hunspell.hxx>
#include <iostream>
#include <string>

int main(int argc, char **argv) {
  if (argc != 3) {
    std::cerr << "usage: hspell <aff> <dic>\n";
    return 2;
  }
  Hunspell h(argv[1], argv[2]);
  std::string word;
  while (std::getline(std::cin, word)) {
    if (!word.empty() && !h.spell(word)) std::cout << word << "\n";
  }
  return 0;
}
