# Layered Model Architecture

This document describes the layered model architecture for efficient and cost-effective AI-driven test automation.

## Architecture Overview

The system uses a 4-layer model architecture, routing tasks to the most appropriate model based on complexity:

### 1. Vision Layer - GPT-4V (Commercial)
**Purpose**: Screenshot analysis only
- **Handles**:
  - Screenshot → semantic interpretation
  - Detects UI issues
  - Identifies inconsistencies
  - Understands device frames
  - Reads text in images

**Why GPT-4V?**
- Most reliable computer-vision LLM on the market
- Best at understanding visual context
- Only used for vision tasks (not reasoning)

**Configuration**:
```bash
OPENAI_API_KEY=sk-...  # Required
VISION_MODEL=gpt-4-vision-preview
```

### 2. Mid-Reasoning Layer - Qwen-2.5-Coder-7B-Instruct (Local)
**Purpose**: Merging outputs, interpreting logs, classifying failures
- **Handles**:
  - Merge GPT-4V output + console logs
  - Interpret backend responses
  - Classify failures
  - Determine cause vs symptom
  - Generate user-friendly explanations
  - Parse test instructions
  - Default action generation

**Why Qwen-Coder-7B?**
- Specialized for code and test automation
- Fast inference on local hardware
- Great at structured reasoning
- More efficient than 32B model

**Configuration**:
```bash
QWEN_CODER_7B_API_URL=http://localhost:11434/v1
QWEN_CODER_7B_API_KEY=ollama
QWEN_CODER_7B_MODEL=qwen2.5-coder:7b
```

### 3. Heavy Reasoning Layer - Qwen-2.5-Coder-14B-Instruct (Local)
**Purpose**: Deep reasoning, root-cause analysis, IRL self-healing
- **Handles**:
  - Deep chain-of-thought
  - Conflicting signals (UI says error, backend says success)
  - Multi-step logic
  - Root-cause analysis
  - Generating recommended fixes
  - Stitching frontend + backend into full-stack view
  - IRL self-healing (when retries fail)

**Why Qwen-2.5-Coder-14B?**
- Specialized for code and test automation
- Excellent reasoning capabilities
- Replaces Llama 4 Scout
- More efficient for code-related tasks

**Configuration**:
```bash
QWEN_CODER_14B_API_URL=http://localhost:11434/v1
QWEN_CODER_14B_API_KEY=ollama
QWEN_CODER_14B_MODEL=qwen2.5-coder:14b
```

### 4. Utility Layer - Llama 8B (Local)
**Purpose**: Trivial parsing, routing, metadata extraction
- **Handles**:
  - Trivial parsing
  - Routing
  - Extracting test metadata
  - Low-value classification tasks

**Why Llama 8B?**
- Super cheap and fast
- Perfect for simple tasks
- No need for heavy models

**Configuration**:
```bash
LLAMA_8B_API_URL=http://localhost:11434/v1
LLAMA_8B_API_KEY=ollama
LLAMA_8B_MODEL=llama3.2:8b
```

## Pipeline Flow

### Test Execution Flow

```
1. Screenshot captured
   ↓
2. GPT-4V analyzes screenshot (Vision Layer)
   ↓
3. Console logs collected
   ↓
4. Qwen-Coder-7B merges vision + logs (Mid-Reasoning Layer)
   ↓
5. If contradictions exist → Qwen-Coder-14B (Heavy Reasoning Layer)
   ↓
6. Final structured response → User dashboard
```

### Instruction Parsing Flow

```
1. User provides test instructions
   ↓
2. Qwen-Coder-7B parses instructions (Mid-Reasoning Layer)
   ↓
3. Structured plan generated
   ↓
4. Test execution begins
```

## Setup Instructions

### 1. Install Ollama

Download from: https://ollama.ai

### 2. Download Required Models

```bash
# Mid-Reasoning Layer (replaces Qwen 32B)
ollama pull qwen2.5-coder:7b

# Heavy Reasoning Layer (replaces Llama 4 Scout)
ollama pull qwen2.5-coder:14b

# Utility Layer
ollama pull llama3.2:8b
```

### 3. Configure Environment Variables

Copy `worker/.env.example.layered` to `worker/.env` and configure:

```bash
# Vision Layer (Required)
OPENAI_API_KEY=sk-your-key-here

# Mid-Reasoning Layer (replaces Qwen 32B)
QWEN_CODER_7B_API_URL=http://localhost:11434/v1
QWEN_CODER_7B_API_KEY=ollama
QWEN_CODER_7B_MODEL=qwen2.5-coder:7b

# Heavy Reasoning Layer (replaces Llama 4 Scout)
QWEN_CODER_14B_API_URL=http://localhost:11434/v1
QWEN_CODER_14B_API_KEY=ollama
QWEN_CODER_14B_MODEL=qwen2.5-coder:14b

# Utility Layer
LLAMA_8B_API_URL=http://localhost:11434/v1
LLAMA_8B_MODEL=llama3.2:8b
```

### 4. Verify Models

```bash
# Check installed models
ollama list

# Test Qwen 32B
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:32b",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Cost Efficiency

### Why This Architecture?

**Without Layering**:
- Using GPT-4V for everything: **$0.01-0.03 per test** (expensive)
- Using single local model for everything: **Slower, less accurate**

**With Layering**:
- GPT-4V only for vision: **$0.001-0.003 per test** (90% cost reduction)
- Local models for reasoning: **Free** (no API costs)
- Total cost: **~$0.001-0.003 per test** (10x cheaper)

### Model Selection Logic

- **Simple task?** → Llama 8B (fast, free)
- **Medium complexity?** → Qwen-Coder-7B (balanced, replaces Qwen 32B)
- **Complex reasoning/IRL?** → Qwen-Coder-14B (powerful, replaces Llama 4 Scout)
- **Vision analysis?** → GPT-4V (best vision model)

## Benefits

1. **Cost Effective**: 90% reduction in API costs
2. **Fast**: Local models have no network latency
3. **Private**: Data stays on your machine
4. **Scalable**: No rate limits on local models
5. **Accurate**: Best model for each task

## Migration from Legacy

The system maintains backward compatibility:
- Legacy `LlamaService` and `QwenService` still work
- New `LayeredModelService` is used when available
- Gradual migration path

## Troubleshooting

### Models Not Found

```bash
# Check if Ollama is running
ollama list

# Download missing models
ollama pull qwen2.5:32b
ollama pull llama3.2:8b
```

### API Connection Errors

```bash
# Verify Ollama is accessible
curl http://localhost:11434/api/tags

# Check API URL format
# Should be: http://localhost:11434/v1 (note the /v1)
```

### GPT-4V Not Working

```bash
# Verify API key
echo $OPENAI_API_KEY

# Test API connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

## Next Steps

1. Download all required models
2. Configure environment variables
3. Restart worker service
4. Run a test to verify layered architecture is working

