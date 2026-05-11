#!/usr/bin/env node
/**
 * Authentication Setup Script
 * 
 * This script handles secure authentication:
 * 1. Reads encrypted credentials from .env.encrypted or prompts user
 * 2. Logs into the application
 * 3. Saves authentication state (cookies/localStorage) to auth.json
 * 4. Tests reuse auth.json - MCP never sees credentials
 * 
 * Usage:
 *   npm run auth:setup          # Interactive login (opens browser)
 *   npm run auth:setup:headless # Headless login (uses env vars)
 *   npm run auth:clear          # Clear saved auth state
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// Configuration
const CONFIG = {
  authFile: './auth.json',
  envFile: './.env.encrypted',
  loginUrl: process.env.LOGIN_URL || 'http://localhost:3000/login',
  
  // Selectors - UPDATE THESE for your application
  selectors: {
    usernameInput: '#username',
    passwordInput: '#password',
    loginButton: 'button[type="submit"]',
    loggedInIndicator: '[data-testid="user-menu"]', // Element visible after login
  },
  
  // Encryption key from environment (set this securely)
  encryptionKey: process.env.AUTH_ENCRYPTION_KEY || '',
};

// ═══════════════════════════════════════════════════════════════
// ENCRYPTION UTILITIES
// ═══════════════════════════════════════════════════════════════

function encrypt(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText, key) {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ═══════════════════════════════════════════════════════════════
// CREDENTIAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function promptCredentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Username: ', (username) => {
      // Hide password input
      process.stdout.write('Password: ');
      let password = '';
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (char) => {
        char = char.toString();
        if (char === '\n' || char === '\r') {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          rl.close();
          resolve({ username, password });
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007F') {
          password = password.slice(0, -1);
        } else {
          password += char;
          process.stdout.write('*');
        }
      });
    });
  });
}

function getCredentialsFromEnv() {
  // Try encrypted file first
  if (fs.existsSync(CONFIG.envFile) && CONFIG.encryptionKey) {
    try {
      const encrypted = JSON.parse(fs.readFileSync(CONFIG.envFile, 'utf-8'));
      return {
        username: decrypt(encrypted.username, CONFIG.encryptionKey),
        password: decrypt(encrypted.password, CONFIG.encryptionKey),
      };
    } catch (e) {
      console.error('Failed to decrypt credentials:', e.message);
    }
  }
  
  // Fall back to environment variables
  if (process.env.TEST_USERNAME && process.env.TEST_PASSWORD) {
    return {
      username: process.env.TEST_USERNAME,
      password: process.env.TEST_PASSWORD,
    };
  }
  
  return null;
}

async function saveEncryptedCredentials(username, password) {
  if (!CONFIG.encryptionKey) {
    console.log('⚠️  No encryption key set. Credentials not saved.');
    console.log('   Set AUTH_ENCRYPTION_KEY environment variable to enable.');
    return;
  }
  
  const encrypted = {
    username: encrypt(username, CONFIG.encryptionKey),
    password: encrypt(password, CONFIG.encryptionKey),
  };
  
  fs.writeFileSync(CONFIG.envFile, JSON.stringify(encrypted, null, 2));
  console.log('✅ Encrypted credentials saved to', CONFIG.envFile);
}

// ═══════════════════════════════════════════════════════════════
// AUTH STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function setupAuthInteractive() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   INTERACTIVE AUTH SETUP');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('A browser will open. Please log in manually.\n');
  console.log('After logging in, press Enter in this terminal to save auth state.\n');
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto(CONFIG.loginUrl);
  
  // Wait for user to log in manually
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  await new Promise((resolve) => {
    rl.question('Press Enter after you have logged in successfully...', resolve);
    rl.close();
  });
  
  // Save auth state
  await context.storageState({ path: CONFIG.authFile });
  
  await browser.close();
  
  console.log('\n✅ Auth state saved to', CONFIG.authFile);
  console.log('   Tests will now use this saved auth state.\n');
}

async function setupAuthHeadless() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   HEADLESS AUTH SETUP');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Get credentials
  let credentials = getCredentialsFromEnv();
  
  if (!credentials) {
    console.log('No credentials found in environment.');
    console.log('Please enter credentials (they will be encrypted if key is set):\n');
    credentials = await promptCredentials();
    
    // Offer to save encrypted
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const save = await new Promise((resolve) => {
      rl.question('Save encrypted credentials for future use? (y/n): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
    
    if (save) {
      await saveEncryptedCredentials(credentials.username, credentials.password);
    }
  }
  
  console.log('\nLogging in...');
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto(CONFIG.loginUrl);
    
    // Fill login form
    await page.fill(CONFIG.selectors.usernameInput, credentials.username);
    await page.fill(CONFIG.selectors.passwordInput, credentials.password);
    await page.click(CONFIG.selectors.loginButton);
    
    // Wait for login to complete
    await page.waitForSelector(CONFIG.selectors.loggedInIndicator, { timeout: 30000 });
    
    // Save auth state
    await context.storageState({ path: CONFIG.authFile });
    
    console.log('\n✅ Login successful!');
    console.log('   Auth state saved to', CONFIG.authFile);
    
  } catch (error) {
    console.error('\n❌ Login failed:', error.message);
    console.log('\nTry interactive mode: npm run auth:setup');
  } finally {
    // Clear credentials from memory
    credentials.password = '';
    credentials = null;
    
    await browser.close();
  }
}

function clearAuth() {
  if (fs.existsSync(CONFIG.authFile)) {
    fs.unlinkSync(CONFIG.authFile);
    console.log('✅ Auth state cleared');
  } else {
    console.log('No auth state to clear');
  }
  
  if (fs.existsSync(CONFIG.envFile)) {
    fs.unlinkSync(CONFIG.envFile);
    console.log('✅ Encrypted credentials cleared');
  }
}

function checkAuth() {
  if (fs.existsSync(CONFIG.authFile)) {
    const stats = fs.statSync(CONFIG.authFile);
    const age = (Date.now() - stats.mtimeMs) / 1000 / 60 / 60; // hours
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   AUTH STATUS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('   ✅ Auth state exists:', CONFIG.authFile);
    console.log(`   📅 Age: ${age.toFixed(1)} hours`);
    
    if (age > 24) {
      console.log('   ⚠️  Auth state may be expired. Consider refreshing.');
    }
    
    console.log('\n');
  } else {
    console.log('\n❌ No auth state found. Run: npm run auth:setup\n');
  }
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const command = process.argv[2];

switch (command) {
  case 'interactive':
    setupAuthInteractive();
    break;
  case 'headless':
    setupAuthHeadless();
    break;
  case 'clear':
    clearAuth();
    break;
  case 'check':
    checkAuth();
    break;
  default:
    console.log(`
Auth Setup - Secure authentication for Playwright tests

Commands:
  npm run auth:setup           Interactive login (recommended)
  npm run auth:setup:headless  Headless login with credentials
  npm run auth:check           Check auth state
  npm run auth:clear           Clear saved auth state

Environment Variables:
  LOGIN_URL              Login page URL
  AUTH_ENCRYPTION_KEY    Key for encrypting credentials
  TEST_USERNAME          Username (for headless mode)
  TEST_PASSWORD          Password (for headless mode)

The auth state (cookies/session) is saved to auth.json.
Tests and MCP use this file - they never see your credentials.
`);
}
