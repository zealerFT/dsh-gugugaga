import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const shared = {
  absWorkingDir: root, bundle: true, target: 'es2022', platform: 'browser',
  loader: { '.png': 'dataurl', '.css': 'text' }, logLevel: 'info',
};
await mkdir(join(root, 'dist'), { recursive: true });
await build({
  ...shared, entryPoints: ['src/client.js'], outfile: 'lib/client.js', format: 'cjs',
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-gugugaga-pet",factory:require=>{const module={exports:{}};const exports=module.exports;' },
  footer: { js: 'return module.exports;}});' },
});
await build({ ...shared, entryPoints: ['src/preview.js'], outfile: '.preview/preview.js', format: 'esm' });
await copyFile(join(root, 'preview.html'), join(root, '.preview/index.html'));
await copyFile(join(root, 'assets/character-preview.png'), join(root, '.preview/character-preview.png'));
const template = await readFile(join(root, 'preview.html'), 'utf8');
const script = await readFile(join(root, '.preview/preview.js'), 'utf8');
await writeFile(join(root, 'dist/gugugaga-preview.html'), template.replace('<script type="module" src="./preview.js"></script>', () => `<script type="module">${script.replaceAll('</script', '<\\/script')}</script>`));
