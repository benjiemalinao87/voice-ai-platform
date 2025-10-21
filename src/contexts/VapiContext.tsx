import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VapiClient } from '../lib/vapi';
import { d1Client } from '../lib/d1';
import { decrypt } from '../lib/encryption';
import { useAuth } from './AuthContext';

interface VapiContextType {
  vapiClient: VapiClient | null;
  isConfigured: boolean;
  isLoading: boolean;
  decryptAndLoadKeys: (password: string) => Promise<boolean>;
  clearKeys: () => void;
}

const VapiContext = createContext<VapiContextType | undefined>(undefined);

export function VapiProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [vapiClient, setVapiClient] = useState<VapiClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Clear VAPI client when user logs out
  useEffect(() => {
    if (!user || !token) {
      setVapiClient(null);
    }
  }, [user, token]);

  const decryptAndLoadKeys = async (password: string): Promise<boolean> => {
    if (!token) {
      console.error('No authentication token');
      return false;
    }

    setIsLoading(true);
    try {
      // Load encrypted settings from D1
      const settings = await d1Client.getUserSettings();

      if (!settings.encryptedPrivateKey) {
        console.error('No API keys configured');
        return false;
      }

      // Decrypt the private key
      const privateKey = await decrypt(
        settings.encryptedPrivateKey,
        password,
        settings.encryptionSalt
      );

      // Create VAPI client with user's private key
      const client = new VapiClient(privateKey);
      setVapiClient(client);

      return true;
    } catch (error) {
      console.error('Failed to decrypt and load VAPI keys:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearKeys = () => {
    setVapiClient(null);
  };

  return (
    <VapiContext.Provider
      value={{
        vapiClient,
        isConfigured: !!vapiClient,
        isLoading,
        decryptAndLoadKeys,
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
