import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Trash2, Download, CheckCircle, XCircle, Loader } from 'lucide-react';
import { vapiClient } from '../lib/vapi';
import { d1Client } from '../lib/d1';

interface KnowledgeFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  vapiFileId?: string;
}

interface KnowledgeBaseProps {
  agentId: string;
}

export function KnowledgeBase({ agentId }: KnowledgeBaseProps) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files from database on mount
  useEffect(() => {
    loadFiles();
  }, [agentId]);

  const loadFiles = async () => {
    try {
      const data = await d1Client.listKnowledgeFiles(agentId);
      
      const loadedFiles: KnowledgeFile[] = data.map((f) => ({
        id: f.id,
        name: f.file_name,
        size: f.file_size,
        uploadedAt: new Date(f.created_at).toISOString(),
        status: f.status,
        vapiFileId: f.vapi_file_id
      }));
      
      setFiles(loadedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
      // If D1 is not set up, files will just be empty
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);

    for (const file of Array.from(selectedFiles)) {
      const tempFile: KnowledgeFile = {
        id: `temp-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'uploading'
      };

      setFiles(prev => [...prev, tempFile]);

      try {
        if (!vapiClient) {
          throw new Error('VAPI client not configured');
        }

        // Upload to VAPI Files API
        const vapiData = await vapiClient.uploadFile(file);

        // Save file reference to D1 database
        const dbData = await d1Client.createKnowledgeFile({
          agent_id: agentId,
          vapi_file_id: vapiData.id,
          file_name: file.name,
          file_size: file.size,
          status: 'ready'
        });

        // Update file status with database ID
        setFiles(prev => prev.map(f => 
          f.id === tempFile.id 
            ? { 
                id: dbData.id, 
                name: file.name,
                size: file.size,
                uploadedAt: new Date(dbData.created_at).toISOString(),
                status: 'ready' as const,
                vapiFileId: vapiData.id
              }
            : f
        ));
        
      } catch (error) {
        console.error('Upload error:', error);
        setFiles(prev => prev.map(f => 
          f.id === tempFile.id 
            ? { ...f, status: 'error' as const }
            : f
        ));
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      const fileToDelete = files.find(f => f.id === fileId);
      if (!fileToDelete) return;

      // Delete from VAPI if we have the VAPI file ID
      if (vapiClient && fileToDelete.vapiFileId) {
        try {
          await vapiClient.deleteFile(fileToDelete.vapiFileId);
        } catch (error) {
          console.error('VAPI delete error:', error);
          // Continue anyway to delete from database
        }
      }

      // Delete from D1 database
      await d1Client.deleteKnowledgeFile(fileId);

      // Remove from UI
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: KnowledgeFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: KnowledgeFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'ready':
        return 'Ready';
      case 'error':
        return 'Error';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Knowledge Base
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Upload documents for the AI to reference during conversations
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload Files
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          💡 How Knowledge Base Works
        </h4>
        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <li>• Upload PDFs, Word docs, or text files with information your AI should know</li>
          <li>• The AI will automatically search and reference this content during calls</li>
          <li>• Perfect for FAQs, product information, policies, and procedures</li>
          <li>• Supported formats: PDF, DOC, DOCX, TXT, MD</li>
        </ul>
      </div>

      {/* Files List */}
      {loading ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Loader className="w-12 h-12 text-blue-500 dark:text-blue-400 mx-auto mb-4 animate-spin" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading files...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">No files uploaded yet</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Click "Upload Files" to add knowledge base documents
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(file.status)}
                  <span className={`text-xs font-medium ${
                    file.status === 'ready' ? 'text-green-600 dark:text-green-400' :
                    file.status === 'error' ? 'text-red-600 dark:text-red-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`}>
                    {getStatusText(file.status)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={file.status === 'uploading'}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Stats */}
      {files.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Total Files: <span className="font-semibold text-gray-900 dark:text-gray-100">{files.length}</span>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Ready: <span className="font-semibold text-green-600 dark:text-green-400">
                {files.filter(f => f.status === 'ready').length}
              </span>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Total Size: <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

