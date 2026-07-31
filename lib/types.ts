// The club name used to be an editable config field, but saving it was
// unreliable, so per request it's now a simple hardcoded constant.
// Just change the string below to update it everywhere.
export const CLUB_NAME = "Unser Verein";

export interface Jersey {
  id: string;
  number: number;
  name: string;
  start: number;
  jerseyPhoto: string;
  facePhoto: string;
}

export interface AuctionConfig {
  ended: boolean;
  endTime: string; // ISO date string
  jerseys: Jersey[];
}

export interface BidEntry {
  id: string;
  amount: number;
  bidder: string;
  phone: string;
  email: string;
  time: string; // ISO date string
  removed: boolean;
}

export type BidsMap = Record<string, BidEntry | null>;

export interface ConfigResponse {
  config: AuctionConfig;
  bids: BidsMap;
}

export interface ApiError {
  error: string;
  minNext?: number;
}
