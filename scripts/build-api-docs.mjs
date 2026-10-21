/**
 * Renders api/openapi.yaml as one self contained HTML page with Redoc, so the backend developer can
 * read the contract in a browser with no tooling and no network. The page embeds both the viewer
 * and the document. Written to api/build/index.html, which is not committed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const spec = parse(readFileSync(resolve(root, 'api', 'openapi.yaml'), 'utf8'));
const viewer = readFileSync(
  resolve(root, 'node_modules', 'redoc', 'bundles', 'redoc.standalone.js'),
  'utf8',
);

// Safe to put inside a script element: no sequence in the JSON can close it.
const embedded = JSON.stringify(spec)
  .replaceAll('<', '\\u003c')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${spec.info.title}</title>
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="docs">Loading the API contract…</div>
    <script id="spec" type="application/json">${embedded}</script>
    <script>${viewer.replace(/<\/script/gi, '<\\/script')}</script>
    <script>
      Redoc.init(JSON.parse(document.getElementById('spec').textContent), { hideDownloadButton: false, expandResponses: '200,201' }, document.getElementById('docs'));
    </script>
  </body>
</html>
`;

const out = resolve(root, 'api', 'build');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'index.html'), html);
console.log(`wrote api/build/index.html (${Math.round(html.length / 1024)} KB)`);

// Check that what was written renders: open it in a simulated browser and count the operations.
const { JSDOM, VirtualConsole } = await import('jsdom');
const expected = Object.values(spec.paths).flatMap((item) =>
  Object.keys(item).filter((key) => ['get', 'post', 'put', 'patch', 'delete'].includes(key)),
).length;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
  beforeParse(window) {
    // Browser features the simulation lacks and the viewer needs.
    window.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    });
    window.Worker = class {
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    };
    window.URL.createObjectURL = () => 'blob:x';
    window.scrollTo = () => {};
  },
});
let rendered = 0;
for (let waited = 0; waited < 20_000 && rendered < expected; waited += 500) {
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  rendered = dom.window.document.querySelectorAll('[data-section-id^="operation/"]').length;
}
dom.window.close();
if (rendered !== expected) {
  console.error(`The rendered view shows ${rendered} operations; the contract has ${expected}.`);
  process.exit(1);
}
console.log(`checked: the rendered view shows all ${rendered} operations`);
