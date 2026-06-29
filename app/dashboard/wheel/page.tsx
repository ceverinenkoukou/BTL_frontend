"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, Goodie, MonSiteInfo, SiteList } from "@/lib/types/backend";
import { PageHeader } from "@/components/dashboard/page-header";
import { getGoodiesByCampagne } from "@/lib/services/goodieService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Gift, Trophy, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const WHEEL_COLORS = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#14b8a6", // teal
  "#ef4444", // red
];

type WheelPrize = { 
  id: string; 
  name: string; 
  probability: number; 
  quantity_available: number; 
  quantity_won: number; 
  is_active: boolean;
  isGoodie: boolean;  // Pour identifier si c'est un goodie réel
};

type GainGoodieItem = {
  id: string;
  goodie_nom: string;
  site_nom: string;
  campagne?: string;
  campagne_nom?: string;
  hotesse_nom?: string | null;
  produit_nom?: string | null;
  quantite_produit: number;
  nom_client?: string | null;
  created_at: string;
};

function normalizeWheelDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function getPrizeAtPointer<T extends WheelPrize>(prizes: T[], rotationDegrees: number): T | null {
  if (prizes.length === 0) return null;
  const anglePerSlice = 360 / prizes.length;
  const pointerAngleOnWheel = normalizeWheelDegrees(-rotationDegrees);
  const index = Math.floor(pointerAngleOnWheel / anglePerSlice) % prizes.length;
  return prizes[index] ?? null;
}

function fitCanvasLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 3 && ctx.measureText(`${shortened}...`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
}

function formatGainDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WheelPage() {
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [sites, setSites] = useState<SiteList[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [prizes, setPrizes] = useState<WheelPrize[]>([]);
  const [goodies, setGoodies] = useState<Goodie[]>([]);
  const [recentGains, setRecentGains] = useState<GainGoodieItem[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [savingGain, setSavingGain] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<WheelPrize | null>(null);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cumulativeRotationRef = useRef(0);
  
  // Sécurisation : État pour savoir si le composant est monté côté client
  const [isMounted, setIsMounted] = useState(false);

  // Déclencher uniquement côté client une fois le navigateur prêt
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. DÉCLARATION DES FONCTIONS (Placées avant les useEffect)
  const fetchCampaigns = useCallback(async () => {
    try {
      const { data } = await api.get<CampagneList[] | { results?: CampagneList[] }>("/campagnes/");
      const allCampaigns = Array.isArray(data) ? data : (data.results ?? []);
      const now = Date.now();
      const visibleCampaigns = allCampaigns
        .sort((a, b) => {
          const aActive = new Date(a.date_debut).getTime() <= now && new Date(a.date_fin).getTime() >= now;
          const bActive = new Date(b.date_debut).getTime() <= now && new Date(b.date_fin).getTime() >= now;
          if (aActive !== bActive) return aActive ? -1 : 1;
          return a.nom.localeCompare(b.nom);
        });
      setCampaigns(visibleCampaigns);
      setSelectedCampaign(prev => (
        prev && visibleCampaigns.some(c => c.id === prev)
          ? prev
          : visibleCampaigns[0]?.id ?? ""
      ));
    } catch {
      // silently ignore — page still renders
    }
  }, []);

  // Charger les goodies de la campagne et construire les prix de la roue
  const fetchPrizes = useCallback(async () => {
    if (!selectedCampaign) {
      setPrizes([]);
      setGoodies([]);
      return;
    }
    
    try {
      let activeGoodies: { id: string; nom: string; quantite_restante: number; quantite_distribuee?: number }[] = [];

      if (selectedSite) {
        const { data } = await api.get<MonSiteInfo>("/degustations/mon-site/", {
          params: { site_id: selectedSite },
        });
        // Seuls les goodies avec un stock du jour disponible sur ce site sont
        // renvoyés par le backend (cf. DegustationViewSet.mon_site) — un goodie
        // en rupture aujourd'hui sur ce site n'apparaît donc plus sur la roue.
        activeGoodies = data.goodies_disponibles ?? [];
        setGoodies([]);
      } else {
        const campGoodies = await getGoodiesByCampagne(selectedCampaign);
        setGoodies(campGoodies);
        activeGoodies = campGoodies;
      }
      
      if (activeGoodies.length === 0) {
        setPrizes([]);
        return;
      }
      
      // Convertir les goodies en prix de roue
      const wheelPrizes: WheelPrize[] = activeGoodies.map(g => ({
        id: g.id,
        name: g.nom,
        probability: 100 / activeGoodies.length,
        quantity_available: g.quantite_restante,
        quantity_won: g.quantite_distribuee || 0,
        is_active: true,
        isGoodie: true,
      }));
      
      setPrizes(wheelPrizes);
    } catch {
      toast.error("Impossible de charger les goodies de la campagne");
      setPrizes([]);
      setGoodies([]);
    }
  }, [selectedCampaign, selectedSite]);

  const fetchRecentGains = useCallback(async () => {
    if (!selectedCampaign) {
      setRecentGains([]);
      return;
    }

    try {
      const { data } = await api.get<GainGoodieItem[] | { results?: GainGoodieItem[] }>("/gains-goodies/");
      const gains = Array.isArray(data) ? data : (data.results ?? []);
      setRecentGains(
        gains
          .filter(gain => gain.campagne === selectedCampaign)
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
    } catch {
      setRecentGains([]);
    }
  }, [selectedCampaign]);

  // 2. CONTRÔLE DES EFFETS D'APPLICATIONS
  useEffect(() => { 
    if (isMounted) fetchCampaigns(); 
  }, [fetchCampaigns, isMounted]);

  useEffect(() => {
    if (isMounted && selectedCampaign) {
      // Charger les sites de la campagne
      api.get<SiteList[]>("/sites/").then(({ data }) => {
        const all = Array.isArray(data) ? data : (data as any).results ?? [];
        const campSites = all.filter((s: SiteList) => s.campagne === selectedCampaign);
        setSites(campSites);
        setSelectedSite(campSites[0]?.id ?? "");
      }).catch(() => setSites([]));
    }
  }, [selectedCampaign, isMounted]);

  useEffect(() => {
    if (isMounted && selectedCampaign) {
      fetchPrizes();
      fetchRecentGains();
    }
  }, [selectedCampaign, selectedSite, fetchPrizes, fetchRecentGains, isMounted]);

  // 3. DESSIN DU CANVAS (Ajout d'une sécurité stricte si canvasRef n'est pas prêt)
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isMounted || prizes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 32;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const anglePerSlice = (2 * Math.PI) / prizes.length;
    const rotationRad = (((rotation % 360) + 360) % 360) * Math.PI / 180;

    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.24)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 14;
    const rim = ctx.createRadialGradient(centerX, centerY, radius * 0.62, centerX, centerY, radius + 18);
    rim.addColorStop(0, "#f8fafc");
    rim.addColorStop(0.72, "#334155");
    rim.addColorStop(1, "#0f172a");
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 18, 0, 2 * Math.PI);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.restore();

    prizes.forEach((prize, index) => {
      const startAngle = index * anglePerSlice + rotationRad;
      const endAngle = (index + 1) * anglePerSlice + rotationRad;
      const middleAngle = startAngle + anglePerSlice / 2;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(middleAngle);
      const flipped = Math.cos(middleAngle) < 0;
      if (flipped) ctx.rotate(Math.PI);
      ctx.textAlign = flipped ? "left" : "right";
      ctx.fillStyle = "#fff";
      ctx.font = "700 14px sans-serif";
      ctx.shadowColor = "rgba(15, 23, 42, 0.42)";
      ctx.shadowBlur = 4;
      const label = fitCanvasLabel(ctx, prize.name, Math.max(62, radius * 0.42));
      ctx.fillText(label, flipped ? -(radius - 22) : radius - 22, 5);
      ctx.restore();
    });

    const innerGlow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
    innerGlow.addColorStop(0, "rgba(255,255,255,0.18)");
    innerGlow.addColorStop(0.52, "rgba(255,255,255,0.05)");
    innerGlow.addColorStop(1, "rgba(15,23,42,0.14)");
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = innerGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
    const hub = ctx.createRadialGradient(centerX - 10, centerY - 12, 5, centerX, centerY, 40);
    hub.addColorStop(0, "#ffffff");
    hub.addColorStop(0.52, "#f8fafc");
    hub.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.font = "800 11px sans-serif";
    ctx.fillText("BTL", centerX, centerY + 4);

    ctx.beginPath();
    ctx.moveTo(centerX + radius + 24, centerY);
    ctx.lineTo(centerX + radius - 8, centerY - 18);
    ctx.lineTo(centerX + radius - 8, centerY + 18);
    ctx.closePath();
    ctx.fillStyle = "#f97316";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [prizes, rotation, isMounted]);

  useEffect(() => {
    if (isMounted && prizes.length > 0) {
      drawWheel();
    }
  }, [prizes, rotation, drawWheel, isMounted]);

  // 4. ANIMATION DE LA ROUE ET CONFETTIS DYNAMIQUES
  const spinWheel = () => {
    if (spinning || prizes.length === 0 || !isMounted) return;

    setSpinning(true);
    setWonPrize(null);

    const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0);
    let random = Math.random() * totalProbability;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
      random -= prize.probability;
      if (random <= 0) {
        selectedPrize = prize;
        break;
      }
    }
    const anglePerSlice = 360 / prizes.length;
    const prizeIndex = prizes.findIndex((p) => p.id === selectedPrize.id);
    const prizeAngle = prizeIndex * anglePerSlice + anglePerSlice / 2;
    // Milieu du segment gagnant (0° = droite, sens horaire canvas)
    // const prizeCenter = prizeIndex * anglePerSlice + anglePerSlice / 2;

    // La roue tourne en sens antihoraire (rotation diminue).
    // Pour que l'aiguille (droite, 0°) pointe sur prizeCenter,
    // il faut : -rotation ≡ prizeCenter (mod 360)
    // => rotation_finale ≡ -prizeCenter ≡ (360 - prizeCenter) % 360
    const startCumulative = cumulativeRotationRef.current;
    const currentRotation = normalizeWheelDegrees(startCumulative);
    const targetFinalRot = (360 - prizeAngle + 360) % 360;
    const delta = (targetFinalRot - currentRotation + 360) % 360;
    const totalSpins = 5 + Math.floor(Math.random() * 3);
    const targetCumulative = startCumulative + 360 * totalSpins + delta;
    const duration = 5000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = startCumulative + (targetCumulative - startCumulative) * eased;
      cumulativeRotationRef.current = current;
      setRotation(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        cumulativeRotationRef.current = targetCumulative;
        setRotation(targetCumulative);
        setSpinning(false);
        const finalPrize = getPrizeAtPointer(prizes, targetCumulative) ?? selectedPrize;
        setWonPrize(finalPrize);
        setShowWinDialog(true);

        if (finalPrize.isGoodie) {
          import("canvas-confetti").then((module) => {
            const confetti = module.default;
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          });
        }
      }
    };

    animate();
  };

  const handleSaveSpin = async () => {
    if (!wonPrize || !wonPrize.isGoodie) return;
    if (!selectedSite) {
      toast.error("Veuillez sélectionner un site avant de confirmer.");
      return;
    }
    setSavingGain(true);
    try {
      const { data } = await api.post<{ stock_jour_restant?: number }>("/gains-goodies/enregistrer/", {
        goodie_id: wonPrize.id,
        site_id: selectedSite,
        nom_client: customerName.trim() || undefined,
      });
      const restant = data.stock_jour_restant;
      const stockMsg = restant !== undefined
        ? (restant > 0 ? ` — ${restant} ${wonPrize.name} restant${restant > 1 ? "s" : ""} aujourd'hui` : ` — dernier ${wonPrize.name} du jour !`)
        : "";
      toast.success(`🎁 Gain enregistré${customerName ? ` pour ${customerName}` : ""} !${stockMsg}`);
      setShowWinDialog(false);
      setCustomerName("");
      setCustomerPhone("");
      // Rafraîchir les goodies pour mettre à jour les stocks
      fetchPrizes();
      fetchRecentGains();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || "Erreur lors de l'enregistrement du gain.";
      toast.error(msg);
    } finally {
      setSavingGain(false);
    }
  };

  // Empêche le pré-rendu serveur de manipuler le HTML instable avant le montage client
  if (!isMounted) {
    return <div className="p-6 text-muted-foreground text-center">Chargement de la roue...</div>;
  }

  const activeCampaign = campaigns.find(c => c.id === selectedCampaign);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roue à cadeaux"
        description="Tirage goodies par campagne et par site"
        icon={<Gift className="w-5 h-5" />}
        brandColor={activeCampaign?.couleur_primaire}
        brandSecondary={activeCampaign?.couleur_secondaire}
        logoUrl={activeCampaign?.logo_url}
        ctaSlot={
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-64 bg-white/20 border-white/30 text-white placeholder:text-white/60 [&>svg]:text-white">
                <SelectValue placeholder="Sélectionner une campagne" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sites.length > 1 && (
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-56 bg-white/20 border-white/30 text-white placeholder:text-white/60 [&>svg]:text-white">
                  <SelectValue placeholder="Sélectionner un site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="flex flex-col items-center px-4 py-7 sm:p-8 bg-[radial-gradient(circle_at_50%_12%,rgba(249,115,22,0.16),transparent_34%),linear-gradient(180deg,#ffffff,#f8fafc)]">
              <div className="relative rounded-full p-4 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_60px_rgba(15,23,42,0.14)] border border-white">
                <canvas
                  ref={canvasRef}
                  width={390}
                  height={390}
                  className="block max-w-full rounded-full"
                />
                {prizes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-full">
                    <p className="text-muted-foreground text-center px-8">
                      Aucun prix configuré pour cette campagne
                    </p>
                  </div>
                )}
              </div>

              <Button
                size="lg"
                className="mt-8 h-14 px-10 text-base font-semibold text-white shadow-lg shadow-orange-200 bg-gradient-to-r from-orange-500 to-slate-900 hover:from-orange-600 hover:to-slate-800"
                onClick={spinWheel}
                disabled={spinning || prizes.length === 0}
              >
                {spinning ? (
                  <>
                    <RotateCcw className="w-6 h-6 mr-2 animate-spin" />
                    En cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6 mr-2" />
                    Faire tourner !
                  </>
                )}
              </Button>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full max-w-2xl">
                {prizes.map((prize, index) => (
                  <div
                    key={prize.id}
                    className="min-w-0 flex items-center gap-2 rounded-md border border-slate-200 bg-white/82 px-3 py-2 text-sm shadow-sm"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: WHEEL_COLORS[index % WHEEL_COLORS.length] }}
                    />
                    <span className="truncate font-medium text-slate-700">{prize.name}</span>
                  </div>
                ))}
              </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              Derniers gains
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentGains.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun gain enregistré</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentGains.map((gain) => (
                  <div key={gain.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-600">
                        <Gift className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{gain.goodie_nom}</p>
                        <p className="truncate text-xs text-slate-500">{gain.site_nom}</p>
                        {gain.hotesse_nom && (
                          <p className="truncate text-xs text-slate-500">Hôtesse : {gain.hotesse_nom}</p>
                        )}
                        {gain.nom_client && (
                          <p className="truncate text-xs text-slate-500">Client : {gain.nom_client}</p>
                        )}
                        {gain.produit_nom && (
                          <p className="truncate text-xs text-slate-500">
                            Produit offert : {gain.quantite_produit} x {gain.produit_nom}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        {formatGainDate(gain.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showWinDialog} onOpenChange={setShowWinDialog}>
        <DialogContent className="text-center overflow-hidden border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center justify-center gap-2">
              <Trophy className="w-8 h-8 text-orange-500" />
              Félicitations !
            </DialogTitle>
            <DialogDescription>
              {`Vous avez gagné : ${wonPrize?.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
              <div className={cn(
                "mx-auto w-24 h-24 rounded-full flex items-center justify-center",
                "bg-gradient-to-br from-orange-500 to-slate-900 shadow-lg shadow-orange-100"
              )}>
                <Gift className="w-12 h-12 text-white" />
              </div>

              <div className="space-y-3 text-left">
                <div className="space-y-2">
                  <Label>Nom du client</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Entrez le nom du gagnant"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone (optionnel)</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Numéro de téléphone"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowWinDialog(false)}
                >
                  Annuler
                </Button>
                <Button className="flex-1" onClick={handleSaveSpin} disabled={savingGain}>
                  {savingGain
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</>
                    : "Enregistrer le gain"
                  }
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setShowWinDialog(false); setWonPrize(null); spinWheel(); }}>
                <RotateCcw className="w-4 h-4 mr-2" />Relancer la roue
              </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
