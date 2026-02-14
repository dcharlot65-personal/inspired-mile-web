/**
 * NFT Minting — Mint Inspired Mile cards as compressed NFTs on Solana via Metaplex Bubblegum.
 * Uses the user's connected wallet to sign the transaction.
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-web3js-adapters';
import { mintV1, mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { publicKey, none } from '@metaplex-foundation/umi';
import type { WalletAdapter } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';
import type { Card } from './cards';

// Merkle tree address — created by scripts/create-merkle-tree.ts
// TODO: Replace with actual tree address after running the creation script
const MERKLE_TREE_ADDRESS = '11111111111111111111111111111111';

// Collection mint — TODO: Create collection NFT and set address
const COLLECTION_MINT = '11111111111111111111111111111111';

const NETWORK = 'devnet';

export interface MintResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/** Build NFT metadata JSON for a card */
export function buildCardMetadata(card: Card): object {
  return {
    name: `Inspired Mile: ${card.name}`,
    symbol: 'MILE',
    description: `${card.name} — ${card.quote}`,
    image: `https://sonnetman.inspiredmile.com/images/cards/${card.id.toLowerCase()}.webp`,
    external_url: 'https://sonnetman.inspiredmile.com',
    attributes: [
      { trait_type: 'House', value: card.house },
      { trait_type: 'Type', value: card.type },
      { trait_type: 'Rarity', value: card.rarity },
      { trait_type: 'Element', value: card.element },
      ...(card.type === 'Character'
        ? [
            { trait_type: 'ATK', value: card.atk },
            { trait_type: 'DEF', value: card.def },
            { trait_type: 'HP', value: card.hp },
          ]
        : []),
    ],
    properties: {
      category: 'image',
      files: [
        {
          uri: `https://sonnetman.inspiredmile.com/images/cards/${card.id.toLowerCase()}.webp`,
          type: 'image/webp',
        },
      ],
    },
  };
}

/** Mint a card as a compressed NFT using the connected wallet */
export async function mintCardAsNFT(
  card: Card,
  walletAdapter: WalletAdapter,
): Promise<MintResult> {
  try {
    const endpoint = clusterApiUrl(NETWORK);
    const umi = createUmi(endpoint).use(mplBubblegum());
    umi.use(walletAdapterIdentity(walletAdapter));

    const metadata = buildCardMetadata(card);

    const { signature } = await mintV1(umi, {
      leafOwner: umi.identity.publicKey,
      merkleTree: publicKey(MERKLE_TREE_ADDRESS),
      metadata: {
        name: `Inspired Mile: ${card.name}`,
        symbol: 'MILE',
        uri: `https://sonnetman.inspiredmile.com/api/v1/nft/metadata/${card.id}`,
        sellerFeeBasisPoints: 500, // 5% royalty
        collection: none(),
        creators: [
          {
            address: umi.identity.publicKey,
            verified: false,
            share: 100,
          },
        ],
      },
    }).sendAndConfirm(umi);

    const sig = Buffer.from(signature).toString('base64');

    return { success: true, signature: sig };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Minting failed',
    };
  }
}
