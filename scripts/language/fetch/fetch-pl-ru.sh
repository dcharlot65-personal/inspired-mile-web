f(){ python3 fetchwork.py "$@" 2>&1 | cut -c1-260; }
P=pl.wikisource.org
f $P pl rj "Romeo i Julia (Shakespeare, tłum. Ulrich, 1895)"
f $P pl hamlet "Hamlet (Shakespeare, tłum. Ulrich, 1895)"
f $P pl mnd "Sen nocy letniej (Shakespeare, tłum. Ulrich, 1895)"
f $P pl tempest "Burza (Shakespeare, tłum. Ulrich, 1895)"
f $P pl macbeth "Makbet (Shakespeare, tłum. Ulrich, 1895)"
f $P pl tn "Wieczór Trzech Króli (Shakespeare, tłum. Ulrich, 1895)"
f $P pl jc "Juliusz Cezar (Shakespeare, tłum. Ulrich, 1895)"
f $P pl mov "Kupiec wenecki (Shakespeare, tłum. Ulrich, 1895)"
f $P pl h4p2 "Król Henryk IV. Część II (Shakespeare, tłum. Ulrich, 1895)"
f $P pl lear "Król Lear (Shakespeare, tłum. Ulrich, 1895)"
f $P pl othello "Otello (Shakespeare, tłum. Ulrich, 1895)"
f $P pl sonnet18 "Sonet XVIII (Shakespeare)"
R=ru.wikisource.org
f $R ru rj "Ромео и Джульетта (Шекспир; Михаловский)"
f $R ru hamlet "Гамлет, принц датский (Шекспир; Гнедич)/1917 (СО)"
f $R ru mnd "Сон в летнюю ночь (Шекспир; Григорьев)"
f $R ru tempest "Буря (Шекспир; Сатин)"
f $R ru macbeth "Макбет (Шекспир; Юрьев)"
f $R ru tn "Двенадцатая ночь, или Что угодно (Шекспир; Кронеберг)"
f $R ru jc "Юлий Цезарь (Шекспир; Козлов)"
f $R ru mov "Венецианский купец (Шекспир; Вейнберг)"
f $R ru h4p2 "Генрих IV (Шекспир; Каншин)/Часть 2"
f $R ru lear "Король Лир (Шекспир; Дружинин)"
f $R ru othello "Отелло, венецианский мавр (Шекспир; Вейнберг)"
f $R ru sonnet18 "Сонет 18 (Шекспир; Гербель)"
for l in it es zh ja de pt; do python3 roots.py $l 2>&1 | cut -c1-900 > roots-$l.txt; done
echo ALLDONE
