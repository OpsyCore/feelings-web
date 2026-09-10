import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/*.test.ts'],exclude:['tests/browser/**'],environment:'node',passWithNoTests:false,reporters:['default'],testTimeout:15000}});
