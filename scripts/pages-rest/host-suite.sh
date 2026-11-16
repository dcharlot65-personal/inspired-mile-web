# Runs on the build host, inside the checkout (through rb). Everything it writes outside the
# checkout goes under im-lang/pages-rest.
#
#   STEPS="ci vitest build pw mutate shots" bash scripts/pages-rest/host-suite.sh
#
# Ports of this branch's own (46331-46336), so a run in another checkout is never tested
# by mistake. The dev server for the screenshots is stopped by its own port.
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
OUT=/Volumes/macos_4TB_external_1/wai-build/im-lang/pages-rest
MEMGUARD=/Volumes/macos_4TB_external_1/wai-build/bin/memguard
mkdir -p $OUT/shots $OUT/logs
STEPS="${STEPS:-vitest build pw shots}"
export E2E_WEB_PORT=46331 E2E_WEB_NOEMAIL_PORT=46332 E2E_API_PORT=46333 E2E_API_NOEMAIL_PORT=46334 E2E_PG_PORT=46335
SHOT_PORT=46336
for p in $E2E_WEB_PORT $E2E_WEB_NOEMAIL_PORT $E2E_API_PORT $E2E_API_NOEMAIL_PORT $E2E_PG_PORT $SHOT_PORT; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then echo "port $p is taken"; lsof -nP -iTCP:$p -sTCP:LISTEN; fi
done
case " $STEPS " in *" ci "*) npm ci --no-audit --no-fund >$OUT/logs/npm.log 2>&1; echo "npm ci exit $?"; tail -3 $OUT/logs/npm.log;; esac
[ -d node_modules ] || { npm ci --no-audit --no-fund >$OUT/logs/npm.log 2>&1; echo "npm ci exit $?"; }
case " $STEPS " in *" vitest "*) $MEMGUARD --max-gb 12 -- npx vitest run >$OUT/logs/vitest.log 2>&1; echo "vitest exit $?"; grep -E "✗|×|FAIL|Test Files|Tests " $OUT/logs/vitest.log | sed -e 's/\x1b\[[0-9;]*m//g' | tail -30;; esac
case " $STEPS " in *" build "*) $MEMGUARD --max-gb 12 -- npm run build >$OUT/logs/build.log 2>&1; echo "build exit $?"; tail -6 $OUT/logs/build.log;; esac
case " $STEPS " in *" pw "*) $MEMGUARD --max-gb 24 -- npx playwright test ${PW_ARGS:-tests/pages-rest.spec.ts} --reporter=list >$OUT/logs/pw.log 2>&1; echo "playwright exit $?"; sed -e 's/\x1b\[[0-9;]*m//g' $OUT/logs/pw.log | grep -E "✓|✘|×|passed|failed|flaky|skipped|did not run|Error:" | tail -${PW_TAIL:-60};; esac
# Each check broken on purpose, and the test expected to go red (unit tests, then the browser tests).
case " $STEPS " in *" mutate "*) $MEMGUARD --max-gb 24 -- node scripts/pages-rest/mutate.mjs --browser >$OUT/logs/mutate.log 2>&1; echo "mutate exit $?"; grep -E "CAUGHT|MISSED|RED|GREEN|SKIPPED|mutation" $OUT/logs/mutate.log | tail -60;; esac
case " $STEPS " in *" shots "*)
  rm -f $OUT/shots/*.png
  API_PROXY_TARGET=http://127.0.0.1:9 $MEMGUARD --max-gb 8 -- npx astro dev --port $SHOT_PORT >$OUT/logs/dev.log 2>&1 &
  for i in $(seq 1 120); do curl -fsS -o /dev/null http://localhost:$SHOT_PORT/offline.html 2>/dev/null && break; sleep 1; done
  $MEMGUARD --max-gb 8 -- node scripts/pages-rest/shots.mjs http://localhost:$SHOT_PORT $OUT/shots "${SHOT_LOCALES:-ar,de,ja,es}" "${SHOT_WIDTHS:-phone,desktop}" >$OUT/logs/shots.log 2>&1; echo "shots exit $?"; tail -30 $OUT/logs/shots.log
  # Stop the dev server this script started, found by its own port.
  for pid in $(lsof -nP -iTCP:$SHOT_PORT -sTCP:LISTEN -t 2>/dev/null); do kill $pid; done
  ls $OUT/shots | wc -l;; esac
