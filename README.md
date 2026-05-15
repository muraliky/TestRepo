# Selenium to Playwright + Cucumber Migration Toolkit

> **AI-Assisted Migration** from Java Selenium + QAF + Cucumber to TypeScript Playwright + @cucumber/cucumber

## What's Different

This toolkit uses **@cucumber/cucumber** (standard Cucumber) instead of playwright-bdd, giving you:
- Standard Cucumber ecosystem compatibility
- Same Gherkin syntax you're used to
- More control over step definitions
- No `bddgen` pre-processing required

## Key Features

| Feature | Description |
|---------|-------------|
| **Full Repo Conversion** | Converts entire source repository, not just pages/steps/features |
| **Single Agent Architecture** | One orchestrator, one file at a time, immediate verification |
| **Chain of Verification (CoVe)** | 6 automated quality checks after each conversion |
| **Progress Tracking** | Resume anytime, never lose work |
| **Safety Guards** | Prevents accidental overwrites |

## Folder Structure

The toolkit **preserves your module structure** automatically:

```
_source-java/                      src/ (OUTPUT)
├── wim/                           ├── pages/
│   ├── pages/                     │   ├── wim/           ← Module preserved!
│   │   └── AccountPage.java       │   │   └── account.page.ts
│   └── steps/                     │   └── payments/
│       └── AccountSteps.java      │       └── payment.page.ts
├── payments/                      ├── steps/
│   ├── pages/                     │   ├── wim/
│   │   └── PaymentPage.java       │   │   └── account.steps.ts
│   └── steps/                     │   └── payments/
│       └── PaymentSteps.java      │       └── payment.steps.ts
├── csbb/                          ├── utils/
│   └── ...                        │   └── csbb/
├── features/                      │       └── ...
│   ├── wim/                       └── ...
│   │   └── account.feature        
│   └── payments/                  features/
│       └── payment.feature        ├── wim/
└── pom.xml                        │   └── account.feature
                                   └── payments/
                                       └── payment.feature
```

### How Module Detection Works

The toolkit scans your source path and identifies module names:

| Source Path | Detected Module | Output Path |
|-------------|-----------------|-------------|
| `wim/pages/LoginPage.java` | `wim` | `src/pages/wim/login.page.ts` |
| `payments/steps/PaySteps.java` | `payments` | `src/steps/payments/pay.steps.ts` |
| `modules/csbb/pages/AcctPage.java` | `csbb` | `src/pages/csbb/acct.page.ts` |
| `src/test/java/pages/HomePage.java` | *(none)* | `src/pages/home.page.ts` |

### Folders That Are NOT Treated as Modules

These common folders are skipped when detecting modules:
- `src`, `main`, `test`, `java`, `resources`
- `pages`, `steps`, `stepdefinitions`
- `utils`, `helpers`, `config`
- `com`, `org`, `net` (package prefixes)

## Quick Start

### Option 1: Interactive Setup (Recommended)

**Windows:**
```batch
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

The setup wizard will:
1. Ask for your Java source repo path
2. Copy it to `_source-java/`
3. Install GitHub Copilot agents to `.github/`
4. Install npm dependencies
5. Install Playwright browsers
6. Generate TypeScript skeletons

### Option 2: Manual Setup

```bash
# 1. Copy your ENTIRE Java repo to _source-java/
cp -r /path/to/java-selenium-repo/* _source-java/

# 2. Copy agents to .github folder
cp -r agents/* .github/agents/
mkdir -p .github/copilot/agents
cp -r agents/* .github/copilot/agents/

# 3. Install dependencies
npm install

# 4. Install Playwright browsers
npx playwright install chromium

# 5. Generate skeletons
npm run migrate
```

### Start Conversion

In VS Code with GitHub Copilot:
```
@pw-orchestrator start
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Generate TypeScript skeletons from Java source |
| `npm run migrate:status` | Show migration progress |
| `npm run verify` | Run CoVe verification on all files |
| `npm run verify:file <path>` | Verify single file |
| `npm test` | Run Cucumber tests |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:debug` | Run tests in debug mode |
| `npm run auth:setup` | Interactive authentication setup |

## CoVe Verification (6 Checks)

| # | Check | What It Catches |
|---|-------|-----------------|
| 1 | No Java Syntax | Selenium/WebDriver/QAF code remaining |
| 2 | Structure | Missing imports, exports, constructor |
| 3 | Count Match | Missing methods/locators vs Java source |
| 4 | Implementation | `throw new Error` placeholders |
| 5 | No Boilerplate | Lazy `waitForLoadState()` only code |
| 6 | Syntax | Unbalanced braces, async/await issues |

## File Type Conversion

| Java Source | TypeScript Output | Notes |
|-------------|-------------------|-------|
| `*Page.java` | `*.page.ts` | Page Object classes |
| `*Steps.java` | `*.steps.ts` | Cucumber step definitions |
| `*.feature` | `*.feature` | Gherkin (minimal changes) |
| `*Utils.java` | `*.utils.ts` | Utility classes |
| `*Helper.java` | `*.helper.ts` | Helper classes |
| `*Config.java` | `*.config.ts` | Configuration classes |
| `TestBase.java` | `support/hooks.ts` | Test hooks & setup |
| `pom.xml` | `package.json` | Dependencies (manual review) |
| `*.properties` | `.env` | Environment variables |

## GitHub Copilot Agents

| Agent | Command | Purpose |
|-------|---------|---------|
| `@pw-orchestrator` | `start` | Main conversion workflow |
| `@pw-migrate` | `<file>` | Convert single file manually |
| `@pw-verify` | `<file>` | Verify single file |
| `@pw-debug` | `<issue>` | Debug test failures |

## Converting Utilities & Helpers

The toolkit handles more than just pages and steps. Example conversions:

### Java Utility → TypeScript
```java
// Java: src/test/java/utils/WaitUtils.java
public class WaitUtils {
    public static void waitForElement(WebDriver driver, By locator) {
        new WebDriverWait(driver, Duration.ofSeconds(10))
            .until(ExpectedConditions.visibilityOfElementLocated(locator));
    }
}
```

```typescript
// TypeScript: src/utils/wait.utils.ts
import { Page, Locator } from '@playwright/test';

export class WaitUtils {
  static async waitForElement(page: Page, locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
  }
}
```

### Java Config → TypeScript
```java
// Java: src/test/java/config/TestConfig.java
public class TestConfig {
    public static final String BASE_URL = System.getProperty("baseUrl", "https://example.com");
}
```

```typescript
// TypeScript: src/config/test.config.ts
export const TestConfig = {
  BASE_URL: process.env.BASE_URL ?? 'https://example.com',
} as const;
```

## Migration Progress

Progress is tracked in `migration-progress.json`:
```json
{
  "pages": { "total": 10, "converted": 5, "verified": 4 },
  "steps": { "total": 15, "converted": 8, "verified": 7 },
  "features": { "total": 20, "converted": 20, "verified": 20 },
  "utils": { "total": 3, "converted": 2, "verified": 2 },
  "helpers": { "total": 2, "converted": 1, "verified": 1 },
  "config": { "total": 1, "converted": 1, "verified": 1 },
  "lastFile": "src/pages/LoginPage.page.ts",
  "lastAction": "verified"
}
```

## Troubleshooting

### "No source files found"
Ensure your Java repo is copied to `_source-java/` with the correct structure.

### "File already exists"
Migration won't overwrite existing files. Use `npm run migrate:force` to regenerate (careful!).

### Tests failing after conversion
1. Run `npm run verify` to check all files
2. Fix any CoVe errors
3. Check `auth.json` exists (run `npm run auth:setup` if needed)

## Requirements

- Node.js 18+
- VS Code with GitHub Copilot
- Playwright browsers (`npx playwright install`)
