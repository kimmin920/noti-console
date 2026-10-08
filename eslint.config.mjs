import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextVitals,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.open-next/**',
      'out/**',
      'build/**',
      'coverage/**',
      // RUI is generated and validated in its source repository.
      'src/ui-kits/resend/**',
    ],
  },
];

export default eslintConfig;
