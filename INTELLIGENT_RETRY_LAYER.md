# Intelligent Retry Layer (IRL)

## Overview

The **Intelligent Retry Layer (IRL)** is a comprehensive de-flaking system for AI-driven test automation. It wraps every test step in a retry policy, self-heals selectors using DOM analysis and vision matching, and allows the AI to propose alternative strategies when retries fail.

## Features

### 1. Retry Policy with Exponential Backoff

Every test action (click, type, assert) is automatically wrapped in a retry policy:

- **Configurable retries**: Default 3 attempts, configurable via `IRL_MAX_RETRIES`
- **Exponential backoff**: Starts at 500ms, doubles each retry, max 5s (configurable)
- **Smart error detection**: Only retries on retryable errors (timeouts, element not found, etc.)

### 2. Self-Healing Selectors

When a selector fails, IRL attempts multiple healing strategies:

#### Strategy 1: DOM-Based Healing (Fast)
- **Text matching**: Finds elements by visible text or aria-label
- **Attribute matching**: Uses ID prefixes, data attributes with dynamic suffix handling
- **Structural matching**: Removes dynamic parts (IDs, data attributes) to find stable selectors

#### Strategy 2: Vision + AI Matching (Accurate)
- **Screenshot analysis**: Captures current page state
- **AI-powered matching**: Uses Llama to analyze screenshot + DOM and find best alternative
- **Context-aware**: Considers action intent and page structure

### 3. AI Alternative Strategies

When retries and self-healing fail, IRL asks the AI (Llama) to propose alternative strategies:

- **Different element**: Finds alternative element to achieve same goal
- **Different action**: Suggests different action type (e.g., scroll first, then click)
- **Different approach**: Proposes entirely different strategy to reach the goal

## Configuration

### Environment Variables

Add these to your `worker/.env`:

```bash
# IRL Configuration
IRL_MAX_RETRIES=3                    # Max retry attempts (default: 3)
IRL_INITIAL_DELAY=500                 # Initial delay in ms (default: 500)
IRL_MAX_DELAY=5000                    # Max delay in ms (default: 5000)
IRL_ENABLE_VISION_MATCHING=true       # Enable AI vision matching (default: true)
IRL_ENABLE_AI_ALTERNATIVES=true      # Enable AI alternative proposals (default: true)
```

### Programmatic Configuration

The IRL is automatically initialized in `TestProcessor` with these defaults:

```typescript
{
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 5000,
  enableVisionMatching: true,
  enableAIAlternatives: true,
}
```

## How It Works

### Step Execution Flow

```
1. Action Generated (by Llama)
   ↓
2. IRL.executeWithRetry() called
   ↓
3. Attempt 1: Execute action
   ├─ Success → Return result
   └─ Failure → Try self-healing
       ├─ DOM healing → Retry with healed selector
       └─ Vision healing → Retry with AI-suggested selector
   ↓
4. Attempt 2+: Retry with backoff
   ├─ Success → Return result
   └─ Failure → Try AI alternative
       ├─ AI proposes alternative → Retry with new action
       └─ No alternative → Continue retries
   ↓
5. All retries exhausted → Return failure
```

### Self-Healing Process

1. **Extract text hint** from action (target, description)
2. **DOM Analysis**:
   - Search DOM for text matches
   - Try attribute-based selectors (ID prefix, data attributes)
   - Try structural selectors (remove dynamic parts)
3. **Vision Matching** (if enabled):
   - Capture screenshot + DOM snapshot
   - Ask Llama to analyze and find best match
   - Verify selector exists and is actionable
4. **Return healed selector** if found

### AI Alternative Strategy

When retries fail, IRL:

1. **Builds context**: Failed action, error message, available elements
2. **Asks Llama**: "Propose alternative to achieve same goal"
3. **Validates alternative**: Ensures it's different from original
4. **Retries with alternative**: Uses new action/selector

## Integration

IRL is automatically integrated into `TestProcessor` for all interactive actions:

- ✅ `click` actions
- ✅ `type` actions
- ✅ `assert` actions
- ❌ `scroll`, `navigate`, `wait` (no retry needed)

### Example Usage

```typescript
// In testProcessor.ts - automatically applied
const retryResult = await this.retryLayer.executeWithRetry(
  session.id,
  action,
  filteredContext,
  isMobile,
  {
    maxRetries: 3,
    enableVisionMatching: true,
    enableAIAlternatives: true,
  }
)
```

## Benefits

### 1. Reduced Flakiness

- **Automatic retries** handle transient failures (network delays, slow rendering)
- **Self-healing** handles dynamic selectors (React/Vue component IDs)
- **AI alternatives** handle complex failures (page structure changes)

### 2. Better Success Rate

- **DOM healing**: Fast recovery from selector changes
- **Vision matching**: Accurate recovery using AI understanding
- **Alternative strategies**: Creative solutions when direct approach fails

### 3. Self-Learning

- **Selector learning**: Successful healings are remembered
- **Pattern recognition**: IRL learns which strategies work for your app
- **Adaptive**: Adjusts retry behavior based on error types

## Monitoring

IRL logs detailed information for debugging:

```
[IRL] Attempt 1/3 failed: Element not found
[IRL] Self-healing found alternative: button:has-text("Login")
[IRL] Attempt 2/3 succeeded after 1 attempts
```

Or when AI alternatives are used:

```
[IRL] Attempt 2/3 failed: Element not visible
[IRL] AI proposed alternative: scroll → click
[IRL] Attempt 3/3 succeeded after 2 attempts
```

## Performance Impact

- **DOM healing**: ~50-100ms overhead (fast)
- **Vision matching**: ~500-1000ms overhead (slower, but more accurate)
- **AI alternatives**: ~1000-2000ms overhead (only on failures)

**Recommendation**: Enable vision matching for production, disable for faster development.

## Troubleshooting

### IRL Not Retrying

Check that:
1. Error is in retryable list (timeouts, not found, etc.)
2. `IRL_MAX_RETRIES > 0`
3. Action type is supported (click, type, assert)

### Self-Healing Not Working

1. **DOM healing fails**: Check if page has stable selectors (IDs, data-testid)
2. **Vision matching fails**: Ensure `LLAMA_API_KEY` is set
3. **No alternatives**: Check Llama API connectivity

### Too Many Retries

Reduce `IRL_MAX_RETRIES` or disable vision matching:

```bash
IRL_MAX_RETRIES=2
IRL_ENABLE_VISION_MATCHING=false
```

## Future Enhancements

- [ ] Machine learning model for selector stability prediction
- [ ] Cross-run selector learning (persist successful healings)
- [ ] Custom retry policies per action type
- [ ] Integration with test history (Pinecone) for better alternatives

## See Also

- [Test Processor](./worker/src/processors/testProcessor.ts) - Main integration point
- [IRL Service](./worker/src/services/intelligentRetryLayer.ts) - Core implementation
- [Llama Service](./worker/src/services/llama.ts) - AI alternative generation

