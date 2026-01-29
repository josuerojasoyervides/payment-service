// scripts/convert-relative-imports-to-aliases.mjs
import path from 'node:path';
import { Project } from 'ts-morph';

const ROOT = process.cwd();

const ALIASES = [
  { alias: '@core', dir: 'src/app/core' },
  { alias: '@shared', dir: 'src/app/shared' },
  { alias: '@payments', dir: 'src/app/features/payments' },
];

const toPosix = (p) => p.split(path.sep).join('/');
const stripExt = (p) => p.replace(/\.(ts|tsx|js|jsx)$/, '');

const project = new Project({
  tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
});

project.addSourceFilesAtPaths(['src/**/*.ts']);

for (const sf of project.getSourceFiles()) {
  const fileDir = path.dirname(sf.getFilePath());

  for (const imp of sf.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (!spec.startsWith('.')) continue;

    const absTarget = path.resolve(fileDir, spec);

    const hit = ALIASES
      .map((a) => ({ ...a, absDir: path.resolve(ROOT, a.dir) }))
      .find((a) => absTarget.startsWith(a.absDir));

    if (!hit) continue;

    const relInside = path.relative(hit.absDir, absTarget);
    const newSpec = `${hit.alias}/${toPosix(stripExt(relInside))}`;

    imp.setModuleSpecifier(newSpec);
  }
}

await project.save();
console.log('✅ Converted relative imports to aliases.');
