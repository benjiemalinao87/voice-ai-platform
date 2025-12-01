import { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  Phone, 
  MessageSquare, 
  GitBranch, 
  Check, 
  Mic,
  Globe,
  PhoneForwarded,
  X,
  Unlink
} from 'lucide-react';

interface NodeData {
  label: string;
  content?: string;
  intents?: string[];
  isActive?: boolean;
  isCompleted?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onDisconnect?: () => void;
  hasConnections?: boolean;
}

// Hover action buttons component
const NodeHoverActions = ({ 
  isHovered, 
  onDelete, 
  onDisconnect,
  hasConnections 
}: { 
  isHovered: boolean; 
  onDelete?: () => void; 
  onDisconnect?: () => void;
  hasConnections?: boolean;
}) => {
  if (!isHovered) return null;
  
  return (
    <>
      {/* Delete button - top right */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 z-10"
          title="Delete node"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      )}
      
      {/* Disconnect button - top left */}
      {onDisconnect && hasConnections && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          className="absolute -top-2 -left-2 w-6 h-6 bg-gray-500 hover:bg-gray-600 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 z-10"
          title="Disconnect all edges"
        >
          <Unlink className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </>
  );
};

// Start Node - Call begins
export const StartNode = ({ data }: { data: NodeData }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div 
      className="relative cursor-pointer" 
      onClick={data.onEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeHoverActions 
        isHovered={isHovered} 
        onDelete={data.onDelete}
        onDisconnect={data.onDisconnect}
        hasConnections={data.hasConnections}
      />
      
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

// Message Node - Agent speaks
export const MessageNode = ({ data }: { data: NodeData }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div 
      className="relative cursor-pointer" 
      onClick={data.onEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeHoverActions 
        isHovered={isHovered} 
        onDelete={data.onDelete}
        onDisconnect={data.onDisconnect}
        hasConnections={data.hasConnections}
      />
      
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

// Listen Node - Wait for user input
export const ListenNode = ({ data }: { data: NodeData }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div 
      className="relative cursor-pointer" 
      onClick={data.onEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeHoverActions 
        isHovered={isHovered} 
        onDelete={data.onDelete}
        onDisconnect={data.onDisconnect}
        hasConnections={data.hasConnections}
      />
      
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
      />
      
      <div className={`w-16 h-16 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-4 border-white dark:border-gray-800 relative ${
        isActive ? 'ring-4 ring-indigo-300 dark:ring-indigo-500 ring-offset-2 animate-pulse' : ''
      } ${isCompleted ? 'ring-4 ring-green-300 dark:ring-green-500' : ''}`}>
        {isCompleted ? (
          <Check className="w-7 h-7 text-white" />
        ) : (
          <Mic className="w-7 h-7 text-white" />
        )}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75"></div>
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
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
      />
    </div>
  );
};

// Branch Node - Decision based on intent
export const BranchNode = ({ data }: { data: NodeData }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div 
      className="relative cursor-pointer" 
      onClick={data.onEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeHoverActions 
        isHovered={isHovered} 
        onDelete={data.onDelete}
        onDisconnect={data.onDisconnect}
        hasConnections={data.hasConnections}
      />
      
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

// Action Node - Perform action
export const ActionNode = ({ data }: { data: NodeData }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div 
      className="relative cursor-pointer" 
      onClick={data.onEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeHoverActions 
        isHovered={isHovered} 
        onDelete={data.onDelete}
        onDisconnect={data.onDisconnect}
        hasConnections={data.hasConnections}
      />
      
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
          <Globe className="w-7 h-7 text-white" />
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

// Transfer Node - Transfer call
export const TransferNode = ({ data }: { data: NodeData }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div 
      className="relative cursor-pointer" 
      onClick={data.onEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeHoverActions 
        isHovered={isHovered} 
        onDelete={data.onDelete}
        onDisconnect={data.onDisconnect}
        hasConnections={data.hasConnections}
      />
      
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
      
      <div className={`w-16 h-16 bg-cyan-500 dark:bg-cyan-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-4 border-white dark:border-gray-800 relative ${
        isActive ? 'ring-4 ring-cyan-300 dark:ring-cyan-500 ring-offset-2 animate-pulse' : ''
      } ${isCompleted ? 'ring-4 ring-green-300 dark:ring-green-500' : ''}`}>
        {isCompleted ? (
          <Check className="w-7 h-7 text-white" />
        ) : (
          <PhoneForwarded className="w-7 h-7 text-white" />
        )}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-75"></div>
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
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
    </div>
  );
};

// End Node - Call ends
export const EndNode = ({ data }: { data: NodeData }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = data.isActive;
  const isCompleted = data.isCompleted;
  
  return (
    <div 
      className="relative cursor-pointer" 
      onClick={data.onEdit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeHoverActions 
        isHovered={isHovered} 
        onDelete={data.onDelete}
        onDisconnect={data.onDisconnect}
        hasConnections={data.hasConnections}
      />
      
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

export const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  listen: ListenNode,
  branch: BranchNode,
  action: ActionNode,
  transfer: TransferNode,
  end: EndNode,
};

