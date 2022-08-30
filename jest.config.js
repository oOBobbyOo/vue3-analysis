module.exports = {
  preset: 'ts-jest',
  globals: {
    __DEV__: true,
    __TEST__: true,
    __VERSION__: require('./package.json').version,
    __BROWSER__: false,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __NODE_JS__: true,
    __FEATURE_OPTIONS_API__: true,
    __FEATURE_SUSPENSE__: true,
    'ts-jest': {
      tsconfig: {
        target: 'esnext',
        sourceMap: true
      }
    }
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['packages/*/src/**/*.ts'],
  watchPathIgnorePatterns: ['/node_modules/', '/dist/', '/.git/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@vue/(.*?)$': '<rootDir>/packages/$1/src',
    vue: '<rootDir>/packages/vue/src'
  },
  rootDir: __dirname,
  testMatch: ['<rootDir>/packages/**/__tests__/**/*spec.[jt]s?(x)']
}
