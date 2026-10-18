import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Pre-render the same React page, so restricted/no-JS viewers still show real
// evidence. Interactions become available when the client bundle starts.
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
});
try {
  const { render } = await server.ssrLoadModule('/app/prerender.tsx');
  const html = await readFile('dist/index.html', 'utf8');
  const status =
    '<div id="preview-status">Read-only preview · Search, filters, notes and comparison require JavaScript. <a href="https://foxicall.github.io/PainMedicine-digest/" target="_blank" rel="noreferrer">Open the interactive website</a>.</div>';
  const rendered = html.replace(
    /<div id="root">[\s\S]*?<\/div>\s*<noscript/,
    () => `${status}<div id="root">${render()}</div><noscript`,
  );
  if (rendered === html) throw new Error('Could not locate the startup placeholder');
  await writeFile('dist/index.html', rendered);
  console.log('Pre-rendered evidence for viewers without JavaScript.');
} finally {
  await server.close();
}
