"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Mail, Lock, User, ArrowRight, ShieldAlert } from "lucide-react";

export default function SignupPage() {
  const [tenantName, setTenantName] = useState("");
  const [industry, setIndustry] = useState("retail");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName || null,
          last_name: lastName || null,
          tenant_name: tenantName,
          industry,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "An error occurred during signup.");
      }

      // Store tokens securely
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("tenant_id", data.tenant_id);
      localStorage.setItem("role", data.role);

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to connect to the backend API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <img 
          src="/clerkey-icon.svg" 
          alt="Clerkey Icon" 
          className="h-16 w-auto mx-auto object-contain"
        />
        <h2 className="text-3xl font-black tracking-tight text-slate-900 mt-2">
          Create your Clerkey Workspace
        </h2>
        <p className="text-sm text-slate-500">
          Onboard your business and launch your multi-tenant AI response agent.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl border border-slate-200 sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold">
              Workspace created! Redirecting to dashboard...
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Business Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Organic Feeds Ltd"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 max-h-48 overflow-y-auto"
              >
                {/* Product-based */}
                <option value="product_based" className="font-extrabold text-emerald-800 bg-slate-100">-- Product-based (All / Other) --</option>
                <option value="retail_grocery">&nbsp;&nbsp;Retail shops, grocery/convenience stores</option>
                <option value="feed_agricultural">&nbsp;&nbsp;Feed/agricultural suppliers</option>
                <option value="pharmacies">&nbsp;&nbsp;Pharmacies</option>
                <option value="furniture_hardware">&nbsp;&nbsp;Furniture and hardware stores</option>
                <option value="bakeries_food">&nbsp;&nbsp;Bakeries and food producers</option>
                <option value="boutiques_clothing">&nbsp;&nbsp;Boutiques and clothing stores</option>
                <option value="electronics_repair">&nbsp;&nbsp;Electronics and phone repair shops</option>

                {/* Food and hospitality */}
                <option value="food_hospitality" className="font-extrabold text-emerald-800 bg-slate-100">-- Food and hospitality (All / Other) --</option>
                <option value="restaurants_cafes">&nbsp;&nbsp;Restaurants and cafés</option>
                <option value="caterers">&nbsp;&nbsp;Caterers</option>
                <option value="food_trucks">&nbsp;&nbsp;Food trucks</option>

                {/* Professional and legal services */}
                <option value="professional_legal" className="font-extrabold text-emerald-800 bg-slate-100">-- Professional and legal services (All / Other) --</option>
                <option value="law_firms">&nbsp;&nbsp;Law firms</option>
                <option value="accounting_tax">&nbsp;&nbsp;Accounting and tax prep firms</option>
                <option value="notaries">&nbsp;&nbsp;Notaries</option>
                <option value="immigration_consultants">&nbsp;&nbsp;Immigration consultants</option>

                {/* Tech and creative services */}
                <option value="tech_creative" className="font-extrabold text-emerald-800 bg-slate-100">-- Tech and creative services (All / Other) --</option>
                <option value="software_agencies">&nbsp;&nbsp;Software/dev agencies</option>
                <option value="freelance_creatives">&nbsp;&nbsp;Freelance designers, marketers, copywriters</option>
                <option value="it_support">&nbsp;&nbsp;IT support/managed service providers</option>
                <option value="web_hosting">&nbsp;&nbsp;Web hosting/domain resellers</option>

                {/* Health and wellness */}
                <option value="health_wellness" className="font-extrabold text-emerald-800 bg-slate-100">-- Health and wellness (All / Other) --</option>
                <option value="medical_clinics">&nbsp;&nbsp;Dental and medical clinics</option>
                <option value="physiotherapists">&nbsp;&nbsp;Physiotherapists, chiropractors</option>
                <option value="therapists_counselors">&nbsp;&nbsp;Therapists and counselors</option>
                <option value="gyms_trainers">&nbsp;&nbsp;Gyms and personal trainers</option>

                {/* Beauty and personal care */}
                <option value="beauty_personal_care" className="font-extrabold text-emerald-800 bg-slate-100">-- Beauty and personal care (All / Other) --</option>
                <option value="salons_barbers">&nbsp;&nbsp;Hair salons and barbershops</option>
                <option value="nail_spas">&nbsp;&nbsp;Nail salons, spas</option>
                <option value="massage_therapists">&nbsp;&nbsp;Massage therapists</option>

                {/* Home and trade services */}
                <option value="home_trade" className="font-extrabold text-emerald-800 bg-slate-100">-- Home and trade services (All / Other) --</option>
                <option value="trade_services">&nbsp;&nbsp;Plumbers, electricians, HVAC technicians</option>
                <option value="cleaning_services">&nbsp;&nbsp;Cleaning services</option>
                <option value="landscapers_gardeners">&nbsp;&nbsp;Landscapers and gardeners</option>
                <option value="movers">&nbsp;&nbsp;Movers</option>
                <option value="handymen_contractors">&nbsp;&nbsp;Handymen/general contractors</option>

                {/* Real estate */}
                <option value="real_estate" className="font-extrabold text-emerald-800 bg-slate-100">-- Real estate (All / Other) --</option>
                <option value="real_estate_agents">&nbsp;&nbsp;Real estate agents</option>
                <option value="property_managers">&nbsp;&nbsp;Property managers</option>
                <option value="rental_hosts">&nbsp;&nbsp;Short-term rental hosts</option>

                {/* Automotive */}
                <option value="automotive" className="font-extrabold text-emerald-800 bg-slate-100">-- Automotive (All / Other) --</option>
                <option value="auto_repair">&nbsp;&nbsp;Auto repair shops</option>
                <option value="car_rental">&nbsp;&nbsp;Car rental agencies</option>
                <option value="driving_schools">&nbsp;&nbsp;Driving schools</option>

                {/* Events and entertainment */}
                <option value="events_entertainment" className="font-extrabold text-emerald-800 bg-slate-100">-- Events and entertainment (All / Other) --</option>
                <option value="event_venues">&nbsp;&nbsp;Event venues</option>
                <option value="photographers">&nbsp;&nbsp;Photographers and videographers</option>
                <option value="musicians">&nbsp;&nbsp;DJs and musicians for hire</option>
                <option value="tour_guides">&nbsp;&nbsp;Tour guides and travel agencies</option>

                {/* Education */}
                <option value="education" className="font-extrabold text-emerald-800 bg-slate-100">-- Education (All / Other) --</option>
                <option value="tutoring_services">&nbsp;&nbsp;Tutoring services</option>
                <option value="teachers">&nbsp;&nbsp;Music/language teachers</option>
                <option value="vocational_centers">&nbsp;&nbsp;Vocational training centers</option>

                {/* Agriculture */}
                <option value="agriculture_wholesale" className="font-extrabold text-emerald-800 bg-slate-100">-- Agriculture & Wholesale (All / Other) --</option>
                <option value="farms_direct">&nbsp;&nbsp;Farms selling direct-to-consumer</option>
                <option value="delivery_couriers">&nbsp;&nbsp;Delivery and courier services</option>
                <option value="wholesale_distributors">&nbsp;&nbsp;Wholesale distributors</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Mercy"
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Munzenzi"
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@organicfeeds.com"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full bg-emerald-600 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Creating Workspace..." : "Create Workspace"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Already have a workspace?{" "}
              <Link href="/login" className="text-emerald-600 font-bold hover:underline">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
