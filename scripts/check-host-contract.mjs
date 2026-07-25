import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function argumentValue(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback;
}

const hosts = [
    {
        name: 'SillyTavern',
        root: argumentValue('--sillytavern', resolve(projectRoot, '..', 'SillyTavern')),
        contentDirectory: 'public',
    },
    {
        name: 'TauriTavern',
        root: argumentValue('--tauritavern', resolve(projectRoot, '..', 'TauriTavern')),
        contentDirectory: 'src',
    },
];

function walkJavaScript(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '.git') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...walkJavaScript(path));
        else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path);
    }
    return files;
}

function parseImports(source) {
    // Ignore fully commented imports while preserving URL-like strings in code.
    source = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    const imports = [];
    const staticPattern = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
    const dynamicPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = staticPattern.exec(source))) {
        const clause = match[1].trim();
        const names = [];
        const named = clause.match(/\{([\s\S]*?)\}/)?.[1];
        if (named) {
            for (const item of named.split(',')) {
                const importedName = item.trim().split(/\s+as\s+/)[0]?.trim();
                if (importedName) names.push(importedName);
            }
        }
        imports.push({ specifier: match[2], names });
    }
    while ((match = dynamicPattern.exec(source))) {
        imports.push({ specifier: match[1], names: [] });
    }
    return imports;
}

function hasExport(source, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declaration = new RegExp(`export\\s+(?:async\\s+)?(?:function|class|const|let|var)\\s+${escaped}\\b`);
    const exportBlocks = [...source.matchAll(/export\s*\{([\s\S]*?)\}/g)];
    return declaration.test(source) || exportBlocks.some(match => match[1]
        .split(',')
        .some(item => {
            const [localName, exportedName] = item.trim().split(/\s+as\s+/);
            return (exportedName ?? localName)?.trim() === name;
        }));
}

function isInside(parent, child) {
    const path = relative(parent, child);
    return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

const pluginFiles = walkJavaScript(projectRoot);
const failures = [];
const hostImportCounts = new Map();

for (const host of hosts) {
    if (!existsSync(host.root)) {
        failures.push(`${host.name}: repository not found at ${host.root}`);
        continue;
    }

    const contentRoot = join(host.root, host.contentDirectory);
    const virtualPluginRoot = join(contentRoot, 'scripts', 'extensions', 'third-party', 'vectors-enhanced');
    let hostImportCount = 0;

    for (const pluginFile of pluginFiles) {
        const pluginRelativePath = relative(projectRoot, pluginFile);
        const virtualPluginFile = join(virtualPluginRoot, pluginRelativePath);
        const source = readFileSync(pluginFile, 'utf8');

        for (const imported of parseImports(source)) {
            if (!imported.specifier.startsWith('.')) continue;
            const target = resolve(dirname(virtualPluginFile), imported.specifier);
            if (isInside(virtualPluginRoot, target)) continue;
            hostImportCount++;

            if (!existsSync(target)) {
                failures.push(`${host.name}: missing module ${relative(contentRoot, target)} imported by ${pluginRelativePath}`);
                continue;
            }

            const targetSource = readFileSync(target, 'utf8');
            for (const name of imported.names) {
                if (!hasExport(targetSource, name)) {
                    failures.push(`${host.name}: ${relative(contentRoot, target)} does not export ${name} (used by ${pluginRelativePath})`);
                }
            }
        }
    }

    hostImportCounts.set(host.name, hostImportCount);
}

const tauriRoot = hosts.find(host => host.name === 'TauriTavern')?.root;
if (tauriRoot && existsSync(tauriRoot)) {
    const requiredRouteFiles = [
        ['src/tauri/main/routes/vector-routes.js', '/api/vector/*'],
        ['src/tauri/main/routes/settings-routes.js', '/api/secrets/write'],
        ['src/tauri/main/routes/ai-routes.js', '/api/backends/chat-completions/generate'],
        ['src/tauri/main/routes/ai-routes.js', '/api/backends/chat-completions/status'],
        ['src/tauri/main/routes/worldinfo-routes.js', '/api/worldinfo/get'],
        ['src/tauri/main/routes/worldinfo-routes.js', '/api/worldinfo/edit'],
        ['src/tauri/main/routes/worldinfo-routes.js', '/api/worldinfo/delete'],
    ];
    for (const [file, route] of requiredRouteFiles) {
        const path = join(tauriRoot, file);
        if (!existsSync(path) || !readFileSync(path, 'utf8').includes(route)) {
            failures.push(`TauriTavern: required route contract missing: ${route} (${file})`);
        }
    }

    const vectorRoutes = readFileSync(join(tauriRoot, 'src/tauri/main/routes/vector-routes.js'), 'utf8');
    if (vectorRoutes.includes('vector_endpoint_unavailable')) {
        const adapterSource = readFileSync(join(projectRoot, 'src/infrastructure/storage/StorageAdapter.js'), 'utf8');
        const backendSource = readFileSync(join(projectRoot, 'src/infrastructure/storage/BrowserVectorBackend.js'), 'utf8');
        if (!adapterSource.includes('activateBrowserFallback') || !backendSource.includes('IndexedDB')) {
            failures.push('TauriTavern: native vector backend is unavailable but browser fallback is not wired');
        }
    }
}

for (const [host, count] of hostImportCounts) {
    console.log(`${host}: checked ${count} host-module imports`);
}

if (failures.length) {
    console.error(`\nHost contract check failed with ${failures.length} issue(s):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log('\nHost contract check passed.');
}
