# Runs on the build host, inside the checkout (through rb). Everything it writes outside the
# checkout goes under im-lang/pages-rest.
export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
OUT=/Volumes/macos_4TB_external_1/wai-build/im-lang/pages-rest
mkdir -p $OUT/shots $OUT/logs
STEPS="${STEPS:-vitest build pw shots}"
export E2E_WEB_PORT=46331 E2E_WEB_NOEMAIL_PORT=46332 E2E_API_PORT=46333 E2E_API_NOEMAIL_PORT=46334 E2E_PG_PORT=46335
SHOT_PORT=46336
for p in $E2E_WEB_PORT $E2E_WEB_NOEMAIL_PORT $E2E_API_PORT $E2E_API_NOEMAIL_PORT $E2E_PG_PORT $SHOT_PORT; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then echo "port $p is taken"; lsof -nP -iTCP:$p -sTCP:LISTEN; fi
done
[ -d node_modules ] || npm ci --no-audit --no-fund >$OUT/logs/npm.log 2>&1
case " $STEPS " in *" vitest "*) npx vitest run >$OUT/logs/vitest.log 2>&1; echo "vitest exit $?"; tail -8 $OUT/logs/vitest.log;; esac
case " $STEPS " in *" build "*) npm run build >$OUT/logs/build.log 2>&1; echo "build exit $?"; tail -6 $OUT/logs/build.log;; esac
case " $STEPS " in *" pw "*) npx playwright test ${PW_ARGS:-tests/pages-rest.spec.ts} --reporter=list >$OUT/logs/pw.log 2>&1; echo "playwright exit $?"; grep -E "✓|✘|×|passed|failed|flaky|skipped|Error:" $OUT/logs/pw.log | tail -60;; esac
case " $STEPS " in *" shots "*)
  rm -f $OUT/shots/*.png
  API_PROXY_TARGET=http://127.0.0.1:9 npx astro dev --port $SHOT_PORT >$OUT/logs/dev.log 2>&1 &
  for i in $(seq 1 90); do curl -fsS -o /dev/null http://localhost:$SHOT_PORT/offline.html 2>/dev/null && break; sleep 1; done
  node scripts/pages-rest/shots.mjs http://localhost:$SHOT_PORT $OUT/shots "${SHOT_LOCALES:-ar,de,ja,es}" "${SHOT_WIDTHS:-phone,desktop}" >$OUT/logs/shots.log 2>&1; echo "shots exit $?"; tail -30 $OUT/logs/shots.log
  # Stop the dev server this script started, found by its own port.
  for pid in $(lsof -nP -iTCP:$SHOT_PORT -sTCP:LISTEN -t 2>/dev/null); do kill $pid; done
  ls $OUT/shots | wc -l;; esac
