import { useEffect, useState, useCallback, memo } from 'react';
import { X, Loader2, Sparkles, AlertCircle, RefreshCw, Phone, PhoneOff, MessageSquare, HelpCircle, Zap, GitBranch } from 'lucide-react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Handle,
  Position,
  NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { d1Client } from '../lib/d1';

interface PromptVisualizerModalProps {
  systemPrompt: string;
  agentId: string;
  agentName?: string;
  onClose: () => void;
}

// ============================================
// CUSTOM NODE COMPONENTS
// ============================================

// Start Node - Green circle
const StartNode = memo(({ data, isConnectable }: NodeProps) => (
  <div className="px-4 py-3 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg border-2 border-green-400 min-w-[120px] text-center">
    <div className="flex items-center justify-center gap-2">
      <Phone className="w-4 h-4" />
      <span className="font-semibold text-sm">{data.label}</span>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-green-400" />
  </div>
));
StartNode.displayName = 'StartNode';

// End Node - Red or Green based on outcome
const EndNode = memo(({ data, isConnectable }: NodeProps) => {
  const isSuccess = data.outcome === 'success';
  return (
    <div className={`px-4 py-3 rounded-full ${isSuccess ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400' : 'bg-gradient-to-br from-red-500 to-rose-600 border-red-400'} text-white shadow-lg border-2 min-w-[120px] text-center`}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className={isSuccess ? '!bg-green-400' : '!bg-red-400'} />
      <div className="flex items-center justify-center gap-2">
        <PhoneOff className="w-4 h-4" />
        <span className="font-semibold text-sm">{data.label}</span>
      </div>
    </div>
  );
});
EndNode.displayName = 'EndNode';

// Message Node - Blue box for AI speech
const MessageNode = memo(({ data, isConnectable }: NodeProps) => (
  <div className="px-4 py-3 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-2 border-blue-400 min-w-[180px] max-w-[280px]">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-blue-400" />
    <div className="flex items-start gap-2">
      <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <div className="font-semibold text-sm">{data.label}</div>
        {data.content && <div className="text-xs mt-1 opacity-90 italic">"{data.content}"</div>}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-blue-400" />
  </div>
));
MessageNode.displayName = 'MessageNode';

// Question/Decision Node - Yellow diamond shape (made with rotation)
const QuestionNode = memo(({ data, isConnectable }: NodeProps) => (
  <div className="relative">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-amber-400 !-top-1" />
    <div className="px-5 py-4 bg-gradient-to-br from-amber-400 to-yellow-500 text-gray-900 shadow-lg border-2 border-amber-300 min-w-[200px] max-w-[300px] rounded-lg" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
    </div>
    {/* Content overlay since clip-path clips content */}
    <div className="absolute inset-0 flex items-center justify-center px-4">
      <div className="text-center">
        <HelpCircle className="w-4 h-4 mx-auto mb-1 text-gray-800" />
        <div className="font-semibold text-xs text-gray-900">{data.label}</div>
        {data.question && <div className="text-[10px] mt-1 text-gray-700">"{data.question}"</div>}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} id="yes" isConnectable={isConnectable} className="!bg-green-500 !-bottom-1 !left-1/3" />
    <Handle type="source" position={Position.Bottom} id="no" isConnectable={isConnectable} className="!bg-red-500 !-bottom-1 !left-2/3" />
  </div>
));
QuestionNode.displayName = 'QuestionNode';

// Decision Node - Yellow/amber with prominent question display
const DecisionNode = memo(({ data, isConnectable }: NodeProps) => (
  <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-gray-900 shadow-xl border-2 border-amber-300/70 min-w-[200px] max-w-[300px] relative">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-amber-600 !w-3 !h-3" />
    
    {/* Decision indicator diamond */}
    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-600 rotate-45 rounded-sm" />
    
    <div className="flex items-start gap-2 ml-1">
      <GitBranch className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-800" />
      <div className="flex-1">
        <div className="font-bold text-sm text-amber-900">{data.label}</div>
        {data.question && (
          <div className="text-xs mt-1.5 text-amber-800 bg-amber-200/50 rounded px-2 py-1 italic">
            "{data.question}"
          </div>
        )}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-amber-600 !w-3 !h-3" />
  </div>
));
DecisionNode.displayName = 'DecisionNode';

// Action Node - Purple box
const ActionNode = memo(({ data, isConnectable }: NodeProps) => (
  <div className="px-4 py-3 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg border-2 border-purple-400 min-w-[160px] max-w-[260px]">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-purple-400" />
    <div className="flex items-start gap-2">
      <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <div className="font-semibold text-sm">{data.label}</div>
        {data.description && <div className="text-xs mt-1 opacity-90">{data.description}</div>}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-purple-400" />
  </div>
));
ActionNode.displayName = 'ActionNode';

// Condition Node - Orange box for if/else
const ConditionNode = memo(({ data, isConnectable }: NodeProps) => (
  <div className="px-4 py-3 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg border-2 border-orange-400 min-w-[160px] max-w-[260px]">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-orange-400" />
    <div className="flex items-start gap-2">
      <GitBranch className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <div className="font-semibold text-sm">{data.label}</div>
        {data.condition && <div className="text-xs mt-1 opacity-90">If: {data.condition}</div>}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-orange-400" />
  </div>
));
ConditionNode.displayName = 'ConditionNode';

// Node types mapping
const nodeTypes = {
  start: StartNode,
  end: EndNode,
  message: MessageNode,
  question: QuestionNode,
  decision: DecisionNode,
  action: ActionNode,
  condition: ConditionNode,
};

// ============================================
// AI PROMPT FOR DEEP CALL FLOW EXTRACTION
// ============================================

const CALL_FLOW_EXTRACTION_PROMPT = `You are an expert at analyzing voice AI system prompts and extracting DETAILED call flow decision trees.

Your job is to extract EVERY decision point, conditional branch, and outcome from the prompt. Think like you're mapping out exactly what the AI agent does at each step of the call.

## CRITICAL REQUIREMENTS
1. Extract ALL qualification questions as separate decision nodes
2. Create branching paths for EVERY if/then/else condition
3. Show the FULL depth of nested conditions (e.g., if homeowner → then check project type → then check timeline)
4. Every decision MUST have at least 2 outgoing paths with clear labels (Yes/No, Qualified/Not Qualified, etc.)
5. Extract 8-20 nodes minimum for a typical prompt - be thorough!

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "title": "Brief title for the flow",
  "nodes": [
    {
      "id": "unique-id",
      "type": "start|end|message|decision|action",
      "label": "Short label (3-5 words)",
      "content": "What AI says (for message nodes)",
      "question": "The exact question asked (for decision nodes)",
      "description": "Action description (for action nodes)",
      "outcome": "success|failure|neutral (for end nodes)"
    }
  ],
  "edges": [
    {
      "source": "source-node-id",
      "target": "target-node-id",
      "label": "Yes|No|Specific condition like 'Homeowner'|'Not Interested'"
    }
  ]
}

## NODE TYPES
- **start**: Call begins (exactly 1)
- **message**: AI says something (greeting, info, confirmation)
- **decision**: Question that BRANCHES into multiple paths (YES/NO, multiple choice)
- **action**: Do something (book appointment, transfer, collect info, lookup data)
- **end**: Call terminates (mark outcome: success/failure/neutral)

## DETAILED EXAMPLE - Appointment Scheduling:
{
  "title": "Home Improvement Appointment Scheduling",
  "nodes": [
    {"id": "start", "type": "start", "label": "Inbound Call"},
    {"id": "greet", "type": "message", "label": "Greeting", "content": "Hi, thanks for calling ABC Home Services!"},
    {"id": "ask-homeowner", "type": "decision", "label": "Homeowner Check", "question": "Are you the homeowner?"},
    {"id": "ask-project", "type": "decision", "label": "Project Type", "question": "What type of project are you interested in?"},
    {"id": "ask-timeline", "type": "decision", "label": "Timeline Check", "question": "When are you looking to start?"},
    {"id": "ask-budget", "type": "decision", "label": "Budget Range", "question": "What's your approximate budget?"},
    {"id": "collect-info", "type": "action", "label": "Collect Info", "description": "Get name, address, phone, email"},
    {"id": "check-availability", "type": "action", "label": "Check Calendar", "description": "Look up available appointment slots"},
    {"id": "offer-times", "type": "decision", "label": "Offer Times", "question": "We have Tuesday at 10am or Thursday at 2pm. Which works better?"},
    {"id": "confirm-booking", "type": "action", "label": "Book Appointment", "description": "Confirm and schedule the appointment"},
    {"id": "end-booked", "type": "end", "label": "Appointment Confirmed", "outcome": "success"},
    {"id": "end-not-homeowner", "type": "end", "label": "Not Homeowner", "outcome": "failure"},
    {"id": "end-not-ready", "type": "end", "label": "Not Ready Yet", "outcome": "neutral"},
    {"id": "end-no-times-work", "type": "end", "label": "No Available Times", "outcome": "neutral"}
  ],
  "edges": [
    {"source": "start", "target": "greet"},
    {"source": "greet", "target": "ask-homeowner"},
    {"source": "ask-homeowner", "target": "ask-project", "label": "Yes"},
    {"source": "ask-homeowner", "target": "end-not-homeowner", "label": "No"},
    {"source": "ask-project", "target": "ask-timeline", "label": "Valid Project"},
    {"source": "ask-project", "target": "end-not-ready", "label": "Not Interested"},
    {"source": "ask-timeline", "target": "ask-budget", "label": "Within 3 months"},
    {"source": "ask-timeline", "target": "end-not-ready", "label": "Not Sure / Later"},
    {"source": "ask-budget", "target": "collect-info", "label": "Has Budget"},
    {"source": "ask-budget", "target": "end-not-ready", "label": "No Budget"},
    {"source": "collect-info", "target": "check-availability"},
    {"source": "check-availability", "target": "offer-times"},
    {"source": "offer-times", "target": "confirm-booking", "label": "Time Selected"},
    {"source": "offer-times", "target": "end-no-times-work", "label": "No Times Work"},
    {"source": "confirm-booking", "target": "end-booked"}
  ]
}

## EXTRACTION RULES
1. READ the prompt carefully and identify:
   - Opening/greeting phrases → message nodes
   - Questions asked to caller → decision nodes with Yes/No or multiple branches
   - If/then/else logic → MUST create branching edges
   - Actions taken (booking, transferring, looking up) → action nodes
   - Ways the call can end → end nodes with appropriate outcomes

2. Every "if" condition in the prompt = decision node with 2+ outgoing edges
3. Nested conditions = chain of decision nodes
4. Be GENEROUS with nodes - more detail is better than less
5. Label edges clearly: "Yes", "No", "Qualified", "Not Interested", "Has Budget", etc.

Now extract the COMPLETE call flow from this prompt:
`;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function getCacheKey(agentId: string): string {
  return `call-flow-viz-${agentId}`;
}

function getCachedFlow(agentId: string, promptHash: string): any | null {
  try {
    const cached = localStorage.getItem(getCacheKey(agentId));
    if (cached) {
      const data = JSON.parse(cached);
      if (data.promptHash === promptHash && data.flowData) {
        return data.flowData;
      }
    }
  } catch (e) {
    console.error('Error reading cache:', e);
  }
  return null;
}

function saveToCache(agentId: string, promptHash: string, flowData: any): void {
  try {
    localStorage.setItem(getCacheKey(agentId), JSON.stringify({
      promptHash,
      flowData,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.error('Error saving to cache:', e);
  }
}

// Layout using Dagre - TB (top-bottom) with wide horizontal spread for decision branches
function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Calculate complexity to adjust spacing
  const decisionCount = nodes.filter(n => n.type === 'decision').length;
  const nodeCount = nodes.length;
  const baseHorizontalSpace = Math.max(120, Math.min(200, 1000 / Math.max(decisionCount, 3)));
  
  dagreGraph.setGraph({ 
    rankdir: 'TB', 
    nodesep: baseHorizontalSpace,  // Wide horizontal spacing for branches
    ranksep: 120, // Vertical spacing between levels
    marginx: 80,
    marginy: 60,
    ranker: 'network-simplex', // Better for decision trees
  });

  // Set node dimensions based on type
  nodes.forEach((node) => {
    let width = 200;
    let height = 70;
    
    if (node.type === 'start') {
      width = 140;
      height = 50;
    } else if (node.type === 'end') {
      width = 160;
      height = 50;
    } else if (node.type === 'decision') {
      width = 220;
      height = 85;
    } else if (node.type === 'message') {
      width = 220;
      height = 75;
    } else if (node.type === 'action') {
      width = 200;
      height = 70;
    }
    
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    let width = 200;
    if (node.type === 'start') width = 140;
    else if (node.type === 'end') width = 160;
    else if (node.type === 'decision' || node.type === 'message') width = 220;
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - 35,
      },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Determine edge color based on label (Yes = green, No = red, etc.)
function getEdgeColor(label: string | undefined, isDarkMode: boolean): { stroke: string; marker: string } {
  if (!label) return { stroke: isDarkMode ? '#6b7280' : '#9ca3af', marker: isDarkMode ? '#6b7280' : '#9ca3af' };
  
  const lowerLabel = label.toLowerCase();
  
  // Positive outcomes - Green
  if (lowerLabel === 'yes' || lowerLabel.includes('qualified') || lowerLabel.includes('success') || 
      lowerLabel.includes('homeowner') || lowerLabel.includes('valid') || lowerLabel.includes('has') ||
      lowerLabel.includes('selected') || lowerLabel.includes('confirmed') || lowerLabel.includes('interested') ||
      lowerLabel.includes('within') || lowerLabel.includes('budget')) {
    return { stroke: isDarkMode ? '#22c55e' : '#16a34a', marker: isDarkMode ? '#22c55e' : '#16a34a' };
  }
  
  // Negative outcomes - Red
  if (lowerLabel === 'no' || lowerLabel.includes('not ') || lowerLabel.includes('fail') || 
      lowerLabel.includes('reject') || lowerLabel.includes('decline') || lowerLabel.includes('no budget') ||
      lowerLabel.includes('later') || lowerLabel.includes('not sure')) {
    return { stroke: isDarkMode ? '#ef4444' : '#dc2626', marker: isDarkMode ? '#ef4444' : '#dc2626' };
  }
  
  // Neutral - Gray
  return { stroke: isDarkMode ? '#8b5cf6' : '#7c3aed', marker: isDarkMode ? '#8b5cf6' : '#7c3aed' };
}

// Convert AI output to React Flow format
function convertToReactFlow(flowData: any, isDarkMode: boolean): { nodes: Node[], edges: Edge[] } {
  const nodes: Node[] = flowData.nodes.map((node: any) => ({
    id: node.id,
    type: node.type === 'question' ? 'decision' : node.type, // Use decision for questions
    data: {
      label: node.label,
      content: node.content,
      question: node.question,
      condition: node.condition,
      description: node.description,
      outcome: node.outcome,
    },
    position: { x: 0, y: 0 }, // Will be set by dagre
  }));

  const edges: Edge[] = flowData.edges.map((edge: any, index: number) => {
    const edgeColors = getEdgeColor(edge.label, isDarkMode);
    const hasLabel = edge.label && edge.label.trim().length > 0;
    
    return {
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: false,
      style: { 
        stroke: edgeColors.stroke, 
        strokeWidth: hasLabel ? 2.5 : 2,
      },
      labelStyle: {
        fill: isDarkMode ? '#ffffff' : '#1f2937',
        fontWeight: 700,
        fontSize: 11,
        textTransform: 'uppercase' as const,
      },
      labelBgStyle: {
        fill: edgeColors.stroke,
        fillOpacity: 0.95,
        rx: 6,
        ry: 6,
      },
      labelBgPadding: [10, 5] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColors.marker,
        width: 20,
        height: 20,
      },
    };
  });

  return getLayoutedElements(nodes, edges);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PromptVisualizerModal({ systemPrompt, agentId, agentName, onClose }: PromptVisualizerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedCache, setUsedCache] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [flowData, setFlowData] = useState<any>(null);
  const [flowTitle, setFlowTitle] = useState('Call Flow');

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // AI extraction
  const extractCallFlow = useCallback(async (prompt: string): Promise<any> => {
    const settings = await d1Client.getUserSettings();
    if (!settings.openaiApiKey) throw new Error('OpenAI API key not configured.');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: CALL_FLOW_EXTRACTION_PROMPT + prompt }],
        temperature: 0.2,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    
    return JSON.parse(jsonStr);
  }, []);

  // Initialize visualization
  const initVisualization = useCallback(async (forceRegenerate = false) => {
    if (!systemPrompt.trim()) {
      setError('No system prompt provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUsedCache(false);

    try {
      const promptHash = hashPrompt(systemPrompt);
      let data: any = null;

      if (!forceRegenerate) {
        data = getCachedFlow(agentId, promptHash);
        if (data) {
          setUsedCache(true);
        }
      }

      if (!data) {
        data = await extractCallFlow(systemPrompt);
        saveToCache(agentId, promptHash, data);
      }

      setFlowData(data);
      setFlowTitle(data.title || 'Call Flow');
    } catch (err: any) {
      console.error('Error extracting call flow:', err);
      setError(err.message || 'Failed to extract call flow');
    } finally {
      setLoading(false);
    }
  }, [systemPrompt, agentId, extractCallFlow]);

  useEffect(() => {
    initVisualization();
  }, [initVisualization]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Styles
  const bgClass = isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200';
  const headerClass = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200';
  const textClass = isDarkMode ? 'text-white' : 'text-gray-900';
  const subTextClass = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const btnClass = isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 ${isDarkMode ? 'bg-black/70' : 'bg-black/50'} backdrop-blur-sm`} onClick={onClose} />
      
      <div className={`relative w-[95vw] h-[90vh] ${bgClass} rounded-2xl shadow-2xl border flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${headerClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${textClass}`}>{flowTitle}</h2>
              <p className={`text-sm ${subTextClass}`}>{agentName ? `${agentName} - ` : ''}User journey visualization</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {usedCache && !loading && (
              <span className={`px-3 py-1 ${isDarkMode ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-100 text-green-700 border-green-300'} text-xs font-medium rounded-full border`}>Cached</span>
            )}
            {!usedCache && !loading && !error && (
              <span className={`px-3 py-1 ${isDarkMode ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-violet-100 text-violet-700 border-violet-300'} text-xs font-medium rounded-full border`}>AI-Generated</span>
            )}
            
            <button
              onClick={() => initVisualization(true)}
              disabled={loading}
              className={`p-2 ${btnClass} rounded-lg transition-colors disabled:opacity-50`}
              title="Regenerate"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button onClick={onClose} className={`p-2 ${btnClass} rounded-lg transition-colors`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className={`px-6 py-2 border-b ${isDarkMode ? 'border-gray-700/50 bg-gray-800/30' : 'border-gray-200 bg-gray-50/50'} flex items-center gap-4 text-xs flex-wrap`}>
          <span className={`${subTextClass} font-semibold`}>Nodes:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gradient-to-br from-green-500 to-emerald-600" />
            <span className={subTextClass}>Start</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-br from-blue-500 to-blue-600" />
            <span className={subTextClass}>Message</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-br from-amber-400 to-yellow-500" />
            <span className={subTextClass}>Decision</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-br from-purple-500 to-violet-600" />
            <span className={subTextClass}>Action</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500 to-rose-600" />
            <span className={subTextClass}>End</span>
          </span>
          
          <span className={`${subTextClass} font-semibold ml-4`}>Paths:</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-4 h-0.5 ${isDarkMode ? 'bg-green-500' : 'bg-green-600'}`} />
            <span className={subTextClass}>Yes/Positive</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-4 h-0.5 ${isDarkMode ? 'bg-red-500' : 'bg-red-600'}`} />
            <span className={subTextClass}>No/Negative</span>
          </span>
        </div>

        {/* Content */}
        <div className={`flex-1 relative overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {loading && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${isDarkMode ? 'bg-gray-900/90' : 'bg-white/90'}`}>
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className={`text-sm ${subTextClass}`}>AI is analyzing your prompt...</p>
              <p className={`text-xs ${subTextClass} mt-1`}>Extracting call flow structure</p>
            </div>
          )}

          {error && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${isDarkMode ? 'bg-gray-900/90' : 'bg-white/90'}`}>
              <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-center max-w-md">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 mb-4">{error}</p>
                <button onClick={() => initVisualization(true)} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm">Try Again</button>
              </div>
            </div>
          )}

          {!loading && !error && flowData && (
            <ReactFlowProvider>
              <FlowGraph flowData={flowData} isDarkMode={isDarkMode} />
            </ReactFlowProvider>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t ${isDarkMode ? 'border-gray-700/50 bg-gray-800/30' : 'border-gray-200 bg-gray-50/50'}`}>
          <div className={`flex items-center justify-between text-xs ${subTextClass}`}>
            <span>Scroll to zoom • Drag to pan • Drag nodes to reorganize</span>
            <span>Press <kbd className={`px-1.5 py-0.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded`}>Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FLOW GRAPH COMPONENT (uses ReactFlow hooks)
// ============================================

function FlowGraph({ flowData, isDarkMode }: { flowData: any, isDarkMode: boolean }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = convertToReactFlow(flowData, isDarkMode);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [flowData, isDarkMode, setNodes, setEdges, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      nodesDraggable={true}
      nodesConnectable={false}
      minZoom={0.2}
      maxZoom={2}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background color={isDarkMode ? '#374151' : '#e5e7eb'} gap={20} size={1} />
      <Controls className={`${isDarkMode ? 'bg-gray-800 border-gray-700 [&>button]:bg-gray-800 [&>button]:border-gray-700 [&>button]:text-white [&>button:hover]:bg-gray-700' : ''}`} />
      <Panel position="bottom-center" className={`px-4 py-2 rounded-full text-xs font-medium ${isDarkMode ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-white text-gray-500 border border-gray-200 shadow-sm'}`}>
        User Journey Flow • {nodes.length} steps
      </Panel>
    </ReactFlow>
  );
}
