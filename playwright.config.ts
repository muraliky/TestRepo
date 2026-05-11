import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  // Timeout for each test
  timeout: 60000,
  
  // Timeout for expect assertions
  expect: {
    timeout: 10000,
  },
  
  // Retry failed tests
  retries: process.env.CI ? 2 : 0,
  
  // Parallel workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for page.goto()
    baseURL: process.env.BASE_URL || 'https://example.com',
    
    // Collect trace on first retry
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on retry
    video: 'on-first-retry',
    
    // Headless mode (can be overridden)
    headless: process.env.HEADED !== 'true',
    
    // Storage state (authentication)
    storageState: './auth.json',
  },
  
  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
