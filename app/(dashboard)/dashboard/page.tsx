"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filtroPeriodo, setFiltroPeriodo] = useState<"dia" | "mes" | "ano">("mes");
  const supabase = createClient();

  const fetchAtendimentos = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/atendimentos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  return (
    <div className="space-y-4">
      <DashboardStats refreshTrigger={refreshTrigger} />
    </div>
  );
}
