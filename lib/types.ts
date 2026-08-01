export const CLUB_NAME = "SPG GROSSWALSERTAL";

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
