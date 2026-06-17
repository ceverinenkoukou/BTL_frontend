"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, Goodie, SiteList, Promotion } from "@/lib/types/backend";
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
  isGoodie: boolean;
  promotionId?: string;
};

export default function WheelPage() {
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [sites, setSites] = useState<SiteList[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [prizes, setPrizes] = useState<WheelPrize[]>([]);
  const [goodies, setGoodies] = useState<Goodie[]>([]);
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [savingGain, setSavingGain] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<WheelPrize | null>(null);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cumulativeRotationRef = useRef(0);
  const prizesRef = useRef<WheelPrize[]>([]);
  
  // Sécurisation : État pour savoir si le composant est monté côté client
  const [isMounted, setIsMounted] = useState(false);

  // Déclencher uniquement côté client une fois le navigateur prêt
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. DÉCLARATION DES FONCTIONS (Placées avant les useEffect)
  const fetchCampaigns = useCallback(async () => {
    try {
      const { data } = await api.get<CampagneList[]>("/campagnes/");
      const now = new Date();
      const active = data
        .filter(c => new Date(c.date_debut) <= now && new Date(c.date_fin) >= now)
        .sort((a, b) => a.nom.localeCompare(b.nom));
      setCampaigns(active);
      if (active.length > 0) setSelectedCampaign(active[0].id);
    } catch {
      // silently ignore — page still renders
    }
  }, []);

  // Charger les goodies via la promotion GAGNE active de la campagne
  const fetchPrizes = useCallback(async () => {
    if (!selectedCampaign) {
      setPrizes([]);
      setGoodies([]);
      setActivePromotion(null);
      return;
    }

    try {
      // Chercher les promotions GAGNE actives de la campagne
      const { data: promoData } = await api.get<{ results?: Promotion[]; } | Promotion[]>(
        "/promotions/", { params: { campagne: selectedCampaign } }
      );
      const promos: Promotion[] = Array.isArray(promoData)
        ? promoData
        : (promoData as { results?: Promotion[] }).results ?? [];
      const promoGagne = promos.find(
        p => p.type_promotion === "GAGNE" && p.is_active && p.goodies_details.length > 0
      ) ?? null;
      setActivePromotion(promoGagne);

      // Goodies à afficher : ceux de la promo GAGNE si elle existe, sinon tous les goodies de la campagne
      let allGoodies: Goodie[];
      if (promoGagne && promoGagne.goodies.length > 0) {
        const campGoodies = await getGoodiesByCampagne(selectedCampaign);
        allGoodies = campGoodies.filter(g => promoGagne.goodies.includes(g.id));
      } else {
        allGoodies = await getGoodiesByCampagne(selectedCampaign);
      }
      setGoodies(allGoodies);

      const activeGoodies = allGoodies.filter(g => g.quantite_restante > 0);
      if (activeGoodies.length === 0) {
        setPrizes([]);
        return;
      }

      const wheelPrizes: WheelPrize[] = activeGoodies.map(g => ({
        id: g.id,
        name: g.nom,
        probability: 1,
        quantity_available: g.quantite_restante,
        quantity_won: g.quantite_distribuee || 0,
        is_active: true,
        isGoodie: true,
        promotionId: promoGagne?.id,
      }));

      prizesRef.current = wheelPrizes;
      setPrizes(wheelPrizes);
    } catch {
      toast.error("Impossible de charger les goodies de la campagne");
      setPrizes([]);
      setGoodies([]);
    }
  }, [selectedCampaign]);

  // 2. CONTRÔLE DES EFFETS D'APPLICATIONS
  useEffect(() => { 
    if (isMounted) fetchCampaigns(); 
  }, [fetchCampaigns, isMounted]);

  useEffect(() => {
    if (isMounted && selectedCampaign) {
      fetchPrizes();
      // Charger les sites de la campagne
      api.get<SiteList[]>("/sites/").then(({ data }) => {
        const all = Array.isArray(data) ? data : (data as any).results ?? [];
        const campSites = all.filter((s: SiteList) => s.campagne === selectedCampaign);
        setSites(campSites);
        setSelectedSite(campSites.length === 1 ? campSites[0].id : "");
      }).catch(() => setSites([]));
    }
  }, [selectedCampaign, fetchPrizes, isMounted]);

  // 3. DESSIN DU CANVAS (Ajout d'une sécurité stricte si canvasRef n'est pas prêt)
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isMounted || prizes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const anglePerSlice = (2 * Math.PI) / prizes.length;
    const rotationRad = (((rotation % 360) + 360) % 360) * Math.PI / 180;

    prizes.forEach((prize, index) => {
      const startAngle = index * anglePerSlice + rotationRad;
      const endAngle = (index + 1) * anglePerSlice + rotationRad;

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
      ctx.rotate(startAngle + anglePerSlice / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(prize.name, radius - 20, 5);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + radius + 15, centerY);
    ctx.lineTo(centerX + radius - 10, centerY - 15);
    ctx.lineTo(centerX + radius - 10, centerY + 15);
    ctx.closePath();
    ctx.fillStyle = "#f97316";
    ctx.fill();
  }, [prizes, rotation, isMounted]);

  useEffect(() => {
    if (isMounted && prizes.length > 0) {
      drawWheel();
    }
  }, [prizes, rotation, drawWheel, isMounted]);

  // 4. ANIMATION DE LA ROUE ET CONFETTIS DYNAMIQUES
  const spinWheel = () => {
    // Utiliser prizesRef pour éviter les closures sur un état périmé
    const currentPrizes = prizesRef.current;
    if (spinning || currentPrizes.length === 0 || !isMounted) return;

    setSpinning(true);
    setWonPrize(null);

    // Sélection uniforme par index
    const prizeIndex = Math.floor(Math.random() * currentPrizes.length);
    const selectedPrize = currentPrizes[prizeIndex];

    const anglePerSlice = 360 / currentPrizes.length;
    const prizeAngle = prizeIndex * anglePerSlice + anglePerSlice / 2;
    // Milieu du segment gagnant (0° = droite, sens horaire canvas)
    // const prizeCenter = prizeIndex * anglePerSlice + anglePerSlice / 2;

    // La roue tourne en sens antihoraire (rotation diminue).
    // Pour que l'aiguille (droite, 0°) pointe sur prizeCenter,
    // il faut : -rotation ≡ prizeCenter (mod 360)
    // => rotation_finale ≡ -prizeCenter ≡ (360 - prizeCenter) % 360
    const totalSpins = 5;
    const startCumulative = cumulativeRotationRef.current;
    const currentRotation = ((startCumulative % 360) + 360) % 360;
    const targetFinalRot = (360 - prizeAngle + 360) % 360;
    const rawDelta = (targetFinalRot - currentRotation + 360) % 360;
    // Si delta est 0 ou trop petit, forcer un tour complet pour éviter que la roue reste immobile
    const delta = rawDelta < 5 ? rawDelta + 360 : rawDelta;
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
        setWonPrize(selectedPrize);
        setShowWinDialog(true);
        setCustomerName("");
        setCustomerPhone("");

        import("canvas-confetti").then((module) => {
          const confetti = module.default;
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        });
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
      await api.post("/gains-goodies/enregistrer/", {
        goodie_id: wonPrize.id,
        site_id: selectedSite,
        promotion_id: wonPrize.promotionId ?? undefined,
        nom_client: customerName.trim() || undefined,
      });
      toast.success(`🎁 Gain enregistré${customerName ? ` pour ${customerName}` : ""} !`);
      setShowWinDialog(false);
      setCustomerName("");
      setCustomerPhone("");
      // Rafraîchir les goodies pour mettre à jour les stocks
      fetchPrizes();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Roue à Cadeaux</h1>
          <p className="text-muted-foreground mt-1">
            Faites tourner la roue pour gagner des goodies !
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-64">
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
              <SelectTrigger className="w-56">
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
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6 flex flex-col items-center">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={350}
                  height={350}
                  className="max-w-full"
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
                className="mt-8 h-14 px-12 text-lg"
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

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                {prizes.map((prize, index) => (
                  <div
                    key={prize.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: WHEEL_COLORS[index % WHEEL_COLORS.length] }}
                    />
                    <span className="truncate">{prize.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Derniers gains
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun gain enregistré</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showWinDialog} onOpenChange={setShowWinDialog}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center justify-center gap-2">
              <Trophy className="w-8 h-8 text-primary" />
              Félicitations !
            </DialogTitle>
            <DialogDescription>
              {wonPrize ? `Vous avez gagné : ${wonPrize.name}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className={cn(
              "mx-auto w-24 h-24 rounded-full flex items-center justify-center",
              "bg-gradient-to-br from-primary to-accent"
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
                onClick={() => {
                  setShowWinDialog(false);
                  setWonPrize(null);
                  setTimeout(() => spinWheel(), 300);
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Rejouer
              </Button>
              <Button className="flex-1" onClick={handleSaveSpin} disabled={savingGain}>
                {savingGain
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</>
                  : "Enregistrer le gain"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}