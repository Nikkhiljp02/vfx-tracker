# AI Resource Manager Setup Guide

## 🚀 Overview

Your VFX Tracker now has an AI Resource Manager powered by Google Gemini 1.5 Flash (FREE) with Groq as fallback. The AI can answer questions about resource allocation, availability, utilization, and more - all without modifying any data.

## ✅ What's Been Implemented

### 1. AI Chat Interface
- **Location**: Resource Forecast View → Click "🤖 AI Assistant" button
- **Features**: 
  - Chat interface with message history
  - Quick action prompts
  - Real-time responses
  - Smart typing indicators

### 2. AI Capabilities (Read-Only)

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

6 read-only functions have been implemented:
1. `get_resource_forecast` - Get allocations for date ranges
2. `get_available_resources` - Find available employees
3. `get_overallocated_resources` - Find scheduling conflicts
4. `get_show_allocations` - Get show-specific data
5. `get_employee_schedule` - Get employee details
6. `get_department_utilization` - Department analytics

## 🔧 Setup Instructions

### Step 1: Get Google Gemini API Key (FREE)

1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

**Note**: FREE tier includes:
- 15 requests per minute
- 1 million requests per day
- Completely free forever!

### Step 2: Get Groq API Key (Optional - Fallback)

1. Go to: https://console.groq.com/keys
2. Sign up (free account)
3. Create an API key
4. Copy your key

**Note**: FREE tier includes:
- 30 requests per minute
- Very fast inference
- Good fallback for rate limits

### Step 3: Add API Keys to Environment Variables

Open your `.env.local` file and add:

```env
# AI Configuration
GOOGLE_AI_KEY="your_gemini_api_key_here"
GROQ_API_KEY="your_groq_api_key_here"  # Optional
```

**Important**: At minimum, you need `GOOGLE_AI_KEY`. Groq is optional for fallback.

### Step 4: Restart Development Server

```bash
npm run dev
```

### Step 5: Test the AI

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
- AI can only READ data (no modifications)
- All data access respects user permissions
- Function calls are logged for audit

## 💰 Cost Analysis

### With FREE Tiers Only:

**Scenario: 20 users, 10 queries/day each = 200 queries/day**

- **Gemini 1.5 Flash**: FREE (15 RPM = 900/hour)
- **Groq (fallback)**: FREE (30 RPM = 1,800/hour)
- **Total capacity**: 2,700 queries/hour for $0/month

**You're covered for:**
- Small to medium VFX studios
- Multiple users throughout the day
- Peak usage periods

## 🔍 Troubleshooting

### "No AI provider configured" error
- Make sure `GOOGLE_AI_KEY` is set in `.env.local`
- Restart your dev server after adding keys

### "Failed to process message" error
- Check if API key is valid
- Verify you haven't exceeded rate limits (unlikely with free tier)
- Check network connectivity

### AI gives generic responses
- This means Groq fallback is being used (limited capabilities)
- Gemini might be rate-limited temporarily
- Wait a minute and try again

### "Live data access temporarily unavailable"
- This message appears when using Groq fallback
- Gemini will be available again after rate limit resets (1 minute)

## 📈 Scaling Options

If you need more capacity in the future:

### Gemini Pro (Paid)
- $0.075 per 1M tokens
- Higher rate limits
- Same quality
- Still very cheap!

### Add More Providers
- Easy to add OpenAI, Claude, etc.
- Existing code supports multiple providers
- Round-robin between providers

## 🎯 Future Enhancements (Not Implemented Yet)

These could be added later:

❌ **Write Operations** (requires user confirmation)
- "Add John to Shot 123 tomorrow"
- "Shift Shot ABC by 2 days"
- "Mark Sarah as on leave next week"

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
**Total Cost**: $0/month (with free tiers)  
**Capabilities**: 6 read-only functions, unlimited queries within rate limits
