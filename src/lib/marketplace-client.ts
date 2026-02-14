/**
 * Marketplace Client — API wrapper for card marketplace endpoints.
 */

const API_BASE = '/api/v1/marketplace';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
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
  return request('/');
}

export async function createListing(cardId: string, type: 'sale' | 'trade', priceCredits?: number, wantedCardIds?: string[]): Promise<Listing> {
  return request('/list', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, listing_type: type, price_credits: priceCredits, wanted_card_ids: wantedCardIds }),
  });
}

export async function getListing(id: string): Promise<Listing> {
  return request(`/${id}`);
}

export async function cancelListing(id: string): Promise<void> {
  await request(`/${id}/cancel`, { method: 'POST' });
}

export async function buyListing(id: string): Promise<{ status: string; card_id: string }> {
  return request(`/${id}/buy`, { method: 'POST' });
}

export async function myListings(): Promise<Listing[]> {
  return request('/my');
}
