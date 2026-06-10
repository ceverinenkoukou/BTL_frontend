import type { Profile, Company, Product, Zone, Campaign, CampaignSite, CampaignTeamMember, Tasting, Sale, CampaignStats, HostessStats, Gender, AgeRange, TasteRating, PurchaseIntent } from "./types";

// Mock user data
export const mockUsers: Profile[] = [
  {
    id: "1",
    email: "admin@example.com",
    full_name: "Admin User",
    phone: "+33612345678",
    role: "admin",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    email: "supervisor@example.com",
    full_name: "Marie Dupont",
    phone: "+33687654321",
    role: "supervisor",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    email: "hostess@example.com",
    full_name: "Sophie Martin",
    phone: "+33611223344",
    role: "hostess",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock company data
export const mockCompanies: Company[] = [
  {
    id: "1",
    name: "FreshUp Beverages",
    logo_url: undefined,
    address: "123 Rue du Commerce, Paris",
    contact_email: "contact@freshup.com",
    contact_phone: "+33123456789",
    created_by: "1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock product data
export const mockProducts: Product[] = [
  {
    id: "1",
    company_id: "1",
    name: "FreshUp Orange",
    description: "Jus d'orange naturel",
    sku: "FU-001",
    unit_price: 2.50,
    image_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company: mockCompanies[0],
  },
  {
    id: "2",
    company_id: "1",
    name: "FreshUp Apple",
    description: "Jus de pomme bio",
    sku: "FU-002",
    unit_price: 3.00,
    image_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company: mockCompanies[0],
  },
];

// Mock zone data
export const mockZones: Zone[] = [
  {
    id: "1",
    name: "Zone Paris Centre",
    city: "Paris",
    region: "Île-de-France",
    country: "France",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Zone Lyon",
    city: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    country: "France",
    created_at: new Date().toISOString(),
  },
];

// Mock campaign data
export const mockCampaigns: Campaign[] = [
  {
    id: "1",
    company_id: "1",
    name: "Campagne Été 2024",
    description: "Dégustation estivale dans les centres commerciaux",
    zone_id: "1",
    location_details: "Centre Commercial Les Halles",
    sales_objective: 500,
    tasting_objective: 1000,
    start_date: "2024-06-01",
    end_date: "2024-08-31",
    status: "active",
    created_by: "1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company: mockCompanies[0],
    zone: mockZones[0],
    products: mockProducts,
  },
  {
    id: "2",
    company_id: "1",
    name: "Campagne Rentrée 2024",
    description: "Lancement nouveau produit",
    zone_id: "2",
    location_details: "Centre Commercial Part-Dieu",
    sales_objective: 300,
    tasting_objective: 600,
    start_date: "2024-09-01",
    end_date: "2024-11-30",
    status: "planned",
    created_by: "1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company: mockCompanies[0],
    zone: mockZones[1],
    products: mockProducts,
  },
];

// Mock campaign team assignments
export const mockCampaignTeam: CampaignTeamMember[] = [
  {
    id: "1",
    campaign_id: "1",
    user_id: "3",
    role: "hostess",
    assigned_at: new Date().toISOString(),
    user: mockUsers[2],
  },
];

// Mock tasting data
export const mockTastings: Tasting[] = [
  {
    id: "1",
    campaign_id: "1",
    hostess_id: "3",
    product_id: "1",
    gender: "female",
    age_range: "26-35",
    taste_rating: "4",
    purchase_intent: "high",
    has_purchased: true,
    notes: "Très satisfait",
    created_at: new Date().toISOString(),
    campaign: mockCampaigns[0],
    hostess: mockUsers[2],
    product: mockProducts[0],
  },
  {
    id: "2",
    campaign_id: "1",
    hostess_id: "3",
    product_id: "2",
    gender: "male",
    age_range: "36-45",
    taste_rating: "5",
    purchase_intent: "high",
    has_purchased: true,
    notes: "Excellent goût",
    created_at: new Date().toISOString(),
    campaign: mockCampaigns[0],
    hostess: mockUsers[2],
    product: mockProducts[1],
  },
];

// Mock sales data
export const mockSales: Sale[] = [
  {
    id: "1",
    campaign_id: "1",
    tasting_id: "1",
    hostess_id: "3",
    product_id: "1",
    quantity: 2,
    unit_price: 2.50,
    total_amount: 5.00,
    validated: true,
    validated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    campaign: mockCampaigns[0],
    tasting: mockTastings[0],
    hostess: mockUsers[2],
    product: mockProducts[0],
  },
  {
    id: "2",
    campaign_id: "1",
    tasting_id: "2",
    hostess_id: "3",
    product_id: "2",
    quantity: 1,
    unit_price: 3.00,
    total_amount: 3.00,
    validated: true,
    validated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    campaign: mockCampaigns[0],
    tasting: mockTastings[1],
    hostess: mockUsers[2],
    product: mockProducts[1],
  },
];

// Mock campaign stats
export const mockCampaignStats: CampaignStats = {
  total_tastings: 150,
  total_sales: 75,
  total_revenue: 187.50,
  conversion_rate: 50,
  tastings_by_gender: [
    { gender: "female", count: 85 },
    { gender: "male", count: 60 },
    { gender: "other", count: 5 },
  ],
  tastings_by_age: [
    { age_range: "18-25", count: 30 },
    { age_range: "26-35", count: 50 },
    { age_range: "36-45", count: 40 },
    { age_range: "46-55", count: 20 },
    { age_range: "55+", count: 10 },
  ],
  tastings_by_rating: [
    { rating: "1", count: 5 },
    { rating: "2", count: 10 },
    { rating: "3", count: 25 },
    { rating: "4", count: 60 },
    { rating: "5", count: 50 },
  ],
  sales_by_product: [
    { product_name: "FreshUp Orange", quantity: 45, revenue: 112.50 },
    { product_name: "FreshUp Apple", quantity: 30, revenue: 75.00 },
  ],
};

// Mock hostess stats
export const mockHostessStats: HostessStats = {
  total_tastings: 150,
  total_sales: 75,
  total_revenue: 187.50,
  conversion_rate: 50,
  average_rating: 4.2,
  campaigns_count: 1,
};

// ─── 33 Export / Sobraga ───────────────────────────────────────────────────
// Campagne 1 : Animation 33 Export GMS     (24 Jun – 11 Jul | 5 PDV | 12 j | 10 VAC)
// Campagne 2 : Animation 33 Export CHR LBV (16 Jun – 19 Jul | 2 FZ  | 15 j |  8 CHR)

export const sobragoCompany: Company = {
  id: "2",
  name: "Sobraga - 33 Export",
  logo_url: undefined,
  address: "Zone Industrielle d'Oloumi, Libreville, Gabon",
  contact_email: "sobraga@33export.ga",
  contact_phone: "+24177000000",
  created_by: "1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const export33Products: Product[] = [
  {
    id: "3",
    company_id: "2",
    name: "33 Export CAN 33cl",
    description: "Bière blonde premium en canette aluminium 33cl",
    sku: "33EX-CAN33",
    unit_price: 700,
    image_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company: sobragoCompany,
  },
  {
    id: "4",
    company_id: "2",
    name: "33 Export VC 33cl",
    description: "Bière blonde premium en verre consigné 33cl",
    sku: "33EX-VC33",
    unit_price: 600,
    image_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company: sobragoCompany,
  },
];

// ── Zones ─────────────────────────────────────────────────────────────────
// GMS (5 PDV) + CHR (2 Grandes Fans Zones LBV)
export const gabonZones: Zone[] = [
  { id: "z1", name: "Mbolo Owendo",                  city: "Libreville", region: "Estuaire",          country: "Gabon", created_at: new Date().toISOString() },
  { id: "z2", name: "Casino Centre-Ville",           city: "Libreville", region: "Estuaire",          country: "Gabon", created_at: new Date().toISOString() },
  { id: "z3", name: "Score Akanda",                  city: "Libreville", region: "Estuaire",          country: "Gabon", created_at: new Date().toISOString() },
  { id: "z4", name: "Marché du Lac – Port-Gentil",   city: "Port-Gentil", region: "Ogooué-Maritime",  country: "Gabon", created_at: new Date().toISOString() },
  { id: "z5", name: "Score Franceville",             city: "Franceville", region: "Haut-Ogooué",      country: "Gabon", created_at: new Date().toISOString() },
  { id: "z6", name: "Fans Zone Stade Omar Bongo",    city: "Libreville", region: "Estuaire",          country: "Gabon", created_at: new Date().toISOString() },
  { id: "z7", name: "Fans Zone Jardin d'Essai",      city: "Libreville", region: "Estuaire",          country: "Gabon", created_at: new Date().toISOString() },
];

// ── Users ─────────────────────────────────────────────────────────────────
// IDs 4 : compte entreprise | 5 : sup GMS | 6 : sup CHR
// IDs 7-16 : 10 Hôtesses VAC (GMS) | IDs 17-24 : 8 Hôtesses CHR
export const export33Users: Profile[] = [
  { id: "4",  email: "sobraga@33export.ga",   full_name: "Sobraga SA",            phone: "+24177000000", role: "company",    company_id: "2", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "5",  email: "sup.gms@sobraga.ga",    full_name: "Jean-Marc Obiang",      phone: "+24166001122", role: "supervisor",                   avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "6",  email: "sup.chr@sobraga.ga",    full_name: "Hervé Mounguengui",     phone: "+24166003344", role: "supervisor",                   avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  // VAC GMS (10)
  { id: "7",  email: "vac1@sobraga.ga",  full_name: "Flore Mba",           phone: "+24177110011", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "8",  email: "vac2@sobraga.ga",  full_name: "Patricia Nguema",     phone: "+24177220022", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "9",  email: "vac3@sobraga.ga",  full_name: "Christelle Ondo",     phone: "+24177330033", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "10", email: "vac4@sobraga.ga",  full_name: "Marlène Nzé",         phone: "+24177440044", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "11", email: "vac5@sobraga.ga",  full_name: "Rosalie Boundono",    phone: "+24177550055", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "12", email: "vac6@sobraga.ga",  full_name: "Nadège Bongo",        phone: "+24177660066", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "13", email: "vac7@sobraga.ga",  full_name: "Sylvie Moubamba",     phone: "+24177770077", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "14", email: "vac8@sobraga.ga",  full_name: "Aurélie Minko",       phone: "+24177880088", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "15", email: "vac9@sobraga.ga",  full_name: "Joëlle Ngoua",        phone: "+24177990099", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "16", email: "vac10@sobraga.ga", full_name: "Céleste Kombila",     phone: "+24177001100", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  // CHR (8)
  { id: "17", email: "chr1@sobraga.ga",  full_name: "Vanessa Ella",        phone: "+24177111222", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "18", email: "chr2@sobraga.ga",  full_name: "Laëtitia Akué",       phone: "+24177222333", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "19", email: "chr3@sobraga.ga",  full_name: "Stéphanie Mengue",    phone: "+24177333444", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "20", email: "chr4@sobraga.ga",  full_name: "Marie-Claire Bivigou",phone: "+24177444555", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "21", email: "chr5@sobraga.ga",  full_name: "Rachèle Ndong",       phone: "+24177555666", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "22", email: "chr6@sobraga.ga",  full_name: "Diane Mbadinga",      phone: "+24177666777", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "23", email: "chr7@sobraga.ga",  full_name: "Ginette Ossou",       phone: "+24177777888", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "24", email: "chr8@sobraga.ga",  full_name: "Béatrice Lendoye",    phone: "+24177888999", role: "hostess", avatar_url: undefined, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// ════════════════════════════════════════════════════════════════════════════
// CAMPAGNE 1 — Animation 33 Export GMS
// Période : 24 Juin – 11 Juillet 2025 | 5 PDV | 12 jours animés (Mer-Jeu-Ven-Sam)
// Objectif : 810 casiers ventes | 1 140 dégustations | 720 goodies | 315 packs gratuits
// Mécaniques GMS+ : 4 CAN = 1 CAN offerte / 6 CAN = 1 tirage
// Mécaniques Mini-GMS : 1 pack = 1 tirage / 4 packs = 1 pack + 1 lot
// ════════════════════════════════════════════════════════════════════════════

export const export33Campaign: Campaign = {
  id: "3",
  company_id: "2",
  name: "Animation 33 Export GMS",
  description: "Animer la 33 Export CAN 33cl en GMS — Achat avec Gain. GMS+ : 4 CAN achetées = 1 CAN offerte / 6 CAN = 1 tirage. Mini-GMS : 1 pack = 1 tirage / 4 packs = 1 pack + 1 lot.",
  location_details: "5 GMS : Mbolo Owendo, Casino Centre-Ville, Score Akanda (LBV) — Marché du Lac (Port-Gentil) — Score Franceville",
  sales_objective: 810,
  tasting_objective: 1140,
  start_date: "2025-06-24",
  end_date: "2025-07-11",
  status: "active",
  created_by: "1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  company: sobragoCompany,
  products: [export33Products[0]],
  team: [],
  sites: [],
};

export const export33CampaignSites: CampaignSite[] = [
  { id: "s1", campaign_id: "3", zone_id: "z1", name: "Mbolo Owendo",          zone: gabonZones[0] },
  { id: "s2", campaign_id: "3", zone_id: "z2", name: "Casino Centre-Ville",   zone: gabonZones[1] },
  { id: "s3", campaign_id: "3", zone_id: "z3", name: "Score Akanda",          zone: gabonZones[2] },
  { id: "s4", campaign_id: "3", zone_id: "z4", name: "Marché du Lac P-G",     zone: gabonZones[3] },
  { id: "s5", campaign_id: "3", zone_id: "z5", name: "Score Franceville",     zone: gabonZones[4] },
];

// Jean-Marc (sup) + 10 VAC hostesses (2 par site)
export const export33CampaignTeam: CampaignTeamMember[] = [
  { id: "t1",  campaign_id: "3", site_id: "s1", user_id: "5",  role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1]  },
  { id: "t2",  campaign_id: "3", site_id: "s2", user_id: "5",  role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1]  },
  { id: "t3",  campaign_id: "3", site_id: "s3", user_id: "5",  role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1]  },
  { id: "t4",  campaign_id: "3", site_id: "s4", user_id: "5",  role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1]  },
  { id: "t5",  campaign_id: "3", site_id: "s5", user_id: "5",  role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1]  },
  { id: "t6",  campaign_id: "3", site_id: "s1", user_id: "7",  role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[3]  },
  { id: "t7",  campaign_id: "3", site_id: "s1", user_id: "8",  role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[4]  },
  { id: "t8",  campaign_id: "3", site_id: "s2", user_id: "9",  role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[5]  },
  { id: "t9",  campaign_id: "3", site_id: "s2", user_id: "10", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[6]  },
  { id: "t10", campaign_id: "3", site_id: "s3", user_id: "11", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[7]  },
  { id: "t11", campaign_id: "3", site_id: "s3", user_id: "12", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[8]  },
  { id: "t12", campaign_id: "3", site_id: "s4", user_id: "13", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[9]  },
  { id: "t13", campaign_id: "3", site_id: "s4", user_id: "14", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[10] },
  { id: "t14", campaign_id: "3", site_id: "s5", user_id: "15", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[11] },
  { id: "t15", campaign_id: "3", site_id: "s5", user_id: "16", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[12] },
];

// ════════════════════════════════════════════════════════════════════════════
// CAMPAGNE 2 — Animation 33 Export Coupe du Monde CHR LBV
// Période : 16 Juin – 19 Juillet 2025 | 2 Grandes Fans Zones | 15 jours | 8 CHR hostesses
// Objectif : 320 dégustations période (20/j) | 107 casiers gratuits | 960 goodies
// Mécaniques : 3 bouteilles achetées = 1 offerte / 9 achetées = 1 tirage (finale = tombola)
// ════════════════════════════════════════════════════════════════════════════

export const export33CampaignCHR: Campaign = {
  id: "4",
  company_id: "2",
  name: "Animation 33 Export Coupe du Monde CHR LBV",
  description: "Animer la 33 Export VC 33cl en CHR — Achat avec Gain. 3 bouteilles achetées = 1 offerte. 9 bouteilles achetées = 1 tirage (lors de la finale : 1 ticket tombola).",
  location_details: "2 Grandes Fans Zones à Libreville : Stade Omar Bongo & Jardin d'Essai",
  sales_objective: 107,
  tasting_objective: 320,
  start_date: "2025-06-16",
  end_date: "2025-07-19",
  status: "active",
  created_by: "1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  company: sobragoCompany,
  products: [export33Products[1]],
  team: [],
  sites: [],
};

export const chrSites: CampaignSite[] = [
  { id: "s6", campaign_id: "4", zone_id: "z6", name: "Fans Zone Stade Omar Bongo", zone: gabonZones[5] },
  { id: "s7", campaign_id: "4", zone_id: "z7", name: "Fans Zone Jardin d'Essai",   zone: gabonZones[6] },
];

// Hervé (sup) + 8 CHR hostesses (4 par site)
export const chrTeam: CampaignTeamMember[] = [
  { id: "t16", campaign_id: "4", site_id: "s6", user_id: "6",  role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[2]  },
  { id: "t17", campaign_id: "4", site_id: "s7", user_id: "6",  role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[2]  },
  { id: "t18", campaign_id: "4", site_id: "s6", user_id: "17", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[13] },
  { id: "t19", campaign_id: "4", site_id: "s6", user_id: "18", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[14] },
  { id: "t20", campaign_id: "4", site_id: "s6", user_id: "19", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[15] },
  { id: "t21", campaign_id: "4", site_id: "s6", user_id: "20", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[16] },
  { id: "t22", campaign_id: "4", site_id: "s7", user_id: "21", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[17] },
  { id: "t23", campaign_id: "4", site_id: "s7", user_id: "22", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[18] },
  { id: "t24", campaign_id: "4", site_id: "s7", user_id: "23", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[19] },
  { id: "t25", campaign_id: "4", site_id: "s7", user_id: "24", role: "hostess",    assigned_at: new Date().toISOString(), user: export33Users[20] },
];

// ── Tasting / Sales generators ────────────────────────────────────────────

const genderCycle: Gender[]         = ["female", "male", "female", "male", "female", "other", "female", "male", "female", "male"];
const ageCycle: AgeRange[]          = ["18-25", "26-35", "36-45", "18-25", "26-35", "46-55", "18-25", "26-35", "36-45", "26-35"];
const ratingCycle: TasteRating[]    = ["4", "5", "3", "5", "4", "4", "5", "3", "4", "5"];
const intentCycle: PurchaseIntent[] = ["high", "high", "medium", "high", "high", "low", "high", "medium", "high", "high"];
const purchasedCycleGMS             = [true, true, false, true, true, false, true, false, true, true]; // ~70%
const purchasedCycleCHR             = [true, true, true, false, true, true, true, false, true, true];  // ~80% (mécanique CHR)

function makeDate(baseIso: string, dayOffset: number): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
}

// GMS : 12 jours animés — ~95 dégustations/jour réparties sur 10 hostesses
// On simule 8 jours écoulés → ~760 dégustations réalisées
export const export33Tastings: Tasting[] = (() => {
  const result: Tasting[] = [];
  const gmsHostessIds = ["7", "8", "9", "10", "11", "12", "13", "14", "15", "16"];
  const gmsSiteMap: Record<string, string> = {
    "7": "s1", "8": "s1", "9": "s2", "10": "s2",
    "11": "s3", "12": "s3", "13": "s4", "14": "s4", "15": "s5", "16": "s5",
  };
  let idx = 0;
  // 8 jours animés écoulés (sur 12 au total), ~95/jour
  const dailyCounts = [88, 92, 97, 95, 90, 98, 96, 94];
  for (let day = 0; day < dailyCounts.length; day++) {
    for (let t = 0; t < dailyCounts[day]; t++) {
      const i = idx++;
      const hostessId = gmsHostessIds[i % gmsHostessIds.length];
      result.push({
        id: String(200 + i),
        campaign_id: "3",
        hostess_id: hostessId,
        product_id: "3",
        site_id: gmsSiteMap[hostessId],
        gender: genderCycle[i % genderCycle.length],
        age_range: ageCycle[i % ageCycle.length],
        taste_rating: ratingCycle[i % ratingCycle.length],
        purchase_intent: intentCycle[i % intentCycle.length],
        has_purchased: purchasedCycleGMS[i % purchasedCycleGMS.length],
        notes: "",
        created_at: makeDate("2025-06-25T09:00:00Z", day),
        campaign: export33Campaign,
        hostess: export33Users.find(u => u.id === hostessId)!,
        product: export33Products[0],
      });
    }
  }
  return result;
})();

export const export33Sales: Sale[] = (() => {
  const result: Sale[] = [];
  export33Tastings.forEach((tasting, i) => {
    if (tasting.has_purchased) {
      const qty = i % 5 === 0 ? 2 : 1;
      result.push({
        id: String(300 + result.length),
        campaign_id: "3",
        tasting_id: tasting.id,
        hostess_id: tasting.hostess_id,
        product_id: "3",
        site_id: tasting.site_id,
        quantity: qty,
        unit_price: export33Products[0].unit_price,
        total_amount: export33Products[0].unit_price * qty,
        validated: true,
        validated_at: tasting.created_at,
        created_at: tasting.created_at,
        campaign: export33Campaign,
        tasting,
        hostess: tasting.hostess,
        product: export33Products[0],
      });
    }
  });
  return result;
})();

// CHR : 15 jours animés — 20 dégustations/jour | 10 jours écoulés → ~200 réalisées
export const chrTastings: Tasting[] = (() => {
  const result: Tasting[] = [];
  const chrHostessIds = ["17", "18", "19", "20", "21", "22", "23", "24"];
  const chrSiteMap: Record<string, string> = {
    "17": "s6", "18": "s6", "19": "s6", "20": "s6",
    "21": "s7", "22": "s7", "23": "s7", "24": "s7",
  };
  let idx = 0;
  const dailyCounts = [18, 20, 19, 22, 20, 21, 19, 20, 22, 21];
  for (let day = 0; day < dailyCounts.length; day++) {
    for (let t = 0; t < dailyCounts[day]; t++) {
      const i = idx++;
      const hostessId = chrHostessIds[i % chrHostessIds.length];
      result.push({
        id: String(800 + i),
        campaign_id: "4",
        hostess_id: hostessId,
        product_id: "4",
        site_id: chrSiteMap[hostessId],
        gender: genderCycle[i % genderCycle.length],
        age_range: ageCycle[i % ageCycle.length],
        taste_rating: ratingCycle[i % ratingCycle.length],
        purchase_intent: intentCycle[i % intentCycle.length],
        has_purchased: purchasedCycleCHR[i % purchasedCycleCHR.length],
        notes: "",
        created_at: makeDate("2025-06-16T19:00:00Z", day),
        campaign: export33CampaignCHR,
        hostess: export33Users.find(u => u.id === hostessId)!,
        product: export33Products[1],
      });
    }
  }
  return result;
})();

export const chrSales: Sale[] = (() => {
  const result: Sale[] = [];
  chrTastings.forEach((tasting, i) => {
    if (tasting.has_purchased) {
      const qty = i % 4 === 0 ? 3 : 1;
      result.push({
        id: String(900 + result.length),
        campaign_id: "4",
        tasting_id: tasting.id,
        hostess_id: tasting.hostess_id,
        product_id: "4",
        site_id: tasting.site_id,
        quantity: qty,
        unit_price: export33Products[1].unit_price,
        total_amount: export33Products[1].unit_price * qty,
        validated: true,
        validated_at: tasting.created_at,
        created_at: tasting.created_at,
        campaign: export33CampaignCHR,
        tasting,
        hostess: tasting.hostess,
        product: export33Products[1],
      });
    }
  });
  return result;
})();

// ── Aggregate stats ───────────────────────────────────────────────────────

// GMS : 8 jours sur 12 écoulés → 750 dégus / 380 acheteurs / objectif 1 140 dégus & 810 casiers
export const mock33ExportStats = {
  totalTastings: 750,
  totalSales: 383,
  conversionRate: 51.1,
  totalRevenue: 283_400,
  goodiesDistributed: 480,         // sur 720 prévus
  gratuitsDistributed: 198,        // sur 315 packs prévus
  campaignDays: 12,
  objectiveTastingsPct: Math.round((750  / 1140) * 100),   // ~66 %
  objectiveSalesPct:    Math.round((383  /  810) * 100),   // ~47 %
  byZone: [
    { zone: "Mbolo Owendo",         tastings: 192, sales: 98  },
    { zone: "Casino Centre-Ville",  tastings: 183, sales: 93  },
    { zone: "Score Akanda",         tastings: 176, sales: 90  },
    { zone: "Marché du Lac P-G",    tastings: 108, sales: 56  },
    { zone: "Score Franceville",    tastings: 91,  sales: 46  },
  ],
  byProduct: [
    { name: "33 Export CAN 33cl", sales: 383, revenue: 283_400 },
  ],
  // 8 jours animés : Mer 25/6, Jeu 26/6, Ven 27/6, Sam 28/6, Mer 2/7, Jeu 3/7, Ven 4/7, Sam 5/7
  dailyData: [
    { date: "25 juin",  tastings: 88,  sales: 45  },
    { date: "26 juin",  tastings: 92,  sales: 47  },
    { date: "27 juin",  tastings: 97,  sales: 50  },
    { date: "28 juin",  tastings: 95,  sales: 49  },
    { date: "2 juil.",  tastings: 90,  sales: 46  },
    { date: "3 juil.",  tastings: 98,  sales: 50  },
    { date: "4 juil.",  tastings: 96,  sales: 49  },
    { date: "5 juil.",  tastings: 94,  sales: 48  },
  ],
  byGender: [
    { name: "Femme", value: 54 },
    { name: "Homme", value: 42 },
    { name: "Autre", value: 4  },
  ],
  byAge: [
    { name: "18-25", value: 29 },
    { name: "26-35", value: 37 },
    { name: "36-45", value: 22 },
    { name: "46-55", value: 8  },
    { name: "55+",   value: 4  },
  ],
};

// CHR : 10 jours sur 15 écoulés → 202 dégus / 162 acheteurs / objectif 320 dégus & 107 casiers
export const mock33ExportStatsCHR = {
  totalTastings: 202,
  totalSales: 162,
  conversionRate: 80.2,
  totalRevenue: 103_680,
  goodiesDistributed: 640,         // sur 960 prévus
  gratuitsDistributed: 72,         // sur 107 casiers prévus
  campaignDays: 15,
  objectiveTastingsPct: Math.round((202 / 320) * 100),    // ~63 %
  objectiveSalesPct:    Math.round((72  / 107) * 100),    // ~67 %
  byZone: [
    { zone: "Fans Zone Stade Omar Bongo", tastings: 105, sales: 84 },
    { zone: "Fans Zone Jardin d'Essai",   tastings: 97,  sales: 78 },
  ],
  byProduct: [
    { name: "33 Export VC 33cl", sales: 162, revenue: 103_680 },
  ],
  dailyData: [
    { date: "16 juin",  tastings: 18, sales: 14 },
    { date: "17 juin",  tastings: 20, sales: 16 },
    { date: "18 juin",  tastings: 19, sales: 15 },
    { date: "19 juin",  tastings: 22, sales: 18 },
    { date: "20 juin",  tastings: 20, sales: 16 },
    { date: "21 juin",  tastings: 21, sales: 17 },
    { date: "22 juin",  tastings: 19, sales: 15 },
    { date: "23 juin",  tastings: 20, sales: 16 },
    { date: "24 juin",  tastings: 22, sales: 18 },
    { date: "25 juin",  tastings: 21, sales: 17 },
  ],
  byGender: [
    { name: "Femme", value: 48 },
    { name: "Homme", value: 49 },
    { name: "Autre", value: 3  },
  ],
  byAge: [
    { name: "18-25", value: 35 },
    { name: "26-35", value: 40 },
    { name: "36-45", value: 18 },
    { name: "46-55", value: 5  },
    { name: "55+",   value: 2  },
  ],
};

// ── Wire up sites & teams ─────────────────────────────────────────────────

export33CampaignSites.forEach(site => {
  site.team = export33CampaignTeam.filter(m => m.site_id === site.id);
});
chrSites.forEach(site => {
  site.team = chrTeam.filter(m => m.site_id === site.id);
});

export33Campaign.sites = export33CampaignSites;
export33Campaign.team  = export33CampaignTeam;
export33CampaignCHR.sites = chrSites;
export33CampaignCHR.team  = chrTeam;

// ── Push into shared arrays ───────────────────────────────────────────────

mockUsers.push(...export33Users);
mockCompanies.push(sobragoCompany);
mockProducts.push(...export33Products);
mockZones.push(...gabonZones);
mockCampaigns.push(export33Campaign, export33CampaignCHR);
mockTastings.push(...export33Tastings, ...chrTastings);
mockSales.push(...export33Sales, ...chrSales);
mockCampaignTeam.push(...export33CampaignTeam, ...chrTeam);

// Simple mock auth functions
export const mockAuth = {
  signIn: async (email: string, password: string) => {
    // Mock authentication - accept any email from mockUsers with any password
    const user = mockUsers.find(u => u.email === email);
    if (user) {
      return { user, error: null };
    }
    return { user: null, error: { message: "Email non trouvé" } };
  },
  
  signUp: async (email: string, password: string, fullName: string) => {
    // Mock signup - create a new user
    const newUser: Profile = {
      id: String(mockUsers.length + 1),
      email,
      full_name: fullName,
      role: "hostess",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockUsers.push(newUser);
    return { user: newUser, error: null };
  },
  
  signOut: async () => {
    return { error: null };
  },
};
