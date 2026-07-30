export type CompanySettings = {
  cafe_name: string;
  logo_url: string;
  contact_phone: string;
  address: string;
  currency: string;
  timezone: string;
  tax_percent: string;
  receipt_header: string;
  receipt_footer: string;
};

export type SecurityInfo = {
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
};

export type SettingsResponse = {
  settings: CompanySettings;
  security: SecurityInfo;
};

export type UpdateSettingsInput = Partial<Omit<CompanySettings, "tax_percent">> & { tax_percent?: number };

export type SystemInfo = {
  appVersion: string;
  nodeVersion: string;
  prismaVersion: string;
  postgresVersion: string;
  counts: {
    users: number;
    products: number;
    sales: number;
    purchases: number;
    ingredients: number;
  };
};

export type ClearDataSummary = {
  saleItems: number;
  sales: number;
  purchaseItems: number;
  purchases: number;
  stockMovements: number;
  priceHistory: number;
  backups: number;
  stockRowsReset: number;
  ingredientsCostReset: number;
};
