# AI Resource Manager Setup Guide

## 🚀 Overview

Your VFX Tracker now has an AI Resource Manager powered by OpenAI. The AI can answer questions about resource allocation, availability, utilization, and more. If the AI proposes a change, it will require explicit approval before anything is modified.

## ✅ What's Been Implemented

### 1. AI Chat Interface
- **Location**: Resource Forecast View → Click "🤖 AI Assistant" button
- **Features**: 
  - Chat interface with message history
  - Quick action prompts
  - Real-time responses
  - Smart typing indicators

### 2. AI Capabilities

The AI can help with:

✅ **Resource Availability**
- "Who is available tomorrow?"
- "Show me free artists next week"
- "Which animators are available on January 5th?"

✅ **Allocation Forecasts**
- "Get forecast for next 7 days"
- "Show allocations for Animation department this week"
- "What's scheduled for day shift next Monday?"

✅ **Overallocation Detection**
- "Find overallocated resources this week"
- "Show me who is working more than 1.0 MD today"
- "Are there any conflicts in the schedule?"

✅ **Show & Shot Information**
- "Get all allocations for Show ABC"
- "Who is working on Shot 123?"
- "Show me the timeline for Project Phoenix"

✅ **Employee Schedules**
- "What's John's schedule for next week?"
- "Show me Sarah's allocations this month"
- "When is Mike available?"

✅ **Department Analytics**
- "What's the utilization for Compositing department?"
- "Show capacity analysis for Animation"
- "How busy is the VFX team this week?"

### 3. AI Functions

The AI uses tool functions to read schedule data and (when approved) perform write operations like assignments and deletions.

## 🔧 Setup Instructions

### Step 1: Get an OpenAI API Key (Recommended)

1. Go to: https://platform.openai.com/api-keys
2. Create an API key
3. Copy your API key

Add it to your environment:

```env
OPENAI_API_KEY="your_openai_api_key_here"
# Optional: defaults to gpt-4o-mini (fast + low cost)
OPENAI_MODEL="gpt-4o-mini"
```

**Note**: OpenAI API usage is billed; there is not typically a permanently-free API tier.

### Step 2: Add OpenAI API Key to Environment Variables

Open your `.env.local` file and add:

```env
# AI Configuration
OPENAI_API_KEY="your_openai_api_key_here"
OPENAI_MODEL="gpt-4o-mini"  # Optional
```

**Important**: `OPENAI_API_KEY` is required.

### Step 3: Restart Development Server

```bash
npm run dev
```

### Step 4: Test the AI

1. Navigate to Resource Forecast view
2. Click the "🤖 AI Assistant" button (gradient purple button in toolbar)
3. Try a quick prompt: "Who is available tomorrow?"
4. The AI should respond with real data from your database!

## 📊 Example Queries

### Simple Queries
```
Who is available today?
Show me the forecast for this week
Find overallocated resources
```

### Specific Queries
```
Get allocations for John Doe from Jan 1 to Jan 7
Show utilization for Animation department this month
Who is working on Show ABC?
```

### Complex Queries
```
Find all available animators next week and show their current workload
Compare utilization between Animation and Compositing departments
Show me all overallocated resources and their conflicting allocations
```

## 🛡️ Security & Permissions

- **ADMIN** and **RESOURCE** roles can use AI chat
- **VIEWER** role cannot access AI chat
- Any write operations require explicit user approval
- All data access respects user permissions
- Function calls are logged for audit

## 💰 Cost Notes

OpenAI usage is billed; costs depend on your model and usage volume.

## 🔍 Troubleshooting

### "No AI provider configured" error
- Make sure `OPENAI_API_KEY` is set in `.env.local`
- Restart your dev server after adding keys

### "Failed to process message" error
- Check if API key is valid
- Verify you haven't exceeded rate limits
- Check network connectivity

### AI gives generic responses or errors
- Check if the OpenAI API key is valid
- Try shorter questions or smaller date ranges

## 📈 Scaling Options

- Use a smaller/faster OpenAI model where acceptable.
- Add caching for common queries.

## 🎯 Future Enhancements

These could be added later:

❌ **More Write Operations** (still require user confirmation)

❌ **Export Capabilities**
- "Export this week's allocations to Excel"
- "Generate PDF report for Show ABC"

❌ **Advanced Analytics**
- "Predict resource needs for next month"
- "Suggest optimal allocation strategy"
- "Find scheduling conflicts and suggest fixes"

❌ **Memory & Context**
- Remember previous conversations
- Learn user preferences
- Personalized suggestions

## 📞 Support

If you need help with:
- Adding write operations (with confirmations)
- Implementing export features
- Adding more AI capabilities
- Optimizing performance

Just ask!

## ✨ That's It!

Your AI Resource Manager is ready to use. Just add your API keys and start chatting!

**Total Setup Time**: ~5 minutes  
**Total Cost**: Depends on OpenAI usage  
**Capabilities**: Read insights + approval-gated write actions
