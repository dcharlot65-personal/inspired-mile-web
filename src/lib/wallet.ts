/**
 * Wallet Bridge — bridges Solana wallet-adapter React state to vanilla JS.
 * Listens for CustomEvents dispatched by the WalletButton React component.
 */

import bs58 from 'bs58';
import type { WalletAdapter } from '@solana/wallet-adapter-base';

export type WalletState = 'disconnected' | 'connecting' | 'connected';

let state: WalletState = 'disconnected';
let address: string | null = null;
let signMessageFn: ((message: Uint8Array) => Promise<Uint8Array>) | null = null;
let walletAdapter: WalletAdapter | null = null;

// Listen for state changes from the React wallet component
if (typeof window !== 'undefined') {
  window.addEventListener('wallet-state-change', ((e: CustomEvent) => {
    const detail = e.detail as {
      connected: boolean;
      connecting: boolean;
      address: string | null;
      signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
      adapter?: WalletAdapter | null;
    };
    if (detail.connected && detail.address) {
      state = 'connected';
      address = detail.address;
      signMessageFn = detail.signMessage ?? null;
      walletAdapter = detail.adapter ?? null;
    } else if (detail.connecting) {
      state = 'connecting';
      address = null;
      signMessageFn = null;
      walletAdapter = null;
    } else {
      state = 'disconnected';
      address = null;
      signMessageFn = null;
      walletAdapter = null;
    }
  }) as EventListener);
}

export function getWalletState(): WalletState {
  return state;
}

export function getWalletAddress(): string | null {
  return address;
}

export function isConnected(): boolean {
  return state === 'connected';
}

export function getExplorerUrl(mintAddress: string): string {
  return `https://solscan.io/token/${mintAddress}?cluster=devnet`;
}

/**
 * Sign a message with the connected wallet and return base58-encoded signature.
 */
export function getWalletAdapter(): WalletAdapter | null {
  return walletAdapter;
}

export async function signAuthMessage(message: string): Promise<string> {
  if (!signMessageFn) {
    throw new Error('Wallet not connected or signMessage not supported');
  }
  const encoded = new TextEncoder().encode(message);
  const signatureBytes = await signMessageFn(encoded);
  return bs58.encode(signatureBytes);
}
