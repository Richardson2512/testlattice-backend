# Rihario Feature Strategy
## Vibe Testing for Solo & Indie Developers

---

## 1️⃣ CORE FEATURES (Must-Have)

### Live Exploration
**What it does:** Watch an AI agent explore your app in real-time through a live browser session.

**Why it matters:** Solo devs need to see what's actually happening, not just pass/fail results. Live exploration builds trust that the tool is actually checking the right things.

---

### Visual Checks
**What it does:** Automatically detects if pages look broken, have layout issues, or show error states.

**Why it matters:** "Does my app look broken?" is the #1 question solo devs ask before shipping. No need to manually check every viewport.

---

### Flow Exploration
**What it does:** AI follows natural user flows (signup, checkout, key interactions) and reports if anything feels off.

**Why it matters:** Solo devs care about the happy path working. They don't need exhaustive test coverage—they need confidence the core experience works.

---

### Issue Detection
**What it does:** Catches console errors, broken links, slow pages, and obvious problems automatically.

**Why it matters:** Catches real problems that users would hit, without requiring technical test writing.

---

### Simple Replay
**What it does:** Watch a video replay of what the AI did, with screenshots at key moments.

**Why it matters:** When something looks wrong, solo devs need quick context to understand what happened—no need to dig through logs.

---

### Natural Language Instructions
**What it does:** Tell the AI what to check in plain English: "check the checkout flow" or "make sure signup works."

**Why it matters:** No learning curve. Solo devs can start using it immediately without learning a testing framework.

---

## 2️⃣ DIFFERENTIATING FEATURES (Competitive Edge)

### Human-in-the-Loop Controls
**What it does:** Pause the exploration at any time, manually interact, guide the AI, or override decisions—then resume.

**Why enterprise tools don't do this:** Enterprise tools are built for automation and CI/CD pipelines, not interactive exploration.

**Why solo devs care:** Sometimes the AI needs a nudge. Being able to guide it mid-session makes it feel like a pair programming partner, not a black box.

---

### Live Stream View
**What it does:** See exactly what the AI is doing right now, in real-time, with its thinking process visible.

**Why enterprise tools don't do this:** Enterprise tools optimize for speed and parallelization. Live visibility is a performance cost.

**Why solo devs care:** Trust is built through transparency. Seeing the AI's process builds confidence that it's checking the right things.

---

### Context-Aware Exploration
**What it does:** AI understands your app's structure, learns from interactions, and gets smarter about what to check.

**Why enterprise tools don't do this:** Enterprise tools expect explicit test specifications. They don't adapt or learn.

**Why solo devs care:** Solo devs don't have time to write comprehensive test plans. The tool should get smarter on its own.

---

### No Code, No Config
**What it does:** Start exploring immediately. No setup, no YAML files, no configuration.

**Why enterprise tools don't do this:** Enterprise tools assume dedicated QA teams who will maintain test suites.

**Why solo devs care:** Solo devs want to check their app, not maintain test infrastructure.

---

## 3️⃣ ADVANCED / POWER-USER FEATURES (Hidden or Optional)

### Custom Instructions
**How gated:** Toggle "Advanced Mode" or expand "Add specific instructions" section.

**What it does:** Provide detailed instructions for specific checks: "click the dark mode toggle" or "test on mobile viewport."

**Why hidden:** Most solo devs don't need this. Keep the default flow simple.

---

### Multi-Page Flows
**How gated:** Toggle in exploration settings, or URL parameter `?mode=flow`

**What it does:** Explore across multiple pages in sequence (e.g., homepage → product → cart → checkout).

**Why hidden:** Single-page checks are the default. Multi-page is for experienced users who want deeper exploration.

---

### Browser Selection
**How gated:** Collapsed section "Check different browsers" (expandable)

**What it does:** Run the same exploration on Chrome, Firefox, Safari.

**Why hidden:** Most solo devs care about "does it work" not "does it work everywhere." Keep it optional.

---

### Export Options
**How gated:** Hidden in "..." menu on completed explorations

**What it does:** Export video replay, screenshots, or a simple report.

**Why hidden:** Not the primary use case. Most people just need to see the replay and move on.

---

### Manual Override Mode
**How gated:** Button appears during live exploration: "Take Control"

**What it does:** Pause AI, manually interact, then resume or save the session.

**Why hidden:** Most explorations run automatically. Manual mode is for edge cases.

---

## 4️⃣ FEATURES THAT SHOULD NOT BE IN THE PRODUCT

### ❌ Test Suites / Test Collections
**Why harmful:** Implies maintaining a test library. Solo devs don't want to maintain tests—they want instant confidence.

**Alternative:** Single, on-demand explorations. No "save as test" button.

---

### ❌ Coverage Reports
**Why harmful:** Pushes toward "must cover everything" mentality. Solo devs care about confidence, not metrics.

**Alternative:** Simple status: "Explored 12 pages, found 0 issues."

---

### ❌ CI/CD Integration
**Why harmful:** Implies automation pipelines. Solo devs run checks manually before deploying, not in automated pipelines.

**Alternative:** Optional webhook for deployments (hidden, advanced only).

---

### ❌ Assertion Framework
**Why harmful:** Requires writing code and maintaining test logic. Contradicts "no code" promise.

**Alternative:** AI automatically detects problems. No assertions needed.

---

### ❌ Test Management Dashboard
**Why harmful:** Feels like enterprise QA tool. Solo devs don't manage tests—they run checks.

**Alternative:** Simple history of recent explorations with replay links.

---

### ❌ Scheduled / Automated Runs
**Why harmful:** Implies test maintenance and monitoring. Solo devs check before shipping, not on a schedule.

**Alternative:** Optional "remind me to check before deploy" (not automated).

---

### ❌ Test Data Management
**Why harmful:** Enterprise concern. Solo devs use real data or simple fixtures.

**Alternative:** AI adapts to whatever data exists.

---

### ❌ Parallel Test Execution
**Why harmful:** Enterprise optimization. Solo devs run one check at a time, quickly.

**Alternative:** Fast, sequential explorations.

---

### ❌ Test Analytics / Trends
**Why harmful:** Implies test management and maintenance. Solo devs care about "is it broken now?" not trends.

**Alternative:** Simple issue list, no historical analysis.

---

### ❌ Custom Assertions / Validation Rules
**Why harmful:** Requires writing code. Defeats purpose of vibe testing.

**Alternative:** AI detects common problems automatically.

---

## 5️⃣ FINAL SUMMARY

### Landing Page Header Features

**Primary:**
- **Live Exploration** — Watch AI check your app in real-time
- **Visual Checks** — Automatic detection of broken layouts
- **Flow Testing** — Natural exploration of key user paths
- **Issue Detection** — Catches errors and problems automatically

**Secondary (visible but not emphasized):**
- **Replay & Review** — Video replay of what happened
- **No Code Required** — Start exploring immediately

---

### Product Positioning

**For Solo & Indie Developers**

**Rihario helps you feel confident before shipping.**

No test suites. No code. No maintenance.

Just point our AI at your app and watch it explore. See if anything feels broken. Get confidence you're not shipping a mess.

---

### Feature List (Plain Language)

**Core Experience:**
1. **Explore Your App** — AI explores your app live, following natural user flows
2. **See What's Broken** — Automatic detection of visual issues, errors, and problems
3. **Watch It Happen** — Live stream of the AI's exploration process
4. **Review the Replay** — Video and screenshots of what the AI found
5. **Guide When Needed** — Pause, interact, and resume exploration at any time

**Hidden / Advanced:**
- Custom instructions (for specific checks)
- Multi-page flows (for deeper exploration)
- Browser selection (check different browsers)
- Export options (save replays or reports)

---

## Implementation Notes

**Language to Use:**
- ✅ "Explore" not "test"
- ✅ "Check" not "assert"
- ✅ "See what's broken" not "coverage"
- ✅ "Confidence" not "quality assurance"
- ✅ "Flow" not "test case"
- ✅ "Issue" not "defect"

**Language to Avoid:**
- ❌ "Test suite"
- ❌ "Test case"
- ❌ "Assertion"
- ❌ "Coverage"
- ❌ "Regression"
- ❌ "CI/CD"
- ❌ "QA"
- ❌ "Automation"
- ❌ "Test management"

---

**Last Updated:** 2024
**Product Philosophy:** Confidence over coverage. Exploration over execution. Human-in-the-loop over full automation.
