export interface SmOfferItem {
  storeId: string;
  storeName: string;
  storeUrl: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  currency: string;
  isAvailable: boolean;
  type?: string;
  sellerId?: string | number | null;
  sellerName?: string | null;
}

export interface SmStoreModule {
  id: string;
  name: string;
  baseUrl: string;
  isEnabled: boolean;
  fetch: (query: string, initialSearch?: boolean) => Promise<SmOfferItem[]>;
}

export interface SmFilters {
  priceMin: string;
  priceMax: string;
  discountPercentMin: string;
  discountPercentMax: string;
  discountAmountMin: string;
  discountAmountMax: string;
  hasDiscount: boolean;
  stores: Record<string, boolean>;
}

export interface SmSortState {
  field: 'price' | 'discountPercent' | 'discountAmount' | 'name';
  direction: 'asc' | 'desc';
}

export interface SmStoreStatus {
  name: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  error: string | null;
  statusCode?: number | null;
}

export interface SmScrapedSteamOffer {
  id: string;
  title: string;
  price: number | null;
  originalPrice: number | null;
  priceText?: string;
  originalPriceText?: string;
  discountPercent: number;
  type: 'sub' | 'bundle' | 'dlc';
  defaultOrder?: number;
}
