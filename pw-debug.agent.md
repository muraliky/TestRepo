---
name: pw-debug
description: Debug failing Playwright tests using Playwright MCP Server. Inspects pages, finds correct locators, fixes code.
tools:
  - playwright
---

# DEBUG AGENT (with Playwright MCP)

Debug failing tests by interacting with Desktop Chrome via Playwright MCP Server.

**SECURITY:** MCP uses saved auth state (auth.json). It never sees your credentials.

---

## PREREQUISITES

1. **Run tests first (user runs manually):**
   ```bash
   npm test
   ```

2. **Auth state must exist:**
   ```bash
   npm run auth:check
   # If not found:
   npm run auth:setup
   ```

3. **Playwright MCP configured:** See `docs/PLAYWRIGHT_MCP_SETUP.md`

---

## ON "@pw-debug"

### Step 1: Get Test Failures

Ask user for test output or run:
```bash
npx playwright test --project=desktop-chrome --reporter=list 2>&1 | head -100
```

Parse the output to identify:
- Failed test file and line number
- Error message
- Failing locator/selector

### Step 2: For Each Failure - Use Playwright MCP

#### 2a. Navigate to the Page

Use Playwright MCP to open the page where the test failed:

```
Use browser_navigate to go to: <page-url>
```

#### 2b. Take Snapshot

Get the page structure to find correct elements:

```
Use browser_snapshot to get the accessibility tree
```

#### 2c. Analyze and Find Correct Locator

From the snapshot, identify:
- What element exists on the page
- The correct selector/locator to use
- Why the original locator failed

#### 2d. Verify the New Locator

Use Playwright MCP to test the new locator:

```
Use browser_click or browser_get_text to verify the element works
```

### Step 3: Fix the Code

Update the page object or step file with the correct locator.

### Step 4: Report

```
═══════════════════════════════════════════════════════════════
           DEBUG FIXES APPLIED
═══════════════════════════════════════════════════════════════

   1. ✅ login.page.ts:25
      Error:   locator('#submit-btn') not found
      Found:   Button with text "Sign In"
      Fix:     page.getByRole('button', { name: 'Sign In' })

   2. ✅ account.page.ts:45
      Error:   Timeout waiting for '.balance-display'
      Found:   Element has data-testid="account-balance"
      Fix:     page.getByTestId('account-balance')

   3. ⚠️ transfer.page.ts:12
      Error:   Element not visible
      Found:   Element is inside iframe
      Fix:     page.frameLocator('#payment-frame').locator('#amount')

   Re-run tests: @pw-test

═══════════════════════════════════════════════════════════════
```

### Step 5: Close Browser

```
Use browser_close to close the browser
```

---

## PLAYWRIGHT MCP TOOLS

| Tool | Usage |
|------|-------|
| `browser_navigate` | Navigate to URL |
| `browser_snapshot` | Get accessibility tree (best for finding locators) |
| `browser_screenshot` | Take visual screenshot |
| `browser_click` | Click element to test |
| `browser_type` | Type into input |
| `browser_get_text` | Get element text |
| `browser_hover` | Hover over element |
| `browser_wait` | Wait for element |
| `browser_close` | Close browser |

---

## LOCATOR FIXING STRATEGY

### 1. Element Not Found

**Get snapshot:**
```
browser_snapshot
```

**Look for:**
- Different ID or class
- Text content
- Role (button, link, textbox)
- data-testid attribute

**Fix priority:**
```typescript
// 1. Role-based (best)
page.getByRole('button', { name: 'Submit' })

// 2. Test ID
page.getByTestId('submit-btn')

// 3. Label
page.getByLabel('Email')

// 4. Text
page.getByText('Submit')

// 5. CSS (last resort)
page.locator('#submit-btn')
```

### 2. Multiple Elements Found

**Get snapshot to see all matches:**
```
browser_snapshot
```

**Fix options:**
```typescript
// First match
page.locator('.btn').first()

// Specific index
page.locator('.btn').nth(2)

// Filter by text
page.locator('.btn').filter({ hasText: 'Submit' })

// More specific selector
page.locator('.form-actions .btn.primary')
```

### 3. Timeout / Element Not Visible

**Check if element exists:**
```
browser_snapshot
```

**Possible causes:**
- Element loads slowly → Add wait
- Element is hidden → Check visibility
- Element in iframe → Use frameLocator
- Element requires scroll → scrollIntoView

**Fixes:**
```typescript
// Add explicit wait
await element.waitFor({ state: 'visible', timeout: 10000 });

// Scroll into view
await element.scrollIntoViewIfNeeded();

// Handle iframe
page.frameLocator('#iframe-id').locator('#element')
```

### 4. Element in Shadow DOM

**If element is in shadow DOM:**
```typescript
page.locator('host-element').locator('shadow-element')
```

---

## EXAMPLE DEBUG SESSION

**Error:** `locator('#login-btn') not found`

**Step 1: Navigate**
```
browser_navigate to https://app.example.com/login
```

**Step 2: Snapshot**
```
browser_snapshot

Result:
- button "Sign In" [data-testid="auth-submit"]
- input "Username" [id="username"]
- input "Password" [id="password"]
```

**Step 3: Analyze**
- No element with id="login-btn"
- Found button with text "Sign In" and data-testid="auth-submit"

**Step 4: Verify**
```
browser_click on button "Sign In"
→ Success!
```

**Step 5: Fix Code**
```typescript
// Before
this.loginButton = page.locator('#login-btn');

// After
this.loginButton = page.getByRole('button', { name: 'Sign In' });
// Or: page.getByTestId('auth-submit')
```

**Step 6: Report**
```
✅ Fixed login.page.ts:25
   #login-btn → getByRole('button', { name: 'Sign In' })
```

**Step 7: Close**
```
browser_close
```

---

## RULES

1. **ALWAYS USE MCP** - Don't guess locators, inspect the actual page
2. **SNAPSHOT FIRST** - Get accessibility tree before fixing
3. **VERIFY BEFORE FIXING** - Test the new locator with MCP
4. **PREFER SEMANTIC LOCATORS** - getByRole > getByTestId > locator
5. **MINIMAL CHANGES** - Only fix what's broken
6. **CLOSE BROWSER** - Always close when done
