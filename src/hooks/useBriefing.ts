"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import type { AngkaBriefing, BriefingAi } from "@/lib/analisAi";

export interface Briefing {
  angka: AngkaBriefing;
  ai: BriefingAi | null;
  dibuat?: Timestamp;
  aiDibuat?: Timestamp | null;
}

/** Briefing Analis AI terbaru (`ai_briefing/terbaru`, hanya operator). */
export function useBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onSnapshot(
      doc(db, "ai_briefing", "terbaru"),
      (snap) => {
        setBriefing((snap.data() as Briefing | undefined) ?? null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  return { briefing, loading };
}
