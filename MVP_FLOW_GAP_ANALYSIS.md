# MVP User Flow Gap Analysis

## ✅ What's Already Implemented

### 1. Authentication Flow
- ✅ `/signup` - User signup page
- ✅ `/login` - User login page
- ✅ Supabase Auth integration
- ✅ Redirect to dashboard after login
- ❌ `/forgot-password` - Not implemented (optional for MVP)

### 2. Dashboard
- ✅ `/dashboard` - Dashboard page exists
- ✅ List of test runs
- ✅ Status indicators (completed, running, queued, failed)
- ✅ Create test functionality (via modal)
- ❌ **Missing**: Remaining test credits display
- ❌ **Missing**: "Resume Paused Test" CTA button
- ❌ **Missing**: "View Test Report" CTA button (report link exists but not prominent)

### 3. Test Creation
- ✅ Test creation functionality exists
- ✅ Project selection
- ✅ URL input
- ✅ Device selection
- ❌ **Route mismatch**: Current is modal in `/dashboard`, MVP needs `/test/create/frontend`
- ❌ **Missing**: Test mode selection (Single-page vs Multi-page)
- ❌ **Missing**: Extra instructions field ("Check navbar", "Click login button")
- ❌ **Missing**: Max 3 pages limit for multi-page tests

### 4. Test Runner (Live Testing)
- ✅ `/runs/:id` - Test run detail page exists
- ✅ Pause/Resume functionality
- ✅ Live step updates
- ✅ Virtual display with screenshots
- ❌ **Route mismatch**: Current is `/runs/:id`, MVP needs `/test/run/:testId`
- ❌ **Missing**: Live video stream (currently only screenshots)
- ❌ **Missing**: Live logs panel (left side)
- ❌ **Missing**: Steps + Errors panel (right side)
- ❌ **Missing**: Stop Test button
- ❌ **Missing**: WebSocket or screenshot-per-second streaming
- ❌ **Layout mismatch**: Current is vertical, MVP needs 3-column layout

### 5. Report Page
- ✅ Report generation functionality
- ✅ Report HTML generation
- ✅ Screenshots display
- ✅ Steps display
- ❌ **Route mismatch**: Current shows report in same page, MVP needs `/test/report/:testId`
- ❌ **Missing**: Dedicated report page
- ❌ **Missing**: AI Insights section (issues detected, visual problems, broken links, console errors)
- ❌ **Missing**: Full video recording player (currently mocked)
- ❌ **Missing**: Test Summary section (status, total steps, pages tested)
- ❌ **Missing**: Developer Actions (Re-run test, Download report, Share report)

### 6. Video Recording
- ✅ Video artifact storage
- ✅ Video upload to Supabase
- ❌ **Missing**: Real Playwright video recording (currently mocked)
- ❌ **Missing**: Video recording starts automatically when test starts
- ❌ **Missing**: Video continues recording during pause
- ❌ **Missing**: Video finalization on test completion
- ❌ **Missing**: Live video streaming to frontend

## 🔴 Critical Gaps to Fix

### Priority 1: Route Structure
1. **Create `/test/create/frontend` page** - Move test creation from modal to dedicated page
2. **Rename `/runs/:id` to `/test/run/:testId`** - Match MVP route structure
3. **Create `/test/report/:testId` page** - Dedicated report page

### Priority 2: Video Recording
1. **Implement real Playwright video recording** - Use `page.video()` API
2. **Start recording automatically** - When test starts
3. **Continue recording during pause** - Don't stop video on pause
4. **Finalize and upload video** - On test completion or stop

### Priority 3: Live Test Runner UI
1. **3-column layout** - Left: Logs, Center: Video, Right: Steps/Errors
2. **Live logs panel** - Real-time step-by-step logs
3. **Live video stream** - WebSocket or screenshot-per-second
4. **Stop Test button** - Stop test early and generate partial report

### Priority 4: Test Creation Form
1. **Test mode selection** - Single-page vs Multi-page (max 3 pages)
2. **Extra instructions field** - Free text for user guidance
3. **Project name field** - Optional project creation

### Priority 5: Report Page
1. **Test Summary section** - Status, steps, pages tested
2. **AI Insights section** - Issues, problems, errors detected
3. **Full video player** - Play recorded video
4. **Developer Actions** - Re-run, Download, Share

### Priority 6: Dashboard Enhancements
1. **Test credits display** - Show remaining credits
2. **Resume Paused Test button** - Quick action for paused tests
3. **View Report button** - Direct link to report page

## 📋 API Endpoints Needed

### Current API Structure
- ✅ `POST /api/tests/run` - Create test run
- ✅ `GET /api/tests/:runId` - Get test run
- ✅ `POST /api/tests/:runId/pause` - Pause test
- ✅ `POST /api/tests/:runId/resume` - Resume test
- ✅ `POST /api/tests/:runId/report` - Generate report

### MVP API Requirements
- ❌ `POST /api/frontend/run/start` - Start frontend test (MVP naming)
- ❌ `WS /api/frontend/run/stream/:testId` - WebSocket for live updates (or GET endpoint)
- ❌ `POST /api/frontend/run/stop` - Stop test early
- ❌ `GET /api/frontend/report/:testId` - Get report (MVP naming)

## 🎯 Implementation Plan

### Phase 1: Route Restructuring
1. Create `/test/create/frontend` page
2. Rename `/runs/:id` to `/test/run/:testId`
3. Create `/test/report/:testId` page
4. Update all internal links

### Phase 2: Video Recording
1. Implement Playwright video recording
2. Start recording on test start
3. Continue recording during pause
4. Finalize and upload on completion

### Phase 3: Live Test Runner
1. Implement 3-column layout
2. Add live logs panel
3. Add live video stream (screenshot-per-second for MVP)
4. Add Stop Test button

### Phase 4: Enhanced Forms
1. Add test mode selection
2. Add extra instructions field
3. Improve project creation flow

### Phase 5: Report Page
1. Create dedicated report page
2. Add AI Insights section
3. Add video player
4. Add developer actions

### Phase 6: Dashboard Polish
1. Add test credits display
2. Add resume paused test button
3. Add view report button

