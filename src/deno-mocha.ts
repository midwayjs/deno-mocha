import esbuild from 'esbuild';
import arg from 'arg';
import glob from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import childProcess from 'child_process';

const kHelp = `
deno-mocha [options] ...<file-pattern>

  --exclude <file-pattern>            exclude files by pattern
`;

const modsDir = path.join(__dirname, '../mods');

const importMap = new Map<string, string>([
  ['assert', 'https://deno.land/std@0.139.0/node/assert.ts'],
]);

async function startServer(host: string, port: number, patterns: string[], excludePatterns: string[]) {
  const matches = patterns.flatMap(p => {
    return glob.sync(p, {
      cwd: process.cwd(),
      ignore: ['**/node_modules', ...excludePatterns],
    });
  });

  const kDenoMochaRunnerEntry = '!dmr:index.ts';
  const kEntryContents = `
import '!dmr:bdd-global.ts';

${
  matches.map(it => `import './${it}';`).join('\n')
}
`;

  const ImportMapPlugin: esbuild.Plugin = {
    name: 'import-map',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path.startsWith('!dmr:')) {
          return {
            path: args.path,
            namespace: 'dmr',
            external: false,
          };
        }
        if (importMap.has(args.path)) {
          return {
            path: importMap.get(args.path),
            namespace: args.path,
            external: true
          };
        }
        return null;
      });

      build.onLoad({ filter: /.*/ }, async (args) => {
        if (args.namespace !== 'dmr') {
          return null;
        }
        if (args.path === kDenoMochaRunnerEntry) {
          return {
            contents: kEntryContents,
            resolveDir: process.cwd(),
          };
        }

        const file = await fs.readFile(path.join(modsDir, args.path.substring(5)), 'utf8');
        return {
          contents: file,
          resolveDir: modsDir,
        };
      });
    },
  }

  const server = await esbuild.serve({
    host,
    port,
  }, {
    platform: 'browser',
    target: 'esnext',
    format: 'esm',
    mainFields: ['esnext', 'browser', 'module', 'main'],
    bundle: true,
    sourcemap: 'inline',
    plugins: [
      ImportMapPlugin,
    ],
    entryPoints: [kDenoMochaRunnerEntry],
    outfile: 'index.js',
  });

  return server;
}

async function denoTest(denoExecPath, url) {
  const cp = childProcess.spawn(denoExecPath, ['test', '-r', `--location=${url}`, url], {
    stdio: 'inherit',
  });
  return new Promise<void>((resolve, reject) => {
    cp.on('exit', (code, signal) => {
      if (code === 0) {
        return resolve();
      }
      const err = new Error(`Deno test failed: code(${code}), signal(${signal})`);
      (err as any).exitCode = code;
      reject(err);
    });
  });
}

async function main() {
  const opt = arg({
    '--port': Number,
    '--host': String,
    '--deno': String,
    '--exclude': [String],
    '--help': Boolean,
  }, {
    argv: process.argv.slice(2),
  });

  if (opt['--help']) {
    console.log(kHelp);
    return;
  }

  const port = opt['--port'] ?? 8888;
  const host = opt['--host'] ?? '127.0.0.1';
  const deno = opt['--deno'] ?? 'deno';

  const excludePatterns = opt['--exclude'] ?? [];
  const patterns = opt._;

  const server = await startServer(host, port, patterns, excludePatterns);

  try {
    await denoTest(deno, `http://${host}:${port}/index.js`);
  } catch (e: any) {
    if (e.exitCode) {
      process.exitCode = e.exitCode;
    } else {
      throw e;
    }
  } finally {
    server.stop();
  }
}


main().catch(e => {
  console.error('unexpected error:', e);
  process.exitCode = 1;
});
