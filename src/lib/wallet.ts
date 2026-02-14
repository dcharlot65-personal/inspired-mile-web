/**
 * Wallet Bridge — bridges Solana wallet-adapter React state to vanilla JS.
 * Listens for CustomEvents dispatched by the WalletButton React component.
 */

export type WalletState = 'disconnected' | 'connecting' | 'connected';

let state: WalletState = 'disconnected';
let address: string | null = null;

// Listen for state changes from the React wallet component
if (typeof window !== 'undefined') {
  window.addEventListener('wallet-state-change', ((e: CustomEvent) => {
    const detail = e.detail as { connected: boolean; connecting: boolean; address: string | null };
    if (detail.connected && detail.address) {
      state = 'connected';
      address = detail.address;
    } else if (detail.connecting) {
      state = 'connecting';
      address = null;
    } else {
      state = 'disconnected';
      address = null;
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
