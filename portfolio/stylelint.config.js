/** @type {import('stylelint').Config} */
const config = {
  plugins: ['stylelint-scss', '@stylistic/stylelint-plugin'],
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-config-recess-order',
    'stylelint-config-prettier-scss',
  ],
  customSyntax: 'postcss-scss',
  rules: {
    // ── Color ────────────────────────────────────────────────────────────────
    'color-function-notation': 'modern',
    'color-hex-length': 'long',
    'alpha-value-notation': 'number',

    // ── Font ─────────────────────────────────────────────────────────────────
    'font-weight-notation': 'numeric',

    // ── Number ───────────────────────────────────────────────────────────────
    'number-max-precision': 5,

    // ── Value ────────────────────────────────────────────────────────────────
    'value-no-vendor-prefix': true,

    // ── Property ─────────────────────────────────────────────────────────────
    'property-no-vendor-prefix': [
      true,
      {
        ignoreProperties: ['font-smoothing', 'osx-font-smoothing', 'text-size-adjust'],
      },
    ],

    // ── Declaration ──────────────────────────────────────────────────────────
    'declaration-block-no-duplicate-properties': true,
    'declaration-no-important': true,

    // ── Block ────────────────────────────────────────────────────────────────
    'block-no-empty': true,

    // ── Selector ─────────────────────────────────────────────────────────────
    'selector-max-id': 0,
    'selector-no-vendor-prefix': true,
    'selector-max-specificity': '0,4,2',
    // CSS Modules use camelCase class names — disable class pattern enforcement
    'selector-class-pattern': null,

    // ── Max / nesting ────────────────────────────────────────────────────────
    'max-nesting-depth': 4,

    // ── SCSS specific ────────────────────────────────────────────────────────
    'scss/dollar-variable-pattern': /^[a-z][a-z0-9-]*$/,
    'scss/at-mixin-pattern': /^[a-z][a-z0-9-]*$/,
    'scss/no-duplicate-dollar-variables': [true, { ignoreInsideAtRules: ['if', 'each', 'for'] }],
    'scss/at-rule-no-unknown': true,
    'scss/comment-no-empty': true,
    'scss/no-global-function-names': true,

    // Renamed/removed in stylelint-scss v6+ — disable to avoid "unknown rule" error
    'import-notation': null,

    // ── CSS Modules compatibility ─────────────────────────────────────────────
    // Allow :global and :local pseudo-classes used in CSS Modules
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global', 'local'] }],
    // Allow `composes` property used in CSS Modules
    'property-no-unknown': [true, { ignoreProperties: ['composes'] }],

    // ── Stylistic (kept minimal — prettier handles formatting) ────────────────
    '@stylistic/indentation': 4,
    '@stylistic/string-quotes': 'double',
  },
  overrides: [
    {
      // globals.scss uses vendor-prefixed scrollbar selectors and webkit font-smoothing
      files: ['styles/globals.scss'],
      rules: {
        'selector-no-vendor-prefix': null,
        'selector-pseudo-element-no-unknown': null,
        'property-no-vendor-prefix': null,
        'value-no-vendor-prefix': null,
        'declaration-no-important': null,
      },
    },
    {
      // Variables file — allow non-BEM patterns freely
      files: ['styles/_variables.scss'],
      rules: {
        'scss/dollar-variable-pattern': null,
      },
    },
  ],
};

export default config;
