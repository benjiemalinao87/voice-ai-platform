/**
 * LLM-based Intent Classifier
 * Uses OpenAI to intelligently classify user intents from transcripts
 */

import { d1Client } from '../../lib/d1';

export interface IntentClassificationResult {
  intent: string | null;
  confidence: number;
  reasoning?: string;
}

/**
 * Classify user intent using OpenAI LLM
 * @param userTranscript - The user's spoken response
 * @param availableIntents - List of possible intents from flow edges
 * @returns Classified intent with confidence score
 */
export async function classifyIntent(
  userTranscript: string,
  availableIntents: string[]
): Promise<IntentClassificationResult> {
  // Get OpenAI API key from settings
  const settings = await d1Client.getUserSettings();
  if (!settings.openaiApiKey) {
    console.warn('[IntentClassifier] OpenAI API key not configured, falling back to keyword matching');
    return fallbackKeywordMatch(userTranscript, availableIntents);
  }

  const intentList = availableIntents.join(', ');
  
  const systemPrompt = `You are an intent classifier for a voice AI system. Your job is to determine which intent best matches the user's spoken response.

Available intents: [${intentList}]

Rules:
1. Return EXACTLY one of the available intents (copy it exactly as written) if there's a match
2. If no intent matches, return "NONE"
3. Be flexible with variations, synonyms, and casual speech patterns
4. Match partial mentions: "margarita" should match "Margarita Pizza", "pepperoni" matches "Pepperoni Pizza"
5. Handle casual confirmations: "yeah that one", "the first one", "number two" based on conversation context
6. Response must be valid JSON only - the intent field must be an EXACT copy from the available intents list

Examples:
- User says "I want the pepperoni" → Intent: "Pepperoni Pizza" (matches available intent exactly)
- User says "yeah, margarita sounds good" → Intent: "Margarita Pizza" (if that's available)
- User says "I'll take the kebab" → Intent: "Kebab Pizza" (if that's available)
- User says "um, what was the second option?" → Intent: "NONE" (asking for clarification)`;

  const userMessage = `Classify this user response: "${userTranscript}"

Return JSON format:
{
  "intent": "<matched intent or NONE>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cost-effective
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error('[IntentClassifier] API error:', response.status);
      return fallbackKeywordMatch(userTranscript, availableIntents);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse JSON response
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    
    const result = JSON.parse(jsonStr);
    
    console.log('[IntentClassifier] LLM result:', result);
    
    // Validate the intent is in available list or NONE
    if (result.intent === 'NONE' || !availableIntents.includes(result.intent)) {
      // Try case-insensitive match
      const matchedIntent = availableIntents.find(
        i => i.toLowerCase() === result.intent?.toLowerCase()
      );
      
      if (matchedIntent) {
        return {
          intent: matchedIntent,
          confidence: result.confidence || 0.8,
          reasoning: result.reasoning
        };
      }
      
      return {
        intent: null,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || 'No matching intent found'
      };
    }
    
    return {
      intent: result.intent,
      confidence: result.confidence || 0.9,
      reasoning: result.reasoning
    };
    
  } catch (error) {
    console.error('[IntentClassifier] Error:', error);
    return fallbackKeywordMatch(userTranscript, availableIntents);
  }
}

/**
 * Fallback keyword matching when LLM is not available
 */
function fallbackKeywordMatch(
  userTranscript: string,
  availableIntents: string[]
): IntentClassificationResult {
  const lowerTranscript = userTranscript.toLowerCase();
  
  for (const intent of availableIntents) {
    const lowerIntent = intent.toLowerCase();
    
    // Direct match
    if (lowerTranscript.includes(lowerIntent)) {
      return {
        intent,
        confidence: 0.7,
        reasoning: 'Keyword match (fallback)'
      };
    }
    
    // Check individual words (for multi-word intents)
    const intentWords = lowerIntent.split(/\s+/);
    const matchedWords = intentWords.filter(word => 
      word.length > 2 && lowerTranscript.includes(word)
    );
    
    if (matchedWords.length > 0 && matchedWords.length >= intentWords.length * 0.5) {
      return {
        intent,
        confidence: 0.5,
        reasoning: `Partial keyword match: ${matchedWords.join(', ')} (fallback)`
      };
    }
  }
  
  return {
    intent: null,
    confidence: 0,
    reasoning: 'No match found (fallback)'
  };
}

/**
 * Extract available intents from branch edges
 */
export function extractIntentsFromEdges(
  branchNodeId: string,
  edges: Array<{ source: string; target: string; label?: string | React.ReactNode }>
): string[] {
  return edges
    .filter(e => e.source === branchNodeId && e.label)
    .map(e => String(e.label))
    .filter(Boolean);
}

