const { readFileSync, writeFileSync } = require('fs')
const { resolve } = require('path')
const { build } = require('vite')
const dts = require('vite-plugin-dts')
const pkg = require(resolve(`package.json`))

main()

async function main() {
  await startBuild()

  await addMainPackageJson()
  await addMainReadMe()
}

async function startBuild() {
  await build({
    plugins: [
      dts.default({
        exclude: ['vite.config.ts', '**/__test__/**/*'],
      }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, `../src/index.ts`),
        name: 'index',
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        output: [
          {
            format: 'umd',
            name: 'index',
            assetFileNames: 'index.[ext]',
          },
          {
            format: 'es',
            name: 'index',
            assetFileNames: 'index.[ext]',
          },
        ],
      },
      outDir: resolve(__dirname, `../dist/`),
    },
  })
}

async function addMainPackageJson() {
  const dir = resolve(__dirname, '../dist')
  const fileName = resolve(dir, 'package.json')

  const data = {
    main: './index.umd.js',
    module: './index.es.js',
    types: './index.d.ts',
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    keywords: pkg.keywords,
    author: pkg.author,
    license: pkg.license,
    repository: pkg.repository,
    homepage: pkg.homepage,
  }

  writeFileSync(fileName, JSON.stringify(data, null, 2))
}

async function addMainReadMe() {
  const dir = resolve(__dirname, '../dist')
  const fileName = resolve(dir, 'README.md')

  writeFileSync(fileName, readFileSync(resolve(__dirname, '../README.md')))
}
