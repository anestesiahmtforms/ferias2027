import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
const sourcePath = path.join(repositoryRoot, 'apps-script', 'Code.gs');
const artifactPath = path.join(repositoryRoot, 'apps-script', 'PWA_Backend.gs');
const publicEntrypoints = new Set(['doGet', 'doPost']);

export function normalizeLineEndings(source) {
  return String(source).replace(/\r\n?/g, '\n');
}

export function globalIdentifiers(source) {
  const identifiers = [];
  const declaration = /^(?:const\s+([A-Za-z_$][\w$]*)\b|function\s+([A-Za-z_$][\w$]*)\s*\()/gm;
  for (const match of source.matchAll(declaration)) {
    const name = match[1] || match[2];
    if (!identifiers.includes(name)) identifiers.push(name);
  }
  return identifiers;
}

function transformCode(source, replacements) {
  let index = 0;

  function readQuoted(quote) {
    let output = quote;
    index += 1;
    while (index < source.length) {
      const character = source[index++];
      output += character;
      if (character === '\\' && index < source.length) output += source[index++];
      else if (character === quote) break;
    }
    return output;
  }

  function readTemplate() {
    let output = '`';
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '\\') {
        output += source.slice(index, index + 2);
        index += 2;
      } else if (character === '`') {
        output += character;
        index += 1;
        return output;
      } else if (character === '$' && source[index + 1] === '{') {
        output += '${';
        index += 2;
        output += readCode(true);
        if (source[index] !== '}') throw new Error('Expressão ${...} sem fechamento em template literal.');
        output += '}';
        index += 1;
      } else {
        output += character;
        index += 1;
      }
    }
    throw new Error('Template literal sem fechamento.');
  }

  function readCode(stopAtBrace = false) {
    let output = '';
    let braceDepth = 0;
    while (index < source.length) {
      const character = source[index];
      const next = source[index + 1];

      if (stopAtBrace && character === '}' && braceDepth === 0) return output;
      if (character === '/' && next === '/') {
        const end = source.indexOf('\n', index);
        const boundary = end < 0 ? source.length : end;
        output += source.slice(index, boundary);
        index = boundary;
      } else if (character === '/' && next === '*') {
        const end = source.indexOf('*/', index + 2);
        if (end < 0) throw new Error('Comentário de bloco sem fechamento.');
        output += source.slice(index, end + 2);
        index = end + 2;
      } else if (character === '"' || character === "'") {
        output += readQuoted(character);
      } else if (character === '`') {
        output += readTemplate();
      } else if (/[A-Za-z_$]/.test(character)) {
        let end = index + 1;
        while (end < source.length && /[A-Za-z0-9_$]/.test(source[end])) end += 1;
        const identifier = source.slice(index, end);
        output += replacements.get(identifier) || identifier;
        index = end;
      } else {
        if (character === '{') braceDepth += 1;
        else if (character === '}' && braceDepth > 0) braceDepth -= 1;
        output += character;
        index += 1;
      }
    }
    if (stopAtBrace) throw new Error('Expressão ${...} sem fechamento em template literal.');
    return output;
  }

  return readCode();
}

export function buildBackendSource(source) {
  source = normalizeLineEndings(source);
  const globals = globalIdentifiers(source);
  for (const entrypoint of publicEntrypoints) {
    if (!globals.includes(entrypoint)) throw new Error(`A fonte canônica não declara ${entrypoint}().`);
  }

  const replacements = new Map(globals
    .filter(identifier => !publicEntrypoints.has(identifier))
    .map(identifier => [identifier, `pwa_${identifier}`]));
  return `// Gerado por scripts/build-apps-script.mjs a partir de Code.gs. Não editar manualmente.\n${transformCode(source, replacements)}`;
}

function run() {
  const source = normalizeLineEndings(fs.readFileSync(sourcePath, 'utf8'));
  const generated = buildBackendSource(source);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(artifactPath) ? normalizeLineEndings(fs.readFileSync(artifactPath, 'utf8')) : '';
    if (current !== generated) {
      console.error('PWA_Backend.gs está ausente ou desatualizado. Execute node scripts/build-apps-script.mjs.');
      process.exitCode = 1;
      return;
    }
    console.log('PWA_Backend.gs corresponde a Code.gs.');
    return;
  }

  fs.writeFileSync(artifactPath, generated, 'utf8');
  console.log(`Backend gerado: ${path.relative(repositoryRoot, artifactPath)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) run();
