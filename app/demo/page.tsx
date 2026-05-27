"use client";

import { Dashboard } from "@/components/dashboard";
import { DEMO_USER_ID } from "@/lib/demo";

export default function DemoPage() {
  return (
    <Dashboard
      userId={DEMO_USER_ID}
      userEmail="demo@wealth-tracker"
      demoMode
    />
  );
}
