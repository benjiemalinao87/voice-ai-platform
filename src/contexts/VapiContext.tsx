import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VapiClient } from '../lib/vapi';
import { d1Client } from '../lib/d1';
import { useAuth } from './AuthContext';

interface VapiContextType {
  vapiClient: VapiClient | null;
  publicKey: string | null;
  selectedOrgId: string | null;
  isConfigured: boolean;
  isLoading: boolean;
  setSelectedOrgId: (orgId: string | null) => void;
  clearKeys: () => void;
}

const VapiContext = createContext<VapiContextType | undefined>(undefined);

export function VapiProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [vapiClient, setVapiClient] = useState<VapiClient | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-load keys when user authenticates
  useEffect(() => {
    if (user && token) {
      loadKeys();
    } else {
      // Clear keys on logout
      setVapiClient(null);
      setPublicKey(null);
      setSelectedOrgId(null);
    }
  }, [user, token]);

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      // Load settings from D1
      const settings = await d1Client.getUserSettings();

      if (!settings.privateKey) {
        console.log('No API keys configured yet');
        setIsLoading(false);
        return;
      }

      console.log('Loading VAPI keys...');

      // Create VAPI client with user's private key
      const client = new VapiClient(settings.privateKey);
      setVapiClient(client);

      // Store public key for VoiceTest component
      if (settings.publicKey) {
        setPublicKey(settings.publicKey);
      }

      // Load selected org ID from settings
      if (settings.selectedOrgId) {
        setSelectedOrgId(settings.selectedOrgId);
      }

      console.log('VAPI client initialized successfully');
    } catch (error) {
      console.error('Failed to load VAPI keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearKeys = () => {
    setVapiClient(null);
    setPublicKey(null);
    setSelectedOrgId(null);
  };

  return (
    <VapiContext.Provider
      value={{
        vapiClient,
        publicKey,
        selectedOrgId,
        isConfigured: !!vapiClient,
        isLoading,
        setSelectedOrgId,
        clearKeys,
      }}
    >
      {children}
    </VapiContext.Provider>
  );
}

export function useVapi() {
  const context = useContext(VapiContext);
  if (context === undefined) {
    throw new Error('useVapi must be used within a VapiProvider');
  }
  return context;
}
