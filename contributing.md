# Contributing to TuneTopia

Thanks for your interest in contributing to **TuneTopia**.  
This guide explains how to get started, our standards, and how to contribute effectively.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Design System](#design-system)
- [AI Usage Policy](#ai-usage-policy)
- [Before You Contribute](#before-you-contribute)
- [Contribution Workflow](#contribution-workflow)
- [Pull Request Checklist](#pull-request-checklist)

---

## Development Setup

### Prerequisites

- Modern browser (Chrome, Edge, Safari)
- Basic understanding of JavaScript, HTML, CSS

### Getting Started

```bash
git clone https://github.com/Adarshakarki/Tune-Topia.git
cd tunetopia
````

Then simply open `index.html` in your browser or run your local dev setup.

---

## Code Standards

We prioritize **clarity, simplicity, and maintainability**.

### General Rules

* Write **self-documenting code**
* Keep functions small and focused
* Avoid unnecessary abstractions
* Remove unused code before committing

### Console Cleanliness

* No errors
* No warnings
* No debug logs left behind

---

## Design System

TuneTopia uses a centralized design system:

```
style/tokens.css
```

### Rules

* Use **CSS variables (design tokens)** for:

  * Colors
  * Spacing
  * Shadows

* ❌ Avoid:

  * Hardcoded hex values
  * Inline styles

Consistency > creativity.

---

## AI Usage Policy

AI is allowed—but only as a **tool**, not a replacement.

### Allowed

* Understanding code
* Refactoring
* Improving readability
* Writing documentation

### Not Allowed

* Submitting code you don’t understand
* “Vibecoding” entire features
* Blindly trusting generated logic

> If you can’t explain your code, don’t submit it.

---

## Before You Contribute

### For Large Changes

* Open an issue first
* Or start a **draft PR early**

This helps avoid wasted effort and conflicting work.

---

## Contribution Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature
# or
git checkout -b fix/your-fix
```

---

### 2. Make Changes

* Follow existing structure
* Keep UI responsive
* Ensure audio/player works correctly

---

### 3. Test Everything

* Audio playback is stable
* UI behaves correctly
* No console issues

---

### 4. Commit

```bash
git add .
git commit -m "feat(player): add queue reorder support"
```

---

### 5. Open Pull Request

Include:

* Clear title
* What changed
* Why it changed

---

## Pull Request Checklist

Before submitting:

* [ ] I understand all my changes
* [ ] Features work correctly (audio, UI, navigation)
* [ ] Code is clean and minimal
* [ ] Design follows tokens and structure
* [ ] No console errors or warnings

---

## Philosophy

TuneTopia is built with **intentional code, not rushed code**.

We value:

* Quality over quantity
* Simplicity over complexity
* Understanding over speed

---

Thanks for contributing to TuneTopia
