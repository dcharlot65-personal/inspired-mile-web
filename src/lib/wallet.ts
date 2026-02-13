/**
 * Wallet Connection — Stub for future Solana integration.
 * Cards exist locally first. Users can optionally connect a wallet
 * to mint cards as NFTs on-chain.
 *
 * Future implementation will use:
 * - @solana/web3.js for Solana connection
 * - @solana/wallet-adapter for wallet UI
 * - @metaplex-foundation/js for compressed NFT minting
 */

export type WalletState = 'disconnected' | 'connecting' | 'connected';

let state: WalletState = 'disconnected';
let address: string | null = null;

export function getWalletState(): WalletState {
  return state;
}

export function getWalletAddress(): string | null {
  return address;
}

export function isConnected(): boolean {
  return state === 'connected';
}

export async function connectWallet(): Promise<boolean> {
  // Stub — will integrate Solana wallet-adapter in Phase 2
  console.log('[Wallet] Connect wallet — coming soon');
  return false;
}

export async function disconnectWallet(): Promise<void> {
  state = 'disconnected';
  address = null;
}

export async function mintCardAsNFT(_cardId: string): Promise<string | null> {
  // Stub — will use Metaplex compressed NFTs in Phase 2
  console.log('[Wallet] Mint card as NFT — coming soon');
  return null;
}

export function getExplorerUrl(mintAddress: string): string {
  return `https://solscan.io/token/${mintAddress}`;
}
