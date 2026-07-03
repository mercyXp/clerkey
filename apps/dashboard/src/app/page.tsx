"use client";

import { useState, useEffect } from "react";

// Mock data representing the seeded tenants from PRD
const seededTenants = [
  {
    id: "a0000000-0000-0000-0000-000000000000",
    name: "Organic Feeds Ltd",
    industry: "Agricultural Retail",
    description: "Premium organic feed, seeds, and farm supply supplier.",
    tone: "Friendly, direct, focus on stock count details",
    metrics: {
      responseTime: "3s",
      autoResolveRate: "82%",
      inquiryVolume: 148,
      activeEscalations: 2
    },
    businessState: [
      { id: "bs-r1", name: "50kg Organic Chicken Feed", category: "stock", value: "42 bags", updated: "10 mins ago", source: "whatsapp_checkin" },
      { id: "bs-r2", name: "25kg High-Protein Pig Feed", category: "stock", value: "8 bags", updated: "2 hours ago", source: "dashboard_edit" },
      { id: "bs-r3", name: "Maize Seeds premium blend", category: "stock", value: "115 bags", updated: "1 day ago", source: "onboarding" },
      { id: "bs-r4", name: "Organic Feed Delivery Fee", category: "rate", value: "$15", updated: "4 hours ago", source: "dashboard_edit" }
    ],
    conversations: [
      { id: "c-r1", customer: "Amara (Farmer)", channel: "whatsapp", status: "resolved", lastMsg: "Do you have 50kg chicken feed in stock?", type: "auto_resolved", reply: "Yes — 42 bags of 50kg Organic Chicken Feed are in stock at our main warehouse. Delivery is a $15 flat rate." },
      { id: "c-r2", customer: "John Kamau", channel: "whatsapp", status: "escalated", lastMsg: "I bought pig feed yesterday but it looks damp. Can I get a refund?", type: "escalated_to_human", reply: "[Drafted] I understand your concern about the feed quality — connecting you directly with our store owner, Mercy, to sort out this refund right away." }
    ]
  },
  {
    id: "b0000000-0000-0000-0000-000000000000",
    name: "Apex Law Partners",
    industry: "Legal Services",
    description: "Corporate, real estate, and civil litigation services.",
    tone: "Professional, formal, clear intake requirements",
    metrics: {
      responseTime: "5s",
      autoResolveRate: "74%",
      inquiryVolume: 92,
      activeEscalations: 1
    },
    businessState: [
      { id: "bs-s1", name: "New Client Consultation Intake", category: "availability", value: "Accepting new clients", updated: "1 hour ago", source: "whatsapp_checkin" },
      { id: "bs-s2", name: "Corporate Consultation Hourly Rate", category: "rate", value: "$250/hour", updated: "3 days ago", source: "dashboard_edit" },
      { id: "bs-s3", name: "Next available corporate consult date", category: "custom", value: "Monday, July 6", updated: "1 hour ago", source: "onboarding" }
    ],
    conversations: [
      { id: "c-s1", customer: "Sarah Jenkins (SaaS founder)", channel: "email", status: "resolved", lastMsg: "Are you accepting new clients for contract drafting and what are your rates?", type: "auto_resolved", reply: "Yes, Apex Law Partners is currently accepting new clients for corporate services. Our consultation rate is $250/hour, and our next available session is Monday, July 6." },
      { id: "c-s2", customer: "David Vance", channel: "whatsapp", status: "escalated", lastMsg: "My business is being sued by a former contractor. I need a trial attorney immediately.", type: "escalated_to_human", reply: "[Drafted] This sounds like an urgent litigation issue. Our litigation lead is being notified of this immediately to review your details and schedule an emergency call." }
    ]
  }
];

export default function Dashboard() {
  const [activeTenantIdx, setActiveTenantIdx] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [liveState, setLiveState] = useState<any[]>([]);
  const [loadingState, setLoadingState] = useState(false);

  // Authentication check on load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        const res = await fetch("http://localhost:8000/api/auth/me", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) {
          // Token expired or invalid -> Try to Refresh Token
          const refresh_token = localStorage.getItem("refresh_token");
          if (refresh_token) {
            const refreshRes = await fetch("http://localhost:8000/api/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token })
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              localStorage.setItem("access_token", refreshData.access_token);
              localStorage.setItem("refresh_token", refreshData.refresh_token);
              // Retry auth
              window.location.reload();
              return;
            }
          }
          
          // Failed refresh or no refresh token -> log out
          handleLogout();
          return;
        }

        const userData = await res.json();
        setUser(userData);
        
        // Check if onboarding completed, if not redirect to onboarding
        if (userData.onboarding_completed === false) {
          window.location.href = "/onboarding";
          return;
        }
        
        // Auto-match seeded workspace layout with active user's tenant ID
        const matchedIdx = seededTenants.findIndex(t => t.id === userData.tenant_id);
        if (matchedIdx !== -1) {
          setActiveTenantIdx(matchedIdx);
        }
      } catch (err) {
        console.error("Auth check failed", err);
        handleLogout();
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Fetch real database state for the logged-in tenant (strictly isolated)
  useEffect(() => {
    if (!user) return;

    const fetchBusinessState = async () => {
      setLoadingState(true);
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("http://localhost:8000/api/business-state", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const stateData = await res.json();
          setLiveState(stateData);
        }
      } catch (err) {
        console.error("Failed to fetch state store", err);
      } finally {
        setLoadingState(false);
      }
    };

    fetchBusinessState();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("role");
    window.location.href = "/login";
  };

  const simulateUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 800);
  };

  if (authLoading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center text-slate-900 font-bold">
        <svg className="animate-spin h-5 w-5 text-emerald-600 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
        Securing multi-tenant session...
      </div>
    );
  }

  // Handle fallback layout mapping for custom-created tenants who don't have deterministic mock data seeded yet.
  const isSeededTenant = seededTenants.some(t => t.id === user?.tenant_id);
  const tenant = isSeededTenant 
    ? (seededTenants[activeTenantIdx] || seededTenants[0])
    : {
        id: user?.tenant_id,
        name: user?.tenant_name || "Your Workspace",
        industry: user?.industry || "Custom Workspace",
        description: "Your live, custom AI-monitored multi-tenant state workspace.",
        tone: "Friendly, helpful, focus on exact factual status",
        metrics: {
          responseTime: "under 2s",
          autoResolveRate: "0%",
          inquiryVolume: 0,
          activeEscalations: 0
        },
        businessState: [],
        conversations: []
      };

  const getInitials = () => {
    if (!user) return "CL";
    const first = user.first_name ? user.first_name.charAt(0).toUpperCase() : "";
    const last = user.last_name ? user.last_name.charAt(0).toUpperCase() : "";
    return (first + last) || user.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden pb-12">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --mist: #F2FAF6;
          --white: #FFFFFF;
          --emerald-950: #04140F;
          --emerald-900: #06321F;
          --emerald-800: #0A4B31;
          --emerald-700: #0C6B42;
          --emerald-600: #0C9A5D;
          --emerald-500: #17B571;
          --emerald-400: #3FDB93;
          --emerald-100: #DEF7EA;
          --emerald-50: #EFFCF5;
          --lime-glow: #9BFCC6;
          --ink: #0A1F18;
          --slate-600: #48594F;
          --slate-400: #84958C;
          --border: rgba(9,64,45,0.12);
          --border-soft: rgba(9,64,45,0.07);
          --danger: #C4433B;
          --danger-soft: #FBEAE8;
          --shadow-sm: 0 2px 10px -4px rgba(6,50,31,0.10);
          --shadow-md: 0 14px 34px -16px rgba(6,50,31,0.22);
          --shadow-lg: 0 30px 70px -24px rgba(6,50,31,0.30);
        }

        body {
          background: var(--mist) !important;
          color: var(--ink) !important;
          font-family: 'Inter', sans-serif !important;
          margin: 0;
          padding: 0;
        }

        /* Ambient mesh background */
        .mesh {
          position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
        }
        .mesh span {
          position: absolute; border-radius: 50%;
          filter: blur(70px);
          opacity: 0.55;
        }
        .mesh .b1 { width: 520px; height: 520px; top: -220px; left: -160px; background: radial-gradient(circle, var(--emerald-400), transparent 70%); animation: drift1 26s ease-in-out infinite alternate; }
        .mesh .b2 { width: 460px; height: 460px; top: 120px; right: -180px; background: radial-gradient(circle, var(--lime-glow), transparent 70%); opacity: 0.35; animation: drift2 32s ease-in-out infinite alternate; }
        .mesh .b3 { width: 600px; height: 600px; bottom: -320px; left: 30%; background: radial-gradient(circle, var(--emerald-100), transparent 72%); opacity: 0.7; animation: drift3 40s ease-in-out infinite alternate; }

        @keyframes drift1 { from { transform: translate(0,0) scale(1); } to { transform: translate(60px,40px) scale(1.08); } }
        @keyframes drift2 { from { transform: translate(0,0) scale(1); } to { transform: translate(-50px,60px) scale(1.1); } }
        @keyframes drift3 { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,-30px) scale(1.05); } }

        .wrap { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 0 28px 64px; }

        /* Top nav */
        .top-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px;
          max-width: 1280px; margin: 0 auto;
          position: relative; z-index: 2;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-mark {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, var(--emerald-500), var(--emerald-800));
          display: flex; align-items: center; justify-content: center;
          box-shadow: var(--shadow-sm);
          position: relative;
        }
        .brand-mark::after {
          content: ''; position: absolute; top: -3px; right: -3px;
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--lime-glow);
          box-shadow: 0 0 0 2px var(--white);
          animation: pulseDot 2.2s ease-in-out infinite;
        }
        .brand-mark svg { width: 18px; height: 18px; color: var(--white); }
        .brand-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }

        .nav-center {
          display: flex; align-items: center; gap: 8px;
          background: var(--white);
          border: 1px solid var(--border-soft);
          padding: 5px; border-radius: 100px;
          box-shadow: var(--shadow-sm);
        }
        .nav-center .label {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em;
          color: var(--slate-400); padding: 0 10px; text-transform: uppercase;
        }
        .ws-pill {
          font-family: 'Inter'; font-size: 13px; font-weight: 600;
          padding: 8px 16px; border-radius: 100px; cursor: pointer; border: none;
          transition: all .2s ease; white-space: nowrap;
        }
        .ws-pill.active { background: var(--emerald-900); color: var(--white); box-shadow: var(--shadow-sm); }
        .ws-pill.inactive { background: transparent; color: var(--slate-400); }
        .ws-pill.inactive:hover { color: var(--slate-600); }
        .ws-pill:disabled { opacity: 0.5; cursor: not-allowed; }

        .nav-right { display: flex; align-items: center; gap: 14px; }
        .tenant-badge {
          display: flex; align-items: center; gap: 6px;
          font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500;
          color: var(--emerald-700); background: var(--emerald-50);
          border: 1px solid var(--emerald-100); padding: 7px 12px; border-radius: 100px;
        }
        .tenant-badge svg { width: 13px; height: 13px; }
        .user-chip { display: flex; align-items: center; gap: 9px; }
        .avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, var(--emerald-400), var(--emerald-700));
          color: var(--white); font-family: 'Space Grotesk'; font-weight: 600; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .user-meta { line-height: 1.25; }
        .user-name { font-size: 13px; font-weight: 600; }
        .user-role { font-size: 10px; color: var(--slate-400); font-family: 'JetBrains Mono'; letter-spacing: 0.06em; }
        .icon-btn { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: var(--slate-400); background: transparent; border: 1px solid var(--border-soft); cursor: pointer; }
        .icon-btn:hover { color: var(--emerald-700); border-color: var(--emerald-100); background: var(--emerald-50); }
        .icon-btn svg { width: 15px; height: 15px; }

        @media (max-width: 900px) {
          .nav-center { display: none; }
          .top-nav { padding: 16px 20px; }
        }

        /* Hero */
        .hero {
          position: relative; overflow: hidden;
          background: radial-gradient(120% 140% at 15% 0%, var(--emerald-700) 0%, var(--emerald-900) 45%, var(--emerald-950) 100%);
          border-radius: 26px;
          padding: 38px 40px;
          color: var(--white);
          box-shadow: var(--shadow-lg);
          margin-top: 6px;
        }
        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0);
          background-size: 22px 22px;
          opacity: 0.5;
        }
        .hero-glow {
          position: absolute; top: -140px; right: -90px; width: 420px; height: 420px; border-radius: 50%;
          background: radial-gradient(circle, var(--lime-glow), transparent 68%);
          opacity: 0.30; filter: blur(20px);
          animation: breathe 5s ease-in-out infinite;
        }
        @keyframes breathe { 0%,100% { transform: scale(1); opacity: 0.28; } 50% { transform: scale(1.12); opacity: 0.4; } }

        .hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; position: relative; z-index: 1; flex-wrap: wrap; }
        .hero-badges { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .live-chip {
          display: flex; align-items: center; gap: 7px;
          font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.06em;
          background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.18);
          padding: 6px 12px 6px 10px; border-radius: 100px;
        }
        .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lime-glow); position: relative; flex-shrink: 0; }
        .pulse-dot::after {
          content: ''; position: absolute; inset: -5px; border-radius: 50%;
          border: 1.5px solid var(--lime-glow);
          animation: pulseRing 1.8s ease-out infinite;
        }
        @keyframes pulseRing { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes pulseDot { 0%,100% { box-shadow: 0 0 0 2px var(--white), 0 0 0 2px var(--white); } 50% { box-shadow: 0 0 0 2px var(--white), 0 0 6px 2px rgba(155,252,198,0.7); } }

        .scope-text { font-size: 12px; color: rgba(255,255,255,0.65); font-family: 'Inter'; }

        .sync-btn {
          display: flex; align-items: center; gap: 8px;
          background: var(--white); color: var(--emerald-800);
          font-family: 'Inter'; font-weight: 600; font-size: 13px;
          border: none; padding: 11px 18px; border-radius: 11px; cursor: pointer;
          box-shadow: 0 8px 20px -8px rgba(0,0,0,0.35);
          transition: transform .15s ease;
        }
        .sync-btn:hover { transform: translateY(-1px); }
        .sync-btn svg { width: 15px; height: 15px; transition: transform .6s ease; }
        .sync-btn.spinning svg { transform: rotate(360deg); }

        .hero-heading {
          font-family: 'Space Grotesk', sans-serif; font-weight: 700;
          font-size: clamp(26px, 3.4vw, 38px); line-height: 1.15; letter-spacing: -0.01em;
          margin: 26px 0 10px; position: relative; z-index: 1; max-width: 640px;
        }
        .hero-heading .grad {
          background: linear-gradient(90deg, var(--lime-glow), var(--emerald-400));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .hero-sub { font-size: 14.5px; color: rgba(255,255,255,0.72); max-width: 560px; line-height: 1.6; position: relative; z-index: 1; }

        /* Stats */
        .stats-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
          margin-top: 22px;
        }
        @media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 520px) { .stats-grid { grid-template-columns: 1fr; } }

        .stat-card {
          background: rgba(255,255,255,0.72);
          backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          border: 1px solid var(--border-soft);
          border-radius: 18px; padding: 20px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow .2s ease, transform .2s ease;
        }
        .stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .stat-top { display: flex; align-items: flex-start; justify-content: space-between; }
        .stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--slate-400); font-weight: 600; }
        .stat-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .stat-icon svg { width: 16px; height: 16px; }
        .stat-icon.g { background: var(--emerald-50); color: var(--emerald-600); }
        .stat-icon.r { background: var(--danger-soft); color: var(--danger); }
        .stat-value { font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 30px; margin: 10px 0 4px; letter-spacing: -0.02em; }
        .stat-foot { font-size: 11.5px; color: var(--slate-400); display: flex; align-items: center; gap: 5px; }
        .stat-foot.up { color: var(--emerald-600); }
        .stat-foot.warn { color: var(--danger); }

        /* Panels */
        .panels-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 18px; margin-top: 18px; align-items: start; }
        @media (max-width: 980px) { .panels-grid { grid-template-columns: 1fr; } }

        .panel {
          background: rgba(255,255,255,0.78);
          backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          border: 1px solid var(--border-soft);
          border-radius: 20px; padding: 22px;
          box-shadow: var(--shadow-sm);
        }
        .panel-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
        .panel-title-row { display: flex; align-items: center; gap: 9px; }
        .panel-title-row svg { width: 16px; height: 16px; color: var(--emerald-600); }
        .panel-title { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15.5px; }
        .panel-sub { font-size: 12px; color: var(--slate-400); margin: 4px 0 18px; line-height: 1.5; max-width: 90%; }
        .count-chip { font-family: 'JetBrains Mono'; font-size: 11px; background: var(--emerald-50); color: var(--emerald-700); padding: 4px 10px; border-radius: 100px; font-weight: 500; white-space: nowrap; }

        /* fact store rows */
        .fact-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-top: 1px solid var(--border-soft); gap: 12px; }
        .fact-row:first-of-type { border-top: 1px solid var(--border-soft); }
        .fact-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .tag { font-family: 'JetBrains Mono'; font-size: 9.5px; font-weight: 600; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; }
        .tag.stock { background: var(--emerald-50); color: var(--emerald-700); }
        .tag.rate { background: transparent; color: var(--emerald-600); border: 1px solid var(--emerald-400); }
        .tag.custom { background: var(--emerald-100); color: var(--emerald-900); }
        .tag.availability { background: var(--lime-glow); color: var(--emerald-900); }
        .fact-meta { font-family: 'JetBrains Mono'; font-size: 10.5px; color: var(--slate-400); margin-top: 5px; }
        .fact-meta b { color: var(--slate-600); font-weight: 500; }
        .fact-value { font-family: 'JetBrains Mono'; font-weight: 600; font-size: 13px; background: var(--emerald-900); color: var(--white); padding: 6px 12px; border-radius: 9px; white-space: nowrap; }
        .fact-note {
          margin-top: 16px; padding: 12px 14px; border-radius: 12px;
          background: var(--emerald-50); border: 1px dashed var(--emerald-400);
          font-size: 11.5px; color: var(--emerald-700); line-height: 1.5;
        }

        /* conversation monitor */
        .convo { border-top: 1px solid var(--border-soft); padding: 16px 0; }
        .convo:first-of-type { border-top: 1px solid var(--border-soft); }
        .convo-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .convo-who { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
        .convo-channel { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--slate-400); font-weight: 500; }
        .convo-channel svg { width: 12px; height: 12px; }
        .status-pill { font-family: 'JetBrains Mono'; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; padding: 5px 10px; border-radius: 100px; display: flex; align-items: center; gap: 5px; }
        .status-pill.resolved { background: var(--emerald-50); color: var(--emerald-700); }
        .status-pill.escalated { background: var(--danger-soft); color: var(--danger); }
        .status-pill .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

        .bubble { border-radius: 12px; padding: 11px 13px; font-size: 13px; line-height: 1.55; margin-bottom: 8px; }
        .bubble .k { display: block; font-family: 'JetBrains Mono'; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; opacity: 0.65; }
        .bubble.in { background: #F4F6F5; color: var(--ink); }
        .bubble.out { background: var(--emerald-50); color: var(--emerald-900); border-left: 3px solid var(--emerald-500); }
        .bubble.esc { background: var(--danger-soft); color: #7A2C26; border-left: 3px solid var(--danger); }

        .panel-footnote { margin-top: 14px; font-size: 11px; color: var(--slate-400); text-align: center; padding-top: 14px; border-top: 1px solid var(--border-soft); }

        /* Config */
        .config-panel { margin-top: 18px; }
        .config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
        @media (max-width: 700px) { .config-grid { grid-template-columns: 1fr; } }
        .config-card {
          background: var(--white); border: 1px solid var(--border-soft); border-radius: 14px;
          padding: 16px 18px;
        }
        .config-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--slate-400); font-weight: 600; margin-bottom: 8px; display: block; }
        .config-value { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .config-value svg { width: 15px; height: 15px; color: var(--emerald-600); flex-shrink: 0; }

        footer.tiny { text-align: center; font-size: 11px; color: var(--slate-400); margin-top: 26px; font-family: 'JetBrains Mono'; }
      ` }} />

      <div className="mesh">
        <span className="b1"></span>
        <span className="b2"></span>
        <span className="b3"></span>
      </div>

      <nav className="top-nav">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <span className="brand-name">Clerkey</span>
        </div>

        <div className="nav-center">
          <span className="label">Workspace</span>
          {isSeededTenant ? (
            seededTenants.map((t, idx) => (
              <button
                key={t.id}
                disabled={user && user.tenant_id !== t.id}
                onClick={() => {
                  setActiveTenantIdx(idx);
                  simulateUpdate();
                }}
                className={`ws-pill ${activeTenantIdx === idx ? "active" : "inactive"}`}
              >
                {t.name} {user && user.tenant_id === t.id && "(You)"}
              </button>
            ))
          ) : (
            <button className="ws-pill active" disabled>
              {user?.tenant_name || "Your Workspace"} (You)
            </button>
          )}
        </div>

        <div className="nav-right">
          <div className="tenant-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Strict Tenant Isolation
          </div>
          <div className="user-chip">
            <div className="avatar">{getInitials()}</div>
            <div className="user-meta">
              <div className="user-name">
                {user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email : "Loading..."}
              </div>
              <div className="user-role">{user?.role?.toUpperCase() || "OWNER"}</div>
            </div>
          </div>
          <button className="icon-btn" aria-label="Log out" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </nav>

      <div className="wrap">
        <section className="hero">
          <div className="hero-glow"></div>
          <div className="hero-top">
            <div className="hero-badges">
              <div className="live-chip">
                <span className="pulse-dot"></span>ACTIVE SESSION SCOPED
              </div>
              <span className="scope-text">Isolated workspace · {tenant.industry}</span>
            </div>
            <button className={`sync-btn ${isUpdating ? "spinning" : ""}`} id="syncBtn" onClick={simulateUpdate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              <span id="syncLabel">{isUpdating ? "Syncing…" : "Sync state"}</span>
            </button>
          </div>

          <h1 className="hero-heading">
            Welcome back, <span className="grad">{tenant.name}</span>
          </h1>
          <p className="hero-sub">{tenant.description}</p>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Response latency</span>
              <div className="stat-icon g">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
              </div>
            </div>
            <div className="stat-value">{tenant.metrics.responseTime}</div>
            <div className="stat-foot up">▲ Under SLA</div>
          </div>
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Auto-resolution rate</span>
              <div className="stat-icon g">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <div className="stat-value">{tenant.metrics.autoResolveRate}</div>
            <div className="stat-foot">No human needed</div>
          </div>
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Inquiry volume</span>
              <div className="stat-icon g">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
            </div>
            <div className="stat-value">{tenant.metrics.inquiryVolume}</div>
            <div className="stat-foot">This month</div>
          </div>
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Active escalations</span>
              <div className="stat-icon r">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
            <div className="stat-value text-red-600">{tenant.metrics.activeEscalations}</div>
            <div className="stat-foot warn">Requires review</div>
          </div>
        </section>

        <section className="panels-grid">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                  <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                </svg>
                <span className="panel-title">Live Database Scoped Fact Store</span>
              </div>
              <span className="count-chip">
                {loadingState ? "Loading..." : `${liveState.length > 0 ? liveState.length : tenant.businessState.length} items`}
              </span>
            </div>
            <p className="panel-sub">Real, strictly isolated database rows queried via the secure BaseRepository chokepoint.</p>

            {loadingState ? (
              <div className="py-12 text-center text-slate-400 font-medium flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                Loading isolated database state...
              </div>
            ) : liveState.length > 0 ? (
              liveState.map((item) => (
                <div key={item.id} className="fact-row">
                  <div>
                    <div className="fact-name">
                      {item.name}{" "}
                      <span className={`tag ${item.item_type}`}>
                        {item.item_type}
                      </span>
                    </div>
                    <div className="fact-meta">
                      Confirmed {new Date(item.last_confirmed_at).toLocaleDateString()} · via <b>{item.confirmed_by}</b>
                    </div>
                  </div>
                  <div className="fact-value">
                    {item.current_value} {item.item_type === "stock" ? "bags" : ""}
                  </div>
                </div>
              ))
            ) : (
              /* Static fallback if no live database rows found */
              tenant.businessState.map((item) => (
                <div key={item.id} className="fact-row">
                  <div>
                    <div className="fact-name">
                      {item.name}{" "}
                      <span className={`tag ${item.category}`}>
                        {item.category}
                      </span>
                    </div>
                    <div className="fact-meta">
                      Updated {item.updated} · via <b>{item.source}</b>
                    </div>
                  </div>
                  <div className="fact-value">{item.value}</div>
                </div>
              ))
            )}

            <div className="fact-note">Business state auto-updates when owners reply to WhatsApp check-in messages, or edit directly here.</div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <span className="panel-title">Live Conversation Monitor</span>
              </div>
            </div>
            <p className="panel-sub">Incoming channel inquiries and automated decisions.</p>

            {tenant.conversations.length > 0 ? (
              tenant.conversations.map((c) => (
                <div key={c.id} className="convo">
                  <div className="convo-head">
                    <div className="convo-who">
                      {c.customer}
                      <span className="convo-channel">
                        {c.channel === "whatsapp" ? (
                          <>
                            <svg className="w-3 h-3 mr-1 inline-block" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.5 14.4c-.3-.1-1.7-.9-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4.1-.2 0-.4 0-.5C10.9 8.9 10.5 8 10.3 7.4c-.1-.4-.3-.4-.5-.4-.1 0-.3 0-.5 0-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3z" />
                            </svg>
                            WhatsApp
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                            Email
                          </>
                        )}
                      </span>
                    </div>
                    <span className={`status-pill ${c.type === "auto_resolved" ? "resolved" : "escalated"}`}>
                      <span className="dot"></span>
                      {c.type === "auto_resolved" ? "Auto-resolved" : "Escalated"}
                    </span>
                  </div>
                  <div className="bubble in">
                    <span className="k">Inbound query</span>
                    {c.lastMsg}
                  </div>
                  <div className={`bubble ${c.type === "auto_resolved" ? "out" : "esc"}`}>
                    <span className="k">
                      {c.type === "auto_resolved" ? "AI auto-reply" : "Escalation check drafted"}
                    </span>
                    {c.reply}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 font-light text-xs italic">
                No active messaging conversations found for this workspace.
              </div>
            )}

            <div className="panel-footnote">Simulating 2 fully isolated workspaces on a unified database model.</div>
          </div>
        </section>

        <section className="panel config-panel">
          <div className="panel-title-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span className="panel-title">Scoped Agent Configuration</span>
          </div>
          <div className="config-grid">
            <div className="config-card">
              <span className="config-label">Tone preference</span>
              <div className="config-value">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                {tenant.tone}
              </div>
            </div>
            <div className="config-card">
              <span className="config-label">Security &amp; verification</span>
              <div className="config-value">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                High-confidence gate
              </div>
            </div>
          </div>
        </section>

        <footer className="tiny">clerkey · agent telemetry for {tenant.name}</footer>
      </div>
    </div>
  );
}
