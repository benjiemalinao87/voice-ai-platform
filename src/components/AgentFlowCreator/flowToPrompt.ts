import type { Node, Edge } from 'reactflow';

export interface ApiHeader {
  key: string;
  value: string;
}

export interface ResponseMapping {
  path: string;      // JSON path like "data.customer.name"
  label: string;     // Display name for the field
  enabled: boolean;  // Whether to include in context
}

export interface ApiConfig {
  endpoint: string;              // e.g., "https://api.example.com/customer/{phone}"
  method: 'GET';                 // GET only for now
  headers: ApiHeader[];          // Custom headers
  testPhone?: string;            // For UI testing
  responseMapping: ResponseMapping[];  // Which fields to extract
  lastTestResponse?: any;        // Store last test result for UI display
}

export interface FlowNodeData {
  label: string;
  content?: string;
  intents?: string[];
  actionType?: string;
  transferNumber?: string;
  endMessage?: string;
  apiConfig?: ApiConfig;         // API configuration for action nodes
}

/**
 * Convert visual flow nodes and edges to a system prompt
 * Includes [[NODE:id]] markers for real-time flow visualization tracking
 */
export function flowToPrompt(nodes: Node<FlowNodeData>[], edges: Edge[]): string {
  const sections: string[] = [];
  
  // Find start node
  const startNode = nodes.find(n => n.type === 'start');
  if (!startNode) {
    return 'No conversation flow defined.';
  }

  // Build adjacency map
  const adjacencyMap = new Map<string, string[]>();
  edges.forEach(edge => {
    const sources = adjacencyMap.get(edge.source) || [];
    sources.push(edge.target);
    adjacencyMap.set(edge.source, sources);
  });

  // Get edge label for a connection
  const getEdgeLabel = (sourceId: string, targetId: string): string | undefined => {
    const edge = edges.find(e => e.source === sourceId && e.target === targetId);
    return edge?.label as string | undefined;
  };

  // Traverse flow and build prompt
  const visited = new Set<string>();
  const flowSteps: string[] = [];
  let stepNumber = 1;

  const processNode = (nodeId: string, indent: string = ''): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nextNodeIds = adjacencyMap.get(nodeId) || [];

    switch (node.type) {
      case 'start':
        flowSteps.push(`${stepNumber}. [CALL STARTS] Begin the conversation.`);
        stepNumber++;
        break;

      case 'message':
        if (node.data.content) {
          flowSteps.push(`${stepNumber}. [SAY] "${node.data.content}"`);
        } else {
          flowSteps.push(`${stepNumber}. [SAY] ${node.data.label}`);
        }
        stepNumber++;
        break;

      case 'listen':
        // Stronger wait instructions to ensure AI pauses for user input
        flowSteps.push(`${stepNumber}. [WAIT FOR USER RESPONSE]`);
        flowSteps.push(`   ⚠️ CRITICAL: You MUST stop speaking completely and wait for the user to respond.`);
        flowSteps.push(`   - Do NOT continue speaking until the user has answered.`);
        flowSteps.push(`   - Do NOT assume what the user wants.`);
        flowSteps.push(`   - Do NOT offer multiple options in rapid succession.`);
        flowSteps.push(`   - Ask your question, then STOP and LISTEN.`);
        if (node.data.intents && node.data.intents.length > 0) {
          flowSteps.push(`   - Expected user choices: ${node.data.intents.join(', ')}`);
          flowSteps.push(`   - After user responds, acknowledge their choice before proceeding.`);
        }
        stepNumber++;
        break;

      case 'branch':
        flowSteps.push(`${stepNumber}. [BRANCH] Based on detected intent, choose the appropriate response:`);
        stepNumber++;
        
        // Add branch conditions
        nextNodeIds.forEach(targetId => {
          const label = getEdgeLabel(nodeId, targetId);
          const targetNode = nodes.find(n => n.id === targetId);
          if (label && targetNode) {
            flowSteps.push(`   - If user wants "${label}": Go to ${targetNode.data.label}`);
          }
        });
        break;

      case 'action':
        const actionType = node.data.actionType || 'custom';
        flowSteps.push(`${stepNumber}. [ACTION: ${actionType.toUpperCase()}] ${node.data.content || node.data.label}`);
        stepNumber++;
        break;

      case 'transfer':
        const transferNumber = node.data.transferNumber || 'configured number';
        flowSteps.push(`${stepNumber}. [TRANSFER] Transfer call to ${transferNumber}`);
        stepNumber++;
        break;

      case 'end':
        if (node.data.endMessage || node.data.content) {
          flowSteps.push(`${stepNumber}. [END CALL] Say: "${node.data.endMessage || node.data.content}" and end the call.`);
        } else {
          flowSteps.push(`${stepNumber}. [END CALL] End the conversation politely.`);
        }
        stepNumber++;
        return; // Don't process children of end node
    }

    // Process next nodes (except for branch which handles its own children)
    if (node.type !== 'branch') {
      nextNodeIds.forEach(nextId => processNode(nextId, indent));
    } else {
      // For branch, process all branches
      nextNodeIds.forEach(nextId => processNode(nextId, indent + '  '));
    }
  };

  processNode(startNode.id);

  // Build the final prompt
  sections.push('[CONVERSATION FLOW]');
  sections.push('Follow this conversation flow step by step:');
  sections.push('');
  sections.push(...flowSteps);
  sections.push('');
  sections.push('[CRITICAL RULES]');
  sections.push('1. WAITING IS MANDATORY: When the flow says "WAIT FOR USER RESPONSE", you MUST:');
  sections.push('   - Complete your current sentence/question');
  sections.push('   - STOP talking completely');
  sections.push('   - Wait silently for the user to speak');
  sections.push('   - Do NOT fill silence with additional options or suggestions');
  sections.push('   - Do NOT continue the conversation until user responds');
  sections.push('');
  sections.push('2. ACKNOWLEDGMENT: After the user responds:');
  sections.push('   - First acknowledge their choice ("Great choice!" or "I understand you want...")');
  sections.push('   - Then proceed to the appropriate next step');
  sections.push('');
  sections.push('3. GENERAL RULES:');
  sections.push('   - Follow the flow steps in order');
  sections.push('   - Be natural and conversational');
  sections.push('   - If the user asks something unexpected, acknowledge it and guide them back to the flow');
  sections.push('   - Always be helpful and professional');

  return sections.join('\n');
}

/**
 * Validate that the flow is complete and correct
 */
export function validateFlow(nodes: Node<FlowNodeData>[], edges: Edge[]): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  // Check for start node
  const startNodes = nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Flow must have a Start node');
  } else if (startNodes.length > 1) {
    errors.push('Flow can only have one Start node');
  }

  // Check for terminal nodes (end or transfer)
  const endNodes = nodes.filter(n => n.type === 'end');
  const transferNodes = nodes.filter(n => n.type === 'transfer');
  if (endNodes.length === 0 && transferNodes.length === 0) {
    errors.push('Flow must have at least one End or Transfer node');
  }

  // Check for disconnected nodes (except start which has no incoming)
  const nodesWithIncoming = new Set(edges.map(e => e.target));
  nodes.forEach(node => {
    if (node.type !== 'start' && !nodesWithIncoming.has(node.id)) {
      errors.push(`Node "${node.data.label}" has no incoming connection`);
    }
  });

  // Check that all non-terminal nodes have outgoing connections
  // Terminal nodes: 'end' and 'transfer' don't need outgoing connections
  const nodesWithOutgoing = new Set(edges.map(e => e.source));
  nodes.forEach(node => {
    const isTerminalNode = node.type === 'end' || node.type === 'transfer';
    if (!isTerminalNode && !nodesWithOutgoing.has(node.id)) {
      errors.push(`Node "${node.data.label}" has no outgoing connection`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get initial nodes for a new flow
 */
export function getInitialNodes(): Node<FlowNodeData>[] {
  return [
    {
      id: 'start-1',
      type: 'start',
      position: { x: 400, y: 50 },
      data: { label: 'Call Starts' },
    },
    {
      id: 'message-1',
      type: 'message',
      position: { x: 400, y: 180 },
      data: { 
        label: 'Greeting', 
        content: 'Hello! Thank you for calling. How can I help you today?' 
      },
    },
    {
      id: 'listen-1',
      type: 'listen',
      position: { x: 400, y: 310 },
      data: { 
        label: 'Listen for Intent',
        intents: ['Appointment', 'Information', 'Support']
      },
    },
    {
      id: 'branch-1',
      type: 'branch',
      position: { x: 400, y: 440 },
      data: { 
        label: 'Route by Intent'
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 150, y: 580 },
      data: { 
        label: 'Book Appointment',
        content: 'Schedule appointment',
        actionType: 'appointment'
      },
    },
    {
      id: 'message-2',
      type: 'message',
      position: { x: 400, y: 580 },
      data: { 
        label: 'Provide Info',
        content: 'Let me provide you with that information...'
      },
    },
    {
      id: 'transfer-1',
      type: 'transfer',
      position: { x: 650, y: 580 },
      data: { 
        label: 'Transfer to Support',
        transferNumber: '+1234567890'
      },
    },
    {
      id: 'end-1',
      type: 'end',
      position: { x: 400, y: 720 },
      data: { 
        label: 'End Call',
        endMessage: 'Thank you for calling. Have a great day!'
      },
    }
  ];
}

/**
 * Get initial edges for a new flow
 */
export function getInitialEdges(): Edge[] {
  return [
    { id: 'e1-2', source: 'start-1', target: 'message-1', animated: true, style: { stroke: '#10b981' } },
    { id: 'e2-3', source: 'message-1', target: 'listen-1', animated: true, style: { stroke: '#3b82f6' } },
    { id: 'e3-4', source: 'listen-1', target: 'branch-1', animated: true, style: { stroke: '#6366f1' } },
    { id: 'e4-5', source: 'branch-1', target: 'action-1', label: 'Appointment', animated: true, style: { stroke: '#a855f7' } },
    { id: 'e4-6', source: 'branch-1', target: 'message-2', label: 'Info', animated: true, style: { stroke: '#a855f7' } },
    { id: 'e4-7', source: 'branch-1', target: 'transfer-1', label: 'Support', animated: true, style: { stroke: '#a855f7' } },
    { id: 'e5-8', source: 'action-1', target: 'end-1', animated: true, style: { stroke: '#f97316' } },
    { id: 'e6-8', source: 'message-2', target: 'end-1', animated: true, style: { stroke: '#3b82f6' } },
    { id: 'e7-8', source: 'transfer-1', target: 'end-1', animated: true, style: { stroke: '#06b6d4' } },
  ];
}

