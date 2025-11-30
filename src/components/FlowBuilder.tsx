import { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Phone, 
  MessageSquare, 
  GitBranch, 
  Check, 
  X, 
  Trash2,
  Volume2,
  Zap,
  Clock,
  Play,
  Square
} from 'lucide-react';

// Custom Node Components
const MessageNode = ({ data, selected, id }: any) => {
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
      
      <div className={`w-16 h-16 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-4 border-white dark:border-gray-800 relative ${
        isActive ? 'ring-4 ring-blue-300 dark:ring-blue-500 ring-offset-2 animate-pulse' : ''
      } ${isCompleted ? 'ring-4 ring-green-300 dark:ring-green-500' : ''}`}>
        {isCompleted ? (
          <Check className="w-7 h-7 text-white" />
        ) : (
          <MessageSquare className="w-7 h-7 text-white" />
        )}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75"></div>
        )}
      </div>
      
      {data.label && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm">
            {data.label}
          </span>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
};

const BranchNode = ({ data, selected, id }: any) => {
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
      
      <div className={`w-16 h-16 bg-purple-500 dark:bg-purple-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-4 border-white dark:border-gray-800 relative ${
        isActive ? 'ring-4 ring-purple-300 dark:ring-purple-500 ring-offset-2 animate-pulse' : ''
      } ${isCompleted ? 'ring-4 ring-green-300 dark:ring-green-500' : ''}`}>
        {isCompleted ? (
          <Check className="w-7 h-7 text-white" />
        ) : (
          <GitBranch className="w-7 h-7 text-white" />
        )}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-75"></div>
        )}
      </div>
      
      {data.label && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm">
            {data.label}
          </span>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
    </div>
  );
};

const ActionNode = ({ data, selected, id }: any) => {
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
      
      <div className={`w-16 h-16 bg-orange-500 dark:bg-orange-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-4 border-white dark:border-gray-800 relative ${
        isActive ? 'ring-4 ring-orange-300 dark:ring-orange-500 ring-offset-2 animate-pulse' : ''
      } ${isCompleted ? 'ring-4 ring-green-300 dark:ring-green-500' : ''}`}>
        {isCompleted ? (
          <Check className="w-7 h-7 text-white" />
        ) : (
          <Zap className="w-7 h-7 text-white" />
        )}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-75"></div>
        )}
      </div>
      
      {data.label && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm">
            {data.label}
          </span>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
    </div>
  );
};

const StartNode = ({ data, selected, id }: any) => {
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div className="relative">
      <div className={`w-16 h-16 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-4 border-white dark:border-gray-800 relative ${
        isActive ? 'ring-4 ring-green-300 dark:ring-green-500 ring-offset-2 animate-pulse' : ''
      } ${isCompleted ? 'ring-4 ring-green-300 dark:ring-green-500' : ''}`}>
        {isCompleted ? (
          <Check className="w-7 h-7 text-white" />
        ) : (
          <Phone className="w-7 h-7 text-white" />
        )}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></div>
        )}
      </div>
      
      {data.label && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm">
            {data.label}
          </span>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
    </div>
  );
};

const EndNode = ({ data, selected, id }: any) => {
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
      
      <div className={`w-16 h-16 bg-red-500 dark:bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-4 border-white dark:border-gray-800 relative ${
        isActive ? 'ring-4 ring-red-300 dark:ring-red-500 ring-offset-2 animate-pulse' : ''
      } ${isCompleted ? 'ring-4 ring-green-300 dark:ring-green-500' : ''}`}>
        <Check className="w-7 h-7 text-white" />
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></div>
        )}
      </div>
      
      {data.label && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm">
            {data.label}
          </span>
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  branch: BranchNode,
  action: ActionNode,
  end: EndNode,
};

const initialNodes: Node[] = [
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
    id: 'branch-1',
    type: 'branch',
    position: { x: 400, y: 310 },
    data: { 
      label: 'Intent Detection',
      content: 'What is the caller asking about?',
      options: ['Appointment', 'Information', 'Support']
    },
  },
  {
    id: 'action-1',
    type: 'action',
    position: { x: 200, y: 480 },
    data: { 
      label: 'Book Appointment',
      content: 'Schedule appointment in calendar'
    },
  },
  {
    id: 'message-2',
    type: 'message',
    position: { x: 400, y: 480 },
    data: { 
      label: 'Provide Info',
      content: 'Let me provide you with that information...'
    },
  },
  {
    id: 'message-3',
    type: 'message',
    position: { x: 600, y: 480 },
    data: { 
      label: 'Transfer to Support',
      content: 'Let me connect you with our support team...'
    },
  },
  {
    id: 'end-1',
    type: 'end',
    position: { x: 400, y: 650 },
    data: { label: 'Call Ends' },
  }
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'start-1', target: 'message-1', animated: true, style: { stroke: '#10b981' } },
  { id: 'e2-3', source: 'message-1', target: 'branch-1', animated: true, style: { stroke: '#3b82f6' } },
  { id: 'e3-4', source: 'branch-1', target: 'action-1', label: 'Appointment', animated: true, style: { stroke: '#a855f7' } },
  { id: 'e3-5', source: 'branch-1', target: 'message-2', label: 'Info', animated: true, style: { stroke: '#a855f7' } },
  { id: 'e3-6', source: 'branch-1', target: 'message-3', label: 'Support', animated: true, style: { stroke: '#a855f7' } },
  { id: 'e4-7', source: 'action-1', target: 'end-1', animated: true, style: { stroke: '#f97316' } },
  { id: 'e5-7', source: 'message-2', target: 'end-1', animated: true, style: { stroke: '#3b82f6' } },
  { id: 'e6-7', source: 'message-3', target: 'end-1', animated: true, style: { stroke: '#3b82f6' } },
];

function FlowBuilderInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(10);
  const [isTesting, setIsTesting] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(new Set());
  const shouldContinueRef = useRef(true);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${nodeIdCounter}`,
      type,
      position: {
        x: Math.random() * 400 + 200,
        y: Math.random() * 300 + 200,
      },
      data: {
        label: type === 'message' ? 'New Message' :
               type === 'branch' ? 'New Branch' :
               type === 'action' ? 'New Action' :
               type === 'start' ? 'Start' :
               type === 'end' ? 'End' : 'New Node',
        content: type === 'message' ? 'Enter your message here...' :
                type === 'branch' ? 'What should the AI ask?' :
                type === 'action' ? 'Define your action...' : undefined
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNodeIdCounter(nodeIdCounter + 1);
  };

  const clearCanvas = () => {
    if (window.confirm('Are you sure you want to clear all nodes?')) {
      setNodes([]);
      setEdges([]);
    }
  };

  const deleteSelectedElements = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  }, [setNodes, setEdges]);

  // Find start node
  const findStartNode = useCallback(() => {
    return nodes.find(node => node.type === 'start');
  }, [nodes]);

  // Get next nodes from current node
  const getNextNodes = useCallback((nodeId: string) => {
    return edges
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target);
  }, [edges]);

  // Traverse flow starting from start node
  const traverseFlow = useCallback(async () => {
    const startNode = findStartNode();
    if (!startNode) {
      alert('No start node found. Please add a start node to test the flow.');
      return;
    }

    setIsTesting(true);
    setActiveNodeId(null);
    setCompletedNodeIds(new Set());
    shouldContinueRef.current = true;

    // Reset all nodes
    setNodes((nds) => nds.map(node => ({
      ...node,
      data: { ...node.data, isActive: false, isCompleted: false }
    })));

    // Traverse the flow - using a recursive approach to handle branches properly
    const visited = new Set<string>();
    
    const processNode = async (nodeId: string, delay: number = 0): Promise<void> => {
      if (visited.has(nodeId) || !shouldContinueRef.current) return;
      
      visited.add(nodeId);

      // Wait before processing this node
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (!shouldContinueRef.current) return;

      const currentNode = nodes.find(n => n.id === nodeId);
      if (!currentNode) return;

      // Mark node as active
      setActiveNodeId(nodeId);
      setNodes((nds) => nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, isActive: true, isCompleted: false } }
          : { ...node, data: { ...node.data, isActive: false } }
      ));

      // Wait a bit to show the node is active
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!shouldContinueRef.current) return;

      // Mark node as completed
      setCompletedNodeIds(prev => new Set([...prev, nodeId]));
      setNodes((nds) => nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, isActive: false, isCompleted: true } }
          : node
      ));

      // If it's an end node, stop
      if (currentNode.type === 'end') {
        return;
      }

      // Get next nodes
      const nextNodeIds = getNextNodes(nodeId);
      
      // For branch nodes, simulate choosing one path (first one)
      // In a real scenario, you might want to show all paths or let user choose
      if (currentNode.type === 'branch' && nextNodeIds.length > 0) {
        // Take the first path for demo
        await processNode(nextNodeIds[0], 500);
      } else {
        // Process all next nodes sequentially
        for (const nextId of nextNodeIds) {
          if (!visited.has(nextId) && shouldContinueRef.current) {
            await processNode(nextId, 500);
          }
        }
      }
    };

    // Start traversal from start node
    await processNode(startNode.id, 0);

    // Final wait and cleanup
    if (shouldContinueRef.current) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setActiveNodeId(null);
      setIsTesting(false);
    }
  }, [nodes, edges, findStartNode, getNextNodes, setNodes]);

  const stopTest = useCallback(() => {
    shouldContinueRef.current = false;
    setIsTesting(false);
    setActiveNodeId(null);
    setCompletedNodeIds(new Set());
    setNodes((nds) => nds.map(node => ({
      ...node,
      data: { ...node.data, isActive: false, isCompleted: false }
    })));
  }, [setNodes]);

  // Update nodes when testing state changes
  useEffect(() => {
    if (!isTesting) {
      setNodes((nds) => nds.map(node => ({
        ...node,
        data: { ...node.data, isActive: false, isCompleted: false }
      })));
    }
  }, [isTesting, setNodes]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Flow Builder</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Design your voice AI conversation flow</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={clearCanvas}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          <button 
            onClick={deleteSelectedElements}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <X className="w-4 h-4" />
            Delete Selected
          </button>
          {!isTesting ? (
            <button 
              onClick={traverseFlow}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <Play className="w-4 h-4" />
              Test Flow
            </button>
          ) : (
            <button 
              onClick={stopTest}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
            >
              <Square className="w-4 h-4" />
              Stop Test
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm">
            <Check className="w-4 h-4" />
            Save Flow
          </button>
        </div>
      </div>

      {/* Node Palette */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">Add Node:</span>
        
        <button 
          onClick={() => addNode('start')}
          className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-sm font-medium text-green-700 dark:text-green-400"
        >
          <Phone className="w-4 h-4" />
          Start
        </button>

        <button 
          onClick={() => addNode('message')}
          className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium text-blue-700 dark:text-blue-400"
        >
          <MessageSquare className="w-4 h-4" />
          Message
        </button>
        
        <button 
          onClick={() => addNode('branch')}
          className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-medium text-purple-700 dark:text-purple-400"
        >
          <GitBranch className="w-4 h-4" />
          Branch
        </button>
        
        <button 
          onClick={() => addNode('action')}
          className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors text-sm font-medium text-orange-700 dark:text-orange-400"
        >
          <Zap className="w-4 h-4" />
          Action
        </button>

        <button 
          onClick={() => addNode('end')}
          className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium text-red-700 dark:text-red-400"
        >
          <Check className="w-4 h-4" />
          End
        </button>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
          <MiniMap 
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            nodeColor={(node) => {
              switch (node.type) {
                case 'start': return '#10b981';
                case 'message': return '#3b82f6';
                case 'branch': return '#a855f7';
                case 'action': return '#f97316';
                case 'end': return '#ef4444';
                default: return '#6b7280';
              }
            }}
          />
          <Panel position="bottom-right" className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-2 mr-2">
            💡 Drag nodes to position • Click and drag from handles to connect • Delete key to remove
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
}
