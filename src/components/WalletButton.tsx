/**
 * WalletButton — React island that renders the Solana wallet connect button.
 * Dispatches CustomEvents so non-React code (Astro scripts) can react to wallet state.
 */

import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import SolanaWalletProvider from './WalletProvider';

function WalletButtonInner() {
  const { publicKey, connected, connecting, signMessage, wallet } = useWallet();

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('wallet-state-change', {
        detail: {
          connected,
          connecting,
          address: publicKey?.toBase58() ?? null,
          signMessage: signMessage ?? null,
          adapter: wallet?.adapter ?? null,
        },
      }),
    );
  }, [connected, connecting, publicKey, signMessage, wallet]);

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton
        style={{
          backgroundColor: 'transparent',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
          height: '2rem',
          padding: '0 0.75rem',
          color: 'rgba(212, 175, 55, 0.9)',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

export default function WalletButton() {
  return (
    <SolanaWalletProvider>
      <WalletButtonInner />
    </SolanaWalletProvider>
  );
}
