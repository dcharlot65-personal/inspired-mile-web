/**
 * Marketplace Client — API wrapper for card marketplace endpoints.
 */

import { ApiError } from './api-client';

const API_BASE = '/api/v1/marketplace';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  // The status and the body, for src/lib/api-errors.ts to turn into a code. Never shown as they are.
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return response.json();
}

export interface Listing {
  id: string;
  seller_id: string;
  seller_username: string;
  card_id: string;
  listing_type: string;
  price_credits: number | null;
  wanted_card_ids: string[];
  status: string;
  created_at: string;
}

export async function browseListings(): Promise<Listing[]> {
  return request('');
}

/** List one card for sale. The card is locked to the listing until it sells or is cancelled.
 *  Only sales are offered (a trade would need the buyer's card moved too, which is not built). */
export async function createListing(cardId: string, priceCredits: number): Promise<Listing> {
  return request('/list', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, listing_type: 'sale', price_credits: priceCredits }),
  });
}

export async function getListing(id: string): Promise<Listing> {
  return request(`/${id}`);
}

export async function cancelListing(id: string): Promise<void> {
  await request(`/${id}/cancel`, { method: 'POST' });
}

/** Buy a listing: the price moves from you to the seller, and the card to you, in one step. */
export async function buyListing(id: string): Promise<{ status: string; card_id: string; price: number; credits: number }> {
  return request(`/${id}/buy`, { method: 'POST' });
}

export async function myListings(): Promise<Listing[]> {
  return request('/my');
}
