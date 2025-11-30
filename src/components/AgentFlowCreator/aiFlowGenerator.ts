/**
 * AI Flow Generator
 * Generates voice agent flows from natural language descriptions
 */

import { Node, Edge } from 'reactflow';
import { d1Client } from '../../lib/d1';
import type { FlowNodeData } from './flowToPrompt';

export interface GeneratedFlow {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  summary: string;
}

export interface GenerationResult {
  success: boolean;
  flow?: GeneratedFlow;
  error?: string;
}

/**
 * System prompt that teaches the AI about node types and flow construction
 */
const FLOW_GENERATOR_SYSTEM_PROMPT = `You are an expert Voice AI flow designer. Your job is to create conversational flow structures for voice agents based on user descriptions.

## NODE TYPES

Each node has: id, type, position {x, y}, and data {label, content?, ...}

1. **start** - Entry point of the call
   - data: { label: "Call Starts" }
   - Every flow MUST begin with exactly one start node
   - Position: Usually at top center

2. **message** - AI speaks to the user
   - data: { label: "Short title", content: "What the AI says..." }
   - Use for greetings, questions, confirmations, information
   - Example: { label: "Greeting", content: "Welcome! How can I help you today?" }

3. **listen** - Wait for user to respond
   - data: { label: "Wait for response" }
   - ALWAYS place after a message that asks a question
   - The AI pauses and listens for user input

4. **branch** - Route based on user's response
   - data: { label: "Route by intent" }
   - ALWAYS place after a listen node
   - Connect to multiple message nodes via labeled edges
   - Edge labels should match the target node's label

5. **action** - Execute an API call or data lookup
   - data: { label: "Action name", actionType: "data_lookup" }
   - Use for CRM lookups, booking systems, etc.

6. **transfer** - Transfer call to human or phone number
   - data: { label: "Transfer to Human", transferNumber: "+1234567890" }
   - Use when user needs human assistance

7. **end** - End the call
   - data: { label: "End Call", endMessage: "Thank you, goodbye!" }
   - Every conversation path MUST terminate at an end or transfer node

## FLOW CONSTRUCTION RULES

1. ALWAYS start with a "start" node
2. After a greeting/question message → add "listen" node
3. After "listen" → add "branch" if multiple response paths exist
4. Branch edges MUST have labels matching target options
5. Each branch path should lead to a message node
6. All paths must end with "end" or "transfer" node
7. Use descriptive labels for easy understanding

## POSITIONING GUIDELINES

- Start node: y=50
- Nodes flow downward, increment y by 120-150 per level
- Branch targets spread horizontally (x: 100, 300, 500, etc.)
- Keep x centered around 300 for single paths

## EDGE STRUCTURE

Edges connect nodes: { id: "e-source-target", source: "source-id", target: "target-id", label?: "Option Label" }

- Regular edges: no label needed
- Branch edges: MUST have label matching the intent/option

## EXAMPLE OUTPUT

For "Create a pizza ordering agent with 3 options":

{
  "nodes": [
    { "id": "start-1", "type": "start", "position": { "x": 300, "y": 50 }, "data": { "label": "Call Starts" } },
    { "id": "msg-greeting", "type": "message", "position": { "x": 300, "y": 170 }, "data": { "label": "Greeting", "content": "Welcome to Pizza Palace! We have Margherita, Pepperoni, and Hawaiian pizzas today. Which would you like?" } },
    { "id": "listen-1", "type": "listen", "position": { "x": 300, "y": 290 }, "data": { "label": "Wait for order" } },
    { "id": "branch-1", "type": "branch", "position": { "x": 300, "y": 410 }, "data": { "label": "Route by pizza choice" } },
    { "id": "msg-margherita", "type": "message", "position": { "x": 100, "y": 530 }, "data": { "label": "Margherita", "content": "Great choice! One Margherita pizza coming up. Is there anything else?" } },
    { "id": "msg-pepperoni", "type": "message", "position": { "x": 300, "y": 530 }, "data": { "label": "Pepperoni", "content": "Excellent! One Pepperoni pizza for you. Anything else?" } },
    { "id": "msg-hawaiian", "type": "message", "position": { "x": 500, "y": 530 }, "data": { "label": "Hawaiian", "content": "Perfect! One Hawaiian pizza with pineapple. Need anything else?" } },
    { "id": "end-1", "type": "end", "position": { "x": 300, "y": 650 }, "data": { "label": "End Call", "endMessage": "Thank you for your order! It will be ready in 20 minutes. Goodbye!" } }
  ],
  "edges": [
    { "id": "e-start-greeting", "source": "start-1", "target": "msg-greeting" },
    { "id": "e-greeting-listen", "source": "msg-greeting", "target": "listen-1" },
    { "id": "e-listen-branch", "source": "listen-1", "target": "branch-1" },
    { "id": "e-branch-margherita", "source": "branch-1", "target": "msg-margherita", "label": "Margherita" },
    { "id": "e-branch-pepperoni", "source": "branch-1", "target": "msg-pepperoni", "label": "Pepperoni" },
    { "id": "e-branch-hawaiian", "source": "branch-1", "target": "msg-hawaiian", "label": "Hawaiian" },
    { "id": "e-margherita-end", "source": "msg-margherita", "target": "end-1" },
    { "id": "e-pepperoni-end", "source": "msg-pepperoni", "target": "end-1" },
    { "id": "e-hawaiian-end", "source": "msg-hawaiian", "target": "end-1" }
  ],
  "summary": "Created a pizza ordering flow with greeting, 3 pizza options (Margherita, Pepperoni, Hawaiian), and end call."
}

## RESPONSE FORMAT

ALWAYS respond with valid JSON only. No markdown, no explanations outside JSON.
The JSON must have: nodes (array), edges (array), summary (string).`;

/**
 * Generate a flow from a natural language description
 */
export async function generateFlowFromPrompt(
  userPrompt: string
): Promise<GenerationResult> {
  console.log('[AI Flow Generator] Generating flow for:', userPrompt);
  
  // Get OpenAI API key from settings
  const settings = await d1Client.getUserSettings();
  if (!settings.openaiApiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured. Please add it in Settings.'
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use GPT-4o for better flow generation
        messages: [
          { role: 'system', content: FLOW_GENERATOR_SYSTEM_PROMPT },
          { role: 'user', content: `Create a voice agent flow for: ${userPrompt}` }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AI Flow Generator] API error:', response.status, errorData);
      return {
        success: false,
        error: `API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    console.log('[AI Flow Generator] Raw response:', content);
    
    // Parse JSON response
    let jsonStr = content.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // Validate the generated flow
    const validation = validateGeneratedFlow(parsed);
    if (!validation.valid) {
      console.error('[AI Flow Generator] Validation failed:', validation.errors);
      return {
        success: false,
        error: `Invalid flow structure: ${validation.errors.join(', ')}`
      };
    }
    
    // Add animated edges
    const edges = parsed.edges.map((edge: Edge) => ({
      ...edge,
      animated: true
    }));
    
    console.log('[AI Flow Generator] Successfully generated flow with', parsed.nodes.length, 'nodes');
    
    return {
      success: true,
      flow: {
        nodes: parsed.nodes,
        edges,
        summary: parsed.summary || 'Flow generated successfully'
      }
    };
    
  } catch (error: any) {
    console.error('[AI Flow Generator] Error:', error);
    
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: 'Failed to parse AI response. Please try again.'
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to generate flow'
    };
  }
}

/**
 * Validate the generated flow structure
 */
function validateGeneratedFlow(flow: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check basic structure
  if (!flow.nodes || !Array.isArray(flow.nodes)) {
    errors.push('Missing or invalid nodes array');
  }
  
  if (!flow.edges || !Array.isArray(flow.edges)) {
    errors.push('Missing or invalid edges array');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // Check for start node
  const startNode = flow.nodes.find((n: any) => n.type === 'start');
  if (!startNode) {
    errors.push('Flow must have a start node');
  }
  
  // Check for end or transfer node
  const hasTerminalNode = flow.nodes.some((n: any) => 
    n.type === 'end' || n.type === 'transfer'
  );
  if (!hasTerminalNode) {
    errors.push('Flow must have at least one end or transfer node');
  }
  
  // Check node structure
  for (const node of flow.nodes) {
    if (!node.id || !node.type || !node.position || !node.data) {
      errors.push(`Invalid node structure: ${JSON.stringify(node)}`);
      break;
    }
    
    if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      errors.push(`Invalid position for node ${node.id}`);
    }
    
    if (!node.data.label) {
      errors.push(`Missing label for node ${node.id}`);
    }
  }
  
  // Check edge structure
  const nodeIds = new Set(flow.nodes.map((n: any) => n.id));
  for (const edge of flow.edges) {
    if (!edge.id || !edge.source || !edge.target) {
      errors.push(`Invalid edge structure: ${JSON.stringify(edge)}`);
      break;
    }
    
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge references non-existent source: ${edge.source}`);
    }
    
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge references non-existent target: ${edge.target}`);
    }
  }
  
  // Check branch edges have labels
  const branchNodes = flow.nodes.filter((n: any) => n.type === 'branch');
  for (const branch of branchNodes) {
    const branchEdges = flow.edges.filter((e: any) => e.source === branch.id);
    const unlabeledEdges = branchEdges.filter((e: any) => !e.label);
    if (unlabeledEdges.length > 0) {
      errors.push(`Branch node ${branch.id} has edges without labels`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Auto-layout nodes using simple algorithm
 * (Can be used to clean up AI-generated positions)
 */
export function autoLayoutNodes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Node<FlowNodeData>[] {
  // Find start node
  const startNode = nodes.find(n => n.type === 'start');
  if (!startNode) return nodes;
  
  // Build adjacency map
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) {
      outgoing.set(edge.source, []);
    }
    outgoing.get(edge.source)!.push(edge.target);
  }
  
  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = [{ id: startNode.id, level: 0 }];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    levels.set(id, level);
    
    const targets = outgoing.get(id) || [];
    for (const target of targets) {
      if (!visited.has(target)) {
        queue.push({ id: target, level: level + 1 });
      }
    }
  }
  
  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  for (const [nodeId, level] of levels) {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(nodeId);
  }
  
  // Assign positions
  const ySpacing = 140;
  const xSpacing = 200;
  const centerX = 300;
  
  return nodes.map(node => {
    const level = levels.get(node.id);
    if (level === undefined) return node;
    
    const siblings = levelGroups.get(level) || [];
    const siblingIndex = siblings.indexOf(node.id);
    const totalSiblings = siblings.length;
    
    // Center siblings horizontally
    const startX = centerX - ((totalSiblings - 1) * xSpacing) / 2;
    const x = startX + siblingIndex * xSpacing;
    const y = 50 + level * ySpacing;
    
    return {
      ...node,
      position: { x, y }
    };
  });
}

