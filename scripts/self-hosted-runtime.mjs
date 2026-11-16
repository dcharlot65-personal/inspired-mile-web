// Ships, from this site, the runtime files that libraries would otherwise fetch from a
// public CDN in the player's browser.
//
// - Transformers.js (the opponent, the judge, the ear) runs models on onnxruntime-web, whose
//   WebAssembly and loader (.mjs) it takes from cdn.jsdelivr.net unless told otherwise.
// - kokoro-js (the voice) carries its own, older Transformers.js with its own onnxruntime-web.
// - model-viewer takes its Draco and KTX2 decoders from www.gstatic.com when a model needs them.
//
// The files are read from node_modules, so they always match the installed library. In dev
// they are served by a middleware; in a build they are copied into the output. Their URLs
// carry the library version, so an upgrade can never pair a new loader with an old binary
// from a cache. The pages learn the URLs from the `__SELF_HOSTED__` constant
// (src/lib/self-hosted.ts).
//
// If a library changes its file layout this throws at start-up, on purpose: a build that
// silently fell back to the CDN is what this exists to prevent.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.wasm': 'application/wasm',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

/** The directory of package `name` as Node would resolve it from `fromDir`. */
function packageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`self-hosted-runtime: package "${name}" not found from ${fromDir}; run npm ci`);
    dir = parent;
  }
}

function version(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
}

/**
 * What is served and from where.
 * @returns {{ paths: Record<string, string>, ortFiles: string[], files: Map<string, string> }}
 *   `paths` goes to the pages; `files` maps a URL path to the file on disk.
 */
export function selfHostedRuntime(root) {
  const files = new Map();
  const mount = (urlDir, sourceDir, names) => {
    for (const name of names) {
      const source = path.join(sourceDir, name);
      if (!fs.existsSync(source)) {
        throw new Error(`self-hosted-runtime: ${source} is missing. The library's layout changed; update scripts/self-hosted-runtime.mjs (do not let it fall back to a CDN).`);
      }
      files.set(urlDir + name, source);
    }
  };

  // Transformers.js 4: asks for the "asyncify" build, or the plain one on Safari before 26
  // without WebGPU (its src/backends/onnx.js). Both are shipped.
  const transformers = packageDir('@huggingface/transformers', root);
  const ort = packageDir('onnxruntime-web', transformers);
  const ortUrl = `/ort/${version(ort)}/`;
  const ortFiles = [
    'ort-wasm-simd-threaded.asyncify.mjs',
    'ort-wasm-simd-threaded.asyncify.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.wasm',
  ];
  mount(ortUrl, path.join(ort, 'dist'), ortFiles);

  // kokoro-js: its Transformers.js 3 imports onnxruntime-web's WebGPU bundle, which asks for
  // the "jsep" build under whatever prefix it is given.
  const kokoro = packageDir('kokoro-js', root);
  const kokoroTransformers = packageDir('@huggingface/transformers', kokoro);
  if (kokoroTransformers === transformers) {
    throw new Error('self-hosted-runtime: kokoro-js now shares the site\'s Transformers.js. Its runtime files are then the ones above; update src/lib/thespian-voice.ts and this file together.');
  }
  const kokoroOrt = packageDir('onnxruntime-web', kokoroTransformers);
  const kokoroOrtUrl = `/ort/${version(kokoroOrt)}/`;
  if (kokoroOrtUrl === ortUrl) throw new Error('self-hosted-runtime: both onnxruntime-web copies report the same version; merge the two mounts.');
  mount(kokoroOrtUrl, path.join(kokoroOrt, 'dist'), ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']);

  // model-viewer: decoders for compressed models. No model on the site is compressed today;
  // these make sure that one that is never sends the visitor's browser to Google for a decoder.
  const modelViewer = packageDir('@google/model-viewer', root);
  const three = packageDir('three', modelViewer);
  const threeUrl = `/vendor/three-${version(three)}/`;
  mount(`${threeUrl}draco/`, path.join(three, 'examples/jsm/libs/draco/gltf'), ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']);
  mount(`${threeUrl}basis/`, path.join(three, 'examples/jsm/libs/basis'), ['basis_transcoder.js', 'basis_transcoder.wasm']);

  return {
    paths: { ort: ortUrl, kokoroOrt: kokoroOrtUrl, draco: `${threeUrl}draco/`, basis: `${threeUrl}basis/` },
    ortFiles,
    files,
  };
}

/** Astro integration: serve the files in dev, copy them into the build, tell the pages. */
export default function selfHostedRuntimeIntegration() {
  let runtime;
  return {
    name: 'self-hosted-runtime',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        runtime = selfHostedRuntime(fileURLToPath(config.root));
        updateConfig({
          vite: {
            define: {
              __SELF_HOSTED__: JSON.stringify({ ...runtime.paths, ortFiles: runtime.ortFiles }),
            },
            plugins: [{
              name: 'self-hosted-runtime:serve',
              configureServer(server) {
                // Registered before Vite's own middlewares, so the .mjs loaders are sent
                // as they are and not rewritten as source modules.
                server.middlewares.use((req, res, next) => {
                  const source = runtime.files.get((req.url ?? '').split('?')[0]);
                  if (!source) return next();
                  res.setHeader('Content-Type', TYPES[path.extname(source)] ?? 'application/octet-stream');
                  res.setHeader('Content-Length', fs.statSync(source).size);
                  res.setHeader('Cache-Control', 'no-cache');
                  if (req.method === 'HEAD') return res.end();
                  fs.createReadStream(source).pipe(res);
                });
              },
            }],
          },
        });
      },
      'astro:build:done': ({ dir }) => {
        const out = fileURLToPath(dir);
        for (const [url, source] of runtime.files) {
          const target = path.join(out, url);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(source, target);
        }
      },
    },
  };
}
