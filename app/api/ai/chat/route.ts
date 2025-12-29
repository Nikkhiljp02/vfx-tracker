import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { auth } from '@/lib/auth';
import { aiFunctionDeclarations, executeAIFunction } from '@/lib/ai/functions';

// Initialize AI clients
const genAI = process.env.GOOGLE_AI_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    // Only ADMIN and RESOURCE roles can use AI chat
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { message, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Try Gemini first (free tier)
    if (genAI) {
      try {
        const response = await processWithGemini(message, conversationHistory, user.id);
        return NextResponse.json({ 
          message: response,
          provider: 'gemini'
        });
      } catch (error: any) {
        console.error('Gemini error:', error);
        
        // If rate limited and Groq is available, fallback
        if (error.message?.includes('rate') && groq) {
          console.log('Falling back to Groq due to rate limit');
          const response = await processWithGroq(message, conversationHistory, user.id);
          return NextResponse.json({ 
            message: response,
            provider: 'groq'
          });
        }
        
        throw error;
      }
    } 
    // If Gemini not configured, try Groq
    else if (groq) {
      const response = await processWithGroq(message, conversationHistory, user.id);
      return NextResponse.json({ 
        message: response,
        provider: 'groq'
      });
    }
    
    return NextResponse.json({ 
      error: 'No AI provider configured. Please set GOOGLE_AI_KEY or GROQ_API_KEY' 
    }, { status: 500 });

  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ 
      error: 'Failed to process message' 
    }, { status: 500 });
  }
}

async function processWithGemini(message: string, history: any[], userId: string): Promise<string> {
  if (!genAI) throw new Error('Gemini not configured');

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    tools: [{
      functionDeclarations: aiFunctionDeclarations as any
    }],
    systemInstruction: `You are an AI Resource Manager for a VFX production studio. You help manage resource allocations, schedules, and forecasts.

Current capabilities:
- View resource forecasts and allocations
- Check employee availability and schedules
- Analyze department utilization
- Find overallocated resources
- Get show and shot information

Important guidelines:
- Always use the provided functions to get real data
- Format dates as YYYY-MM-DD
- Be concise and professional
- When showing data, use clear formatting with bullet points or tables
- If you need more specific information, ask the user
- You can only VIEW data, not modify it

Current date: ${new Date().toISOString().split('T')[0]}`
  });

  // Convert history to Gemini format
  const geminiHistory = history.map((msg: any) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const chat = model.startChat({ history: geminiHistory });
  let result = await chat.sendMessage(message);
  
  // Handle function calls
  let functionCall = result.response.functionCalls()?.[0];
  let attempts = 0;
  const maxAttempts = 5; // Prevent infinite loops

  while (functionCall && attempts < maxAttempts) {
    attempts++;
    console.log(`Function call attempt ${attempts}:`, functionCall.name, functionCall.args);
    
    // Execute the function
    const functionResult = await executeAIFunction(
      functionCall.name,
      functionCall.args,
      userId
    );
    
    // Send result back to AI
    result = await chat.sendMessage([{
      functionResponse: {
        name: functionCall.name,
        response: functionResult
      }
    }]);
    
    // Check if AI wants to call another function
    functionCall = result.response.functionCalls()?.[0];
  }
  
  return result.response.text();
}

async function processWithGroq(message: string, history: any[], userId: string): Promise<string> {
  if (!groq) throw new Error('Groq not configured');

  // Groq uses OpenAI-compatible API but with limited function calling
  // For now, use it for simple queries without function calling
  const messages = [
    {
      role: 'system' as const,
      content: `You are an AI Resource Manager for a VFX production studio. You help with resource planning and scheduling queries. 

Note: You are currently running in fallback mode with limited capabilities. You can answer general questions about resource management but cannot access live data. Inform the user that live data access is temporarily unavailable and they should try again shortly.

Current date: ${new Date().toISOString().split('T')[0]}`
    },
    ...history.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user' as const,
      content: message
    }
  ];

  const completion = await groq.chat.completions.create({
    messages,
    model: "llama-3.1-70b-versatile",
    temperature: 0.7,
    max_tokens: 1024
  });

  return completion.choices[0]?.message?.content || 'No response generated';
}
