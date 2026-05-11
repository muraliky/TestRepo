#!/usr/bin/env node

/**
 * Selenium to Playwright + Cucumber Migration Script
 * 
 * Scans entire source Java repository and generates TypeScript skeletons.
 * Handles: Pages, Steps, Features, Utils, Helpers, Config, and more.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Source: Your entire Java repo goes here
  sourceDir: path.join(ROOT, '_source-java'),
  
  // Output directories
  output: {
    pages: path.join(ROOT, 'src/pages'),
    steps: path.join(ROOT, 'src/steps'),
    utils: path.join(ROOT, 'src/utils'),
    helpers: path.join(ROOT, 'src/helpers'),
    config: path.join(ROOT, 'src/config'),
    support: path.join(ROOT, 'src/support'),
    features: path.join(ROOT, 'features'),
  },
  
  // Progress tracking
  progressFile: path.join(ROOT, 'migration-progress.json'),
  
  // File classification patterns
  patterns: {
    page: /Page\.java$/i,
    steps: /(Steps?|StepDef(inition)?s?)\.java$/i,
    feature: /\.feature$/i,
    utils: /(Utils?|Utility|Utilities)\.java$/i,
    helper: /(Helper|Helpers)\.java$/i,
    config: /(Config|Configuration|Settings|Properties)\.java$/i,
    testBase: /(TestBase|BaseTest|AbstractTest|TestSetup)\.java$/i,
    hooks: /(Hooks?|CucumberHooks)\.java$/i,
  },
  
  // Directories to skip
  skipDirs: ['node_modules', '.git', 'target', 'build', 'out', '.idea', '.vscode'],
  
  // Files to skip
  skipFiles: ['.DS_Store', 'Thumbs.db'],
};

// ═══════════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════════

function loadProgress() {
  if (fs.existsSync(CONFIG.progressFile)) {
    return JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf8'));
  }
  return {
    pages: { total: 0, converted: 0, verified: 0, files: [] },
    steps: { total: 0, converted: 0, verified: 0, files: [] },
    features: { total: 0, converted: 0, verified: 0, files: [] },
    utils: { total: 0, converted: 0, verified: 0, files: [] },
    helpers: { total: 0, converted: 0, verified: 0, files: [] },
    config: { total: 0, converted: 0, verified: 0, files: [] },
    support: { total: 0, converted: 0, verified: 0, files: [] },
    other: { total: 0, converted: 0, verified: 0, files: [] },
    lastFile: null,
    lastAction: null,
    startedAt: new Date().toISOString(),
  };
}

function saveProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
}

// ═══════════════════════════════════════════════════════════════
// FILE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

function classifyFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  // Feature files
  if (CONFIG.patterns.feature.test(fileName)) {
    return 'features';
  }
  
  // Java files - classify by name pattern
  if (ext === '.java') {
    if (CONFIG.patterns.page.test(fileName)) return 'pages';
    if (CONFIG.patterns.steps.test(fileName)) return 'steps';
    if (CONFIG.patterns.utils.test(fileName)) return 'utils';
    if (CONFIG.patterns.helper.test(fileName)) return 'helpers';
    if (CONFIG.patterns.config.test(fileName)) return 'config';
    if (CONFIG.patterns.testBase.test(fileName)) return 'support';
    if (CONFIG.patterns.hooks.test(fileName)) return 'support';
    return 'other';
  }
  
  // Properties files → config
  if (ext === '.properties') {
    return 'config';
  }
  
  return null; // Skip non-relevant files
}

/**
 * Extract module folder from source path to preserve structure.
 * 
 * Examples:
 *   "wim/pages/LoginPage.java" → "wim"
 *   "payments/src/test/java/steps/PaymentSteps.java" → "payments"
 *   "modules/csbb/pages/AccountPage.java" → "csbb"
 *   "src/test/java/pages/LoginPage.java" → null (no module)
 */
function extractModuleFolder(relativePath, category) {
  const parts = relativePath.split(path.sep);
  
  // Common folder names to skip (not modules)
  const skipFolders = [
    'src', 'main', 'test', 'java', 'resources',
    'pages', 'steps', 'stepdefinitions', 'stepdef',
    'utils', 'utilities', 'helpers', 'config', 'configuration',
    'features', 'scenarios', 'support', 'hooks',
    'com', 'org', 'net', 'io' // Package prefixes
  ];
  
  // Find module name: first folder that's NOT in skipFolders
  // and comes BEFORE the category folder (pages, steps, etc.)
  let moduleFound = null;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const folder = parts[i].toLowerCase();
    
    // Stop if we hit the category folder itself
    if (folder === category || 
        (category === 'steps' && (folder === 'stepdefinitions' || folder === 'stepdef'))) {
      break;
    }
    
    // Skip common non-module folders
    if (skipFolders.includes(folder)) {
      continue;
    }
    
    // This looks like a module name
    moduleFound = parts[i]; // Keep original case
    break;
  }
  
  return moduleFound;
}

function getOutputPath(sourceFile, category) {
  const fileName = path.basename(sourceFile);
  const ext = path.extname(fileName);
  let baseName = fileName.replace(ext, '');
  
  // Convert to kebab-case
  baseName = baseName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
  
  // Preserve module structure from source path
  const relativePath = path.relative(CONFIG.sourceDir, sourceFile);
  const moduleFolder = extractModuleFolder(relativePath, category);
  
  const baseOutputDir = CONFIG.output[category] || CONFIG.output.utils;
  const outputDir = moduleFolder ? path.join(baseOutputDir, moduleFolder) : baseOutputDir;
  
  switch (category) {
    case 'pages':
      return path.join(outputDir, `${baseName}.page.ts`);
    case 'steps':
      return path.join(outputDir, `${baseName}.steps.ts`);
    case 'features':
      return path.join(outputDir, fileName); // Keep .feature extension
    case 'utils':
      return path.join(outputDir, `${baseName}.utils.ts`);
    case 'helpers':
      return path.join(outputDir, `${baseName}.helper.ts`);
    case 'config':
      if (ext === '.properties') {
        return path.join(outputDir, `${baseName}.config.ts`);
      }
      return path.join(outputDir, `${baseName}.config.ts`);
    case 'support':
      // TestBase → hooks.ts, Hooks → hooks.ts
      if (/hooks?/i.test(baseName)) {
        return path.join(outputDir, 'hooks.ts');
      }
      return path.join(outputDir, `${baseName}.ts`);
    default:
      return path.join(CONFIG.output.utils, `${baseName}.ts`);
  }
}

// ═══════════════════════════════════════════════════════════════
// FILE SCANNING
// ═══════════════════════════════════════════════════════════════

function scanDirectory(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!CONFIG.skipDirs.includes(entry.name)) {
        scanDirectory(fullPath, files);
      }
    } else if (entry.isFile()) {
      if (!CONFIG.skipFiles.includes(entry.name)) {
        const category = classifyFile(fullPath);
        if (category) {
          files.push({
            source: fullPath,
            category,
            output: getOutputPath(fullPath, category),
            relativePath: path.relative(CONFIG.sourceDir, fullPath),
          });
        }
      }
    }
  }
  
  return files;
}

// ═══════════════════════════════════════════════════════════════
// JAVA PARSING
// ═══════════════════════════════════════════════════════════════

function parseJavaFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  return {
    className: extractClassName(content),
    package: extractPackage(content),
    imports: extractImports(content),
    methods: extractMethods(content),
    fields: extractFields(content),
    annotations: extractAnnotations(content),
    locators: extractLocators(content),
    stepAnnotations: extractStepAnnotations(content),
  };
}

function extractClassName(content) {
  const match = content.match(/public\s+class\s+(\w+)/);
  return match ? match[1] : 'Unknown';
}

function extractPackage(content) {
  const match = content.match(/package\s+([\w.]+);/);
  return match ? match[1] : '';
}

function extractImports(content) {
  const imports = [];
  const regex = /import\s+([\w.]+);/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function extractMethods(content) {
  const methods = [];
  const regex = /(?:@\w+(?:\([^)]*\))?\s+)*(public|private|protected)?\s+(?:static\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    methods.push({
      visibility: match[1] || 'public',
      returnType: match[2],
      name: match[3],
    });
  }
  return methods;
}

function extractFields(content) {
  const fields = [];
  const regex = /(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    fields.push({
      type: match[1],
      name: match[2],
    });
  }
  return fields;
}

function extractAnnotations(content) {
  const annotations = [];
  const regex = /@(\w+)(?:\(([^)]*)\))?/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    annotations.push({
      name: match[1],
      value: match[2] || '',
    });
  }
  return annotations;
}

function extractLocators(content) {
  const locators = [];
  
  // @FindBy patterns
  const findByRegex = /@FindBy\s*\(\s*(\w+)\s*=\s*["']([^"']+)["']\s*\)\s*(?:private|public|protected)?\s*\w+\s+(\w+)/g;
  let match;
  while ((match = findByRegex.exec(content)) !== null) {
    locators.push({
      strategy: match[1], // id, css, xpath, etc.
      value: match[2],
      name: match[3],
    });
  }
  
  // By.xxx patterns
  const byRegex = /By\.(id|css|xpath|className|name|tagName|linkText|partialLinkText)\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = byRegex.exec(content)) !== null) {
    locators.push({
      strategy: match[1],
      value: match[2],
      name: `locator_${locators.length}`,
    });
  }
  
  return locators;
}

function extractStepAnnotations(content) {
  const steps = [];
  const regex = /@(Given|When|Then|And|But)\s*\(\s*["'](.+?)["']\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    steps.push({
      keyword: match[1],
      pattern: match[2],
    });
  }
  return steps;
}

// ═══════════════════════════════════════════════════════════════
// SKELETON GENERATION
// ═══════════════════════════════════════════════════════════════

function generatePageSkeleton(parsed, sourceFile) {
  const className = parsed.className.replace(/Page$/, '') + 'Page';
  
  // Convert locators to Playwright format
  const locatorLines = parsed.locators.map(loc => {
    const strategy = convertLocatorStrategy(loc.strategy, loc.value);
    return `  readonly ${loc.name} = this.page.locator(${strategy});`;
  }).join('\n');
  
  // Generate method stubs
  const methodLines = parsed.methods
    .filter(m => m.name !== 'constructor' && m.visibility === 'public')
    .map(m => {
      const isVoid = m.returnType === 'void';
      const returnType = isVoid ? 'Promise<void>' : `Promise<${convertType(m.returnType)}>`;
      return `
  async ${m.name}(): ${returnType} {
    // TODO: Convert from Java
    // Source: ${path.basename(sourceFile)}
    throw new Error('Not implemented: ${m.name}');
  }`;
    }).join('\n');
  
  return `// ${className}
// Source: ${path.basename(sourceFile)}
// Status: SKELETON - Needs conversion

import { Page, Locator, expect } from '@playwright/test';

export class ${className} {
  constructor(private readonly page: Page) {}
  
  // ═══════════════════════════════════════════════════════════════
  // LOCATORS
  // ═══════════════════════════════════════════════════════════════
  
${locatorLines || '  // TODO: Add locators from Java source'}
  
  // ═══════════════════════════════════════════════════════════════
  // METHODS
  // ═══════════════════════════════════════════════════════════════
${methodLines || '\n  // TODO: Add methods from Java source'}
}
`;
}

function generateStepsSkeleton(parsed, sourceFile) {
  const fileName = path.basename(sourceFile, '.java');
  
  // Convert step annotations to Cucumber format
  const stepLines = parsed.stepAnnotations.map((step, index) => {
    const keyword = convertStepKeyword(step.keyword, step.pattern);
    const pattern = step.pattern;
    
    return `
${keyword}('${escapePattern(pattern)}', async function (this: CustomWorld) {
  // TODO: Convert from Java
  // Source: ${fileName}
  throw new Error('Not implemented');
});`;
  }).join('\n');
  
  return `// Step Definitions: ${fileName}
// Source: ${path.basename(sourceFile)}
// Status: SKELETON - Needs conversion

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// ═══════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════
${stepLines || '\n// TODO: Add step definitions from Java source'}
`;
}

function generateUtilsSkeleton(parsed, sourceFile) {
  const className = parsed.className;
  
  const methodLines = parsed.methods
    .filter(m => m.visibility === 'public')
    .map(m => {
      const isStatic = parsed.imports.some(i => i.includes('static'));
      const prefix = isStatic ? 'static ' : '';
      return `
  ${prefix}async ${m.name}(): Promise<${convertType(m.returnType)}> {
    // TODO: Convert from Java
    throw new Error('Not implemented: ${m.name}');
  }`;
    }).join('\n');
  
  return `// ${className}
// Source: ${path.basename(sourceFile)}
// Status: SKELETON - Needs conversion

import { Page } from '@playwright/test';

export class ${className} {
  constructor(private readonly page: Page) {}
${methodLines || '\n  // TODO: Add methods from Java source'}
}
`;
}

function generateConfigSkeleton(parsed, sourceFile) {
  const className = parsed.className || 'Config';
  
  // Extract fields as config values
  const configLines = parsed.fields.map(field => {
    return `  ${field.name}: process.env.${field.name.toUpperCase()} ?? '',`;
  }).join('\n');
  
  return `// ${className}
// Source: ${path.basename(sourceFile)}
// Status: SKELETON - Needs conversion

import * as dotenv from 'dotenv';
dotenv.config();

export const ${className} = {
${configLines || '  // TODO: Add config values from Java source\n  BASE_URL: process.env.BASE_URL ?? "https://example.com",'}
} as const;
`;
}

function generateFeatureSkeleton(sourceFile) {
  // Features just need to be copied with minimal changes
  let content = fs.readFileSync(sourceFile, 'utf8');
  
  // Convert And/But to Given/When/Then based on step text
  content = convertAndButKeywords(content);
  
  return content;
}

// ═══════════════════════════════════════════════════════════════
// CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════

function convertLocatorStrategy(strategy, value) {
  switch (strategy.toLowerCase()) {
    case 'id':
      return `'#${value}'`;
    case 'css':
    case 'cssselector':
      return `'${value}'`;
    case 'xpath':
      return `'xpath=${value}'`;
    case 'classname':
      return `'.${value}'`;
    case 'name':
      return `'[name="${value}"]'`;
    case 'tagname':
      return `'${value}'`;
    case 'linktext':
      return `'text=${value}'`;
    case 'partiallinktext':
      return `'text=${value}'`;
    default:
      return `'${value}'`;
  }
}

function convertType(javaType) {
  const typeMap = {
    'void': 'void',
    'String': 'string',
    'int': 'number',
    'Integer': 'number',
    'long': 'number',
    'Long': 'number',
    'double': 'number',
    'Double': 'number',
    'float': 'number',
    'Float': 'number',
    'boolean': 'boolean',
    'Boolean': 'boolean',
    'WebElement': 'Locator',
    'List': 'Array',
    'Map': 'Record',
  };
  return typeMap[javaType] || 'unknown';
}

function convertStepKeyword(keyword, pattern) {
  // Convert And/But to appropriate keyword based on step text
  if (keyword === 'And' || keyword === 'But') {
    const actionWords = ['click', 'enter', 'select', 'type', 'input', 'fill', 'submit', 'press', 'navigate', 'scroll', 'drag', 'drop', 'upload', 'download', 'open', 'close'];
    const assertWords = ['should', 'verify', 'see', 'displayed', 'visible', 'assert', 'error', 'message', 'contains', 'exist', 'present', 'show', 'appear', 'match'];
    
    const lowerPattern = pattern.toLowerCase();
    if (actionWords.some(w => lowerPattern.includes(w))) return 'When';
    if (assertWords.some(w => lowerPattern.includes(w))) return 'Then';
    return 'Given';
  }
  return keyword;
}

function escapePattern(pattern) {
  return pattern.replace(/'/g, "\\'");
}

function convertAndButKeywords(featureContent) {
  const lines = featureContent.split('\n');
  let lastKeyword = 'Given';
  
  return lines.map(line => {
    const trimmed = line.trim();
    
    if (/^(Given|When|Then)\s/.test(trimmed)) {
      lastKeyword = trimmed.split(/\s/)[0];
      return line;
    }
    
    if (/^(And|But)\s/.test(trimmed)) {
      const stepText = trimmed.replace(/^(And|But)\s+/, '');
      const newKeyword = convertStepKeyword('And', stepText);
      return line.replace(/^(\s*)(And|But)/, `$1${newKeyword}`);
    }
    
    return line;
  }).join('\n');
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'generate';
  
  console.log('\n' + '═'.repeat(65));
  console.log('   SELENIUM → PLAYWRIGHT + CUCUMBER MIGRATION');
  console.log('═'.repeat(65) + '\n');
  
  // Handle commands
  if (command === 'status') {
    showStatus();
    return;
  }
  
  if (command === 'force') {
    console.log('⚠️  FORCE MODE: Will regenerate all skeletons\n');
  }
  
  // Check source directory
  if (!fs.existsSync(CONFIG.sourceDir)) {
    console.error(`❌ Source directory not found: ${CONFIG.sourceDir}`);
    console.error('\n   Please copy your Java repo to _source-java/');
    process.exit(1);
  }
  
  // Scan all files
  console.log('📂 Scanning source directory...\n');
  const files = scanDirectory(CONFIG.sourceDir);
  
  if (files.length === 0) {
    console.error('❌ No source files found in _source-java/');
    console.error('   Supported: *.java, *.feature, *.properties');
    process.exit(1);
  }
  
  // Group by category
  const grouped = {};
  for (const file of files) {
    if (!grouped[file.category]) {
      grouped[file.category] = [];
    }
    grouped[file.category].push(file);
  }
  
  // Print summary
  console.log('   Found files:');
  for (const [category, categoryFiles] of Object.entries(grouped)) {
    console.log(`   ├─ ${category}: ${categoryFiles.length} files`);
  }
  console.log('');
  
  // Create output directories
  for (const dir of Object.values(CONFIG.output)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  // Load progress
  const progress = loadProgress();
  let created = 0;
  let skipped = 0;
  
  // Generate skeletons
  for (const file of files) {
    const outputPath = file.output;
    const relativeOutput = path.relative(ROOT, outputPath);
    
    // Check if file exists (skip unless force)
    if (fs.existsSync(outputPath) && command !== 'force') {
      skipped++;
      continue;
    }
    
    try {
      let skeleton;
      
      if (file.category === 'features') {
        skeleton = generateFeatureSkeleton(file.source);
      } else {
        const parsed = parseJavaFile(file.source);
        
        switch (file.category) {
          case 'pages':
            skeleton = generatePageSkeleton(parsed, file.source);
            break;
          case 'steps':
            skeleton = generateStepsSkeleton(parsed, file.source);
            break;
          case 'utils':
          case 'helpers':
            skeleton = generateUtilsSkeleton(parsed, file.source);
            break;
          case 'config':
            skeleton = generateConfigSkeleton(parsed, file.source);
            break;
          default:
            skeleton = generateUtilsSkeleton(parsed, file.source);
        }
      }
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(outputPath, skeleton);
      console.log(`   ✅ ${relativeOutput}`);
      created++;
      
      // Update progress
      if (progress[file.category]) {
        progress[file.category].total++;
        if (!progress[file.category].files.includes(relativeOutput)) {
          progress[file.category].files.push(relativeOutput);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${file.relativePath}: ${error.message}`);
    }
  }
  
  // Save progress
  saveProgress(progress);
  
  // Print summary
  console.log('\n' + '─'.repeat(65));
  console.log(`   Created: ${created} | Skipped: ${skipped}`);
  console.log('─'.repeat(65));
  
  if (skipped > 0) {
    console.log('\n   ℹ️  Some files skipped (already exist).');
    console.log('   Use "npm run migrate:force" to regenerate all.');
  }
  
  console.log('\n   Next steps:');
  console.log('   1. Run: @pw-orchestrator start');
  console.log('   2. Convert one file at a time');
  console.log('   3. Verify with CoVe after each file');
  console.log('');
}

function showStatus() {
  const progress = loadProgress();
  
  console.log('   Migration Progress:\n');
  
  const categories = ['pages', 'steps', 'features', 'utils', 'helpers', 'config', 'support'];
  
  for (const cat of categories) {
    const data = progress[cat] || { total: 0, converted: 0, verified: 0 };
    const percent = data.total > 0 ? Math.round((data.verified / data.total) * 100) : 0;
    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
    console.log(`   ${cat.padEnd(10)} [${bar}] ${percent}% (${data.verified}/${data.total})`);
  }
  
  if (progress.lastFile) {
    console.log(`\n   Last: ${progress.lastFile} (${progress.lastAction})`);
  }
  
  console.log('');
}

main();
