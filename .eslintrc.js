module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [
    ".eslintrc.js",
    "**/*.spec.ts",
    "**/*.integration-spec.ts",
    "**/*.e2e-spec.ts",
  ],
  rules: {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "prettier/prettier": "off",

    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            target: "**/use-cases/tier-1-in-domain/**",
            from: [
              "**/use-cases/tier-1-in-domain/**",
              "**/use-cases/tier-2/**",
              "**/use-cases/tier-3/**",
              "**/use-cases/tier-4/**",
            ],
            message:
              "tier-1-in-domain cannot import from higher tier use-cases",
          },
          {
            target: "**/use-cases/tier-2/**",
            from: [
              "**/use-cases/tier-2/**",
              "**/use-cases/tier-3/**",
              "**/use-cases/tier-4/**",
            ],
            message: "tier-2 cannot import from higher tier use-cases",
          },
          {
            target: "**/use-cases/tier-3/**",
            from: ["**/use-cases/tier-3/**", "**/use-cases/tier-4/**"],
            message: "tier-3 cannot import from higher tier use-cases",
          },
          {
            target: "**/use-cases/tier-4/**",
            from: ["**/use-cases/tier-4/**"],
            message: "tier-4 cannot import from other tier-4 use-cases",
          },
        ],
      },
    ],
  },
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json",
      },
    },
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
  },
};
