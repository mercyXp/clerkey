"use client";

import { useState } from "react";
import { 
  Building2, 
  Users, 
  MessageSquare, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw,
  Phone,
  Mail,
  Sliders,
  DollarSign
} from "lucide-react";

// Mock data representing the seeded tenants from PRD
const seededTenants = [
  {
    id: "tenant-retail-1",
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
      { id: "bs-r2", name: "25kg High-Protein Pig Feed", category: "stock", value: "8 bags (Low stock alert)", updated: "2 hours ago", source: "dashboard_edit" },
      { id: "bs-r3", name: "Maize Seeds premium blend", category: "stock", value: "115 packets", updated: "1 day ago", source: "onboarding" },
      { id: "bs-r4", name: "Organic Feed Delivery Fee", category: "pricing", value: "$15 flat rate", updated: "4 hours ago", source: "dashboard_edit" }
    ],
    conversations: [
      { id: "c-r1", customer: "Amara (Farmer)", channel: "whatsapp", status: "resolved", lastMsg: "Do you have 50kg chicken feed in stock?", type: "auto_resolved", reply: "Yes! We currently have 42 bags of 50kg Organic Chicken Feed in stock at our main warehouse. We also offer delivery for a $15 flat rate." },
      { id: "c-r2", customer: "John Kamau", channel: "whatsapp", status: "escalated", lastMsg: "I bought pig feed yesterday but it looks damp. Can I get a refund?", type: "escalated_to_human", reply: "[Drafted] I understand you have a concern with the feed quality. I am transferring you directly to our store owner Mercy to resolve this refund right away." }
    ]
  },
  {
    id: "tenant-service-2",
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
      { id: "bs-s2", name: "Corporate Consultation Hourly Rate", category: "pricing", value: "$250/hour", updated: "3 days ago", source: "dashboard_edit" },
      { id: "bs-s3", name: "Next available corporate consult date", category: "capacity", value: "Monday, July 6", updated: "1 hour ago", source: "onboarding" }
    ],
    conversations: [
      { id: "c-s1", customer: "Sarah Jenkins (SaaS founder)", channel: "email", status: "resolved", lastMsg: "Are you accepting new clients for contract drafting and what are your rates?", type: "auto_resolved", reply: "Yes, Apex Law Partners is currently accepting new clients for corporate services. Our consultation rate is $250/hour, and our next available session is Monday, July 6." },
      { id: "c-s2", customer: "David Vance", channel: "whatsapp", status: "escalated", lastMsg: "My business is being sued by a former contractor. I need a trial attorney immediately.", type: "escalated_to_human", reply: "[Drafted] This sounds like an urgent litigation issue. Our litigation lead is being notified of this immediately to review your details and schedule an emergency call." }
    ]
  }
];

export default function Dashboard() {
  const [activeTenantIdx, setActiveTenantIdx] = useState(0);
  const tenant = seededTenants[activeTenantIdx];
  const [isUpdating, setIsUpdating] = useState(false);

  const simulateUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 800);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 flex flex-col">
      {/* Upper Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl font-bold tracking-wider flex items-center justify-center shadow-md">
            CK
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-emerald-800 leading-tight">Clerkey</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">Multi-Tenant AI Agent Platform</p>
          </div>
        </div>

        {/* Tenant Switcher to demonstrate multi-tenant data isolation */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-semibold px-2 uppercase tracking-wider">Workspace:</span>
          {seededTenants.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTenantIdx(idx);
                simulateUpdate();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeTenantIdx === idx 
                  ? "bg-white text-emerald-700 shadow-md border border-slate-100" 
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1">
            <ShieldCheck size={14} /> Dev Sandbox Scoped
          </span>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm text-emerald-800 border border-slate-300">
            M
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        
        {/* Onboarding & Intro Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider">
                Phase 1 Active
              </span>
              <span className="text-slate-300 text-xs font-medium">| Industry Isolated: {tenant.industry}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome back to your workspace, <span className="text-emerald-300">{tenant.name}</span>
            </h2>
            <p className="text-slate-200 text-sm max-w-2xl font-light">
              {tenant.description} Your custom agent is monitoring messaging channels and responding in real-time based on your live business state below.
            </p>
          </div>
          <button 
            onClick={simulateUpdate}
            className="bg-white text-emerald-800 font-bold text-sm px-4 py-2.5 rounded-xl shadow-md hover:bg-emerald-50 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {isUpdating ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Sync State
          </button>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Auto-Response Latency</p>
              <h3 className="text-2xl font-black text-slate-900">{tenant.metrics.responseTime}</h3>
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
                <TrendingUp size={12} /> Under SLA
              </p>
            </div>
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <Clock size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Auto-Resolution Rate</p>
              <h3 className="text-2xl font-black text-slate-900">{tenant.metrics.autoResolveRate}</h3>
              <p className="text-xs text-slate-500 font-medium">No human needed</p>
            </div>
            <div className="bg-teal-50 text-teal-600 p-3 rounded-xl">
              <CheckCircle2 size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Inquiry Volume</p>
              <h3 className="text-2xl font-black text-slate-900">{tenant.metrics.inquiryVolume}</h3>
              <p className="text-xs text-slate-500 font-medium">This month</p>
            </div>
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
              <MessageSquare size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Escalations</p>
              <h3 className="text-2xl font-black text-red-600">{tenant.metrics.activeEscalations}</h3>
              <p className="text-xs text-red-500 font-medium flex items-center gap-0.5">
                <AlertCircle size={12} /> Requires review
              </p>
            </div>
            <div className="bg-red-50 text-red-600 p-3 rounded-xl">
              <AlertCircle size={24} />
            </div>
          </div>
        </div>

        {/* Content Section Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Business State Fact Store */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-950 flex items-center gap-2 text-md">
                    <Sliders className="text-emerald-700" size={18} /> Live Business State Store
                  </h3>
                  <p className="text-xs text-slate-500 font-light mt-0.5">
                    Multi-tenant schema (FR-5b) representing facts that can go stale.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded">
                  {tenant.businessState.length} Items
                </span>
              </div>

              <div className="p-5 divide-y divide-slate-100">
                {tenant.businessState.map((item) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                          item.category === "stock" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                          item.category === "pricing" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                          "bg-purple-100 text-purple-800 border border-purple-200"
                        }`}>
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs font-light text-slate-500 flex items-center gap-1.5">
                        <span>Updated {item.updated}</span>
                        <span>•</span>
                        <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-[10px] text-slate-600">
                          via {item.source}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 block">
                          {item.value}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500 font-light italic">
                  Note: Business State is auto-updated when owners reply to WhatsApp check-in messages (FR-8) or edit directly.
                </p>
              </div>
            </div>

            {/* Agent Configuration Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-950 text-md flex items-center gap-2">
                <Sliders className="text-emerald-700" size={18} /> Scoped Agent Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-xl space-y-1 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tone Preference</p>
                  <p className="text-sm font-semibold text-slate-900">{tenant.tone}</p>
                </div>
                <div className="border border-slate-200 p-4 rounded-xl space-y-1 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Security & Verification</p>
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-600" /> High-Confidence Gate
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Live Conversation Monitor */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-950 flex items-center gap-2 text-md">
                    <MessageSquare className="text-emerald-700" size={18} /> Live Conversation Monitor
                  </h3>
                  <p className="text-xs text-slate-500 font-light mt-0.5">
                    Incoming channel inquiries and automated decisions.
                  </p>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-5 justify-between">
                <div className="space-y-5">
                  {tenant.conversations.map((c) => (
                    <div key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-950">{c.customer}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
                            {c.channel === "whatsapp" ? <Phone size={11} className="text-emerald-600" /> : <Mail size={11} className="text-blue-600" />}
                            {c.channel}
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          c.type === "auto_resolved" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {c.type === "auto_resolved" ? "Auto-Resolved" : "Escalated"}
                        </span>
                      </div>

                      {/* Inbound Question bubble */}
                      <div className="bg-slate-100 border border-slate-200/60 rounded-xl rounded-tl-none p-3 text-xs text-slate-800 relative">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Inbound Query:</span>
                        {c.lastMsg}
                      </div>

                      {/* Outbound Response bubble */}
                      <div className={`rounded-xl rounded-tr-none p-3 text-xs border relative ${
                        c.type === "auto_resolved" 
                          ? "bg-emerald-50/60 border-emerald-100 text-emerald-950" 
                          : "bg-rose-50/40 border-rose-100 text-rose-950"
                      }`}>
                        <span className={`text-[10px] uppercase font-bold block mb-1 ${
                          c.type === "auto_resolved" ? "text-emerald-700" : "text-rose-700"
                        }`}>
                          {c.type === "auto_resolved" ? "AI Auto-Reply:" : "Escalation Check Drafted:"}
                        </span>
                        {c.reply}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-150">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                    <p className="text-xs text-slate-600 leading-normal font-light">
                      Currently simulating <strong>{seededTenants.length} fully isolated workspaces</strong> using a unified database model.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 px-6 text-center text-xs text-slate-500">
        <p>© 2026 Clerkey AI. MIT License. Developed for the Alibaba Cloud Autopilot Hackathon.</p>
      </footer>
    </div>
  );
}
