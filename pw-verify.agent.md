---
name: pw-verify
description: Run STRICT CoVe verification on migrated files. Checks structure, count match, implementation, and syntax.
---

# VERIFY AGENT

## ON "@pw-verify"

Run full verification on all files:
```bash
node scripts/verify.js
```

## ON "@pw-verify <filepath>"

Verify single file:
```bash
node scripts/verify.js file <filepath>
```

---

## CoVe CHECKS

### For Pages (5 checks):
| Check | What it verifies |
|-------|------------------|
| No Java Syntax | No Selenium/WebDriver/sendKeys/getText/isDisplayed |
| Page Structure | export class, constructor(page: Page), Page import |
| Count Match | Locators & Methods count matches Java source |
| Implementation | No `throw new Error('Method not implemented')` |
| Syntax | Balanced braces, no double async/await |

### For Steps (5 checks):
| Check | What it verifies |
|-------|------------------|
| No Java Syntax | No @Given/@When/@Then annotations, Java types |
| Step Structure | Given/When/Then import from fixtures, async callbacks |
| Count Match | Step definition count matches Java source |
| Implementation | No `throw new Error('Step not implemented')` |
| Syntax | Balanced braces, no double async/await |

---

## Example Output

```
📄 login.page.ts
   ├─ No Java Syntax: ✓
   ├─ Page Structure: ✓
   ├─ Count Match: ✓
   │  └─ ℹ️  Found: 5 locator(s), 2 method(s)
   ├─ Implementation: ✓
   └─ Syntax: ✓
   └─ ✅ PASSED

📝 login.steps.ts
   ├─ No Java Syntax: ✓
   ├─ Step Structure: ✓
   ├─ Count Match: ✗
   │  └─ ❌ Steps: Expected 12, Found 10 (2 MISSING)
   ├─ Implementation: ✓
   └─ Syntax: ✓
   └─ ❌ FAILED (1 error)
```
