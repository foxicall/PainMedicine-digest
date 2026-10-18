import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPreview } from '../scripts/build-preview.mjs';

const directories = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture(base = '/') {
  const root = await mkdtemp(join(tmpdir(), 'pain-preview-'));
  directories.push(root);
  const dist = join(root, 'dist');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(
    join(dist, 'index.html'),
    `<html><head><link rel="icon" href="${base}favicon.svg"><script type="module" crossorigin src="${base}assets/app.js"></script><link rel="stylesheet" crossorigin href="${base}assets/app.css"></head><body><div id="root"></div></body></html>`,
  );
  await writeFile(
    join(dist, 'assets/app.js'),
    'document.getElementById("root").textContent="Trial library";',
  );
  await writeFile(
    join(dist, 'assets/app.css'),
    `@font-face{font-family:demo;src:url(${base}assets/font.woff2)}body{color:#126b60}`,
  );
  await writeFile(join(dist, 'assets/font.woff2'), Buffer.from('font fixture'));
  await writeFile(join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return { distDir: dist, outputPath: join(root, 'preview.html'), base };
}

describe('standalone preview packaging', () => {
  it.each(['/', '/PainMedicine-digest/'])(
    'embeds every required asset for base %s',
    async (base) => {
      const options = await fixture(base);
      const result = await buildPreview(options);
      const html = await readFile(options.outputPath, 'utf8');
      expect(result.bytes).toBeGreaterThan(0);
      expect(html).toContain('textContent="Trial library"');
      expect(html).toContain('data:font/woff2;base64,');
      expect(html).toContain('data:image/svg+xml;base64,');
      expect(html).not.toMatch(/src="/);
      expect(html).not.toMatch(/url\(\/assets/);
    },
  );
  it('rejects a future code-split build instead of producing a broken preview', async () => {
    const options = await fixture();
    await writeFile(join(options.distDir, 'assets/app.js'), 'import("./chunk.js");');
    await expect(buildPreview(options)).rejects.toThrow('Split JavaScript chunks');
  });
  it('rejects external script dependencies', async () => {
    const options = await fixture();
    const html = (await readFile(join(options.distDir, 'index.html'), 'utf8')).replace(
      '/assets/app.js',
      'https://example.test/app.js',
    );
    await writeFile(join(options.distDir, 'index.html'), html);
    await expect(buildPreview(options)).rejects.toThrow('External preview asset');
  });
  it('rejects assets outside the build directory', async () => {
    const options = await fixture();
    await writeFile(
      join(options.distDir, 'assets/app.css'),
      'body{background:url(../../private.svg)}',
    );
    await expect(buildPreview(options)).rejects.toThrow('escapes the build directory');
  });
});
