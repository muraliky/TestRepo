#!/usr/bin/env node
/**
 * Chain of Verification (CoVe) - STRICT Migration Validation
 * 
 * Strictly verifies BOTH pages and steps migration.
 * 
 * USAGE:
 *   npm run verify              - Run full CoVe
 *   npm run verify:file <path>  - Verify single file
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  pagesOut: './src/pages',
  stepsOut: './src/steps',
  reportFile: './cove-report.json',
  pendingFile: './pending-methods.json',
  sourceDir: './_source-java',
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getAllFiles(dir, extension) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extension));
    } else if (item.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// STRICT JAVA SYNTAX CHECK (Common for both pages and steps)
// ═══════════════════════════════════════════════════════════════

function checkNoJavaSyntax(content, fileType) {
  const issues = [];
  
  const javaPatterns = [
    // Java keywords
    { pattern: /\bpublic\s+void\b/, msg: 'Java: public void' },
    { pattern: /\bprivate\s+void\b/, msg: 'Java: private void' },
    { pattern: /\bpublic\s+static\b/, msg: 'Java: public static' },
    { pattern: /\bprivate\s+static\b/, msg: 'Java: private static' },
    
    // Selenium/WebDriver
    { pattern: /\bWebElement\b/, msg: 'Selenium: WebElement' },
    { pattern: /\bWebDriver\b/, msg: 'Selenium: WebDriver' },
    { pattern: /@FindBy/, msg: 'Selenium: @FindBy annotation' },
    { pattern: /\bBy\.xpath\s*\(/, msg: 'Selenium: By.xpath()' },
    { pattern: /\bBy\.id\s*\(/, msg: 'Selenium: By.id()' },
    { pattern: /\bBy\.name\s*\(/, msg: 'Selenium: By.name()' },
    { pattern: /\bBy\.className\s*\(/, msg: 'Selenium: By.className()' },
    { pattern: /\bBy\.cssSelector\s*\(/, msg: 'Selenium: By.cssSelector()' },
    { pattern: /\bBy\.linkText\s*\(/, msg: 'Selenium: By.linkText()' },
    { pattern: /\bBy\.tagName\s*\(/, msg: 'Selenium: By.tagName()' },
    
    // Selenium methods
    { pattern: /\.sendKeys\s*\(/, msg: 'Selenium: .sendKeys() → use .fill()' },
    { pattern: /\.getText\s*\(\)/, msg: 'Selenium: .getText() → use .textContent()' },
    { pattern: /\.isDisplayed\s*\(\)/, msg: 'Selenium: .isDisplayed() → use .isVisible()' },
    { pattern: /\.findElement\s*\(/, msg: 'Selenium: .findElement()' },
    { pattern: /\.findElements\s*\(/, msg: 'Selenium: .findElements()' },
    
    // Java driver
    { pattern: /\bdriver\.get\s*\(/, msg: 'Java: driver.get() → use page.goto()' },
    { pattern: /\bdriver\.navigate\s*\(/, msg: 'Java: driver.navigate()' },
    { pattern: /\bdriver\.findElement/, msg: 'Java: driver.findElement' },
    { pattern: /\bdriver\.getCurrentUrl/, msg: 'Java: driver.getCurrentUrl → use page.url()' },
    { pattern: /\bdriver\.getTitle/, msg: 'Java: driver.getTitle → use page.title()' },
    
    // Java wait/sleep
    { pattern: /Thread\.sleep/, msg: 'Java: Thread.sleep → use page.waitForTimeout()' },
    { pattern: /\bWebDriverWait\b/, msg: 'Java: WebDriverWait' },
    { pattern: /\bExpectedConditions\b/, msg: 'Java: ExpectedConditions' },
    
    // Java Cucumber annotations
    { pattern: /@Given\s*\(/, msg: 'Java: @Given annotation' },
    { pattern: /@When\s*\(/, msg: 'Java: @When annotation' },
    { pattern: /@Then\s*\(/, msg: 'Java: @Then annotation' },
    { pattern: /@And\s*\(/, msg: 'Java: @And annotation' },
    { pattern: /@But\s*\(/, msg: 'Java: @But annotation' },
    
    // Java types
    { pattern: /\bString\s+\w+\s*=/, msg: 'Java: String declaration → use const/let' },
    { pattern: /\bint\s+\w+\s*=/, msg: 'Java: int declaration → use let/const' },
    { pattern: /\bboolean\s+\w+\s*=/, msg: 'Java: boolean declaration → use let/const' },
    { pattern: /\bList</, msg: 'Java: List<> → use array []' },
    { pattern: /\bMap</, msg: 'Java: Map<> → use object {}' },
    
    // Java methods
    { pattern: /\.size\s*\(\)/, msg: 'Java: .size() → use .length' },
    { pattern: /\.equals\s*\(/, msg: 'Java: .equals() → use ===' },
    { pattern: /\.contains\s*\(/, msg: 'Java: .contains() → use .includes()' },
    { pattern: /\.isEmpty\s*\(\)/, msg: 'Java: .isEmpty() → use .length === 0' },
    
    // Java assertions
    { pattern: /\bAssert\.\w+/, msg: 'Java: Assert.* → use expect()' },
    { pattern: /\bassertTrue\s*\(/, msg: 'Java: assertTrue → use expect().toBeTruthy()' },
    { pattern: /\bassertEquals\s*\(/, msg: 'Java: assertEquals → use expect().toBe()' },
  ];
  
  for (const jp of javaPatterns) {
    if (jp.pattern.test(content)) {
      // Find line number
      const lines = content.split('\n');
      let lineNum = 0;
      for (let i = 0; i < lines.length; i++) {
        if (jp.pattern.test(lines[i]) && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('*')) {
          lineNum = i + 1;
          break;
        }
      }
      issues.push({ 
        severity: 'error', 
        message: jp.msg,
        line: lineNum
      });
    }
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// STRICT PAGE CHECKS
// ═══════════════════════════════════════════════════════════════

function checkPageStructure(content, fileName) {
  const issues = [];
  
  // Must have export class
  if (!/export\s+class\s+\w+/.test(content)) {
    issues.push({ severity: 'error', message: 'Missing: export class' });
  }
  
  // Must have Page import
  if (!/import.*Page.*from\s*['"]@playwright\/test['"]/.test(content) &&
      !/import.*{[^}]*Page[^}]*}.*from/.test(content)) {
    issues.push({ severity: 'error', message: 'Missing: Page import from @playwright/test' });
  }
  
  // Must have constructor with Page
  if (!/constructor\s*\([^)]*page\s*:\s*Page/.test(content)) {
    issues.push({ severity: 'error', message: 'Missing: constructor(page: Page)' });
  }
  
  // Must have page property
  if (!/page\s*:\s*Page/.test(content)) {
    issues.push({ severity: 'error', message: 'Missing: page property' });
  }
  
  // Locators should use Playwright locator
  if (!/Locator/.test(content) && /readonly\s+\w+/.test(content)) {
    issues.push({ severity: 'warning', message: 'Locators should be typed as Locator' });
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// STRICT STEP CHECKS
// ═══════════════════════════════════════════════════════════════

function checkStepStructure(content, fileName) {
  const issues = [];
  
  // Must have BDD imports from fixtures
  if (!/import\s*{[^}]*(Given|When|Then)[^}]*}\s*from\s*['"][^'"]*fixtures['"]/.test(content)) {
    issues.push({ severity: 'error', message: 'Missing: Given/When/Then import from fixtures' });
  }
  
  // Check step definitions exist
  const stepPattern = /(Given|When|Then)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const steps = [];
  let match;
  while ((match = stepPattern.exec(content))) {
    steps.push({ keyword: match[1], text: match[2] });
  }
  
  if (steps.length === 0) {
    issues.push({ severity: 'error', message: 'No step definitions found' });
  }
  
  // Steps should have async callback
  const asyncSteps = (content.match(/(Given|When|Then)\s*\([^,]+,\s*async/g) || []).length;
  const totalSteps = (content.match(/(Given|When|Then)\s*\(/g) || []).length;
  
  if (asyncSteps < totalSteps) {
    issues.push({ severity: 'error', message: `${totalSteps - asyncSteps} step(s) missing async callback` });
  }
  
  // Check for fixture destructuring
  if (!/{\s*\w+/.test(content.match(/(Given|When|Then)\s*\([^,]+,\s*async\s*\(\s*{[^}]+}/)?.[0] || '')) {
    // Not a strict error, just informational
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// COUNT MATCHING CHECK - PAGES
// ═══════════════════════════════════════════════════════════════

function checkPageCountMatch(tsFilePath, tsContent) {
  const issues = [];
  
  // Try to find corresponding Java file
  const fileName = path.basename(tsFilePath, '.page.ts');
  
  // Check pending-methods.json first
  let expectedMethods = 0;
  let expectedLocators = 0;
  
  if (fs.existsSync(CONFIG.pendingFile)) {
    try {
      const pending = JSON.parse(fs.readFileSync(CONFIG.pendingFile, 'utf-8'));
      const pageKey = Object.keys(pending.pages || {}).find(k => 
        k.toLowerCase().includes(fileName.toLowerCase()) || 
        fileName.toLowerCase().includes(k.replace('.page.ts', '').toLowerCase())
      );
      if (pageKey && pending.pages[pageKey]) {
        expectedMethods = pending.pages[pageKey].length;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Count locators in TypeScript
  const tsLocators = (tsContent.match(/readonly\s+\w+\s*:\s*Locator/g) || []).length;
  
  // Count methods in TypeScript (async methods that are not constructor)
  const tsMethods = (tsContent.match(/async\s+\w+\s*\([^)]*\)\s*:\s*Promise/g) || []).length;
  
  // Try to find and count from Java source
  const sourceMatch = tsContent.match(/@source\s+([^\n\r]+)/);
  if (sourceMatch) {
    const javaPath = sourceMatch[1].trim();
    if (fs.existsSync(javaPath)) {
      const javaContent = fs.readFileSync(javaPath, 'utf-8');
      
      // Count Java locators
      const javaLocators = (javaContent.match(/@FindBy|By\.\w+\s*\(|private\s+WebElement|public\s+WebElement/g) || []).length;
      
      // Count Java methods (excluding constructor and getters/setters)
      const javaClass = javaContent.match(/class\s+(\w+)/)?.[1] || '';
      const javaMethods = (javaContent.match(/public\s+\w+\s+(\w+)\s*\(/g) || [])
        .filter(m => !m.includes(javaClass) && !m.includes('get') && !m.includes('set')).length;
      
      if (javaLocators > 0) {
        expectedLocators = javaLocators;
      }
      if (javaMethods > 0) {
        expectedMethods = javaMethods;
      }
    }
  }
  
  // Report mismatches
  if (expectedLocators > 0 && tsLocators !== expectedLocators) {
    const diff = expectedLocators - tsLocators;
    if (diff > 0) {
      issues.push({ 
        severity: 'error', 
        message: `Locators: Expected ${expectedLocators}, Found ${tsLocators} (${diff} MISSING)` 
      });
    } else {
      issues.push({ 
        severity: 'warning', 
        message: `Locators: Expected ${expectedLocators}, Found ${tsLocators} (${Math.abs(diff)} extra)` 
      });
    }
  }
  
  if (expectedMethods > 0 && tsMethods !== expectedMethods) {
    const diff = expectedMethods - tsMethods;
    if (diff > 0) {
      issues.push({ 
        severity: 'error', 
        message: `Methods: Expected ${expectedMethods}, Found ${tsMethods} (${diff} MISSING)` 
      });
    } else {
      issues.push({ 
        severity: 'warning', 
        message: `Methods: Expected ${expectedMethods}, Found ${tsMethods} (${Math.abs(diff)} extra)` 
      });
    }
  }
  
  // If we found counts, report them
  if (expectedLocators === 0 && expectedMethods === 0) {
    // No source data, just report what we found
    issues.push({ 
      severity: 'info', 
      message: `Found: ${tsLocators} locator(s), ${tsMethods} method(s)` 
    });
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// COUNT MATCHING CHECK - STEPS
// ═══════════════════════════════════════════════════════════════

function checkStepCountMatch(tsFilePath, tsContent) {
  const issues = [];
  
  const fileName = path.basename(tsFilePath, '.steps.ts');
  
  // Check pending-methods.json first
  let expectedSteps = 0;
  
  if (fs.existsSync(CONFIG.pendingFile)) {
    try {
      const pending = JSON.parse(fs.readFileSync(CONFIG.pendingFile, 'utf-8'));
      const stepKey = Object.keys(pending.steps || {}).find(k => 
        k.toLowerCase().includes(fileName.toLowerCase()) || 
        fileName.toLowerCase().includes(k.replace('.steps.ts', '').toLowerCase())
      );
      if (stepKey && pending.steps[stepKey]) {
        expectedSteps = pending.steps[stepKey].length;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Count steps in TypeScript
  const tsSteps = (tsContent.match(/(Given|When|Then)\s*\(\s*['"`]/g) || []).length;
  
  // Try to find and count from Java source
  const sourceMatch = tsContent.match(/@source\s+([^\n\r]+)/);
  if (sourceMatch) {
    const javaPath = sourceMatch[1].trim();
    if (fs.existsSync(javaPath)) {
      const javaContent = fs.readFileSync(javaPath, 'utf-8');
      
      // Count Java step definitions
      const javaSteps = (javaContent.match(/@(Given|When|Then|And|But)\s*\(/g) || []).length;
      
      if (javaSteps > 0) {
        expectedSteps = javaSteps;
      }
    }
  }
  
  // Report mismatches
  if (expectedSteps > 0 && tsSteps !== expectedSteps) {
    const diff = expectedSteps - tsSteps;
    if (diff > 0) {
      issues.push({ 
        severity: 'error', 
        message: `Steps: Expected ${expectedSteps}, Found ${tsSteps} (${diff} MISSING)` 
      });
    } else {
      issues.push({ 
        severity: 'warning', 
        message: `Steps: Expected ${expectedSteps}, Found ${tsSteps} (${Math.abs(diff)} extra)` 
      });
    }
  }
  
  // If we found counts, report them
  if (expectedSteps === 0) {
    issues.push({ 
      severity: 'info', 
      message: `Found: ${tsSteps} step definition(s)` 
    });
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// STRICT IMPLEMENTATION CHECK
// ═══════════════════════════════════════════════════════════════

function checkImplementation(content, fileType) {
  const issues = [];
  
  // Check for TODO/not implemented markers
  const todoMatches = content.match(/throw\s+new\s+Error\s*\(\s*['"`](Method|Step).*not\s+implemented/g) || [];
  if (todoMatches.length > 0) {
    issues.push({ 
      severity: 'error', 
      message: `${todoMatches.length} method(s)/step(s) NOT implemented`,
    });
  }
  
  // Check for TODO comments
  const todoComments = content.match(/\/\/\s*TODO:/gi) || [];
  if (todoComments.length > 0) {
    issues.push({ 
      severity: 'warning', 
      message: `${todoComments.length} TODO comment(s) remaining`,
    });
  }
  
  // Check for Original Java comments still present
  const originalJava = content.match(/\/\/\s*Original\s*Java:/gi) || [];
  if (originalJava.length > 0) {
    issues.push({ 
      severity: 'warning', 
      message: `${originalJava.length} "Original Java" comment(s) not cleaned up`,
    });
  }
  
  // Check for await on Playwright methods
  const lines = content.split('\n');
  const playwrightMethods = [
    'click(', 'fill(', 'clear(', 'hover(', 'focus(', 
    'press(', 'selectOption(', 'check(', 'uncheck(', 
    'waitFor(', 'goto(', 'reload(', 'goBack(', 'goForward(',
    'textContent(', 'innerText(', 'getAttribute(',
    'isVisible(', 'isEnabled(', 'isChecked(',
    'scrollIntoViewIfNeeded(', 'dblclick(', 'type(',
    'screenshot(', 'evaluate(', 'waitForSelector(',
    'waitForTimeout(', 'waitForLoadState(', 'waitForURL(',
  ];
  
  let missingAwaits = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    
    for (const method of playwrightMethods) {
      if (line.includes('.' + method) && 
          !line.includes('await ') && 
          !line.includes('await(') &&
          !line.includes('return await') &&
          !trimmed.startsWith('//')) {
        missingAwaits.push({ line: idx + 1, method });
      }
    }
  });
  
  if (missingAwaits.length > 0) {
    issues.push({ 
      severity: 'error', 
      message: `${missingAwaits.length} missing await(s): lines ${missingAwaits.slice(0,3).map(m => m.line).join(', ')}${missingAwaits.length > 3 ? '...' : ''}`,
    });
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// BOILERPLATE/PLACEHOLDER DETECTION
// ═══════════════════════════════════════════════════════════════

function checkBoilerplate(content, fileType) {
  const issues = [];
  
  // Extract step/method bodies for analysis
  const bodies = extractBodies(content, fileType);
  let boilerplateOnlyCount = 0;
  const boilerplateSteps = [];
  
  for (const item of bodies) {
    if (isBoilerplateOnly(item.body)) {
      boilerplateOnlyCount++;
      boilerplateSteps.push(item.name);
    }
  }
  
  if (boilerplateOnlyCount > 0) {
    const examples = boilerplateSteps.slice(0, 3).join(', ');
    issues.push({
      severity: 'error',
      message: `${boilerplateOnlyCount} step(s)/method(s) have ONLY boilerplate code: ${examples}${boilerplateSteps.length > 3 ? '...' : ''}`
    });
  }
  
  // Check for empty bodies
  let emptyCount = 0;
  for (const item of bodies) {
    const cleaned = item.body.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!cleaned || cleaned === '{}') {
      emptyCount++;
    }
  }
  
  if (emptyCount > 0) {
    issues.push({
      severity: 'error',
      message: `${emptyCount} empty step(s)/method(s) - no implementation`
    });
  }
  
  return issues;
}

/**
 * Extract step/method bodies for analysis
 */
function extractBodies(content, fileType) {
  const bodies = [];
  
  if (fileType === 'step') {
    // Extract step definition bodies
    const stepRegex = /(Given|When|Then)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g;
    let match;
    while ((match = stepRegex.exec(content))) {
      bodies.push({ 
        name: match[2].substring(0, 40) + (match[2].length > 40 ? '...' : ''),
        body: match[3].trim() 
      });
    }
  } else {
    // Extract method bodies for pages
    const methodRegex = /async\s+(\w+)\s*\([^)]*\)\s*(?::\s*Promise<[^>]+>)?\s*\{([\s\S]*?)\n\s{2}\}/g;
    let match;
    while ((match = methodRegex.exec(content))) {
      bodies.push({ 
        name: match[1],
        body: match[2].trim() 
      });
    }
  }
  
  return bodies;
}

/**
 * Check if a body contains only boilerplate code (no actual implementation)
 */
function isBoilerplateOnly(body) {
  if (!body || body.length === 0) return true;
  
  // Remove comments
  const withoutComments = body
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  
  if (!withoutComments) return true;
  
  // Boilerplate-only patterns (these alone don't constitute real implementation)
  const boilerplatePatterns = [
    /^await\s+page\.waitForLoadState\s*\(\s*['"`]\w+['"`]\s*\)\s*;?$/,
    /^await\s+page\.waitForTimeout\s*\(\s*\d+\s*\)\s*;?$/,
    /^await\s+page\.waitForSelector\s*\([^)]+\)\s*;?$/,
    /^await\s+page\.waitForNavigation\s*\([^)]*\)\s*;?$/,
    /^await\s+page\.waitForURL\s*\([^)]+\)\s*;?$/,
    /^console\.log\s*\([^)]*\)\s*;?$/,
    /^await\s+Promise\.resolve\s*\(\s*\)\s*;?$/,
    /^return\s*;?$/,
    /^\/\/.*$/,
    /^\s*$/,
  ];
  
  // Split into statements
  const statements = withoutComments
    .split(/;|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  if (statements.length === 0) return true;
  
  // Check if ALL statements are boilerplate
  const allBoilerplate = statements.every(stmt => {
    return boilerplatePatterns.some(pattern => pattern.test(stmt));
  });
  
  return allBoilerplate;
}

// ═══════════════════════════════════════════════════════════════
// STRICT SYNTAX CHECK
// ═══════════════════════════════════════════════════════════════

function checkSyntax(content) {
  const issues = [];
  
  // Balanced braces
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    issues.push({ severity: 'error', message: `Unbalanced braces: {=${openBraces}, }=${closeBraces}` });
  }
  
  // Balanced parentheses
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push({ severity: 'error', message: `Unbalanced parentheses: (=${openParens}, )=${closeParens}` });
  }
  
  // Double keywords
  if (/async\s+async/.test(content)) {
    issues.push({ severity: 'error', message: 'Double async keyword' });
  }
  if (/await\s+await/.test(content)) {
    issues.push({ severity: 'error', message: 'Double await keyword' });
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════════
// VERIFY SINGLE FILE
// ═══════════════════════════════════════════════════════════════

function verifyFile(filePath, silent = false) {
  const fileName = path.basename(filePath);
  
  if (!fs.existsSync(filePath)) {
    if (!silent) console.log(`   ❌ ${fileName} - File not found`);
    return { passed: false, file: fileName, error: 'File not found', checks: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const isPage = filePath.includes('.page.ts');
  const isStep = filePath.includes('.steps.ts');
  const fileType = isPage ? 'page' : 'step';
  
  if (!silent) console.log(`\n   📄 ${fileName}`);
  
  // Run all checks
  const checks = [];
  
  // Check 1: No Java Syntax
  const javaSyntaxIssues = checkNoJavaSyntax(content, fileType);
  checks.push({
    name: 'No Java Syntax',
    passed: !javaSyntaxIssues.some(i => i.severity === 'error'),
    issues: javaSyntaxIssues,
  });
  
  // Check 2: Structure (different for pages vs steps)
  if (isPage) {
    const structureIssues = checkPageStructure(content, fileName);
    checks.push({
      name: 'Page Structure',
      passed: !structureIssues.some(i => i.severity === 'error'),
      issues: structureIssues,
    });
  } else if (isStep) {
    const structureIssues = checkStepStructure(content, fileName);
    checks.push({
      name: 'Step Structure',
      passed: !structureIssues.some(i => i.severity === 'error'),
      issues: structureIssues,
    });
  }
  
  // Check 3: Count Match (locators/methods for pages, steps for steps)
  if (isPage) {
    const countIssues = checkPageCountMatch(filePath, content);
    checks.push({
      name: 'Count Match',
      passed: !countIssues.some(i => i.severity === 'error'),
      issues: countIssues,
    });
  } else if (isStep) {
    const countIssues = checkStepCountMatch(filePath, content);
    checks.push({
      name: 'Count Match',
      passed: !countIssues.some(i => i.severity === 'error'),
      issues: countIssues,
    });
  }
  
  // Check 4: Implementation
  const implIssues = checkImplementation(content, fileType);
  checks.push({
    name: 'Implementation',
    passed: !implIssues.some(i => i.severity === 'error'),
    issues: implIssues,
  });
  
  // Check 5: Boilerplate Detection
  const boilerplateIssues = checkBoilerplate(content, fileType);
  checks.push({
    name: 'No Boilerplate',
    passed: !boilerplateIssues.some(i => i.severity === 'error'),
    issues: boilerplateIssues,
  });
  
  // Check 6: Syntax
  const syntaxIssues = checkSyntax(content);
  checks.push({
    name: 'Syntax',
    passed: !syntaxIssues.some(i => i.severity === 'error'),
    issues: syntaxIssues,
  });
  
  // Print results
  if (!silent) {
    for (const check of checks) {
      const icon = check.passed ? '✓' : '✗';
      console.log(`      ├─ ${check.name}: ${icon}`);
      
      // Show errors
      for (const issue of check.issues.filter(i => i.severity === 'error')) {
        console.log(`      │  └─ ❌ ${issue.message}${issue.line ? ` (line ${issue.line})` : ''}`);
      }
      // Show warnings
      for (const issue of check.issues.filter(i => i.severity === 'warning')) {
        console.log(`      │  └─ ⚠️  ${issue.message}`);
      }
      // Show info (for count match)
      for (const issue of check.issues.filter(i => i.severity === 'info')) {
        console.log(`      │  └─ ℹ️  ${issue.message}`);
      }
    }
  }
  
  const hasError = checks.some(c => !c.passed);
  const warningCount = checks.reduce((sum, c) => 
    sum + c.issues.filter(i => i.severity === 'warning').length, 0);
  const errorCount = checks.reduce((sum, c) => 
    sum + c.issues.filter(i => i.severity === 'error').length, 0);
  
  if (!silent) {
    if (!hasError && warningCount === 0) {
      console.log('      └─ ✅ PASSED');
    } else if (!hasError) {
      console.log(`      └─ ⚠️  PASSED (${warningCount} warning${warningCount > 1 ? 's' : ''})`);
    } else {
      console.log(`      └─ ❌ FAILED (${errorCount} error${errorCount > 1 ? 's' : ''})`);
    }
  }
  
  return {
    passed: !hasError,
    file: fileName,
    checks,
    errorCount,
    warningCount,
  };
}

// ═══════════════════════════════════════════════════════════════
// VERIFY ALL FILES
// ═══════════════════════════════════════════════════════════════

function verifyAll() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   CoVe - STRICT Chain of Verification');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const results = {
    pages: { total: 0, passed: 0, failed: 0, errors: 0, warnings: 0 },
    steps: { total: 0, passed: 0, failed: 0, errors: 0, warnings: 0 },
    files: [],
  };
  
  // Verify Pages
  console.log('\n📄 PAGES:');
  const pageFiles = getAllFiles(CONFIG.pagesOut, '.page.ts');
  
  if (pageFiles.length === 0) {
    console.log('   No page files found');
  } else {
    for (const file of pageFiles) {
      const result = verifyFile(file);
      results.files.push(result);
      results.pages.total++;
      if (result.passed) {
        results.pages.passed++;
      } else {
        results.pages.failed++;
      }
      results.pages.errors += result.errorCount || 0;
      results.pages.warnings += result.warningCount || 0;
    }
  }
  
  // Verify Steps
  console.log('\n📝 STEPS:');
  const stepFiles = getAllFiles(CONFIG.stepsOut, '.steps.ts');
  
  if (stepFiles.length === 0) {
    console.log('   No step files found');
  } else {
    for (const file of stepFiles) {
      const result = verifyFile(file);
      results.files.push(result);
      results.steps.total++;
      if (result.passed) {
        results.steps.passed++;
      } else {
        results.steps.failed++;
      }
      results.steps.errors += result.errorCount || 0;
      results.steps.warnings += result.warningCount || 0;
    }
  }
  
  // Summary
  const totalPassed = results.pages.passed + results.steps.passed;
  const totalFailed = results.pages.failed + results.steps.failed;
  const totalFiles = results.pages.total + results.steps.total;
  const totalErrors = results.pages.errors + results.steps.errors;
  const totalWarnings = results.pages.warnings + results.steps.warnings;
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
   Pages:    ${results.pages.passed}/${results.pages.total} passed ${results.pages.failed > 0 ? `(${results.pages.failed} failed)` : '✅'}
   Steps:    ${results.steps.passed}/${results.steps.total} passed ${results.steps.failed > 0 ? `(${results.steps.failed} failed)` : '✅'}
   ─────────────────────────────────────────
   Total:    ${totalPassed}/${totalFiles} passed
   Errors:   ${totalErrors}
   Warnings: ${totalWarnings}
`);
  
  if (totalFailed === 0) {
    console.log('   ✅ ALL CHECKS PASSED');
  } else {
    console.log('   ❌ VERIFICATION FAILED');
    console.log('\n   Failed files:');
    for (const file of results.files.filter(f => !f.passed)) {
      console.log(`   - ${file.file}`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  // Save report
  fs.writeFileSync(CONFIG.reportFile, JSON.stringify(results, null, 2));
  console.log(`   Report saved: ${CONFIG.reportFile}\n`);
  
  // Exit with error if any failed
  process.exit(totalFailed > 0 ? 1 : 0);
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args[0] === 'file' && args[1]) {
  const result = verifyFile(args[1]);
  process.exit(result.passed ? 0 : 1);
} else if (args[0] === 'help' || args[0] === '--help') {
  console.log(`
CoVe - STRICT Chain of Verification

Usage:
  npm run verify              Run full verification
  npm run verify:file <path>  Verify single file

Checks performed:
  1. No Java Syntax     - Ensures no Selenium/Java code remains
  2. Page Structure     - Validates page object structure (for pages)
  3. Step Structure     - Validates step definition structure (for steps)
  4. Implementation     - Checks for unimplemented methods/steps
  5. Syntax             - Validates TypeScript syntax

Exit codes:
  0 = All passed
  1 = Some failed
`);
} else {
  verifyAll();
}
