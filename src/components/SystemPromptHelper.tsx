import { useState } from 'react';
import { Sparkles, X, ArrowRight, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';

interface SystemPromptHelperProps {
  onGenerate: (prompt: string, firstMessage: string) => void;
  onClose: () => void;
}

interface PromptAnswers {
  agentRole: string;
  companyName: string;
  primaryTask: string;
  toneStyle: string;
  responseLength: 'brief' | 'moderate' | 'detailed';
  errorHandling: string;
  specialInstructions: string;
}

export function SystemPromptHelper({ onGenerate, onClose }: SystemPromptHelperProps) {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [answers, setAnswers] = useState<PromptAnswers>({
    agentRole: '',
    companyName: '',
    primaryTask: '',
    toneStyle: 'professional',
    responseLength: 'moderate',
    errorHandling: '',
    specialInstructions: '',
  });

  const totalSteps = 6;

  // Example content for each step
  const examples = {
    1: {
      title: 'Example: Agent Role',
      content: `Customer Support Representative

This agent assists customers with product inquiries, troubleshooting, and general support questions.`,
    },
    2: {
      title: 'Example: Company Name',
      content: `Acme Corporation

A tech company specializing in cloud-based business solutions.`,
    },
    3: {
      title: 'Example: Primary Task',
      content: `Answer customer questions about our products and services, provide technical support for common issues, collect customer information for follow-up, and transfer to a specialist if the issue requires advanced troubleshooting.

The agent should be helpful, patient, and ensure the customer feels heard and supported.`,
    },
    4: {
      title: 'Example: Tone Selection',
      content: `Professional & Polite is ideal for:
• Financial services
• Healthcare
• Legal services
• Enterprise B2B

Friendly & Warm works well for:
• Retail & E-commerce
• Hospitality
• Consumer products
• Small business services`,
    },
    5: {
      title: 'Example: Response Length',
      content: `Brief & Concise: "Your order #12345 will arrive on Friday."

Moderate Detail: "Your order #12345 is currently in transit and is scheduled to arrive this Friday by 5 PM. You'll receive a tracking link via email."

Comprehensive: "I've located your order #12345. It shipped from our warehouse yesterday and is currently in transit with FedEx. Based on the tracking information, it's scheduled to arrive this Friday by 5 PM. I've just sent you an email with the tracking link so you can monitor its progress. Is there anything else you'd like to know about your order?"`,
    },
    6: {
      title: 'Example: Special Instructions',
      content: `Special Instructions:
"If a customer mentions a competitor's product, acknowledge their research and highlight our unique 24/7 support and lifetime warranty."

Error Handling:
"If the customer's request is unclear, ask one clarifying question at a time. For example: 'Just to make sure I understand, are you asking about your recent order or placing a new one?'"`,
    },
  };

  const generateSystemPrompt = async () => {
    setGenerating(true);

    try {
      // Get OpenAI API key from D1
      const { d1Client } = await import('../lib/d1');
      const settings = await d1Client.getUserSettings();

      if (!settings.openaiApiKey) {
        alert('OpenAI API key not configured. Please add it in Settings.');
        setGenerating(false);
        return;
      }

      // Create the generation request
      const generationPrompt = `You are an expert at creating system prompts and first messages for VAPI voice AI assistants. Based on the following information, create both a professional system prompt and an engaging first message (opening greeting) following VAPI best practices:

**Agent Information:**
- Role: ${answers.agentRole}
- Company: ${answers.companyName}
- Primary Task: ${answers.primaryTask}
- Tone/Style: ${answers.toneStyle}
- Response Length: ${answers.responseLength}
- Error Handling: ${answers.errorHandling || 'Standard error handling'}
- Special Instructions: ${answers.specialInstructions || 'None'}

**VAPI Best Practices to Follow:**
1. Define clear identity and persona
2. Set appropriate style and tone
3. Include response guidelines (concise, natural speech)
4. Outline task and goals with step-by-step instructions
5. Add error handling and fallback strategies
6. Use natural speech elements (spell out numbers, hesitations like "um", "uh")
7. Use Markdown formatting for organization
8. Include <wait for user response> markers where appropriate
9. Avoid mentioning "function" or "tools"
10. Keep responses conversational and personality-driven

**Output Format:**
Respond with a JSON object containing both fields:
{
  "systemPrompt": "The complete system prompt following VAPI best practices",
  "firstMessage": "A warm, natural opening greeting that matches the agent's role and tone (1-2 sentences)"
}

The first message should:
- Be friendly and welcoming
- Introduce the agent's role naturally
- Match the specified tone and style
- Be conversational (use natural speech, not overly formal)
- End with an open-ended question or offer to help

Do not include any explanations or meta-text outside the JSON object.`;

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating system prompts for VAPI voice AI assistants. Generate professional, effective prompts following VAPI best practices.',
            },
            {
              role: 'user',
              content: generationPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate prompt');
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();

      // Parse the JSON response
      try {
        const parsed = JSON.parse(content);
        onGenerate(parsed.systemPrompt, parsed.firstMessage);
        onClose();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        alert('Failed to parse generated content. Please try again.');
      }
    } catch (error) {
      console.error('Error generating prompt:', error);
      alert('Failed to generate system prompt. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return answers.agentRole.trim().length > 0;
      case 2:
        return answers.companyName.trim().length > 0;
      case 3:
        return answers.primaryTask.trim().length > 0;
      case 4:
        return true; // Tone has default
      case 5:
        return true; // Response length has default
      case 6:
        return true; // Optional fields
      default:
        return false;
    }
  };

  const currentExample = examples[step as keyof typeof examples];

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  What is the agent's role?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExample(!showExample)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  {showExample ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showExample ? 'Hide' : 'Show'} Example
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Examples: "Customer Support Representative", "Appointment Scheduler", "Sales Assistant"
              </p>
              {showExample && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">{currentExample.title}</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{currentExample.content}</p>
                </div>
              )}
              <input
                type="text"
                value={answers.agentRole}
                onChange={(e) => setAnswers({ ...answers, agentRole: e.target.value })}
                placeholder="e.g., Customer Support Representative"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoFocus
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  What is your company name?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExample(!showExample)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  {showExample ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showExample ? 'Hide' : 'Show'} Example
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This helps personalize the agent's introduction and responses
              </p>
              {showExample && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">{currentExample.title}</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{currentExample.content}</p>
                </div>
              )}
              <input
                type="text"
                value={answers.companyName}
                onChange={(e) => setAnswers({ ...answers, companyName: e.target.value })}
                placeholder="e.g., Acme Corporation"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoFocus
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  What is the primary task or goal?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExample(!showExample)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  {showExample ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showExample ? 'Hide' : 'Show'} Example
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Describe what the agent should accomplish during calls
              </p>
              {showExample && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">{currentExample.title}</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{currentExample.content}</p>
                </div>
              )}
              <textarea
                value={answers.primaryTask}
                onChange={(e) => setAnswers({ ...answers, primaryTask: e.target.value })}
                placeholder="e.g., Answer customer questions, provide product information, and transfer to sales if needed"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                rows={4}
                autoFocus
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  What tone and style should the agent use?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExample(!showExample)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  {showExample ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showExample ? 'Hide' : 'Show'} Example
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose the personality that best fits your brand
              </p>
              {showExample && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">{currentExample.title}</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{currentExample.content}</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'professional', label: 'Professional & Polite', desc: 'Formal, respectful, business-appropriate' },
                  { value: 'friendly', label: 'Friendly & Warm', desc: 'Approachable, conversational, personable' },
                  { value: 'casual', label: 'Casual & Relaxed', desc: 'Informal, easygoing, down-to-earth' },
                  { value: 'empathetic', label: 'Empathetic & Caring', desc: 'Understanding, supportive, compassionate' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAnswers({ ...answers, toneStyle: option.value })}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      answers.toneStyle === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  How detailed should responses be?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExample(!showExample)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  {showExample ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showExample ? 'Hide' : 'Show'} Example
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose the appropriate response length for your use case
              </p>
              {showExample && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">{currentExample.title}</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{currentExample.content}</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'brief' as const, label: 'Brief & Concise', desc: 'Short, to-the-point responses' },
                  { value: 'moderate' as const, label: 'Moderate Detail', desc: 'Balanced, informative responses' },
                  { value: 'detailed' as const, label: 'Comprehensive', desc: 'Thorough, detailed explanations' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAnswers({ ...answers, responseLength: option.value })}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      answers.responseLength === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Additional Instructions (Optional)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExample(!showExample)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  {showExample ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showExample ? 'Hide' : 'Show'} Example
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Add any special requirements, error handling rules, or specific behaviors
              </p>
              {showExample && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">{currentExample.title}</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{currentExample.content}</p>
                </div>
              )}
              <textarea
                value={answers.specialInstructions}
                onChange={(e) => setAnswers({ ...answers, specialInstructions: e.target.value })}
                placeholder="e.g., If customer mentions a competitor, explain our unique advantages"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                rows={4}
              />
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Error Handling Instructions (Optional)
              </label>
              <input
                type="text"
                value={answers.errorHandling}
                onChange={(e) => setAnswers({ ...answers, errorHandling: e.target.value })}
                placeholder="e.g., If unable to understand, ask clarifying questions"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                AI System Prompt Helper
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Step {step} of {totalSteps}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 dark:bg-purple-500 transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1 || generating}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed() || generating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={generateSystemPrompt}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Prompt & First Message
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
