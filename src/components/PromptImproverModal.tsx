import { useState, useCallback } from 'react';
import { X, Wand2, Loader2, Check, Copy, ArrowRight, Sparkles } from 'lucide-react';
import { d1Client } from '../lib/d1';

interface PromptImproverModalProps {
  currentPrompt: string;
  onApply: (improvedPrompt: string) => Promise<void>;
  onClose: () => void;
}

// Remove markdown code block markers from the prompt
function stripMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim();
  
  // Remove opening markdown code block (```markdown or ```)
  cleaned = cleaned.replace(/^```(?:markdown)?\s*\n?/i, '');
  
  // Remove closing markdown code block (```)
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  
  return cleaned.trim();
}

// Voice AI Prompting Best Practices
const PROMPT_IMPROVEMENT_PROMPT = `You are an expert at writing Voice AI prompts following industry best practices for voice conversations.

Your task is to restructure and improve the given system prompt to follow voice AI best practices.

## VOICE AI PROMPTING GUIDELINES:

### 1. Organize into Clear Sections
Use bracketed section headers:
- [Identity] - Define the agent's persona and role
- [Context] - Provide background information
- [Style] - Set stylistic guidelines (tone, conciseness)
- [Response Guidelines] - Specify formatting rules
- [Task] or [Conversation Flow] - Outline objectives with numbered steps
- [Error Handling] - Handle unclear responses
- [Call Closing] - Define how to end calls

### 2. Voice-Specific Best Practices
- Spell out numbers for natural speech (e.g., "January Twenty Four" not "January 24")
- Spell out times (e.g., "Four Thirty PM" not "4:30 PM")
- Use conversational, concise language
- Include <wait for user response> markers where appropriate
- Never say the word 'function' or 'tools' to users
- For transfers, trigger tools silently without announcing

### 3. Response Guidelines to Include
- Ask one question at a time
- Keep responses brief and natural
- Maintain appropriate tone (professional, friendly, etc.)
- Use clarifying questions when needed
- Present dates in clear spoken format

### 4. Task/Flow Structure
- Use numbered steps for conversation flow
- Include conditional logic (if/then responses)
- Define what to do for each user response type
- Include fallback handling

### 5. Error Handling
- Ask clarifying questions for unclear responses
- Politely ask users to repeat if needed
- Avoid infinite loops

## YOUR TASK:
Transform the given prompt into an optimized voice AI format while:
1. Preserving ALL original functionality and intent
2. Adding any missing sections
3. Improving clarity and structure
4. Making it voice-conversation friendly
5. Adding <wait for user response> markers where needed

Output ONLY the improved prompt in markdown format. Do not add explanations before or after. Do NOT wrap the output in markdown code blocks (do not include \`\`\`markdown or \`\`\` markers).

## ORIGINAL PROMPT TO IMPROVE:
`;

export function PromptImproverModal({ currentPrompt, onApply, onClose }: PromptImproverModalProps) {
  const [improving, setImproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [improvedPrompt, setImprovedPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const improvePrompt = useCallback(async () => {
    setImproving(true);
    setError(null);

    try {
      const settings = await d1Client.getUserSettings();

      if (!settings.openaiApiKey) {
        throw new Error('OpenAI API key not configured. Please add it in Settings.');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: PROMPT_IMPROVEMENT_PROMPT + currentPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const rawImproved = data.choices[0]?.message?.content || '';
      // Strip markdown code block markers if present
      const improved = stripMarkdownCodeBlocks(rawImproved);
      setImprovedPrompt(improved);
    } catch (err: any) {
      console.error('Prompt improvement error:', err);
      setError(err.message || 'Failed to improve prompt');
    } finally {
      setImproving(false);
    }
  }, [currentPrompt]);

  const handleCopy = async () => {
    if (improvedPrompt) {
      await navigator.clipboard.writeText(improvedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = async () => {
    if (improvedPrompt) {
      setSaving(true);
      try {
        await onApply(improvedPrompt);
        // Modal will be closed by parent after successful save
      } catch (err) {
        console.error('Error saving prompt:', err);
        setSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-[90vw] max-w-5xl h-[85vh] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Improve Prompt
              </h2>
              <p className="text-sm text-gray-400">
                Restructure your prompt following voice AI best practices
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Current Prompt */}
          <div className="w-1/2 flex flex-col border-r border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-800/30">
              <h3 className="text-sm font-medium text-gray-300">Current Prompt</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-sm text-gray-400 whitespace-pre-wrap font-mono">
                {currentPrompt}
              </pre>
            </div>
          </div>

          {/* Arrow Divider */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          {/* Improved Prompt */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-800/30 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Optimized Prompt
              </h3>
              {improvedPrompt && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!improvedPrompt && !improving && !error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                    <Wand2 className="w-8 h-8 text-amber-400" />
                  </div>
                  <h4 className="text-lg font-medium text-white mb-2">
                    Ready to Improve
                  </h4>
                  <p className="text-sm text-gray-400 max-w-xs mb-6">
                    Click the button below to restructure your prompt following voice AI best practices
                  </p>
                  <button
                    onClick={improvePrompt}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-amber-500/25"
                  >
                    <Wand2 className="w-5 h-5" />
                    Improve Prompt
                  </button>
                </div>
              )}

              {improving && (
                <div className="h-full flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Analyzing and restructuring your prompt...</p>
                  <p className="text-gray-500 text-xs mt-2">This may take a moment</p>
                </div>
              )}

              {error && (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-sm text-center">
                    <p className="text-red-400 text-sm mb-4">{error}</p>
                    <button
                      onClick={improvePrompt}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {improvedPrompt && (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {improvedPrompt}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <span className="text-amber-400">Tip:</span> Review the improved prompt before applying. You can further edit it after applying.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {improvedPrompt && (
              <button
                onClick={handleApply}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving to Database...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply & Save
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Improvement Guidelines Reference */}
        {!improvedPrompt && !improving && (
          <div className="absolute bottom-20 left-6 right-6">
            <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">What will be improved:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-gray-400">Add structured sections ([Identity], [Task], etc.)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-gray-400">Optimize for voice conversation</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-gray-400">Add response timing markers</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-gray-400">Include error handling</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

