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
 * Find best matching intent using flexible matching
 */
function findBestMatch(
  candidateIntent: string | null | undefined,
  availableIntents: string[]
): string | null {
  if (!candidateIntent) return null;
  
  const candidateLower = candidateIntent.toLowerCase().trim();
  
  // 1. Exact match (case-insensitive)
  for (const intent of availableIntents) {
    if (intent.toLowerCase() === candidateLower) {
      console.log(`[IntentClassifier] ✓ Exact match: "${candidateIntent}" → "${intent}"`);
      return intent;
    }
  }
  
  // 2. Candidate contains intent or intent contains candidate
  for (const intent of availableIntents) {
    const intentLower = intent.toLowerCase();
    if (candidateLower.includes(intentLower) || intentLower.includes(candidateLower)) {
      console.log(`[IntentClassifier] ✓ Partial match: "${candidateIntent}" → "${intent}"`);
      return intent;
    }
  }
  
  // 3. Word overlap matching (e.g., "margarita" matches "Margarita Pizza")
  const candidateWords = candidateLower.split(/\s+/).filter(w => w.length > 2);
  for (const intent of availableIntents) {
    const intentLower = intent.toLowerCase();
    const intentWords = intentLower.split(/\s+/).filter(w => w.length > 2);
    
    // Check if any significant word matches
    for (const cWord of candidateWords) {
      for (const iWord of intentWords) {
        if (cWord.includes(iWord) || iWord.includes(cWord)) {
          console.log(`[IntentClassifier] ✓ Word match: "${cWord}" ↔ "${iWord}" → "${intent}"`);
          return intent;
        }
      }
    }
  }
  
  console.log(`[IntentClassifier] ✗ No match found for: "${candidateIntent}"`);
  return null;
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
  console.log('[IntentClassifier] 🎯 Classifying:', userTranscript);
  console.log('[IntentClassifier] 📋 Available intents:', availableIntents);
  
  // First try quick keyword match for instant response
  const quickMatch = findBestMatch(userTranscript, availableIntents);
  if (quickMatch) {
    console.log('[IntentClassifier] ⚡ Quick keyword match found:', quickMatch);
    return {
      intent: quickMatch,
      confidence: 0.85,
      reasoning: 'Quick keyword match'
    };
  }
  
  // Get OpenAI API key from settings
  const settings = await d1Client.getUserSettings();
  if (!settings.openaiApiKey) {
    console.warn('[IntentClassifier] OpenAI API key not configured, falling back to keyword matching');
    return fallbackKeywordMatch(userTranscript, availableIntents);
  }

  // Build numbered list for clearer matching
  const numberedIntents = availableIntents.map((intent, i) => `${i + 1}. "${intent}"`).join('\n');
  
  const systemPrompt = `You are an intent classifier. Match user speech to one of these options:

OPTIONS:
${numberedIntents}

RULES:
- Return the EXACT option text if matched (copy character-for-character)
- "margarita" → "Margarita Pizza" (partial word match is valid)
- "pepperoni" → "Pepperoni Pizza" (partial word match is valid)  
- "kebab" → "Kebab Pizza" (partial word match is valid)
- If no match possible, return "NONE"

RESPOND WITH JSON ONLY:
{"intent": "EXACT OPTION TEXT OR NONE", "confidence": 0.9}`;

  const userMessage = `User said: "${userTranscript}"`;

  try {
    console.log('[IntentClassifier] 🤖 Calling LLM...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0, // Zero temperature for deterministic results
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error('[IntentClassifier] API error:', response.status);
      return fallbackKeywordMatch(userTranscript, availableIntents);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    console.log('[IntentClassifier] 📝 LLM raw response:', content);
    
    // Parse JSON response
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    
    const result = JSON.parse(jsonStr);
    console.log('[IntentClassifier] 📊 Parsed result:', result);
    
    // Handle NONE
    if (result.intent === 'NONE') {
      return {
        intent: null,
        confidence: result.confidence || 0,
        reasoning: 'No match (LLM)'
      };
    }
    
    // Use flexible matching to find the best match
    const matchedIntent = findBestMatch(result.intent, availableIntents);
    
    if (matchedIntent) {
      console.log('[IntentClassifier] ✅ Final matched intent:', matchedIntent);
      return {
        intent: matchedIntent,
        confidence: result.confidence || 0.9,
        reasoning: result.reasoning || 'LLM classification'
      };
    }
    
    console.log('[IntentClassifier] ⚠️ LLM returned but no match found:', result.intent);
    return {
      intent: null,
      confidence: 0,
      reasoning: `LLM returned "${result.intent}" but no match in available intents`
    };
    
  } catch (error) {
    console.error('[IntentClassifier] ❌ Error:', error);
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
  console.log('[IntentClassifier] 🔄 Using fallback keyword matching');
  
  // Use the same flexible matching
  const match = findBestMatch(userTranscript, availableIntents);
  
  if (match) {
    return {
      intent: match,
      confidence: 0.75,
      reasoning: 'Keyword match (fallback)'
    };
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

