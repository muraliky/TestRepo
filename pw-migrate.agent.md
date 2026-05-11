---
name: pw-migrate
description: Convert a single file. Use when you need to re-convert or fix a specific file.
---

# MIGRATE AGENT

Convert a single file.

## ON "@pw-migrate <filepath>"

1. Read: `cat <filepath>`
2. Find `throw new Error` methods
3. Convert each method
4. Save file
5. Report: `✅ <file> converted`

## CONVERSION RULES

| Selenium | Playwright |
|----------|------------|
| `element.click()` | `await this.element.click()` |
| `element.sendKeys(text)` | `await this.element.fill(text)` |
| `element.clear()` | `await this.element.clear()` |
| `element.getText()` | `await this.element.textContent()` |
| `element.isDisplayed()` | `await this.element.isVisible()` |
| `driver.get(url)` | `await this.page.goto(url)` |
| `Thread.sleep(ms)` | `await this.page.waitForTimeout(ms)` |
