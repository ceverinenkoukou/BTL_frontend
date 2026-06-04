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

// ─── 33 Export / Sobraga data ──────────────────────────────────────────────

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
    name: "33 Export 33cl (Canette)",
    description: "Bière blonde premium en canette 33cl",
    sku: "33EX-033",
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
    name: "33 Export 65cl (Bouteille)",
    description: "Bière blonde premium en bouteille 65cl",
    sku: "33EX-065",
    unit_price: 1200,
    image_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company: sobragoCompany,
  },
];

export const gabonZones: Zone[] = [
  { id: "3", name: "Libreville - Mont-Bouët", city: "Libreville", region: "Estuaire", country: "Gabon", created_at: new Date().toISOString() },
  { id: "4", name: "Libreville - Charbonnages", city: "Libreville", region: "Estuaire", country: "Gabon", created_at: new Date().toISOString() },
  { id: "5", name: "Port-Gentil - Centre", city: "Port-Gentil", region: "Ogooué-Maritime", country: "Gabon", created_at: new Date().toISOString() },
  { id: "6", name: "Franceville", city: "Franceville", region: "Haut-Ogooué", country: "Gabon", created_at: new Date().toISOString() },
  { id: "7", name: "Oyem - Marché central", city: "Oyem", region: "Woleu-Ntem", country: "Gabon", created_at: new Date().toISOString() },
];

export const export33Users: Profile[] = [
  {
    id: "4",
    email: "sobraga@33export.ga",
    full_name: "Sobraga SA",
    phone: "+24177000000",
    role: "company",
    company_id: "2",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "5",
    email: "superviseur1.33@sobraga.ga",
    full_name: "Jean-Marc Obiang",
    phone: "+24166001122",
    role: "supervisor",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "6",
    email: "superviseur2.33@sobraga.ga",
    full_name: "Hervé Mounguengui",
    phone: "+24166003344",
    role: "supervisor",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "7",
    email: "hotesse1.33@sobraga.ga",
    full_name: "Flore Mba",
    phone: "+24177110011",
    role: "hostess",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "8",
    email: "hotesse2.33@sobraga.ga",
    full_name: "Patricia Nguema",
    phone: "+24177220022",
    role: "hostess",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "9",
    email: "hotesse3.33@sobraga.ga",
    full_name: "Christelle Ondo",
    phone: "+24177330033",
    role: "hostess",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "10",
    email: "hotesse4.33@sobraga.ga",
    full_name: "Marlène Nzé",
    phone: "+24177440044",
    role: "hostess",
    avatar_url: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const export33Campaign: Campaign = {
  id: "3",
  company_id: "2",
  name: "Promo '33' Export - Supporter N°1 du Football",
  description: "Grande promotion football – Achetez des produits 33 Export et gagnez des lots incroyables ! Vivez des moments inoubliables du 24 Juin au 11 Juillet.",
  location_details: "5 sites au Gabon : Libreville (×2), Port-Gentil, Franceville, Oyem",
  sales_objective: 2500,
  tasting_objective: 5000,
  start_date: "2025-06-24",
  end_date: "2025-07-11",
  status: "active",
  created_by: "1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  company: sobragoCompany,
  products: export33Products,
  team: [],
  sites: [],
};

// Sites de la campagne 33 Export (un par zone)
export const export33CampaignSites: CampaignSite[] = [
  { id: "s1", campaign_id: "3", zone_id: "3", name: "Libreville - Mont-Bouët",     zone: gabonZones[0] },
  { id: "s2", campaign_id: "3", zone_id: "4", name: "Libreville - Charbonnages",  zone: gabonZones[1] },
  { id: "s3", campaign_id: "3", zone_id: "5", name: "Port-Gentil - Centre",       zone: gabonZones[2] },
  { id: "s4", campaign_id: "3", zone_id: "6", name: "Franceville",                zone: gabonZones[3] },
  { id: "s5", campaign_id: "3", zone_id: "7", name: "Oyem - Marché central",      zone: gabonZones[4] },
];

// Équipe par site :
// Jean-Marc (sup 5) couvre s1 + s2 + s5 ; Hervé (sup 6) couvre s3 + s4
// Flore (7) et Patricia (8) sur s1 ; Christelle (9) et Marlène (10) sur s2
// Flore (7) aussi sur s3 ; Christelle (9) aussi sur s4 ; Patricia (8) aussi sur s5
export const export33CampaignTeam: CampaignTeamMember[] = [
  // Superviseurs
  { id: "10", campaign_id: "3", site_id: "s1", user_id: "5", role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1] },
  { id: "11", campaign_id: "3", site_id: "s2", user_id: "5", role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1] },
  { id: "16", campaign_id: "3", site_id: "s5", user_id: "5", role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[1] },
  { id: "12", campaign_id: "3", site_id: "s3", user_id: "6", role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[2] },
  { id: "17", campaign_id: "3", site_id: "s4", user_id: "6", role: "supervisor", assigned_at: new Date().toISOString(), user: export33Users[2] },
  // Hôtesses
  { id: "13", campaign_id: "3", site_id: "s1", user_id: "7",  role: "hostess", assigned_at: new Date().toISOString(), user: export33Users[3] },
  { id: "14", campaign_id: "3", site_id: "s1", user_id: "8",  role: "hostess", assigned_at: new Date().toISOString(), user: export33Users[4] },
  { id: "18", campaign_id: "3", site_id: "s2", user_id: "9",  role: "hostess", assigned_at: new Date().toISOString(), user: export33Users[5] },
  { id: "19", campaign_id: "3", site_id: "s2", user_id: "10", role: "hostess", assigned_at: new Date().toISOString(), user: export33Users[6] },
  { id: "20", campaign_id: "3", site_id: "s3", user_id: "7",  role: "hostess", assigned_at: new Date().toISOString(), user: export33Users[3] },
  { id: "21", campaign_id: "3", site_id: "s4", user_id: "9",  role: "hostess", assigned_at: new Date().toISOString(), user: export33Users[5] },
  { id: "22", campaign_id: "3", site_id: "s5", user_id: "8",  role: "hostess", assigned_at: new Date().toISOString(), user: export33Users[4] },
];

// hostess → site principal (pour les dégustations générées)
const hostessSiteMap: Record<string, string> = {
  "7": "s1",  // Flore → Mont-Bouët
  "8": "s2",  // Patricia → Charbonnages
  "9": "s3",  // Christelle → Port-Gentil
  "10": "s4", // Marlène → Franceville
};

// Generate deterministic tasting + sales data for the 33 Export campaign
const genderCycle: Gender[]         = ["female", "male", "female", "male", "female", "other", "female", "male", "female", "male"];
const ageCycle: AgeRange[]          = ["18-25", "26-35", "36-45", "18-25", "26-35", "46-55", "18-25", "26-35", "36-45", "26-35"];
const ratingCycle: TasteRating[]    = ["4", "5", "3", "5", "4", "4", "5", "3", "4", "5"];
const intentCycle: PurchaseIntent[] = ["high", "high", "medium", "high", "high", "low", "high", "medium", "high", "high"];
const purchasedCycle                = [true, true, false, true, true, false, true, false, true, true];

function makeDate(dayOffset: number): string {
  const d = new Date("2025-06-24T09:00:00Z");
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
}

export const export33Tastings: Tasting[] = (() => {
  const result: Tasting[] = [];
  const hostessIds = ["7", "8", "9", "10"];
  let idx = 0;
  for (let day = 0; day < 18; day++) {
    const countPerDay = day < 3 ? 8 : day < 10 ? 12 : 10;
    for (let t = 0; t < countPerDay; t++) {
      const i = idx++;
      const hostessId = hostessIds[i % hostessIds.length];
      const productId = i % 3 === 0 ? "4" : "3";
      const siteId = hostessSiteMap[hostessId] ?? "s1";
      result.push({
        id: String(200 + i),
        campaign_id: "3",
        hostess_id: hostessId,
        product_id: productId,
        site_id: siteId,
        gender: genderCycle[i % genderCycle.length],
        age_range: ageCycle[i % ageCycle.length],
        taste_rating: ratingCycle[i % ratingCycle.length],
        purchase_intent: intentCycle[i % intentCycle.length],
        has_purchased: purchasedCycle[i % purchasedCycle.length],
        notes: "",
        created_at: makeDate(day),
        campaign: export33Campaign,
        hostess: export33Users.find(u => u.id === hostessId)!,
        product: export33Products.find(p => p.id === productId)!,
      });
    }
  }
  return result;
})();

export const export33Sales: Sale[] = (() => {
  const result: Sale[] = [];
  export33Tastings.forEach((tasting, i) => {
    if (tasting.has_purchased) {
      const qty = i % 3 === 0 ? 2 : 1;
      const product = export33Products.find(p => p.id === tasting.product_id)!;
      result.push({
        id: String(300 + result.length),
        campaign_id: "3",
        tasting_id: tasting.id,
        hostess_id: tasting.hostess_id,
        product_id: tasting.product_id,
        site_id: tasting.site_id,
        quantity: qty,
        unit_price: product.unit_price,
        total_amount: product.unit_price * qty,
        validated: true,
        validated_at: tasting.created_at,
        created_at: tasting.created_at,
        campaign: export33Campaign,
        tasting,
        hostess: tasting.hostess,
        product,
      });
    }
  });
  return result;
})();

// Aggregate stats for the company dashboard (includes projected activity beyond current records)
export const mock33ExportStats = {
  totalTastings: 2847,
  totalSales: 1423,
  conversionRate: 49.9,
  totalRevenue: 1_996_100,
  goodiesDistributed: 312,
  campaignDays: 18,
  objectiveTastingsPct: Math.round((2847 / 5000) * 100),
  objectiveSalesPct: Math.round((1423 / 2500) * 100),
  byZone: [
    { zone: "Libreville - Mont-Bouët",    tastings: 820, sales: 412 },
    { zone: "Libreville - Charbonnages",  tastings: 710, sales: 355 },
    { zone: "Port-Gentil - Centre",       tastings: 620, sales: 310 },
    { zone: "Franceville",                tastings: 430, sales: 215 },
    { zone: "Oyem - Marché central",      tastings: 267, sales: 131 },
  ],
  byProduct: [
    { name: "33 Export 33cl (Canette)", sales: 956,  revenue: 669_200 },
    { name: "33 Export 65cl (Bouteille)", sales: 467, revenue: 560_400 },
  ],
  dailyData: Array.from({ length: 18 }, (_, i) => {
    const base = i < 3 ? 80 : i < 7 ? 160 : i < 13 ? 180 : 140;
    const t = base + (i % 4) * 15;
    const s = Math.round(t * 0.499);
    const d = new Date("2025-06-24");
    d.setDate(d.getDate() + i);
    return {
      date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      tastings: t,
      sales: s,
    };
  }),
  byGender: [
    { name: "Femme", value: 55 },
    { name: "Homme", value: 41 },
    { name: "Autre", value: 4 },
  ],
  byAge: [
    { name: "18-25", value: 28 },
    { name: "26-35", value: 38 },
    { name: "36-45", value: 22 },
    { name: "46-55", value: 8 },
    { name: "55+",   value: 4 },
  ],
};

// Populate site teams (after team members are defined)
export33CampaignSites.forEach(site => {
  site.team = export33CampaignTeam.filter(m => m.site_id === site.id);
});

// Attach sites + team to campaign
export33Campaign.sites = export33CampaignSites;
export33Campaign.team = export33CampaignTeam;

// Push 33 Export data into the shared arrays used by existing pages
mockUsers.push(...export33Users);
mockCompanies.push(sobragoCompany);
mockProducts.push(...export33Products);
mockZones.push(...gabonZones);
mockCampaigns.push(export33Campaign);
mockTastings.push(...export33Tastings);
mockSales.push(...export33Sales);
mockCampaignTeam.push(...export33CampaignTeam);

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
