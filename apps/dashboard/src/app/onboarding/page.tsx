"use client";

import { useState, useEffect } from "react";
import { 
  Building2, 
  Sparkles, 
  Database, 
  Radio, 
  ArrowRight, 
  ArrowLeft, 
  UploadCloud, 
  Plus, 
  Trash2, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  MessageSquare,
  FileSpreadsheet
} from "lucide-react";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Step 1 states: Business Profile
  const [description, setDescription] = useState("");
  const [policies, setPolicies] = useState("");
  const [tone, setTone] = useState("Friendly, direct, focus on stock count details");

  // Step 2 states: Business State Data Entry
  const [importMethod, setImportMethod] = useState<"csv" | "manual">("csv");
  const [csvContent, setCsvContent] = useState("");
  const [csvError, setCsvError] = useState("");
  const [csvSuccess, setCsvSuccess] = useState("");
  const [manualItems, setManualItems] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState("stock");
  const [newItemValue, setNewItemValue] = useState("");
  const [newItemDataType, setNewItemDataType] = useState("integer");

  // Step 3 states: Channel connection placeholders
  const [channelType, setChannelType] = useState("whatsapp");
  const [credentials, setCredentials] = useState("");
  const [connectionSuccess, setConnectionSuccess] = useState("");

  // Validate authentication
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
          window.location.href = "/login";
          return;
        }

        const userData = await res.json();
        setUser(userData);
        
        // If they have already completed onboarding, redirect them straight to the dashboard
        if (userData.onboarding_completed === true) {
          window.location.href = "/";
          return;
        }

        // Initialize form labels dynamically based on business type (FR-5a)
        const isProduct = isProductBased(userData.industry);
        if (isProduct) {
          setDescription("Premium product and farm supply supplier.");
          setPolicies("Delivery is $15 flat rate. Standard return policy within 14 days on dry, unopened bags.");
          setTone("Friendly, direct, focus on stock count details");
          setNewItemType("stock");
          setNewItemDataType("integer");
        } else {
          setDescription("High-quality corporate counsel and legal advice agency.");
          setPolicies("Consultation intake requires business name. Initial consultations are up to 60 mins.");
          setTone("Professional, formal, clear intake requirements");
          setNewItemType("availability");
          setNewItemDataType("boolean");
        }
      } catch (err) {
        console.error("Auth verify failed", err);
        window.location.href = "/login";
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Helper function to decide if industry category is product-based
  const isProductBased = (industry: string) => {
    if (!industry) return true;
    const lower = industry.toLowerCase();
    return lower.includes("product") || lower.includes("retail") || lower.includes("agricultural") || lower.includes("feed") || lower.includes("store") || lower.includes("grocery") || lower.includes("food");
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("http://localhost:8000/api/tenant/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          description,
          general_policies: policies,
          tone_preferences: { tone }
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update profile.");
      }

      setStep(2);
    } catch (err: any) {
      alert(err.message || "An error occurred while saving your profile.");
    } finally {
      setLoading(false);
    }
  };

  // CSV parsing & upload via the transactional bulk-import endpoint
  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setCsvError("");
    setCsvSuccess("");
    if (!csvContent.trim()) {
      setCsvError("CSV content cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/business-state/bulk-import?file_content=${encodeURIComponent(csvContent)}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        // Detailed error messages from transaction rollback
        if (data.detail && typeof data.detail === "object" && data.detail.errors) {
          setCsvError(`Validation errors occurred. Transaction was rolled back:\n${data.detail.errors.join("\n")}`);
        } else {
          setCsvError(data.detail || "Failed to import CSV.");
        }
        return;
      }

      setCsvSuccess(data.message || "Successfully imported!");
      // Proceed to next step after slight delay
      setTimeout(() => {
        setStep(3);
      }, 1000);
    } catch (err: any) {
      setCsvError(err.message || "Network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Direct CSV file drop reader
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  // Add individual items manually (using existing single-item endpoints)
  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemValue.trim()) {
      alert("Name and value are required.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("http://localhost:8000/api/business-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newItemName.trim(),
          item_type: newItemType,
          current_value: newItemValue.trim(),
          data_type: newItemDataType,
          confirmed_by: "onboarding"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to add state item.");
      }

      setManualItems([...manualItems, data]);
      setNewItemName("");
      setNewItemValue("");
    } catch (err: any) {
      alert(err.message || "Validation error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveManualItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/business-state/${itemId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        setManualItems(manualItems.filter(item => item.id !== itemId));
      }
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setLoading(false);
    }
  };

  // Channel Connection placeholders
  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.trim()) {
      alert("Credentials or configuration token is required.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("http://localhost:8000/api/channel-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          channel_type: channelType,
          credentials_raw: credentials,
          status: "connected",
          config: { onboarding_placeholder: true }
        })
      });

      if (res.ok) {
        setConnectionSuccess(`Placeholder ${channelType} credentials saved securely!`);
        setTimeout(() => {
          setStep(4);
        }, 800);
      }
    } catch (err) {
      console.error("Failed to connect", err);
    } finally {
      setLoading(false);
    }
  };

  // Complete onboarding and redirect
  const handleFinishOnboarding = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("http://localhost:8000/api/tenant/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          onboarding_completed: true
        })
      });

      if (res.ok) {
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Finish failed", err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center text-slate-900 font-bold">
        <RefreshCw className="animate-spin text-emerald-600 mr-2" />
        Loading your onboarding profile...
      </div>
    );
  }

  const isProduct = isProductBased(user?.industry);

  // Generate CSV template presets based on business type (FR-5a)
  const csvTemplate = isProduct
    ? "name,item_type,current_value,data_type,confirmed_by\nWheat Grain Bags,stock,140,integer,onboarding\nOrganic Pig Feed,stock,24,integer,onboarding\nFlat Rate Local Delivery,rate,15,decimal,onboarding"
    : "name,item_type,current_value,data_type,confirmed_by\nConsulting Intake,availability,Accepting clients,boolean,onboarding\nPartner Hourly Rate,rate,280,decimal,onboarding\nWeekend Booking Available,availability,no,boolean,onboarding";

  return (
    <div className="min-h-screen relative overflow-x-hidden pb-12 flex flex-col justify-between">
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
        }

        /* Ambient background */
        .mesh {
          position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
        }
        .mesh span {
          position: absolute; border-radius: 50%;
          filter: blur(70px);
          opacity: 0.55;
        }
        .mesh .b1 { width: 520px; height: 520px; top: -220px; left: -160px; background: radial-gradient(circle, var(--emerald-400), transparent 70%); }
        .mesh .b2 { width: 460px; height: 460px; top: 120px; right: -180px; background: radial-gradient(circle, var(--lime-glow), transparent 70%); opacity: 0.35; }
        .mesh .b3 { width: 600px; height: 600px; bottom: -320px; left: 30%; background: radial-gradient(circle, var(--emerald-100), transparent 72%); opacity: 0.7; }

        .wrap { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
      ` }} />

      <div className="mesh">
        <span className="b1"></span>
        <span className="b2"></span>
        <span className="b3"></span>
      </div>

      <div className="wrap flex-1 flex flex-col justify-center">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex justify-center items-center gap-2.5">
            <div className="w-10 h-10 border-radius bg-gradient-to-br from-emerald-500 to-emerald-800 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
            </div>
            <span className="font-bold text-xl tracking-tight font-sans">Clerkey Workspace Launch</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Let's configure your isolated AI Agent
          </h2>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            You are setting up workspace details for <strong className="text-emerald-800">{user?.tenant_name}</strong> ({user?.industry}). Complete these 4 brief steps to launch.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center justify-center gap-2 mb-8 bg-white border border-slate-200/60 p-3 rounded-full shadow-sm max-w-md mx-auto">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all ${
                step === num 
                  ? "bg-emerald-900 text-white shadow-md scale-105" 
                  : step > num 
                    ? "bg-emerald-500 text-white" 
                    : "bg-slate-100 text-slate-400"
              }`}>
                {step > num ? <Check size={14} /> : num}
              </div>
              {num < 4 && <div className={`w-8 h-0.5 mx-1 rounded ${step > num ? "bg-emerald-500" : "bg-slate-100"}`} />}
            </div>
          ))}
        </div>

        {/* Form panel wizard card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
          
          {/* Step 1: Business Profile */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Building2 size={18} className="text-emerald-700" /> 1. Workspace profile details
                </h3>
                <p className="text-xs text-slate-400">Describe your business, operations policies, and how you want the AI agent to converse.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Business Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder={`Tell your agent about ${user?.tenant_name || "your business"}...`}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Customer &amp; Refund Policies</label>
                  <textarea 
                    value={policies}
                    onChange={(e) => setPolicies(e.target.value)}
                    rows={3}
                    placeholder="Enter support rules, delivery rates, or operational bounds..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">AI Agent Conversational Tone</label>
                  <select 
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-sm bg-white"
                  >
                    <option value="Friendly, direct, focus on stock count details">Friendly &amp; Direct (Recommended for retail &amp; product-based)</option>
                    <option value="Professional, formal, clear intake requirements">Professional &amp; Formal (Recommended for services &amp; corporate)</option>
                    <option value="Playful, humorous, witty explanations">Playful &amp; Witty</option>
                    <option value="Direct, minimal, strict answers only">Direct &amp; Concise</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-sm py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : <><ArrowRight size={16} /> Save &amp; Continue</>}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Business-State Data Entry */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Database size={18} className="text-emerald-700" /> 2. Populate business database state
                </h3>
                <p className="text-xs text-slate-400">
                  {isProduct 
                    ? "As a Product-based business, enter inventory quantities ('stock' items) and delivery rates ('rate' items)."
                    : "As a Service-based business, enter calendar availability ('availability' items) and fees ('rate' items)."}
                </p>
              </div>

              {/* Selector Tabs */}
              <div className="flex border-b border-slate-200">
                <button 
                  onClick={() => setImportMethod("csv")}
                  className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${
                    importMethod === "csv" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-400"
                  }`}
                >
                  CSV Bulk Upload (Recommended)
                </button>
                <button 
                  onClick={() => setImportMethod("manual")}
                  className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${
                    importMethod === "manual" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-400"
                  }`}
                >
                  Manual Entry Form
                </button>
              </div>

              {importMethod === "csv" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-dashed border-slate-200 bg-slate-50/50 p-4 rounded-2xl flex flex-col justify-center items-center text-center space-y-2">
                      <UploadCloud size={32} className="text-slate-400" />
                      <div>
                        <span className="text-xs font-bold text-emerald-800">Select a local CSV file</span>
                        <p className="text-[10px] text-slate-400">Must align with headers: name, item_type, current_value</p>
                      </div>
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleCsvFileChange}
                        className="text-xs text-slate-500 max-w-full file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 file:cursor-pointer"
                      />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 relative">
                      <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <FileSpreadsheet size={12} /> Prescribed CSV Template:
                      </span>
                      <pre className="text-[10px] text-slate-600 font-mono mt-2 overflow-x-auto whitespace-pre p-2 bg-white border border-slate-100 rounded-lg">
                        {csvTemplate}
                      </pre>
                      <button 
                        onClick={() => {
                          setCsvContent(csvTemplate);
                          alert("Template loaded into textarea below! Check or edit it, then hit Submit.");
                        }}
                        className="mt-2 text-[10px] text-emerald-700 font-bold hover:underline block"
                      >
                        Load template directly
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">CSV Content Payload</label>
                    <textarea 
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      rows={5}
                      placeholder="Paste your CSV rows here..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                    />
                  </div>

                  {csvError && (
                    <div className="bg-red-50 text-red-800 text-xs border border-red-200 rounded-xl p-4 whitespace-pre-wrap font-mono">
                      {csvError}
                    </div>
                  )}

                  {csvSuccess && (
                    <div className="bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 rounded-xl p-4 font-bold">
                      {csvSuccess}
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
                    <button 
                      onClick={() => setStep(1)}
                      className="text-xs font-bold text-slate-500 flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button 
                      onClick={handleCsvUpload}
                      disabled={loading}
                      className="bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-sm py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <RefreshCw className="animate-spin" size={16} /> : <><ArrowRight size={16} /> Submit &amp; Continue</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Manual Form entry */}
                  <form onSubmit={handleAddManualItem} className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Item Name</label>
                      <input 
                        type="text" 
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder={isProduct ? "e.g. 50kg Chicken Feed" : "e.g. Consultation Hours"}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Type</label>
                      <select 
                        value={newItemType}
                        onChange={(e) => {
                          setNewItemType(e.target.value);
                          if (e.target.value === "stock") setNewItemDataType("integer");
                          else if (e.target.value === "availability") setNewItemDataType("boolean");
                          else if (e.target.value === "rate") setNewItemDataType("decimal");
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white"
                      >
                        <option value="stock">Stock Count</option>
                        <option value="availability">Availability</option>
                        <option value="rate">Rate/Price</option>
                        <option value="custom">Custom Text</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Current Value</label>
                      <div className="flex gap-1">
                        <input 
                          type="text" 
                          value={newItemValue}
                          onChange={(e) => setNewItemValue(e.target.value)}
                          placeholder={newItemType === "stock" ? "42" : newItemType === "rate" ? "15" : "yes"}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none"
                        />
                        <button 
                          type="submit"
                          disabled={loading}
                          className="bg-emerald-900 text-white px-2.5 rounded-lg hover:bg-emerald-800"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Manual item list previews */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-400">Database items added ({manualItems.length})</span>
                    {manualItems.length > 0 ? (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                        {manualItems.map((item) => (
                          <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-900">{item.name}</span>
                              <span className="mx-2 text-slate-300">|</span>
                              <span className="font-mono text-emerald-800 uppercase text-[10px]">{item.item_type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-950 font-mono bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                {item.current_value}
                              </span>
                              <button 
                                onClick={() => handleRemoveManualItem(item.id)}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-400 italic text-xs bg-slate-50 border border-slate-200/50 rounded-2xl">
                        Use the form above to add items directly to your live database workspace.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4">
                    <button 
                      onClick={() => setStep(1)}
                      className="text-xs font-bold text-slate-500 flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button 
                      onClick={() => {
                        if (manualItems.length === 0) {
                          alert("Please populate at least one business state item so the agent has grounded facts to reply with!");
                          return;
                        }
                        setStep(3);
                      }}
                      className="bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-sm py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2"
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Channel Connections Placeholders */}
          {step === 3 && (
            <form onSubmit={handleSaveConnection} className="space-y-5">
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Radio size={18} className="text-emerald-700" /> 3. Wire communication channels
                </h3>
                <p className="text-xs text-slate-400">Configure messaging hook integrations. Credentials are encrypted securely using AES-256-GCM.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Select Channel Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["whatsapp", "email", "instagram"].map((ch) => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => setChannelType(ch)}
                        className={`p-3 border rounded-xl flex flex-col items-center gap-1.5 transition-all ${
                          channelType === ch 
                            ? "border-emerald-700 bg-emerald-50/60 text-emerald-900 font-bold shadow-sm" 
                            : "border-slate-200 text-slate-400"
                        }`}
                      >
                        <span className="capitalize text-xs">{ch}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    {channelType === "whatsapp" ? "WhatsApp API Secret Token (Placeholder)" : 
                     channelType === "email" ? "SMTP/IMAP Server Configurations" : 
                     "Instagram Developer Access Token"}
                  </label>
                  <input 
                    type="password" 
                    value={credentials}
                    onChange={(e) => setCredentials(e.target.value)}
                    placeholder={channelType === "whatsapp" ? "e.g. EAAGx123..." : "e.g. smtp.mail.com:587:owner@company.com"}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-mono"
                  />
                </div>
              </div>

              {connectionSuccess && (
                <div className="bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 rounded-xl p-4 font-bold flex items-center gap-2">
                  <ShieldCheck size={16} />
                  <span>{connectionSuccess}</span>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button 
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-slate-500 flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3"
                  >
                    Skip connection
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-sm py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={16} /> : <><ArrowRight size={16} /> Connect &amp; Continue</>}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Step 4: Finish & Launch */}
          {step === 4 && (
            <div className="space-y-6 text-center py-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md border border-emerald-100 animate-bounce">
                <Sparkles size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">Your AI Workspace is Ready!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Excellent! Your workspace data is securely seeded and the agent tone parameters have been completely initialized.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 max-w-md mx-auto text-left space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Workspace summary</span>
                <div className="text-xs grid grid-cols-2 gap-y-1.5 text-slate-600">
                  <span className="font-semibold">Business name:</span> <span className="text-slate-900 font-bold">{user?.tenant_name}</span>
                  <span className="font-semibold">Industry classification:</span> <span className="text-slate-900 font-bold">{user?.industry}</span>
                  <span className="font-semibold">Selected Tone:</span> <span className="text-slate-900 font-bold">{tone}</span>
                  <span className="font-semibold">Database items populated:</span> <span className="text-slate-900 font-bold">{manualItems.length > 0 ? `${manualItems.length} items` : "Seeded bulk CSV"}</span>
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-4">
                <button 
                  onClick={() => setStep(3)}
                  className="text-xs font-bold text-slate-500 flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button 
                  onClick={handleFinishOnboarding}
                  disabled={loading}
                  className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-sm py-3 px-8 rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : <><ShieldCheck size={16} /> Activate Agent &amp; Enter Dashboard</>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
