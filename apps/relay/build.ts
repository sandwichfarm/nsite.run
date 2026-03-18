import * as esbuild from "npm:esbuild@^0.27.3";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";
import { builtinModules } from "node:module";

await Deno.mkdir("./dist", { recursive: true });

const allBuiltins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

const result = await esbuild.build({
  plugins: [
    ...denoPlugins({ configPath: new URL("./deno.json", import.meta.url).pathname }),
  ],
  entryPoints: ["./src/main.ts"],
  outfile: "./dist/relay.bundle.js",
  bundle: true,
  format: "esm",
  minify: true,
  external: allBuiltins,
  define: { "process.env.NODE_ENV": '"production"' },
  target: "esnext",
  banner: {
    js: 'import process from "node:process";import { Buffer } from "node:buffer";globalThis.process ??= process;globalThis.Buffer ??= Buffer;globalThis.global ??= globalThis;',
  },
});

await esbuild.stop();

const stat = await Deno.stat("./dist/relay.bundle.js");
console.log(`relay.bundle.js: ${(stat.size / 1024).toFixed(1)}KB`);
console.log("Build complete:", result);
