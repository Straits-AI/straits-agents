'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { StraitsClient, type StraitsClientConfig } from './client';

export interface StraitsContextValue {
  client: StraitsClient;
}

const StraitsContext = createContext<StraitsContextValue | null>(null);

export interface StraitsProviderProps {
  config: StraitsClientConfig;
  children: React.ReactNode;
}

/**
 * StraitsProvider provides the Straits client to child components.
 */
export function StraitsProvider({ config, children }: StraitsProviderProps) {
  const client = useMemo(() => new StraitsClient(config), [config]);

  return (
    <StraitsContext.Provider value={{ client }}>
      {children}
    </StraitsContext.Provider>
  );
}

/**
 * useStraits hook to access the Straits client.
 */
export function useStraits(): StraitsContextValue {
  const context = useContext(StraitsContext);

  if (!context) {
    throw new Error('useStraits must be used within a StraitsProvider');
  }

  return context;
}
