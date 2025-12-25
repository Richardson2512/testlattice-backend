# Rihario - Comprehensive Product Documentation

> **AI-Powered Vibe Testing for Solo & Indie Developers**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Target Audience](#target-audience)
4. [Core Features](#core-features)
5. [Technical Architecture](#technical-architecture)
6. [Pricing & Business Model](#pricing--business-model)
7. [Security & Privacy](#security--privacy)
8. [Competitive Positioning](#competitive-positioning)
9. [Current Limitations](#current-limitations)
10. [Future Roadmap](#future-roadmap)

---

## Executive Summary

**Rihario** is an AI-powered testing platform that provides "vibe testing" - a new approach to quality assurance that focuses on pre-ship confidence rather than exhaustive test coverage. 

**Key Value Proposition:**
> "Watch AI explore your app live. See if anything feels broken. No test suites. No code. Just confidence."

**Target Market:** Solo developers and indie hackers who need quick confidence checks before shipping, without the overhead of writing and maintaining test scripts.

**Business Model:** Freemium SaaS with 4 pricing tiers ($0 - $99/month)

---

## Product Overview

### What is Vibe Testing?

Vibe testing is AI-powered exploratory testing that checks if your app **feels broken** before shipping. Instead of writing test scripts or maintaining test suites, users:

1. **Point the AI at their app** - Provide a URL, optionally with instructions
2. **Watch AI explore live** - See real-time navigation, interactions, and issue detection
3. **Review findings** - Get a replay, issues detected, and evidence (screenshots, logs)
4. **Decide what matters** - Fix important issues, ignore false positives

### How It Differs from Traditional Testing

| Aspect | Traditional Testing | Rihario (Vibe Testing) |
|--------|---------------------|------------------------|
| **Setup** | Write scripts, define selectors | Point at URL, optionally add instructions |
| **Maintenance** | Update scripts when app changes | AI adapts automatically |
| **Results** | Pass/fail, deterministic | Issues found, probabilistic |
| **Use Case** | CI/CD gates, coverage metrics | Pre-ship confidence checks |
| **Target User** | QA engineers, automation teams | Solo developers, indie builders |
| **Time to Results** | Hours/days to set up | 1-5 minutes per test |

---

## Target Audience

### Good Fit ✅

- Solo developers building frontend-heavy apps
- Indie hackers shipping fast and iterating often
- Small teams without dedicated QA engineers
- Developers who want quick checks, not exhaustive coverage
- Anyone who cares more about "does it feel broken?" than "is every edge case covered?"

### Not a Fit ❌

- Teams requiring guaranteed test coverage metrics
- Organizations needing CI/CD pipeline integration as a gate
- Companies requiring compliance or audit trails
- Users wanting deterministic, scripted tests
- Those looking to replace Playwright or Selenium

---

## Core Features

### 1. Live Exploration
Watch AI explore your app in real-time. See what it finds as it happens - clicks, navigation, form fills, and issue detection all visible live.

### 2. Visual Testing
AI automatically detects:
- Broken layouts
- Visual errors
- Layout shifts (CLS measurement)
- Accessibility issues (WCAG 2.1 AA)
- Things that "look wrong"

### 3. Flow Exploration
AI follows natural user flows and checks if key paths work smoothly:
- Login flows
- Signup forms
- Checkout processes
- Navigation paths
- Form submissions

### 4. Human-in-the-Loop Control
Pause anytime, take control, guide the AI, then resume. Like pair programming with an AI tester.

### 5. Issue Detection
Automatically catches:
- Console errors (JavaScript exceptions)
- Network errors (failed requests, 4xx/5xx responses)
- Broken links (404s)
- Slow pages (LCP > 2.5s flagged)
- Security issues (XSS risks, missing HTTPS)

### 6. Evidence Collection
Every test produces:
- Step-by-step log with screenshots
- Video replay of the entire session
- Console logs and network requests
- DOM snapshots at key moments
- Severity-rated issues (High/Medium/Low)

### 7. Cross-Browser Testing
Run the same test across multiple browsers in parallel:
- **Chrome** (Chromium)
- **Firefox**
- **Safari** (WebKit)

### 8. Fix Prompts
AI-generated prompts to help fix discovered issues:
- Compatible with Cursor, ChatGPT, Copilot
- Assistive, not automatic fixes
- Context-aware recommendations

### 9. Pre-Test Diagnosis
Before running tests, the system diagnoses:
- What can be tested
- What might be blocked (CAPTCHA, MFA)
- Expected coverage
- Potential issues

---

## Technical Architecture

### Stack Overview

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js (React), TypeScript |
| **Styling** | Custom CSS (premium design system) |
| **Backend API** | Fastify (Node.js), TypeScript |
| **Worker** | Node.js with Playwright |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Storage** | Wasabi S3-compatible storage |
| **Payments** | Polar.sh |
| **Queue** | Redis (BullMQ) |

### Backend Services

The worker service contains 34+ specialized services:

| Service | Purpose |
|---------|---------|
| `unifiedBrain` | Central AI decision-making engine |
| `comprehensiveTesting` | Full testing orchestration |
| `cookieBannerHandler` | Automatic cookie consent handling |
| `authenticationFlowAnalyzer` | Login/signup flow detection |
| `selfHealingMemory` | Learns from past actions to adapt |
| `intelligentRetryLayer` | Smart retry logic for failed actions |
| `accessibilityMap` | WCAG accessibility scanning |
| `visualDiff` | Visual regression detection |
| `visionValidator` | AI vision-based validation |
| `webrtcStreamer` | Live streaming to dashboard |
| `wasabiStorage` | Artifact storage (screenshots, videos) |
| `failureExplanationService` | Human-readable error explanations |
| `successEvaluator` | Determines test success criteria |
| `riskAnalysis` | Evaluates action risk levels |

### Quality & Health Metrics

Every test run measures:

| Metric | What It Measures | Thresholds |
|--------|-----------------|------------|
| **LCP** (Loading Speed) | Time until main content visible | < 2.5s (Good), 2.5-4s (Review), > 4s (Slow) |
| **CLS** (Visual Stability) | Layout shift during loading | < 0.1 (Stable), 0.1-0.25 (Review), > 0.25 (Unstable) |
| **Accessibility** | WCAG 2.1 AA compliance | < 90/100 triggers warning |
| **Security** | Headers, HTTPS, XSS risks | Any critical = fail |
| **Visual Polish** | Pixel-level comparison | > 5% change = issue |

---

## Pricing & Business Model

### Pricing Tiers

| Plan | Price | Tests/Month | Visual Tests | Browsers | Key Features |
|------|-------|-------------|--------------|----------|--------------|
| **Free** | $0 | 3 | 1 | Chrome only | Desktop only, No exports, No history |
| **Starter** | $19 | 100 | 15 | All 3 | Desktop + mobile, 30-day history |
| **Indie** | $39 | 300 | 60 | All 3 | 10 projects, Priority queue, 2-browser parallel |
| **Pro** | $99 | 1,000 | 250 | All 3 | Unlimited projects, 3-browser parallel, 365-day history |

### Add-Ons

| Add-On | Price | Value |
|--------|-------|-------|
| +50 Visual Tests | $10 | Additional visual test quota |
| +200 Visual Tests | $30 | Additional visual test quota |

### Revenue Model

- **Freemium conversion**: Free tier (3 tests) → Paid tiers
- **Monthly subscriptions**: Recurring revenue via Polar.sh
- **Add-on purchases**: Visual test expansions
- **No annual discounts currently** (opportunity for future)

---

## Security & Privacy

### Data Handling

| Data Type | Storage | Retention |
|-----------|---------|-----------|
| Test artifacts (screenshots, videos) | Wasabi S3 | Plan-dependent (30-365 days) |
| Credentials (if provided) | Not stored | Used only during test execution |
| Test results | Supabase PostgreSQL | Plan-dependent |
| User data | Supabase Auth | Until account deletion |

### Security Features

- **HTTPS enforced** for all URLs
- **No credential storage** - used only in-memory during tests
- **Private results** - no sharing without explicit action (paid plans)
- **Automatic cleanup** - artifacts deleted per retention policy

### Limitations (Transparent)

- **Cannot bypass CAPTCHA** - Tests marked as BLOCKED
- **Cannot handle MFA** - Requires manual intervention
- **Cannot test localhost** - Requires publicly accessible URLs
- **Cannot guarantee 100% coverage** - Probabilistic, not exhaustive

---

## Competitive Positioning

### vs Traditional Testing Tools (Playwright, Cypress, Selenium)

| Aspect | Rihario | Traditional Tools |
|--------|---------|-------------------|
| **Setup time** | Minutes | Hours/days |
| **Maintenance** | Zero | Ongoing |
| **Code required** | None | Yes |
| **Deterministic** | No | Yes |
| **CI/CD ready** | No | Yes |
| **Target user** | Solo devs | QA engineers |

**Position**: Rihario is **complementary**, not a replacement. It's for quick confidence checks, not exhaustive test suites.

### vs AI Testing Competitors

| Differentiator | Rihario |
|----------------|---------|
| **Live exploration view** | Watch AI in real-time |
| **Human-in-the-loop** | Pause, guide, resume |
| **Fix prompts** | AI-generated fix suggestions |
| **Visual + functional** | Both in one tool |
| **Pricing** | Affordable for solo devs |

---

## Current Limitations

### Technical Limitations

1. **CAPTCHA/MFA** - Cannot bypass verification systems
2. **Localhost** - Cannot test local development environments
3. **HTTP** - Only HTTPS URLs supported
4. **Cookie banners** - Most handled, some edge cases may block
5. **Infinite loops** - Prevented but may cause early test termination

### Feature Limitations (Not Yet Implemented)

1. **Scheduled tests** - No automated recurring tests
2. **API access** - No public API for programmatic access
3. **CI/CD integration** - No native integration
4. **Team collaboration** - Limited team features
5. **Custom test scripts** - No scripting support

---

## Future Roadmap

### Potential Features (Under Consideration)

| Feature | Priority | Description |
|---------|----------|-------------|
| API & Integration | High | Public API, webhooks, CI/CD guides |
| Scheduled Tests | High | Automated recurring tests |
| Account Management | Medium | Password reset, profile settings |
| Support/Contact | Medium | Help center, chat support |
| Troubleshooting Guide | Low | Consolidated common issues |

---

## Appendix: Documentation Coverage

### Existing User Documentation (48 Pages)

All major user flows are documented at `/docs`:

**Getting Started**
- What Is Vibe Testing?
- Who Is This Tool For?
- How This Is Different From Traditional Testing
- Run Your First Test (No Signup)
- Understanding Your First Test Result

**Core Concepts**
- What Is a Test in This Platform?
- How AI Explores Your App
- Pre-Ship Confidence Explained
- Human-in-the-Loop Testing
- Quality & Health Standards
- Why Not a Replacement for Playwright/Selenium

**Exploration Modes**
- Visual Testing
- Login Flows
- Sign-Up Forms
- Navigation & Broken Links
- Forms & User Inputs
- Accessibility Checks

**Understanding Results**
- Reading Test Logs
- FAILED vs BLOCKED vs SKIPPED
- Error Types Explained
- Evidence Collection
- AI Accuracy

**Security & Pricing**
- Credentials Handling
- Data Storage
- Browser Limitations
- CAPTCHA/MFA Limits
- Coverage Guarantees
- Pricing Plans

---

*Document Version: 1.0*  
*Last Updated: December 25, 2025*
