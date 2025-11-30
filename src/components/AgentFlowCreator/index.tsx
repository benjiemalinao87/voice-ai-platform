import { useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import { ArrowLeft, Save, Eye, EyeOff, AlertCircle, CheckCircle, Phone, Loader2, X, Activity, FileText, Sparkles } from 'lucide-react';
import { AgentConfigPanel, defaultAgentConfig, type AgentConfig } from './AgentConfigPanel';
import { FlowCanvas, type FlowCanvasRef } from './FlowCanvas';
import { flowToPrompt, validateFlow, getInitialNodes, getInitialEdges, type FlowNodeData, type ApiConfig } from './flowToPrompt';
import { classifyIntent, extractIntentsFromEdges } from './intentClassifier';
import { useVapi } from '../../contexts/VapiContext';
import { d1Client } from '../../lib/d1';
import { agentApi } from '../../lib/api';
import { type VapiCallEvent } from '../VoiceTest';

// Helper to get value from object by dot-notation path
function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Execute API call for Action node and return formatted context
async function executeActionApi(
  apiConfig: ApiConfig,
  customerPhone: string | null
): Promise<{ success: boolean; context: string; error?: string }> {
  try {
    if (!apiConfig.endpoint) {
      return { success: false, context: '', error: 'No API endpoint configured' };
    }

    // Replace {phone} placeholder with customer phone
    let url = apiConfig.endpoint;
    if (customerPhone) {
      url = url.replace('{phone}', encodeURIComponent(customerPhone));
    }

    // Build headers object
    const headers: Record<string, string> = {};
    apiConfig.headers.forEach(h => {
      if (h.key && h.value) {
        headers[h.key] = h.value;
      }
    });

    console.log('🌐 Executing Action API:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API Response:', data);

    // Extract mapped fields
    const enabledMappings = apiConfig.responseMapping.filter(m => m.enabled);
    if (enabledMappings.length === 0) {
      return { success: true, context: '' };
    }

    // Build context string
    const contextLines = enabledMappings.map(mapping => {
      const value = getValueByPath(data, mapping.path);
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'N/A');
      return `- ${mapping.label}: ${displayValue}`;
    });

    const context = `[CONTEXT UPDATE] Customer information retrieved:\n${contextLines.join('\n')}`;
    console.log('📝 Context to inject:', context);

    return { success: true, context };
  } catch (error: any) {
    console.error('❌ Action API error:', error);
    return { success: false, context: '', error: error.message || 'API request failed' };
  }
}

// Inject context into VAPI call using addMessage API (direct to VAPI control URL)
async function injectContextToCall(
  controlUrl: string,
  context: string
): Promise<boolean> {
  try {
    console.log('💉 Injecting context via VAPI control URL');
    
    // Call VAPI's control URL directly with add-message command
    const response = await fetch(controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'add-message',
        message: {
          role: 'system',
          content: context
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VAPI error: ${response.status} - ${errorText}`);
    }

    console.log('✅ Context injected successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to inject context:', error);
    return false;
  }
}

interface AgentFlowCreatorProps {
  onBack: () => void;
  onSuccess: () => void;
  editAgentId?: string; // If provided, load existing flow for editing
}

// Minimal nodes for "Start Fresh" option
const getMinimalNodes = (): Node<FlowNodeData>[] => [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 300, y: 50 },
    data: { label: 'Call Starts' },
  },
  {
    id: 'end-1',
    type: 'end',
    position: { x: 300, y: 300 },
    data: { label: 'End Call' },
  },
];

const getMinimalEdges = (): Edge[] => [];

export function AgentFlowCreator({ onBack, onSuccess, editAgentId }: AgentFlowCreatorProps) {
  const { vapiClient, publicKey, isLoading: vapiLoading, isConfigured } = useVapi();
  const [config, setConfig] = useState<AgentConfig>(defaultAgentConfig);
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [createdAssistantId, setCreatedAssistantId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showTemplateSelection, setShowTemplateSelection] = useState(!editAgentId); // Show for new agents
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Real-time flow visualization state
  const flowCanvasRef = useRef<FlowCanvasRef>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [callTranscript, setCallTranscript] = useState<string[]>([]);
  const [isClassifyingIntent, setIsClassifyingIntent] = useState(false);
  const flowTraversalRef = useRef<{
    currentNodeId: string | null;
    visitedNodes: Set<string>;
    isTraversing: boolean;
    lastUserTranscript: string | null;
    detectedIntent: string | null;
    customerPhone: string | null;
    controlUrl: string | null;
  }>({
    currentNodeId: null,
    visitedNodes: new Set(),
    isTraversing: false,
    lastUserTranscript: null,
    detectedIntent: null,
    customerPhone: null,
    controlUrl: null
  });

  // Load existing flow data when editing (wait for VAPI client to be ready)
  useEffect(() => {
    if (editAgentId && !vapiLoading) {
      // If VAPI client is not ready yet, wait a bit more
      if (!vapiClient && editAgentId) {
        // Check if we have flow data first (doesn't need VAPI)
        loadExistingFlow(editAgentId);
      } else if (vapiClient) {
        loadExistingFlow(editAgentId);
      }
    }
  }, [editAgentId, vapiClient, vapiLoading]);

  // NOTE: We no longer auto-dismiss the assistant ID - it's needed for Voice Test
  // The Voice Test section should remain visible after save so users can test their agent

  // Parse [[NODE:xxx]] marker from AI transcript for accurate flow tracking
  const parseNodeMarker = useCallback((transcript: string): string | null => {
    // Match [[NODE:node-id]] pattern
    const match = transcript.match(/\[\[NODE:([^\]]+)\]\]/);
    if (match) {
      console.log('📍 Parsed node marker:', match[1]);
      return match[1];
    }
    // Also try without brackets in case AI doesn't format correctly
    const altMatch = transcript.match(/NODE:([a-zA-Z0-9-]+)/);
    if (altMatch) {
      console.log('📍 Parsed node marker (alt format):', altMatch[1]);
      return altMatch[1];
    }
    return null;
  }, []);

  // Strip node markers from transcript for display
  const stripNodeMarker = useCallback((transcript: string): string => {
    return transcript
      .replace(/\[\[NODE:[^\]]+\]\]\s*/g, '')
      .replace(/NODE:[a-zA-Z0-9-]+\s*/g, '')
      .trim();
  }, []);

  // Handle VAPI call events for real-time flow visualization
  // Uses [[NODE:xxx]] markers from AI transcripts for accurate tracking
  const handleCallEvent = useCallback((event: VapiCallEvent) => {
    const canvas = flowCanvasRef.current;
    if (!canvas) {
      console.log('⚠️ FlowCanvas ref not available');
      return;
    }

    const traversal = flowTraversalRef.current;
    
    // Log all events for debugging
    console.log('🔔 VAPI Event:', event.type, event.data);

    switch (event.type) {
      case 'call-start': {
        console.log('📞 Call started - resetting flow');
        // Reset and start traversal from start node
        canvas.resetAllNodes();
        traversal.visitedNodes.clear();
        traversal.isTraversing = true;
        setIsCallActive(true);
        setCallTranscript([]);
        setCurrentNodeIndex(0);
        
        // Extract customer phone and control URL from call data
        const callData = event.data;
        if (callData?.customer?.number) {
          traversal.customerPhone = callData.customer.number;
          console.log('📱 Customer phone:', traversal.customerPhone);
        }
        if (callData?.monitor?.controlUrl) {
          traversal.controlUrl = callData.monitor.controlUrl;
          console.log('🎛️ Control URL:', traversal.controlUrl);
        }
        
        // Find and highlight start node
        const allNodes = canvas.getNodes();
        console.log('📋 Available nodes:', allNodes.map(n => `${n.id} (${n.type})`));
        
        const startNode = allNodes.find(n => n.type === 'start');
        if (startNode) {
          console.log('✅ Found start node:', startNode.id);
          traversal.currentNodeId = startNode.id;
          canvas.highlightNode(startNode.id);
          
          // Mark start as complete quickly
          setTimeout(() => {
            canvas.completeNode(startNode.id);
            traversal.visitedNodes.add(startNode.id);
            console.log('✅ Start node completed');
          }, 300);
        }
        break;
      }

      case 'speech-start': {
        console.log('🎤 AI speech started, current node:', traversal.currentNodeId);
        
        // AI is starting to speak - advance to next appropriate node if needed
        if (traversal.currentNodeId) {
          const allNodes = canvas.getNodes();
          const currentNode = allNodes.find(n => n.id === traversal.currentNodeId);
          
          // If current node is start or already visited, advance to next node
          if (currentNode?.type === 'start' || traversal.visitedNodes.has(traversal.currentNodeId)) {
            const nextNodeIds = canvas.findNextNodes(traversal.currentNodeId);
            if (nextNodeIds.length > 0) {
              const nextNodeId = nextNodeIds[0];
              if (!traversal.visitedNodes.has(nextNodeId)) {
                console.log('🔄 Advancing from', traversal.currentNodeId, 'to', nextNodeId);
                
                // Complete current if not already
                if (!traversal.visitedNodes.has(traversal.currentNodeId)) {
                  canvas.completeNode(traversal.currentNodeId);
                  traversal.visitedNodes.add(traversal.currentNodeId);
                }
                
                traversal.currentNodeId = nextNodeId;
                canvas.highlightNode(nextNodeId);
              }
            }
          } else {
            canvas.highlightNode(traversal.currentNodeId);
          }
        }
        break;
      }

      case 'speech-end': {
        console.log('🔇 AI speech ended, current node:', traversal.currentNodeId);
        
        if (!traversal.currentNodeId) return;
        
        const allNodes = canvas.getNodes();
        const currentNode = allNodes.find(n => n.id === traversal.currentNodeId);
        
        // Complete current node
        if (!traversal.visitedNodes.has(traversal.currentNodeId)) {
          canvas.completeNode(traversal.currentNodeId);
          traversal.visitedNodes.add(traversal.currentNodeId);
          console.log('✅ Completed node on speech end:', traversal.currentNodeId);
        }
        
        // If on a message node, advance to next (listen/branch/action/end)
        if (currentNode?.type === 'message' || currentNode?.type === 'action') {
          // For action nodes with API config, execute the API and inject context
          if (currentNode?.type === 'action' && currentNode.data.apiConfig?.endpoint) {
            console.log('🔧 Action node has API config, executing...');
            
            // Execute API asynchronously
            executeActionApi(currentNode.data.apiConfig, traversal.customerPhone)
              .then(result => {
                if (result.success && result.context && traversal.controlUrl) {
                  // Inject context into the call
                  injectContextToCall(traversal.controlUrl, result.context);
                } else if (!result.success) {
                  console.warn('⚠️ Action API failed:', result.error);
                }
              });
          }
          
          const nextNodeIds = canvas.findNextNodes(traversal.currentNodeId);
          if (nextNodeIds.length > 0) {
            const nextNodeId = nextNodeIds[0];
            const nextNode = allNodes.find(n => n.id === nextNodeId);
            
            if (nextNode && !traversal.visitedNodes.has(nextNodeId)) {
              console.log('➡️ Moving to next node:', nextNodeId, '(', nextNode.type, ')');
              traversal.currentNodeId = nextNodeId;
              canvas.highlightNode(nextNodeId);
              
              // If it's an end node, complete it
              if (nextNode.type === 'end') {
                setTimeout(() => {
                  canvas.completeNode(nextNodeId);
                  traversal.visitedNodes.add(nextNodeId);
                }, 1000);
              }
            }
          }
        }
        break;
      }

      case 'message': {
        const transcript = event.data?.transcript || '';
        const role = event.data?.role;
        
        console.log(`💬 Message [${role}]:`, transcript);
        console.log('   Current node:', traversal.currentNodeId);
        console.log('   Visited nodes:', Array.from(traversal.visitedNodes));
        
        // Add transcript to call log (strip marker for display)
        if (transcript) {
          const prefix = role === 'assistant' ? '🤖' : '👤';
          const cleanTranscript = stripNodeMarker(transcript);
          if (cleanTranscript) {
            setCallTranscript(prev => [...prev, `${prefix} ${cleanTranscript}`]);
          }
        }
        
        // PRIMARY: Parse node marker from AI transcript for accurate tracking
        if (role === 'assistant' && transcript) {
          console.log('🔍 Searching for node marker in:', transcript);
          const nodeId = parseNodeMarker(transcript);
          
          if (nodeId) {
            console.log('🎯 Found node marker:', nodeId);
            
            // Verify node exists
            const allNodes = canvas.getNodes();
            const targetNode = allNodes.find(n => n.id === nodeId);
            if (!targetNode) {
              console.log('⚠️ Node not found in flow:', nodeId);
              console.log('   Available nodes:', allNodes.map(n => n.id));
            } else {
              console.log('✅ Node exists:', nodeId, '- Type:', targetNode.type);
            }
            
            // Complete previous node if different
            if (traversal.currentNodeId && traversal.currentNodeId !== nodeId) {
              console.log('📦 Completing previous node:', traversal.currentNodeId);
              canvas.completeNode(traversal.currentNodeId);
              traversal.visitedNodes.add(traversal.currentNodeId);
            }
            
            // Highlight the new node
            traversal.currentNodeId = nodeId;
            canvas.highlightNode(nodeId);
            setCurrentNodeIndex(prev => prev + 1);
            console.log('✨ Highlighted new node:', nodeId);
            
            // Check if this is an end node
            if (targetNode?.type === 'end') {
              console.log('🏁 End node reached');
              setTimeout(() => {
                canvas.completeNode(nodeId);
                traversal.visitedNodes.add(nodeId);
              }, 1000);
            }
          } else {
            console.log('❌ No node marker found in transcript');
            
            const allNodes = canvas.getNodes();
            const currentNode = allNodes.find(n => n.id === traversal.currentNodeId);
            
            // If on start node, move to first message
            if (currentNode?.type === 'start' && !traversal.visitedNodes.has(traversal.currentNodeId || '')) {
              const nextNodeIds = canvas.findNextNodes(traversal.currentNodeId!);
              if (nextNodeIds.length > 0) {
                console.log('🔄 Fallback: Moving from start to:', nextNodeIds[0]);
                canvas.completeNode(traversal.currentNodeId!);
                traversal.visitedNodes.add(traversal.currentNodeId!);
                traversal.currentNodeId = nextNodeIds[0];
                canvas.highlightNode(nextNodeIds[0]);
              }
            }
            
            // SMART BRANCH DETECTION: If on branch node and we have a detected intent, route accordingly
            if (currentNode?.type === 'branch' && traversal.detectedIntent) {
              const branchEdges = canvas.getEdges().filter(e => e.source === traversal.currentNodeId);
              const intentLower = traversal.detectedIntent.toLowerCase();
              
              console.log('🔀 On branch node, using detected intent:', traversal.detectedIntent);
              
              // Find edge that matches (exact, then partial)
              let matchingEdge = branchEdges.find(edge => {
                const edgeLabel = String(edge.label || '').toLowerCase();
                if (edgeLabel && edgeLabel === intentLower) return true;
                const targetNode = allNodes.find(n => n.id === edge.target);
                const nodeLabel = String(targetNode?.data?.label || '').toLowerCase();
                return nodeLabel === intentLower;
              });
              
              // Partial match fallback
              if (!matchingEdge) {
                matchingEdge = branchEdges.find(edge => {
                  const edgeLabel = String(edge.label || '').toLowerCase();
                  if (edgeLabel && (edgeLabel.includes(intentLower) || intentLower.includes(edgeLabel))) return true;
                  const targetNode = allNodes.find(n => n.id === edge.target);
                  const nodeLabel = String(targetNode?.data?.label || '').toLowerCase();
                  return nodeLabel.includes(intentLower) || intentLower.includes(nodeLabel);
                });
              }
              
              if (matchingEdge) {
                console.log('🎯 Intent matched branch:', traversal.detectedIntent, '→', matchingEdge.target);
                canvas.completeNode(traversal.currentNodeId!);
                traversal.visitedNodes.add(traversal.currentNodeId!);
                traversal.currentNodeId = matchingEdge.target;
                canvas.highlightNode(matchingEdge.target);
                traversal.detectedIntent = null; // Clear after using
                setCurrentNodeIndex(prev => prev + 1);
              } else {
                console.log('⚠️ No matching edge for intent:', traversal.detectedIntent);
                traversal.detectedIntent = null;
              }
            }
          }
        }
        
        // SECONDARY: For user messages, classify intent and advance listen nodes
        if (role === 'user' && transcript && traversal.currentNodeId) {
          const allNodes = canvas.getNodes();
          const currentNode = allNodes.find(n => n.id === traversal.currentNodeId);
          
          console.log('👤 User message, current node type:', currentNode?.type);
          traversal.lastUserTranscript = transcript;
          
          // If on a listen node, complete it and classify intent
          if (currentNode?.type === 'listen') {
            console.log('👂 User spoke on listen node, classifying intent...');
            canvas.completeNode(traversal.currentNodeId);
            traversal.visitedNodes.add(traversal.currentNodeId);
            
            // Find the branch node that follows
            const nextNodeIds = canvas.findNextNodes(traversal.currentNodeId);
            if (nextNodeIds.length > 0) {
              const branchNodeId = nextNodeIds[0];
              const branchNode = allNodes.find(n => n.id === branchNodeId);
              
              // If next node is a branch, classify intent using LLM
              if (branchNode?.type === 'branch') {
                // Get available intents from branch edges (fall back to target node labels)
                const branchEdges = canvas.getEdges().filter(e => e.source === branchNodeId);
                const availableIntents = branchEdges
                  .map(e => {
                    // First try edge label, then fall back to target node's label
                    if (e.label && String(e.label).trim()) {
                      return String(e.label);
                    }
                    // Fall back to target node's label
                    const targetNode = allNodes.find(n => n.id === e.target);
                    return targetNode?.data?.label || '';
                  })
                  .filter(Boolean);
                
                console.log('🎯 Branch edges found:', branchEdges.length, '- Available intents:', availableIntents);
                
                console.log('🧠 Classifying intent. Available options:', availableIntents);
                setIsClassifyingIntent(true);
                
                // Complete listen node first
                canvas.completeNode(branchNodeId);
              traversal.currentNodeId = branchNodeId;
              canvas.highlightNode(branchNodeId);
              setCurrentNodeIndex(prev => prev + 1);
                
                // Run LLM classification and immediately route when done
                classifyIntent(transcript, availableIntents)
                  .then(result => {
                    console.log('🎯 Intent classification result:', result);
                    if (result.intent) {
                      traversal.detectedIntent = result.intent;
                      console.log('✅ Detected intent:', result.intent, '(confidence:', result.confidence, ')');
                      
                      // IMMEDIATELY route to the matching branch target
                      const branchEdges = canvas.getEdges().filter(e => e.source === branchNodeId);
                      const allNodesForMatch = canvas.getNodes();
                      
                      const intentLower = result.intent?.toLowerCase() || '';
                      
                      // Find edge by matching intent to edge label OR target node label
                      // Try exact match first, then partial match
                      let matchingEdge = branchEdges.find(edge => {
                        const edgeLabel = String(edge.label || '').toLowerCase();
                        if (edgeLabel && edgeLabel === intentLower) return true;
                        const targetNode = allNodesForMatch.find(n => n.id === edge.target);
                        const nodeLabel = String(targetNode?.data?.label || '').toLowerCase();
                        return nodeLabel === intentLower;
                      });
                      
                      // If no exact match, try partial match (intent contained in label or vice versa)
                      if (!matchingEdge && intentLower) {
                        matchingEdge = branchEdges.find(edge => {
                          const edgeLabel = String(edge.label || '').toLowerCase();
                          if (edgeLabel && (edgeLabel.includes(intentLower) || intentLower.includes(edgeLabel))) return true;
                          const targetNode = allNodesForMatch.find(n => n.id === edge.target);
                          const nodeLabel = String(targetNode?.data?.label || '').toLowerCase();
                          return nodeLabel.includes(intentLower) || intentLower.includes(nodeLabel);
                        });
                        if (matchingEdge) {
                          console.log('🔄 Using partial match for intent');
                        }
                      }
                      
                      if (matchingEdge) {
                        console.log('🎯 Routing to branch target:', matchingEdge.target);
                        canvas.completeNode(branchNodeId);
                        traversal.visitedNodes.add(branchNodeId);
                        traversal.currentNodeId = matchingEdge.target;
                        canvas.highlightNode(matchingEdge.target);
                        traversal.detectedIntent = null; // Clear after using
                        setCurrentNodeIndex(prev => prev + 1);
                      } else {
                        console.log('⚠️ No matching edge for intent:', result.intent);
                      }
                    } else {
                      console.log('❓ No clear intent detected:', result.reasoning);
                    }
                  })
                  .catch(err => {
                    console.error('❌ Intent classification error:', err);
                  })
                  .finally(() => {
                    setIsClassifyingIntent(false);
                  });
              } else {
                // No branch node follows, just move to next
                console.log('➡️ Moving to next node:', branchNodeId);
                traversal.currentNodeId = branchNodeId;
                canvas.highlightNode(branchNodeId);
                setCurrentNodeIndex(prev => prev + 1);
              }
            }
          }
          
          // If on a branch node and user speaks again, re-classify and route immediately
          if (currentNode?.type === 'branch') {
            const currentBranchId = traversal.currentNodeId!;
            const branchEdges = canvas.getEdges().filter(e => e.source === currentBranchId);
            
            // Get available intents (edge labels OR target node labels)
            const availableIntents = branchEdges
              .map(e => {
                if (e.label && String(e.label).trim()) {
                  return String(e.label);
                }
                const targetNode = allNodes.find(n => n.id === e.target);
                return targetNode?.data?.label || '';
              })
              .filter(Boolean);
            
            console.log('🔄 Re-classifying intent on branch node. Options:', availableIntents);
            setIsClassifyingIntent(true);
            
            classifyIntent(transcript, availableIntents)
              .then(result => {
                console.log('🎯 Re-classification result:', result);
                if (result.intent) {
                  traversal.detectedIntent = result.intent;
                  const intentLower = result.intent.toLowerCase();
                  
                  // IMMEDIATELY route to matching branch target (exact match, then partial match)
                  let matchingEdge = branchEdges.find(edge => {
                    const edgeLabel = String(edge.label || '').toLowerCase();
                    if (edgeLabel && edgeLabel === intentLower) return true;
                    const targetNode = allNodes.find(n => n.id === edge.target);
                    const nodeLabel = String(targetNode?.data?.label || '').toLowerCase();
                    return nodeLabel === intentLower;
                  });
                  
                  // Partial match fallback
                  if (!matchingEdge) {
                    matchingEdge = branchEdges.find(edge => {
                      const edgeLabel = String(edge.label || '').toLowerCase();
                      if (edgeLabel && (edgeLabel.includes(intentLower) || intentLower.includes(edgeLabel))) return true;
                      const targetNode = allNodes.find(n => n.id === edge.target);
                      const nodeLabel = String(targetNode?.data?.label || '').toLowerCase();
                      return nodeLabel.includes(intentLower) || intentLower.includes(nodeLabel);
                    });
                  }
                  
                  if (matchingEdge) {
                    console.log('🎯 Routing to branch target:', matchingEdge.target);
                    canvas.completeNode(currentBranchId);
                    traversal.visitedNodes.add(currentBranchId);
                    traversal.currentNodeId = matchingEdge.target;
                    canvas.highlightNode(matchingEdge.target);
                    traversal.detectedIntent = null;
                    setCurrentNodeIndex(prev => prev + 1);
                  }
                }
              })
              .catch(err => {
                console.error('❌ Re-classification error:', err);
              })
              .finally(() => {
                setIsClassifyingIntent(false);
              });
          }
        }
        break;
      }

      case 'call-end': {
        console.log('📵 Call ended');
        // Call ended - complete any remaining nodes
        if (traversal.currentNodeId) {
          canvas.completeNode(traversal.currentNodeId);
          traversal.visitedNodes.add(traversal.currentNodeId);
        }
        
        // Find and complete end node
        const allNodes = canvas.getNodes();
        const endNode = allNodes.find(n => n.type === 'end');
        if (endNode && !traversal.visitedNodes.has(endNode.id)) {
          canvas.highlightNode(endNode.id);
          setTimeout(() => {
            canvas.completeNode(endNode.id);
            canvas.highlightNode(null);
          }, 1000);
        } else {
          canvas.highlightNode(null);
        }
        
        traversal.isTraversing = false;
        traversal.currentNodeId = null;
        
        setTimeout(() => {
          setIsCallActive(false);
        }, 2000);
        break;
      }

      case 'error': {
        console.log('❌ Error event:', event.data);
        canvas.resetAllNodes();
        traversal.isTraversing = false;
        traversal.currentNodeId = null;
        setIsCallActive(false);
        break;
      }
    }
  }, [parseNodeMarker, stripNodeMarker]);

  const loadExistingFlow = async (agentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const flowResponse = await d1Client.getAgentFlow(agentId);
      
      if (flowResponse.exists && flowResponse.flowData && flowResponse.configData) {
        // Load existing flow data
        setNodes(flowResponse.flowData.nodes || getInitialNodes());
        setEdges(flowResponse.flowData.edges || getInitialEdges());
        
        // Load config data
        setConfig({
          ...defaultAgentConfig,
          ...flowResponse.configData
        });
        
        setIsEditMode(true);
        setCreatedAssistantId(agentId); // Set for voice test
        setAgentName(flowResponse.configData.name || 'Agent');
      } else {
        // No flow data - load agent from VAPI and create new flow
        // Wait for VAPI client if it's still loading
        if (vapiLoading) {
          // Wait a bit and retry
          setTimeout(() => {
            loadExistingFlow(agentId);
          }, 500);
          return;
        }

        if (!vapiClient) {
          setError('VAPI client not initialized. Please configure your API keys in Settings.');
          setLoading(false);
          return;
        }

        try {
          const agent = await agentApi.getById(agentId, vapiClient);
          
          // Extract config from agent
          setConfig({
            ...defaultAgentConfig,
            name: agent.name,
            voiceId: agent.voice_id || 'Harry',
            model: 'gpt-4o', // Default, can be extracted from agent if available
            temperature: 0.7,
            transcriberModel: 'nova-2',
            silenceTimeout: 5,
            firstMessage: agent.conversation_prompt || 'Hello! How can I help you today?',
          });
          
          // Start with initial flow (empty canvas)
          setNodes(getInitialNodes());
          setEdges(getInitialEdges());
          
          setIsEditMode(true);
          setCreatedAssistantId(agentId);
          setAgentName(agent.name);
        } catch (vapiErr: any) {
          console.error('Error loading agent from VAPI:', vapiErr);
          setError(`Failed to load agent: ${vapiErr.message || 'Please try again.'}`);
        }
      }
    } catch (err: any) {
      console.error('Error loading flow:', err);
      // If it's a 404, try loading from VAPI instead
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        // No flow data exists, try loading from VAPI
        if (vapiClient && !vapiLoading) {
          try {
            const agent = await agentApi.getById(agentId, vapiClient);
            setConfig({
              ...defaultAgentConfig,
              name: agent.name,
              voiceId: agent.voice_id || 'Harry',
              model: 'gpt-4o',
              temperature: 0.7,
              transcriberModel: 'nova-2',
              silenceTimeout: 5,
              firstMessage: agent.conversation_prompt || 'Hello! How can I help you today?',
            });
            setNodes(getInitialNodes());
            setEdges(getInitialEdges());
            setIsEditMode(true);
            setCreatedAssistantId(agentId);
            setAgentName(agent.name);
          } catch (vapiErr: any) {
            setError(`Failed to load agent: ${vapiErr.message || 'Please try again.'}`);
          }
        } else if (vapiLoading) {
          setError('Loading agent configuration...');
          // Retry after a short delay
          setTimeout(() => {
            if (vapiClient) {
              loadExistingFlow(agentId);
            }
          }, 1000);
        } else if (!isConfigured) {
          setError('VAPI client not initialized. Please configure your API keys in Settings.');
        } else {
          setError('Failed to load agent. Please try again.');
        }
      } else {
        setError('Failed to load flow data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNodesChange = useCallback((newNodes: Node<FlowNodeData>[]) => {
    setNodes(newNodes);
    // Clear validation errors when flow changes
    setValidationErrors([]);
  }, []);

  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
    setValidationErrors([]);
  }, []);

  const generatedPrompt = flowToPrompt(nodes, edges);

  const handleSave = async () => {
    setError(null);
    setValidationErrors([]);

    // Validate config
    if (!config.name.trim()) {
      setError('Please enter an agent name');
      return;
    }

    // Validate flow
    const validation = validateFlow(nodes, edges);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    if (!vapiClient) {
      setError('VAPI client not initialized. Please configure your API keys in Settings.');
      return;
    }

    try {
      setSaving(true);

      // Get webhook URL if selected
      let webhookUrl: string | undefined;
      if (config.webhookId) {
        const webhooks = await d1Client.listWebhooks();
        const selectedWebhook = webhooks.find(w => w.id === config.webhookId);
        webhookUrl = selectedWebhook?.webhook_url;
      }

      // Build VAPI assistant payload
      const assistantPayload: any = {
        name: config.name,
        voice: {
          provider: 'vapi',
          voiceId: config.voiceId
        },
        model: {
          provider: 'openai',
          model: config.model,
          temperature: config.temperature,
          messages: [
            {
              role: 'system',
              content: generatedPrompt
            }
          ]
        },
        firstMessage: config.firstMessage || 'Hello! How can I help you today?',
        transcriber: {
          provider: 'deepgram',
          model: config.transcriberModel,
          language: 'en'
        },
        silenceTimeoutSeconds: config.silenceTimeout
      };

      // Add webhook if configured
      if (webhookUrl) {
        assistantPayload.server = {
          url: webhookUrl,
          timeoutSeconds: 20
        };
      }

      if (isEditMode && editAgentId) {
        // UPDATE existing assistant in VAPI
        await vapiClient.updateAssistant(editAgentId, assistantPayload);
        
        // Update or create flow data in D1
        try {
          const existingFlow = await d1Client.getAgentFlow(editAgentId);
          if (existingFlow.exists) {
            // Update existing flow
            await d1Client.updateAgentFlow(editAgentId, { nodes, edges }, config);
          } else {
            // Create new flow data for this agent
            await d1Client.saveAgentFlow(editAgentId, { nodes, edges }, config);
          }
        } catch (flowErr) {
          console.error('Error saving flow data (agent updated successfully):', flowErr);
          // Don't fail the whole operation - agent was updated successfully
        }
        
        setAgentName(config.name);
      } else {
        // CREATE new assistant in VAPI
        const createdAssistant = await vapiClient.createAssistant(assistantPayload) as any;
        
        // Save flow data to D1 for future editing
        try {
          await d1Client.saveAgentFlow(createdAssistant.id, { nodes, edges }, config);
        } catch (flowErr) {
          console.error('Error saving flow data (agent created successfully):', flowErr);
          // Don't fail the whole operation - agent was created successfully
        }
        
        // Store the created assistant ID for testing
        setCreatedAssistantId(createdAssistant.id);
        setAgentName(config.name);
        
        // Switch to edit mode so subsequent saves will UPDATE instead of CREATE
        setIsEditMode(true);
      }
    } catch (err: any) {
      console.error('Error creating agent:', err);
      setError(err.message || 'Failed to create agent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Agents</span>
          </button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Voice AI Agent' : 'Create Voice AI Agent'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPromptPreview(!showPromptPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {showPromptPreview ? (
              <>
                <EyeOff className="w-4 h-4" />
                Hide Prompt
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Preview Prompt
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isEditMode ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? 'Save Changes' : 'Create Agent'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error/Validation Messages */}
      {(error || validationErrors.length > 0) && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              {error && (
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              )}
              {validationErrors.length > 0 && (
                <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading flow data...</p>
          </div>
        </div>
      )}

      {/* Template Selection Screen - Only for new agents */}
      {showTemplateSelection && !loading && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <div className="max-w-2xl w-full mx-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                How would you like to start?
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Choose a starting point for your Voice AI agent
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Use Template Option */}
              <button
                onClick={() => {
                  setNodes(getInitialNodes());
                  setEdges(getInitialEdges());
                  setShowTemplateSelection(false);
                }}
                className="group relative bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all text-left"
              >
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                    Recommended
                  </span>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Use Template
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Start with a pre-built conversational flow including greeting, intent detection, and branching paths.
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                  <li>✓ Greeting message</li>
                  <li>✓ Intent detection (Appointment, Info, Support)</li>
                  <li>✓ Branching logic</li>
                  <li>✓ Ready to customize</li>
                </ul>
              </button>

              {/* Start Fresh Option */}
              <button
                onClick={() => {
                  setNodes(getMinimalNodes());
                  setEdges(getMinimalEdges());
                  setShowTemplateSelection(false);
                }}
                className="group bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-lg transition-all text-left"
              >
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Start Fresh
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Begin with a blank canvas containing only Start and End nodes. Build your flow from scratch.
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                  <li>✓ Clean slate</li>
                  <li>✓ Complete creative freedom</li>
                  <li>✓ Add nodes as needed</li>
                  <li>✓ Full customization</li>
                </ul>
              </button>
            </div>

            <p className="text-center text-xs text-gray-500 dark:text-gray-500 mt-6">
              You can always reset or modify your flow later using the toolbar
            </p>
          </div>
        </div>
      )}

      {/* Main Content - Creation Interface */}
      {!loading && !showTemplateSelection && (
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Config */}
        <AgentConfigPanel 
          config={config} 
          onChange={setConfig}
          createdAssistantId={createdAssistantId}
          publicKey={publicKey}
          onCallEvent={handleCallEvent}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />

          {/* Center - Flow Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Live Call Indicator */}
            {isCallActive && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">Live Call - Flow Visualization Active</span>
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              </div>
            )}
            
            <FlowCanvas
              ref={flowCanvasRef}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              initialNodes={nodes}
              initialEdges={edges}
            />
          </div>

          {/* Right Panel - Prompt Preview (Conditional) */}
          {showPromptPreview && (
            <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Generated System Prompt
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  This prompt will be sent to the AI model
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  {generatedPrompt}
                </pre>
              </div>
            </div>
          )}
      </div>
      )}

      {/* Success Notification Banner - Only show for new creations, not edits */}
      {createdAssistantId && !isEditMode && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow-lg max-w-md animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                Agent Created Successfully!
              </h3>
              <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                <strong>{agentName}</strong> is ready. Use Voice Test in the left panel to test it.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCreatedAssistantId(null);
                    setAgentName('');
                    onSuccess();
                  }}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors"
                >
                  View in Agents List
                </button>
                <button
                  onClick={() => {
                    setCreatedAssistantId(null);
                    setAgentName('');
                    setConfig(defaultAgentConfig);
                    setNodes([]);
                    setEdges([]);
                    setShowTemplateSelection(true); // Show template selection for new agent
                  }}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors"
                >
                  Create Another
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setCreatedAssistantId(null);
                setAgentName('');
              }}
              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode Success Banner */}
    </div>
  );
}

