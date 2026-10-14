import {spawnSync} from 'node:child_process';
import {cp, mkdir, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = path.join(projectDirectory, 'dist');
const runtimeDirectories = ['src', 'public', 'themes'];

async function findJavaScriptFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return findJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  }));

  return nestedFiles.flat();
}

const backendJavaScriptFiles = await findJavaScriptFiles(path.join(projectDirectory, 'src'));
for (const file of backendJavaScriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'});
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Backend syntax check failed: ${file}`);
  }
}

await rm(outputDirectory, {recursive: true, force: true});
await mkdir(outputDirectory, {recursive: true});
for (const directory of runtimeDirectories) {
  await cp(path.join(projectDirectory, directory), path.join(outputDirectory, directory), {recursive: true});
}
console.log(`Built backend runtime in ${path.relative(projectDirectory, outputDirectory)}.`);
