import { useCallback, useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { 
  Phone, 
  MessageSquare, 
  GitBranch, 
  Check, 
  Mic,
  Zap,
  PhoneForwarded,
  Trash2,
  Play,
  Square,
  RefreshCw,
  RotateCcw,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround
} from 'lucide-react';
import { nodeTypes } from './NodeTypes';
import { getInitialNodes, getInitialEdges, type FlowNodeData } from './flowToPrompt';
import { NodeEditorModal } from './NodeEditorModal';
import { X, ArrowRight } from 'lucide-react';

// Auto-layout function using dagre
type LayoutDirection = 'TB' | 'LR'; // TB = top-bottom (vertical), LR = left-right (horizontal)

function getLayoutedElements(
  nodes: Node<FlowNodeData>[], 
  edges: Edge[], 
  direction: LayoutDirection = 'TB'
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  
  dagreGraph.setGraph({ 
    rankdir: direction, 
    nodesep: isHorizontal ? 80 : 100,
    ranksep: isHorizontal ? 180 : 130,
    marginx: 50,
    marginy: 50,
  });

  // Set node dimensions (all nodes are circular, 64x64 + padding for labels)
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 100, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 50, // Center the node (width/2)
        y: nodeWithPosition.y - 50, // Center the node (height/2)
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Edge Editor Modal for setting edge labels (important for branch routing)
function EdgeEditorModal({ 
  edge, 
  onSave, 
  onClose 
}: { 
  edge: Edge; 
  onSave: (label: string) => void; 
  onClose: () => void;
}) {
  const [label, setLabel] = useState(String(edge.label || ''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(label.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit Connection Label
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label (for branch routing)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Pepironi Pizza, Margarita Pizza"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 This label is used by the AI to route the conversation. Make sure it matches one of the intents in your Listen node.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Save Label
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Methods exposed for external control (real-time flow visualization)
export interface FlowCanvasRef {
  highlightNode: (nodeId: string | null) => void;
  completeNode: (nodeId: string) => void;
  resetAllNodes: () => void;
  getNodes: () => Node<FlowNodeData>[];
  getEdges: () => Edge[];
  findNextNodes: (nodeId: string) => string[];
}

interface FlowCanvasProps {
  onNodesChange: (nodes: Node<FlowNodeData>[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  initialNodes?: Node<FlowNodeData>[];
  initialEdges?: Edge[];
}

interface FlowCanvasInnerProps extends FlowCanvasProps {
  forwardedRef?: React.Ref<FlowCanvasRef>;
}

function FlowCanvasInner({ 
  onNodesChange: onNodesChangeCallback, 
  onEdgesChange: onEdgesChangeCallback,
  initialNodes: initNodes,
  initialEdges: initEdges,
  forwardedRef
}: FlowCanvasInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes || getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges || getInitialEdges());
  const [nodeIdCounter, setNodeIdCounter] = useState(10);
  const [editingNode, setEditingNode] = useState<Node<FlowNodeData> | null>(null);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);
  const shouldContinueRef = useRef(true);
  const isInitialMount = useRef(true);
  const isSyncingFromProps = useRef(false);
  const prevInitNodesRef = useRef<Node<FlowNodeData>[] | undefined>(initNodes);
  const prevInitEdgesRef = useRef<Edge[] | undefined>(initEdges);
  
  // Keep refs for external access (for real-time flow visualization)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  
  // Expose methods for external control
  useImperativeHandle(forwardedRef, () => ({
    highlightNode: (nodeId: string | null) => {
      setNodes((nds) => nds.map(node => ({
        ...node,
        data: { 
          ...node.data, 
          isActive: node.id === nodeId,
          // Don't reset isCompleted when highlighting
        }
      })));
    },
    completeNode: (nodeId: string) => {
      setNodes((nds) => nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, isActive: false, isCompleted: true } }
          : node
      ));
    },
    resetAllNodes: () => {
      setNodes((nds) => nds.map(node => ({
        ...node,
        data: { ...node.data, isActive: false, isCompleted: false }
      })));
    },
    getNodes: () => nodesRef.current,
    getEdges: () => edgesRef.current,
    findNextNodes: (nodeId: string) => {
      return edgesRef.current
        .filter(edge => edge.source === nodeId)
        .map(edge => edge.target);
    }
  }), [setNodes]);

  // Sync nodes/edges when initialNodes/initialEdges change (e.g., when loading existing flow)
  useEffect(() => {
    if (initNodes && initNodes !== prevInitNodesRef.current) {
      prevInitNodesRef.current = initNodes;
      isSyncingFromProps.current = true;
      setNodes(initNodes);
      // Reset flag after state update
      setTimeout(() => {
        isSyncingFromProps.current = false;
      }, 0);
    }
  }, [initNodes, setNodes]);

  useEffect(() => {
    if (initEdges && initEdges !== prevInitEdgesRef.current) {
      prevInitEdgesRef.current = initEdges;
      isSyncingFromProps.current = true;
      setEdges(initEdges);
      // Reset flag after state update
      setTimeout(() => {
        isSyncingFromProps.current = false;
      }, 0);
    }
  }, [initEdges, setEdges]);

  // Notify parent of node changes (useEffect to avoid render-phase updates)
  useEffect(() => {
    if (!isInitialMount.current && !isSyncingFromProps.current) {
      onNodesChangeCallback(nodes);
    }
  }, [nodes, onNodesChangeCallback]);

  // Notify parent of edge changes (useEffect to avoid render-phase updates)
  useEffect(() => {
    if (!isInitialMount.current && !isSyncingFromProps.current) {
      onEdgesChangeCallback(edges);
    }
  }, [edges, onEdgesChangeCallback]);

  // Mark initial mount as complete after first render
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  // Notify parent of changes via ReactFlow's onChange handlers
  const handleNodesChangeInternal = useCallback((changes: any) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChangeInternal = useCallback((changes: any) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, animated: true }, eds);
        onEdgesChangeCallback(newEdges);
        return newEdges;
      });
    },
    [setEdges, onEdgesChangeCallback]
  );

  const addNode = (type: string) => {
    const nodeData: FlowNodeData = {
      label: type === 'message' ? 'New Message' :
             type === 'branch' ? 'New Branch' :
             type === 'action' ? 'New Action' :
             type === 'listen' ? 'Listen' :
             type === 'transfer' ? 'Transfer' :
             type === 'start' ? 'Start' :
             type === 'end' ? 'End' : 'New Node',
      content: type === 'message' ? 'Enter your message here...' :
              type === 'action' ? 'Define your action...' : undefined,
      intents: type === 'listen' ? ['Intent 1', 'Intent 2'] : undefined,
      onEdit: undefined
    };

    // Find the last selected node to position new node below it and auto-connect
    const lastNode = lastSelectedNodeId 
      ? nodes.find(n => n.id === lastSelectedNodeId)
      : nodes[nodes.length - 1]; // Fall back to last node in array
    
    // Calculate position: below the last node, or default position
    let newPosition = {
      x: Math.random() * 300 + 250,
      y: Math.random() * 200 + 200,
    };
    
    if (lastNode) {
      newPosition = {
        x: lastNode.position.x,
        y: lastNode.position.y + 130, // 130px below
      };
    }

    const newNodeId = `${type}-${nodeIdCounter}`;
    const newNode: Node<FlowNodeData> = {
      id: newNodeId,
      type,
      position: newPosition,
      data: nodeData,
    };

    // Auto-connect from last node if it can have outgoing connections (not 'end' type)
    const shouldAutoConnect = lastNode && lastNode.type !== 'end' && type !== 'start';
    
    setNodes((nds) => {
      const updated = [...nds, newNode];
      onNodesChangeCallback(updated);
      return updated;
    });
    
    // Create edge from last node to new node
    if (shouldAutoConnect && lastNode) {
      setEdges((eds) => {
        const newEdge: Edge = {
          id: `e-${lastNode.id}-${newNodeId}`,
          source: lastNode.id,
          target: newNodeId,
          animated: true,
        };
        const updated = [...eds, newEdge];
        onEdgesChangeCallback(updated);
        return updated;
      });
    }
    
    // Set the new node as the last selected for next add
    setLastSelectedNodeId(newNodeId);
    setNodeIdCounter(nodeIdCounter + 1);
  };

  const clearCanvas = () => {
    if (window.confirm('Are you sure you want to clear all nodes?')) {
      setNodes([]);
      setEdges([]);
      onNodesChangeCallback([]);
      onEdgesChangeCallback([]);
    }
  };

  // Start Fresh - minimal canvas with just Start and End nodes
  const startFresh = () => {
    if (nodes.length > 0 && !window.confirm('This will replace the current flow with a blank canvas. Continue?')) {
      return;
    }
    
    const freshNodes: Node<FlowNodeData>[] = [
      {
        id: 'start-fresh',
        type: 'start',
        position: { x: 300, y: 50 },
        data: { label: 'Call Starts' },
      },
      {
        id: 'end-fresh',
        type: 'end',
        position: { x: 300, y: 300 },
        data: { label: 'End Call' },
      },
    ];
    
    const freshEdges: Edge[] = [];
    
    setNodes(freshNodes);
    setEdges(freshEdges);
    onNodesChangeCallback(freshNodes);
    onEdgesChangeCallback(freshEdges);
    setNodeIdCounter(10); // Reset counter
  };

  const deleteSelectedElements = useCallback(() => {
    setNodes((nds) => {
      const updated = nds.filter((node) => !node.selected);
      onNodesChangeCallback(updated);
      return updated;
    });
    setEdges((eds) => {
      const updated = eds.filter((edge) => !edge.selected);
      onEdgesChangeCallback(updated);
      return updated;
    });
  }, [setNodes, setEdges, onNodesChangeCallback, onEdgesChangeCallback]);

  // Auto-arrange nodes using dagre layout with smooth animation
  const [isAnimating, setIsAnimating] = useState(false);
  
  const autoArrange = useCallback((direction: LayoutDirection) => {
    if (isAnimating) return; // Prevent multiple animations
    
    const { nodes: targetNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, direction);
    
    // Store starting positions
    const startPositions = new Map(nodes.map(n => [n.id, { x: n.position.x, y: n.position.y }]));
    const targetPositions = new Map(targetNodes.map(n => [n.id, { x: n.position.x, y: n.position.y }]));
    
    // Animation settings
    const duration = 500; // ms
    const startTime = performance.now();
    
    setIsAnimating(true);
    
    // Easing function (ease-out cubic for smooth deceleration)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      
      // Interpolate positions
      const animatedNodes = nodes.map(node => {
        const start = startPositions.get(node.id) || node.position;
        const target = targetPositions.get(node.id) || node.position;
        
        return {
          ...node,
          position: {
            x: start.x + (target.x - start.x) * easedProgress,
            y: start.y + (target.y - start.y) * easedProgress,
          },
        };
      });
      
      setNodes(animatedNodes);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - set final positions
        setNodes(targetNodes);
        setEdges(layoutedEdges);
        onNodesChangeCallback(targetNodes);
        onEdgesChangeCallback(layoutedEdges);
        setIsAnimating(false);
      }
    };
    
    requestAnimationFrame(animate);
  }, [nodes, edges, setNodes, setEdges, onNodesChangeCallback, onEdgesChangeCallback, isAnimating]);

  // Handle node click for editing
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<FlowNodeData>) => {
    setEditingNode(node);
    setLastSelectedNodeId(node.id); // Track for auto-connect
  }, []);

  // Handle edge click for editing label
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setEditingEdge(edge);
  }, []);

  // Delete a specific node and its connected edges
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const updated = nds.filter(n => n.id !== nodeId);
      onNodesChangeCallback(updated);
      return updated;
    });
    // Also remove any edges connected to this node
    setEdges((eds) => {
      const updated = eds.filter(e => e.source !== nodeId && e.target !== nodeId);
      onEdgesChangeCallback(updated);
      return updated;
    });
    // Clear last selected if it was this node
    if (lastSelectedNodeId === nodeId) {
      setLastSelectedNodeId(null);
    }
  }, [setNodes, setEdges, onNodesChangeCallback, onEdgesChangeCallback, lastSelectedNodeId]);

  // Disconnect all edges from a specific node
  const disconnectNode = useCallback((nodeId: string) => {
    setEdges((eds) => {
      const updated = eds.filter(e => e.source !== nodeId && e.target !== nodeId);
      onEdgesChangeCallback(updated);
      return updated;
    });
  }, [setEdges, onEdgesChangeCallback]);

  // Check if a node has any connections
  const nodeHasConnections = useCallback((nodeId: string) => {
    return edges.some(e => e.source === nodeId || e.target === nodeId);
  }, [edges]);

  // Transform nodes to include delete/disconnect callbacks
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onDelete: () => deleteNode(node.id),
        onDisconnect: () => disconnectNode(node.id),
        hasConnections: nodeHasConnections(node.id),
      }
    }));
  }, [nodes, deleteNode, disconnectNode, nodeHasConnections]);

  const handleNodeUpdate = (updatedData: FlowNodeData) => {
    if (!editingNode) return;
    
    setNodes((nds) => {
      const updated = nds.map(n => 
        n.id === editingNode.id 
          ? { ...n, data: updatedData }
          : n
      );
      onNodesChangeCallback(updated);
      return updated;
    });
    setEditingNode(null);
  };

  const handleEdgeUpdate = (newLabel: string) => {
    if (!editingEdge) return;
    
    setEdges((eds) => {
      const updated = eds.map(e => 
        e.id === editingEdge.id 
          ? { ...e, label: newLabel || undefined }
          : e
      );
      onEdgesChangeCallback(updated);
      return updated;
    });
    setEditingEdge(null);
  };

  // Test flow traversal
  const findStartNode = useCallback(() => {
    return nodes.find(node => node.type === 'start');
  }, [nodes]);

  const getNextNodes = useCallback((nodeId: string) => {
    return edges
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target);
  }, [edges]);

  const traverseFlow = useCallback(async () => {
    const startNode = findStartNode();
    if (!startNode) {
      alert('No start node found.');
      return;
    }

    setIsTesting(true);
    shouldContinueRef.current = true;

    setNodes((nds) => nds.map(node => ({
      ...node,
      data: { ...node.data, isActive: false, isCompleted: false }
    })));

    const visited = new Set<string>();
    
    const processNode = async (nodeId: string, delay: number = 0): Promise<void> => {
      if (visited.has(nodeId) || !shouldContinueRef.current) return;
      
      visited.add(nodeId);

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (!shouldContinueRef.current) return;

      const currentNode = nodes.find(n => n.id === nodeId);
      if (!currentNode) return;

      setNodes((nds) => nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, isActive: true, isCompleted: false } }
          : { ...node, data: { ...node.data, isActive: false } }
      ));

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!shouldContinueRef.current) return;

      setNodes((nds) => nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, isActive: false, isCompleted: true } }
          : node
      ));

      if (currentNode.type === 'end') {
        return;
      }

      const nextNodeIds = getNextNodes(nodeId);
      
      if ((currentNode.type === 'branch' || currentNode.type === 'listen') && nextNodeIds.length > 0) {
        await processNode(nextNodeIds[0], 500);
      } else {
        for (const nextId of nextNodeIds) {
          if (!visited.has(nextId) && shouldContinueRef.current) {
            await processNode(nextId, 500);
          }
        }
      }
    };

    await processNode(startNode.id, 0);

    if (shouldContinueRef.current) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsTesting(false);
    }
  }, [nodes, edges, findStartNode, getNextNodes, setNodes]);

  const stopTest = useCallback(() => {
    shouldContinueRef.current = false;
    setIsTesting(false);
    setNodes((nds) => nds.map(node => ({
      ...node,
      data: { ...node.data, isActive: false, isCompleted: false }
    })));
  }, [setNodes]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Node Palette */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">Add:</span>
        
        <button 
          onClick={() => addNode('start')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-xs font-medium text-green-700 dark:text-green-400"
        >
          <Phone className="w-3.5 h-3.5" />
          Start
        </button>

        <button 
          onClick={() => addNode('message')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-xs font-medium text-blue-700 dark:text-blue-400"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Message
        </button>

        <button 
          onClick={() => addNode('listen')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors text-xs font-medium text-indigo-700 dark:text-indigo-400"
        >
          <Mic className="w-3.5 h-3.5" />
          Listen
        </button>
        
        <button 
          onClick={() => addNode('branch')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-xs font-medium text-purple-700 dark:text-purple-400"
        >
          <GitBranch className="w-3.5 h-3.5" />
          Branch
        </button>
        
        <button 
          onClick={() => addNode('action')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors text-xs font-medium text-orange-700 dark:text-orange-400"
        >
          <Zap className="w-3.5 h-3.5" />
          Action
        </button>

        <button 
          onClick={() => addNode('transfer')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors text-xs font-medium text-cyan-700 dark:text-cyan-400"
        >
          <PhoneForwarded className="w-3.5 h-3.5" />
          Transfer
        </button>

        <button 
          onClick={() => addNode('end')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-xs font-medium text-red-700 dark:text-red-400"
        >
          <Check className="w-3.5 h-3.5" />
          End
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Auto-arrange buttons */}
        <button 
          onClick={() => autoArrange('TB')}
          disabled={isAnimating}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg transition-all text-xs font-medium ${
            isAnimating 
              ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700 text-violet-400 dark:text-violet-500 cursor-not-allowed' 
              : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-400'
          }`}
          title="Auto-arrange nodes vertically (top to bottom)"
        >
          <AlignVerticalSpaceAround className={`w-3.5 h-3.5 ${isAnimating ? 'animate-pulse' : ''}`} />
          Vertical
        </button>

        <button 
          onClick={() => autoArrange('LR')}
          disabled={isAnimating}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg transition-all text-xs font-medium ${
            isAnimating 
              ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700 text-violet-400 dark:text-violet-500 cursor-not-allowed' 
              : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-400'
          }`}
          title="Auto-arrange nodes horizontally (left to right)"
        >
          <AlignHorizontalSpaceAround className={`w-3.5 h-3.5 ${isAnimating ? 'animate-pulse' : ''}`} />
          Horizontal
        </button>

        <div className="flex-1" />

        <button 
          onClick={startFresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors text-xs font-medium text-yellow-700 dark:text-yellow-400"
          title="Clear canvas and start with minimal nodes"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Start Fresh
        </button>

        <button 
          onClick={clearCanvas}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium text-gray-700 dark:text-gray-300"
          title="Clear all nodes"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear All
        </button>

        <button 
          onClick={deleteSelectedElements}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>

        {!isTesting ? (
          <button 
            onClick={traverseFlow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs font-medium"
          >
            <Play className="w-3.5 h-3.5" />
            Test
          </button>
        ) : (
          <button 
            onClick={stopTest}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs font-medium"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        )}
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={handleNodesChangeInternal}
          onEdgesChange={handleEdgesChangeInternal}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50 dark:bg-gray-900"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            className="dark:opacity-50"
          />
          <Controls className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg" />
          <Panel position="bottom-right" className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-2 mr-2">
            💡 Click node to edit • Hover for delete/disconnect • Click edge to add label
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Editor Modal */}
      {editingNode && (
        <NodeEditorModal
          node={editingNode}
          onSave={handleNodeUpdate}
          onClose={() => setEditingNode(null)}
        />
      )}

      {/* Edge Editor Modal */}
      {editingEdge && (
        <EdgeEditorModal
          edge={editingEdge}
          onSave={handleEdgeUpdate}
          onClose={() => setEditingEdge(null)}
        />
      )}
    </div>
  );
}

export const FlowCanvas = forwardRef<FlowCanvasRef, FlowCanvasProps>((props, ref) => {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} forwardedRef={ref} />
    </ReactFlowProvider>
  );
});

FlowCanvas.displayName = 'FlowCanvas';

