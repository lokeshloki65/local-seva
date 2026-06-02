import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { 
  Sparkles, Search, Compass, ShieldCheck, ArrowRight, 
  Paintbrush, Wrench, Zap, Wind, ShieldAlert, Heart, Tv, Hammer, Flower, Landmark
} from 'lucide-react';
import apiClient from '../../services/api';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  // Load initial catalog data
  useEffect(() => {
    // 1. Fetch categories
    apiClient.get('/services/categories')
      .then(res => setCategories(res.data))
      .catch(() => {
        // Fallback static categories if backend hasn't booted/seeded yet
        setCategories([
          { id: 'cleaning', name: 'Deep Cleaning', iconURL: 'Sparkles' },
          { id: 'plumbing', name: 'Plumbing Service', iconURL: 'Wrench' },
          { id: 'electrical', name: 'Electrical Work', iconURL: 'Zap' },
          { id: 'ac_repair', name: 'AC servicing', iconURL: 'Wind' },
          { id: 'painting', name: 'Painting', iconURL: 'Paintbrush' },
          { id: 'pest_control', name: 'Pest Control', iconURL: 'ShieldAlert' },
          { id: 'beauty', name: 'Beauty/Salon', iconURL: 'Heart' },
          { id: 'appliance_repair', name: 'TV/Appliances', iconURL: 'Tv' },
          { id: 'carpentry', name: 'Carpentry', iconURL: 'Hammer' },
          { id: 'gardening', name: 'Gardening', iconURL: 'Flower' }
        ]);
      });

    // 2. Fetch popular services
    apiClient.get('/services')
      .then(res => setServices(res.data.slice(0, 4)))
      .catch(() => {
        setServices([
          { id: 'full_house_clean', name: 'Full Home Deep Clean', basePrice: 3499, description: 'Grime and stain removal', imageURL: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80' },
          { id: 'ac_servicing', name: 'AC Jet Pressure Service', basePrice: 599, description: 'Pressure water coil clean', imageURL: 'https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&w=600&q=80' }
        ]);
      });
  }, []);

  const handleAISearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResult(null);
    try {
      const res = await apiClient.get(`/services/search/intent?q=${encodeURIComponent(searchQuery)}`);
      setSearchResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Map icon names to Lucide icons
  const getCategoryIcon = (iconName: string) => {
    const iconsMap: Record<string, any> = {
      Wrench: Wrench,
      Zap: Zap,
      Wind: Wind,
      Paintbrush: Paintbrush,
      ShieldAlert: ShieldAlert,
      Heart: Heart,
      Tv: Tv,
      Hammer: Hammer,
      Flower: Flower,
      Sparkles: Sparkles
    };
    const SelectedIcon = iconsMap[iconName] || Compass;
    return <SelectedIcon className="w-6 h-6 text-primary" />;
  };

  const handleSelectService = (srvId: string, subSrvId: string) => {
    navigate(`/booking-flow?serviceId=${srvId}&subServiceId=${subSrvId}`);
  };

  return (
    <div className="min-h-[calc(100vh-62px)] pb-16 bg-slate-50 dark:bg-slate-950">
      {/* 1. HERO CONVERSATIONAL PANEL */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-primary/20 text-white py-12 md:py-20 px-4 md:px-8 relative overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-yellow-300">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>AI INTENT PARSING POWERED BY GPT-4o</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none">
            Find & Book Local Services <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">
              using Natural Language
            </span>
          </h1>
          
          <p className="text-xs md:text-sm text-slate-300 max-w-xl mx-auto">
            "I need someone to deep clean my dirty bathroom and service my leaky split AC" — Type anything below, and our AI will pre-select the perfect bundle package!
          </p>

          {/* Smart Search Form */}
          <form onSubmit={handleAISearchSubmit} className="max-w-2xl mx-auto relative flex items-center mt-6">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="E.g., My kitchen floor is oily and the wall switch is sparking..."
              className="w-full pl-5 pr-12 py-3.5 rounded-2xl bg-white text-slate-800 placeholder-slate-400 dark:bg-slate-800 dark:text-white dark:border-slate-700 text-xs md:text-sm focus:outline-none shadow-xl"
            />
            <button 
              type="submit"
              disabled={searchLoading}
              className="p-2.5 bg-primary text-white rounded-xl hover:bg-orange-600 transition-colors absolute right-2"
            >
              {searchLoading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin block" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </section>

      {/* 2. SEARCH RESULTS ACCORDION CONTAINER */}
      {searchResult && (
        <section className="max-w-4xl mx-auto mt-6 px-4 page-fade-in">
          <div className="p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <h4 className="font-extrabold text-sm dark:text-white">AI Recommended Package Matches</h4>
              </div>
              <button 
                onClick={() => setSearchResult(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            </div>

            {searchResult.matchedService ? (
              <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-4">
                <div className="w-24 h-24 rounded-2xl border overflow-hidden bg-slate-100 flex-shrink-0">
                  <img src={searchResult.matchedService.imageURL} alt="Service" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-1.5 text-center md:text-left">
                  <h5 className="font-extrabold text-base text-slate-800 dark:text-white">
                    {searchResult.matchedService.name}
                  </h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {searchResult.matchedService.description}
                  </p>
                  <div className="flex items-center justify-center md:justify-start space-x-3 pt-2">
                    <span className="text-sm font-black text-primary">
                      Base: ₹{searchResult.matchedService.basePrice}
                    </span>
                    <button
                      onClick={() => handleSelectService(searchResult.matchedService.id, searchResult.recommendedSubService || '1bhk')}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors shadow-md shadow-primary/10 flex items-center space-x-1"
                    >
                      <span>Book Package Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No exact matches resolved. Try standard grids below.</p>
            )}
          </div>
        </section>
      )}

      {/* 3. CATEGORIES GRID */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 mt-12 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 dark:text-white">
            Browse Home Categories
          </h3>
          <span className="text-xs text-slate-400">30+ services verified</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/booking-flow?categoryId=${cat.id}`)}
              className="p-4 rounded-3xl border bg-white hover:border-primary hover:bg-primary/5 transition-all text-center space-y-2 cursor-pointer dark:bg-slate-900 dark:border-slate-800 flex flex-col items-center justify-center group"
            >
              <div className="p-3 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
                {getCategoryIcon(cat.iconURL)}
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. PROMO BANNERS GRID */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 mt-12">
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-primary/10 to-orange-500/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between">
          <div className="space-y-2 mb-4 md:mb-0 text-center md:text-left">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              LIMITED TIME FESTIVE DEALS
            </span>
            <h4 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight">
              Enjoy Flat 20% Off on all Deep Cleaning bookings
            </h4>
            <p className="text-xs text-slate-400">Use promo code <span className="font-extrabold text-primary">FESTIVE20</span> during checkouts. Exclusions apply.</p>
          </div>
          <button 
            onClick={() => handleSelectService('full_house_clean', '1bhk')}
            className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors shadow-md shadow-primary/20 flex items-center space-x-1"
          >
            <span>Claim Discount</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 5. POPULAR SERVICES SECTOR */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 mt-12 space-y-4">
        <h3 className="text-lg font-black text-slate-800 dark:text-white">
          Trending Near You
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {services.map((srv) => (
            <div 
              key={srv.id} 
              className="p-4 rounded-3xl border bg-white dark:bg-slate-900 dark:border-slate-800 flex items-center space-x-4 hover:shadow-lg transition-shadow"
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0">
                <img src={srv.imageURL} alt="Service" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 space-y-1">
                <h5 className="font-extrabold text-xs md:text-sm text-slate-800 dark:text-white">{srv.name}</h5>
                <p className="text-[10px] md:text-xs text-slate-400 line-clamp-1">{srv.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-black text-primary">₹{srv.basePrice}</span>
                  <button 
                    onClick={() => handleSelectService(srv.id, '1bhk')}
                    className="text-xs font-bold text-primary hover:underline flex items-center space-x-0.5"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. TRUST SEAL FOOTER */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h6 className="font-extrabold text-xs text-slate-800 dark:text-white">100% Insured work</h6>
            <p className="text-[10px] text-slate-400 leading-normal">Every platform request comes with standard safety coverage.</p>
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <Wind className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h6 className="font-extrabold text-xs text-slate-800 dark:text-white">Expert Partners</h6>
            <p className="text-[10px] text-slate-400 leading-normal">All operators undergo mandatory visual and crime history vetting.</p>
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <Landmark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h6 className="font-extrabold text-xs text-slate-800 dark:text-white">No Cancellation Fees</h6>
            <p className="text-[10px] text-slate-400 leading-normal">Free slot reschedules or cancels permitted up to 2 hours in advance.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
