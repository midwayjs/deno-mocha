import esbuild from 'esbuild';
import arg from 'arg';
import glob from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import childProcess from 'child_process';
import mustache from 'mustache';

const kDefaultStdVersion = '0.140.0';
const kHelp = `
deno-mocha [options] ...<file-pattern>

  --exclude <file-pattern>            Exclude files by pattern.
  --std-version <version>             Deno std library version to be used. Default: ${kDefaultStdVersion}
  --sanitize-ops                      Check that the number of async completed ops after the test is the same as number of dispatched ops. Default: false
  --sanitize-resources                Ensure the test case does not "leak" resources. Default: false
`;

const modsDir = path.join(__dirname, '../mods');

function getImportMap(stdVersion) {
  const prefix = `https://deno.land/std@${stdVersion}/`;
  const importMap = new Map<string, string>([
    ['assert', 'node/assert.ts'],
  ].map((it) => [it[0], prefix + it[1]]));
  return importMap;
}

interface TestContext {
  stdVersion: string;
  sanitizeOps: boolean;
  sanitizeResources: boolean;
}

async function startServer(
  host: string,
  port: number,
  patterns: string[],
  excludePatterns: string[],
  testContext: TestContext,
) {
  const matches = patterns.flatMap((p) => {
    return glob.sync(p, {
      cwd: process.cwd(),
      ignore: ['**/node_modules', ...excludePatterns],
    });
  });

  const kDenoMochaRunnerEntry = '!dmr:index.ts';
  const kEntryContents = `
import '!dmr:bdd-global.ts';

${matches.map((it) => `import './${it}';`).join('\n')}
`;

  const importMap = getImportMap(testContext.stdVersion);
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
            external: true,
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

        const file = await fs.readFile(
          path.join(modsDir, args.path.substring(5)),
          'utf8',
        );
        return {
          loader: 'ts',
          contents: mustache.render(file, testContext),
          resolveDir: modsDir,
        };
      });
    },
  };

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

function denoTest(denoExecPath, url, argv) {
  const cp = childProcess.spawn(denoExecPath, [
    'test',
    '-r',
    `--location=${url}`,
    ...argv,
    url,
  ], {
    stdio: 'inherit',
  });
  return new Promise<void>((resolve, reject) => {
    cp.on('exit', (code, signal) => {
      if (code === 0) {
        return resolve();
      }
      const err = new Error(
        `Deno test failed: code(${code}), signal(${signal})`,
      );
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
    '--std-version': String,
    '--exclude': [String],
    '--sanitize-ops': Boolean,
    '--sanitize-resources': Boolean,
    '--help': Boolean,
  }, {
    argv: process.argv.slice(2),
    permissive: true,
  });

  if (opt['--help']) {
    console.log(kHelp);
    return;
  }

  const port = opt['--port'] ?? 8888;
  const host = opt['--host'] ?? '127.0.0.1';
  const deno = opt['--deno'] ?? 'deno';
  const stdVersion = opt['--std-version'] ?? kDefaultStdVersion;
  const sanitizeOps = opt['--sanitize-ops'] ?? false;
  const sanitizeResources = opt['--sanitize-resources'] ?? false;

  const excludePatterns = opt['--exclude'] ?? [];
  const patternsIndex = opt._.findIndex((it) => !it.startsWith('-'));
  const patterns = opt._.slice(patternsIndex);
  const argv = opt._.slice(0, patternsIndex);

  const server = await startServer(
    host,
    port,
    patterns,
    excludePatterns,
    {
      stdVersion,
      sanitizeOps,
      sanitizeResources,
    },
  );

  try {
    await denoTest(deno, `http://${host}:${port}/index.js`, argv);
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

main().catch((e) => {
  console.error('unexpected error:', e);
  process.exitCode = 1;
});
