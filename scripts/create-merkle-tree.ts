/**
 * Create Merkle Tree — One-time script to create a Solana Merkle tree for cNFT minting.
 * Run with: npx tsx scripts/create-merkle-tree.ts
 *
 * After running, copy the tree address and update MERKLE_TREE_ADDRESS in src/lib/nft-mint.ts.
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplBubblegum, createTree } from '@metaplex-foundation/mpl-bubblegum';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import { clusterApiUrl } from '@solana/web3.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const NETWORK = 'devnet';

// Load keypair from local file (standard Solana CLI keypair)
const KEYPAIR_PATH = path.join(
  process.env.HOME || '~',
  '.config/solana/id.json',
);

async function main() {
  console.log(`Creating Merkle tree on ${NETWORK}...`);

  const endpoint = clusterApiUrl(NETWORK);
  const umi = createUmi(endpoint).use(mplBubblegum());

  // Load payer keypair
  if (!fs.existsSync(KEYPAIR_PATH)) {
    console.error(`Keypair not found at ${KEYPAIR_PATH}`);
    console.error('Run: solana-keygen new');
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
  const keypair = umi.eddsa.createKeypairFromSecretKey(
    new Uint8Array(keypairData),
  );
  umi.use(keypairIdentity(keypair));

  // Create tree with capacity for 16,384 leaves (2^14)
  // maxDepth=14, maxBufferSize=64 — enough for many cards
  const merkleTree = generateSigner(umi);

  console.log('Tree address:', merkleTree.publicKey);
  console.log('Sending transaction...');

  const { signature } = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
  }).sendAndConfirm(umi);

  console.log('Transaction signature:', Buffer.from(signature).toString('base64'));
  console.log('\nDone! Update MERKLE_TREE_ADDRESS in src/lib/nft-mint.ts with:');
  console.log(merkleTree.publicKey);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
