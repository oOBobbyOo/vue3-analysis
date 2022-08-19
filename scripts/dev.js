const { build } = require('esbuild')
const nodePolyfills = require('@esbuild-plugins/node-modules-polyfill')
const { resolve, relative } = require('path')

const args = require('minimist')(process.argv.slice(2))
const target = args._[0] || 'vue'
const format = args.f || 'global'
const pkg = require(resolve(__dirname, `../packages/${target}/package.json`))

// resolve output
const outputFormat = format.startsWith('global') ? 'iife' : format === 'cjs' ? 'cjs' : 'esm'

const postfix = format.endsWith('-runtime') ? `runtime.${format.replace(/-runtime$/, '')}` : format

const outfile = resolve(
  __dirname,
  `../packages/${target}/dist/${target === 'vue-compat' ? `vue` : target}.${postfix}.js`
)

const relativeOutfile = relative(process.cwd(), outfile)

build({
  entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
  outfile,
  bundle: true,
  sourcemap: true,
  format: outputFormat,
  globalName: pkg.buildOptions?.name,
  platform: format === 'cjs' ? 'node' : 'browser',
  plugins:
    format === 'cjs' || pkg.buildOptions?.enableNonBrowserBranches
      ? [nodePolyfills.default()]
      : undefined,

  watch: {
    onRebuild(error) {
      if (!error) console.log(`rebuilt: ${relativeOutfile}`)
    }
  }
}).then(() => {
  console.log(`watching: ${relativeOutfile}`)
})
