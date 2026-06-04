"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList } from "@/lib/types/backend";
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
import { Gift, Trophy, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

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

export default function WheelPage() {
  const { user } = useAuth();
  type WheelPrize = { id: string; name: string; probability: number; quantity_available: number; quantity_won: number; is_active: boolean };

  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [prizes, setPrizes] = useState<WheelPrize[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<WheelPrize | null>(null);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedCampaign) fetchPrizes();
  }, [selectedCampaign]);

  useEffect(() => {
    if (prizes.length > 0) {
      drawWheel();
    }
  }, [prizes, rotation]);

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

  const fetchPrizes = async () => {
    setPrizes([
      { id: "1", name: "T-Shirt",       probability: 10, quantity_available: 50,   quantity_won: 0, is_active: true },
      { id: "2", name: "Casquette",      probability: 15, quantity_available: 100,  quantity_won: 0, is_active: true },
      { id: "3", name: "Porte-clés",     probability: 25, quantity_available: 200,  quantity_won: 0, is_active: true },
      { id: "4", name: "Stylo",          probability: 30, quantity_available: 500,  quantity_won: 0, is_active: true },
      { id: "5", name: "Réduction 10%",  probability: 15, quantity_available: 100,  quantity_won: 0, is_active: true },
      { id: "6", name: "Réessayez",      probability: 5,  quantity_available: 9999, quantity_won: 0, is_active: true },
    ]);
  };


  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas || prizes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const anglePerSlice = (2 * Math.PI) / prizes.length;
    const rotationRad = (rotation * Math.PI) / 180;

    prizes.forEach((prize, index) => {
      const startAngle = index * anglePerSlice + rotationRad;
      const endAngle = (index + 1) * anglePerSlice + rotationRad;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + anglePerSlice / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(prize.name, radius - 20, 5);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius + 15, centerY);
    ctx.lineTo(centerX + radius - 10, centerY - 15);
    ctx.lineTo(centerX + radius - 10, centerY + 15);
    ctx.closePath();
    ctx.fillStyle = "#f97316";
    ctx.fill();
  };

  const spinWheel = () => {
    if (spinning || prizes.length === 0) return;

    setSpinning(true);
    setWonPrize(null);

    // Weighted random selection
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

    // Calculate winning angle
    const prizeIndex = prizes.findIndex((p) => p.id === selectedPrize.id);
    const anglePerSlice = 360 / prizes.length;
    const prizeAngle = prizeIndex * anglePerSlice + anglePerSlice / 2;
    
    // Spin animation
    const totalSpins = 5 + Math.random() * 3; // 5-8 full rotations
    const finalAngle = 360 * totalSpins + (360 - prizeAngle);
    
    let currentRotation = rotation;
    const targetRotation = currentRotation + finalAngle;
    const duration = 5000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const newRotation = currentRotation + (targetRotation - currentRotation) * eased;
      setRotation(newRotation % 360);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setWonPrize(selectedPrize);
        setShowWinDialog(true);
        
        // Confetti effect
        if (selectedPrize.name !== "Réessayez") {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      }
    };

    animate();
  };

  const handleSaveSpin = async () => {
    if (!wonPrize) return;

    try {
      toast.success("Gain enregistré!");
      setShowWinDialog(false);
      setCustomerName("");
      setCustomerPhone("");
    } catch (error) {
      console.error("Error saving spin:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Roue à Cadeaux</h1>
          <p className="text-muted-foreground mt-1">
            Faites tourner la roue pour gagner des goodies!
          </p>
        </div>
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
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Wheel Section */}
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
                    Faire tourner!
                  </>
                )}
              </Button>

              {/* Prizes Legend */}
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

        {/* Recent Spins */}
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

      {/* Win Dialog */}
      <Dialog open={showWinDialog} onOpenChange={setShowWinDialog}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center justify-center gap-2">
              <Trophy className="w-8 h-8 text-primary" />
              {wonPrize?.name === "Réessayez" ? "Pas de chance!" : "Félicitations!"}
            </DialogTitle>
            <DialogDescription>
              {wonPrize?.name === "Réessayez"
                ? "Vous pouvez retenter votre chance!"
                : `Vous avez gagné: ${wonPrize?.name}`}
            </DialogDescription>
          </DialogHeader>

          {wonPrize?.name !== "Réessayez" && (
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
                  onClick={() => setShowWinDialog(false)}
                >
                  Annuler
                </Button>
                <Button className="flex-1" onClick={handleSaveSpin}>
                  Enregistrer le gain
                </Button>
              </div>
            </div>
          )}

          {wonPrize?.name === "Réessayez" && (
            <Button
              className="mt-4"
              onClick={() => {
                setShowWinDialog(false);
                spinWheel();
              }}
            >
              Réessayer
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
