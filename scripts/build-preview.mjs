import { readFile, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME = {
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

// The normal Vite deployment is unchanged. This optional distribution contains
// the complete application, styles, favicon, and fonts in one portable HTML file.
export async function buildPreview({
  distDir = resolve('dist'),
  outputPath = resolve('preview.html'),
  base = process.env.VITE_BASE_PATH || '/',
} = {}) {
  const root = resolve(distDir);
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
  const localPath = (url) => {
    if (/^(?:[a-z]+:)?\/\//i.test(url)) throw new Error(`External preview asset: ${url}`);
    let pathname = decodeURIComponent(url.split(/[?#]/)[0]);
    if (prefix && pathname.startsWith(`${prefix}/`)) pathname = pathname.slice(prefix.length);
    const path = resolve(root, pathname.replace(/^\/+/, ''));
    const fromRoot = relative(root, path);
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
      throw new Error('Preview asset escapes the build directory.');
    }
    return path;
  };
  const assetData = async (url) => {
    const path = localPath(url);
    const mime = MIME[extname(path)];
    if (!mime) throw new Error(`Unsupported embedded asset: ${extname(path)}`);
    return `data:${mime};base64,${(await readFile(path)).toString('base64')}`;
  };
  let html = await readFile(resolve(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g)];
  if (scripts.length !== 1)
    throw new Error('Expected one bundled entry script. Run npm run build first.');
  for (const [tag, url] of scripts) {
    const js = await readFile(localPath(url), 'utf8');
    // Fail closed if a future build starts splitting JS into dependent chunks.
    if (/\bimport\s*\(|\b(?:import|export)\s+[^;]*?\bfrom\s*["']/.test(js)) {
      throw new Error('Split JavaScript chunks are not supported by the standalone preview.');
    }
    html = html.replace(
      tag,
      () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
    );
  }
  for (const [tag, url] of html.matchAll(
    /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  )) {
    let css = await readFile(localPath(url), 'utf8');
    const urls = [
      ...new Set([...css.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)].map((match) => match[1])),
    ];
    for (const asset of urls) {
      if (asset.startsWith('data:') || asset.startsWith('#')) continue;
      const data = await assetData(asset);
      css = css.split(asset).join(data);
    }
    html = html.replace(tag, () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
  }
  for (const [tag, url] of html.matchAll(/<link\b[^>]*rel="icon"[^>]*href="([^"]+)"[^>]*>/g)) {
    const data = await assetData(url);
    html = html.replace(tag, () => `<link rel="icon" type="image/svg+xml" href="${data}">`);
  }
  if (/<(?:script|link)\b[^>]*(?:src|href)="(?!data:)/i.test(html)) {
    throw new Error('Standalone preview still has external script or style dependencies.');
  }
  // All styles and scripts are inline; data URLs are safe to render without a base path.
  await writeFile(outputPath, html);
  return { outputPath, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await buildPreview();
  console.log(`Standalone preview: ${result.outputPath} (${Math.round(result.bytes / 1024)} KiB)`);
}
