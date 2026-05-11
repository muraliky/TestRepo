// cucumber.js - Cucumber configuration
export default {
  // Feature file locations
  paths: ['features/**/*.feature'],
  
  // Step definition locations
  require: [
    'src/support/**/*.ts',
    'src/steps/**/*.ts'
  ],
  
  // Use ts-node for TypeScript
  requireModule: ['ts-node/register'],
  
  // Formatters
  format: [
    'progress-bar',
    'html:reports/cucumber-report.html',
    'json:reports/cucumber-report.json'
  ],
  
  // Parallel execution
  parallel: 1,  // Set to number of workers for parallel
  
  // Tags to run (override with --tags)
  // tags: '@smoke',
  
  // Fail fast
  failFast: false,
  
  // Strict mode (fail on undefined/pending steps)
  strict: true,
  
  // Publish reports (optional)
  publishQuiet: true,
};
