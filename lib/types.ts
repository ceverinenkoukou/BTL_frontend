export type UserRole = "admin" | "supervisor" | "hostess" | "manager" | "coordinator" | "company";
export type CampaignStatus = "draft" | "planned" | "active" | "paused" | "completed" | "cancelled";
export type Gender = "male" | "female" | "other";
export type AgeRange = "18-25" | "26-35" | "36-45" | "46-55" | "55+";
export type PurchaseIntent = "low" | "medium" | "high";
export type TasteRating = "1" | "2" | "3" | "4" | "5";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  company_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  sku?: string;
  unit_price: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company?: Company;
}

export interface Zone {
  id: string;
  name: string;
  city?: string;
  region?: string;
  country: string;
  created_at: string;
}

export interface CampaignSite {
  id: string;
  campaign_id: string;
  zone_id: string;
  name: string;
  address?: string;
  zone?: Zone;
  team?: CampaignTeamMember[];
}

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  zone_id?: string;
  location_details?: string;
  sales_objective: number;
  tasting_objective: number;
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
  company?: Company;
  zone?: Zone;
  products?: Product[];
  team?: CampaignTeamMember[];
  sites?: CampaignSite[];
}

export interface CampaignProduct {
  id: string;
  campaign_id: string;
  product_id: string;
  product?: Product;
}

export interface CampaignTeamMember {
  id: string;
  campaign_id: string;
  site_id?: string;
  user_id: string;
  role: UserRole;
  assigned_at: string;
  user?: Profile;
}

export interface Tasting {
  id: string;
  campaign_id: string;
  hostess_id: string;
  product_id: string;
  gender: Gender;
  age_range: AgeRange;
  taste_rating: TasteRating;
  purchase_intent: PurchaseIntent;
  has_purchased: boolean;
  notes?: string;
  site_id?: string;
  created_at: string;
  campaign?: Campaign;
  hostess?: Profile;
  product?: Product;
  site?: CampaignSite;
}

export interface Sale {
  id: string;
  campaign_id: string;
  tasting_id?: string;
  hostess_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  validated: boolean;
  validated_at?: string;
  site_id?: string;
  created_at: string;
  campaign?: Campaign;
  tasting?: Tasting;
  hostess?: Profile;
  product?: Product;
  site?: CampaignSite;
}

export interface DailyReport {
  id: string;
  campaign_id: string;
  hostess_id: string;
  report_date: string;
  total_tastings: number;
  total_sales: number;
  total_amount: number;
  conversion_rate: number;
  validated: boolean;
  validated_by?: string;
  created_at: string;
  campaign?: Campaign;
  hostess?: Profile;
}

export interface WheelSpin {
  id: string;
  campaign_id: string;
  customer_phone?: string;
  customer_name?: string;
  prize_won: string;
  prize_value: number;
  claimed: boolean;
  hostess_id?: string;
  created_at: string;
}

export interface WheelPrize {
  id: string;
  campaign_id: string;
  name: string;
  probability: number;
  quantity_available: number;
  quantity_won: number;
  is_active: boolean;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
  user?: Profile;
}

// Stats interfaces
export interface CampaignStats {
  total_tastings: number;
  total_sales: number;
  total_revenue: number;
  conversion_rate: number;
  tastings_by_gender: { gender: Gender; count: number }[];
  tastings_by_age: { age_range: AgeRange; count: number }[];
  tastings_by_rating: { rating: TasteRating; count: number }[];
  sales_by_product: { product_name: string; quantity: number; revenue: number }[];
}

export interface HostessStats {
  total_tastings: number;
  total_sales: number;
  total_revenue: number;
  conversion_rate: number;
  average_rating: number;
  campaigns_count: number;
}
