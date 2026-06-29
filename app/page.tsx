"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Dashboard } from "@/components/dashboard";
import { LoginScreen } from "@/components/login-screen";
import { supabase } from "@/lib/supabase";

export default function RootPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return <div className="flex-1" aria-busy="true" />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <Dashboard userId={session.user.id} userEmail={session.user.email ?? ""} />;
}
