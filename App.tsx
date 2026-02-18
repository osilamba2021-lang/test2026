
import React, { useState, useEffect } from 'react';
import { ClothingItem, ClothingCategory, StylingState, InspirationImage, StyleProfile, UserAnalysis } from './types';
import ClothingCard from './components/ClothingCard';
import { generateOutfits, analyzeBodyArchitecture } from './services/geminiService';

const CATEGORIES: ClothingCategory[] = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'];

interface DailyContext {
  event: string;
  weather: string;
  location: string;
  vibe: string;
  color: string;
  comfort: number;
  pinterestUrl: string;
}

const App: React.FC = () => {
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [inspiration, setInspiration] = useState<InspirationImage[]>([]);
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'generator' | 'identity'>('generator');
  const [categoryFilter, setCategoryFilter] = useState<ClothingCategory | 'All'>('All');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [styling, setStyling] = useState<StylingState>({
    isGenerating: false,
    suggestions: null,
    error: null
  });
  
  const [context, setContext] = useState<DailyContext>({
    event: '',
    weather: '',
    location: '',
    vibe: '',
    color: '',
    comfort: 5,
    pinterestUrl: ''
  });

  const [profile, setProfile] = useState<StyleProfile>({
    aesthetic: '',
    silhouettes: '',
    forbidden: '',
    signatureColors: '',
    bodyType: '',
    height: ''
  });

  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    try {
      const savedWardrobe = localStorage.getItem('ladys_wardrobe');
      const savedInspo = localStorage.getItem('ladys_inspo');
      const savedContext = localStorage.getItem('ladys_context');
      const savedProfile = localStorage.getItem('ladys_profile');
      
      if (savedWardrobe) setWardrobe(JSON.parse(savedWardrobe));
      if (savedInspo) setInspiration(JSON.parse(savedInspo));
      if (savedContext) {
        const parsed = JSON.parse(savedContext);
        setContext(prev => ({ ...prev, ...parsed }));
      }
      if (savedProfile) setProfile(JSON.parse(savedProfile));
    } catch (e) {
      console.warn("Storage restoration failed", e);
    }

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  useEffect(() => {
    localStorage.setItem('ladys_wardrobe', JSON.stringify(wardrobe));
    localStorage.setItem('ladys_inspo', JSON.stringify(inspiration));
    localStorage.setItem('ladys_context', JSON.stringify(context));
    localStorage.setItem('ladys_profile', JSON.stringify(profile));
  }, [wardrobe, inspiration, context, profile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, category: ClothingCategory) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: ClothingItem = {
          id: Math.random().toString(36).substring(7),
          image: reader.result as string,
          category,
          name: file.name.split('.')[0]
        };
        setWardrobe(prev => [newItem, ...prev]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAnalysisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setIsAnalyzing(true);
      try {
        const result = await analyzeBodyArchitecture(base64);
        setProfile(prev => ({
          ...prev,
          analysisPhoto: base64,
          aiAnalysis: result,
          bodyType: result.bodyShape,
          height: result.heightEstimate
        }));
      } catch (err) {
        alert("Proportion analysis failed. Please use a clear full-length photo.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInspoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: InspirationImage = {
          id: Math.random().toString(36).substring(7),
          image: reader.result as string,
        };
        setInspiration(prev => [...prev, newItem].slice(-6));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeItem = (id: string) => setWardrobe(prev => prev.filter(item => item.id !== id));
  const removeInspo = (id: string) => setInspiration(prev => prev.filter(item => item.id !== id));

  const filteredWardrobe = wardrobe.filter(item => 
    categoryFilter === 'All' ? true : item.category === categoryFilter
  );

  const handleGenerate = async () => {
    if (wardrobe.length < 2) {
      setStyling(prev => ({ ...prev, error: "Upload your clothing pieces first." }));
      return;
    }

    setStyling({ isGenerating: true, suggestions: null, error: null });
    setActiveTab('generator');

    const promptText = `
      COMFORT RATING: ${context.comfort}/10
      EVENT: ${context.event || 'Daily Life'}
      VIBE: ${context.vibe || 'Sophisticated'}
      COLOR: ${context.color || 'Balanced'}
    `;

    try {
      const results = await generateOutfits(wardrobe, inspiration, promptText, profile, context.pinterestUrl);
      setStyling({ isGenerating: false, suggestions: results, error: null });
    } catch (err: any) {
      setStyling({ isGenerating: false, suggestions: null, error: err.message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#faf9f6] text-stone-800">
      <nav className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-stone-200 p-6 flex flex-col sticky top-0 md:h-screen z-20 shadow-sm">
        <div className="mb-10">
          <h1 className="text-2xl font-bold italic text-amber-900 flex items-center gap-2">
            <i className="fa-solid fa-gem text-amber-600"></i>
            The Lady's
          </h1>
          <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-1 font-sans font-bold">Wardrobe Stylist</p>
        </div>

        <div className="space-y-2 flex-grow">
          <button 
            onClick={() => setActiveTab('generator')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'generator' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <i className="fa-solid fa-sun"></i>
            <span className="font-medium">Daily Ritual</span>
          </button>
          <button 
            onClick={() => setActiveTab('identity')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'identity' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <i className="fa-solid fa-dna"></i>
            <span className="font-medium">Style Identity</span>
          </button>
          <button 
            onClick={() => setActiveTab('wardrobe')}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${activeTab === 'wardrobe' ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <i className="fa-solid fa-boxes-stacked"></i>
            <span className="font-medium">Wardrobe</span>
          </button>
        </div>
      </nav>

      <main className="flex-grow p-4 md:p-10 pb-24 md:pb-10 overflow-auto">
        {activeTab === 'wardrobe' ? (
          <div className="max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2 font-serif tracking-tight">Digital Vault</h2>
                <p className="text-stone-500">Curate your collection for AI analysis.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCategoryFilter('All')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${categoryFilter === 'All' ? 'bg-stone-800 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>All</button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${categoryFilter === cat ? 'bg-stone-800 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{cat}</button>
                ))}
              </div>
            </header>

            <section className="mb-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {CATEGORIES.map(cat => (
                <label key={cat} className="group flex flex-col items-center justify-center p-4 border border-dashed border-stone-300 rounded-2xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/20 transition-all active:scale-95">
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, cat)} multiple />
                  <i className="fa-solid fa-plus text-stone-300 group-hover:text-amber-500 mb-2"></i>
                  <span className="text-[9px] font-black uppercase tracking-tighter text-stone-400 group-hover:text-amber-700">{cat}</span>
                </label>
              ))}
            </section>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredWardrobe.map(item => <ClothingCard key={item.id} item={item} onRemove={removeItem} />)}
            </div>
          </div>
        ) : activeTab === 'identity' ? (
          <div className="max-w-4xl mx-auto">
            <header className="mb-12">
              <h2 className="text-4xl font-bold mb-2 font-serif">Aesthetic Identity</h2>
              <p className="text-stone-500">Defining your permanent style DNA and architecture.</p>
            </header>

            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-stone-100 text-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-6">Silhouette Scan</h3>
                  <div className="relative aspect-[3/4] bg-stone-50 rounded-2xl overflow-hidden mb-6 border border-stone-100">
                    {profile.analysisPhoto ? (
                      <img src={profile.analysisPhoto} className="w-full h-full object-cover" alt="Silhouette scan" />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-6 text-stone-300">
                        <i className="fa-solid fa-camera-retro text-4xl mb-4"></i>
                        <p className="text-[10px] uppercase font-bold tracking-widest">Full-Length Photo</p>
                      </div>
                    )}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur flex flex-col items-center justify-center text-amber-900">
                         <i className="fa-solid fa-gear animate-spin text-2xl mb-2"></i>
                         <span className="text-[10px] font-black uppercase tracking-widest">Scanning...</span>
                      </div>
                    )}
                  </div>
                  <label className="block w-full py-3 bg-stone-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-black transition-all">
                    {profile.analysisPhoto ? "Update Architecture" : "Analyze My Proportions"}
                    <input type="file" className="hidden" accept="image/*" onChange={handleAnalysisUpload} />
                  </label>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                {profile.aiAnalysis ? (
                  <div className="bg-stone-900 text-stone-50 p-8 rounded-[2rem] shadow-xl animate-in fade-in slide-in-from-right-8">
                    <div className="flex justify-between items-start mb-8">
                       <h3 className="text-xl font-serif italic">The Dossier</h3>
                       <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[8px] font-black tracking-widest uppercase border border-amber-500/30">AI Architecture Sync</span>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Body Geometry</span>
                        <p className="font-bold text-lg">{profile.aiAnalysis.bodyShape}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Height Profile</span>
                        <p className="font-bold text-lg">{profile.aiAnalysis.heightEstimate}</p>
                      </div>
                      <div className="col-span-2 pt-4 border-t border-white/10">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Stylist Recommendation</span>
                        <p className="italic text-sm leading-relaxed text-amber-200">"{profile.aiAnalysis.suggestedFocus}"</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-[2rem] border border-dashed border-stone-200 text-center py-20">
                    <i className="fa-solid fa-sparkles text-amber-100 text-6xl mb-4"></i>
                    <p className="text-stone-400 font-serif italic">Scan your silhouette to unlock automated flattery logic.</p>
                  </div>
                )}

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 space-y-6">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Styling Directives</h3>
                   <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <label className="text-[9px] font-black text-stone-400 uppercase">Core Aesthetic</label>
                       <input type="text" value={profile.aesthetic} onChange={(e) => setProfile({...profile, aesthetic: e.target.value})} placeholder="e.g. Old Money" className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[9px] font-black text-stone-400 uppercase">Signature Colors</label>
                       <input type="text" value={profile.signatureColors} onChange={(e) => setProfile({...profile, signatureColors: e.target.value})} placeholder="e.g. Navy, Tan" className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm" />
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <header className="mb-10 flex items-end justify-between">
              <div>
                <span className="text-amber-600 font-black uppercase tracking-[0.4em] text-[10px] mb-2 block">{greeting}, My Lady</span>
                <h2 className="text-4xl font-bold mb-2 font-serif">Daily Style Ritual</h2>
              </div>
              <button onClick={() => setActiveTab('identity')} className="text-[10px] font-black uppercase bg-white px-5 py-2.5 rounded-full border border-stone-100 shadow-sm transition-all hover:bg-stone-50">
                {profile.aiAnalysis ? "Architecture Synced" : "Unlock Proportions"}
              </button>
            </header>

            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100">
                  <div className="grid sm:grid-cols-2 gap-6">
                    {['Event', 'Weather', 'Vibe', 'Color'].map(field => (
                      <div key={field} className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{field}</label>
                        <input 
                          type="text"
                          value={(context as any)[field.toLowerCase()]}
                          onChange={(e) => setContext({...context, [field.toLowerCase()]: e.target.value})}
                          placeholder={`Specify ${field.toLowerCase()}...`}
                          className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm"
                        />
                      </div>
                    ))}
                    <div className="sm:col-span-2 space-y-4 pt-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Comfort Rating</label>
                        <span className="text-xs font-bold text-amber-900 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">Level {context.comfort}/10</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={context.comfort} 
                        onChange={(e) => setContext({...context, comfort: parseInt(e.target.value)})} 
                        className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-900" 
                      />
                      <p className="text-[9px] text-stone-400 italic">High comfort prioritizes ergonomics and soft textures.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 border-l-4 border-l-red-600">
                  <div className="flex items-center gap-4 mb-4">
                    <i className="fa-brands fa-pinterest text-red-600 text-xl"></i>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Pinterest Trend Mapping</h4>
                  </div>
                  <input type="url" value={context.pinterestUrl} onChange={(e) => setContext({...context, pinterestUrl: e.target.value})} placeholder="Paste board link for global trend analysis..." className="w-full px-4 py-3 rounded-xl bg-stone-50 border-none text-sm" />
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col">
                <h3 className="text-xs uppercase tracking-widest font-black text-stone-400 mb-6 flex items-center justify-between">
                  Inspiration
                  <label className="cursor-pointer text-amber-600 hover:text-amber-900 transition-colors">
                    <input type="file" className="hidden" accept="image/*" onChange={handleInspoUpload} multiple />
                    <i className="fa-solid fa-plus-circle text-lg"></i>
                  </label>
                </h3>
                <div className="grid grid-cols-3 gap-2 flex-grow content-start">
                  {inspiration.map(inspo => (
                    <div key={inspo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-stone-50 shadow-sm">
                      <img src={inspo.image} className="w-full h-full object-cover" alt="Inspiration" />
                      <button onClick={() => removeInspo(inspo.id)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><i className="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                  ))}
                  {inspiration.length === 0 && (
                    <div className="col-span-3 py-10 text-center border border-dashed border-stone-100 rounded-xl">
                      <span className="text-[9px] text-stone-300 font-bold uppercase">Vault Empty</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={styling.isGenerating || wardrobe.length < 2} 
              className={`w-full py-5 rounded-2xl font-black text-white tracking-[0.2em] uppercase text-[10px] transition-all shadow-xl group ${styling.isGenerating ? 'bg-stone-300 cursor-not-allowed' : 'bg-amber-950 hover:bg-black hover:-translate-y-1'}`}
            >
              {styling.isGenerating ? (
                <span className="flex items-center justify-center gap-4">
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  {`Syncing Architecture (Est. < 30s)...`}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-4">
                  Synthesize My Daily Look
                  <i className="fa-solid fa-sparkles text-amber-400 group-hover:animate-bounce"></i>
                </span>
              )}
            </button>

            {styling.suggestions && (
              <div className="mt-16 space-y-16 pb-20">
                <div className="text-center mb-10">
                   <h3 className="text-2xl font-serif italic text-stone-400">The Curation</h3>
                   <div className="w-12 h-[1px] bg-amber-200 mx-auto mt-4"></div>
                </div>
                <div className="grid lg:grid-cols-3 gap-8">
                  {styling.suggestions.map((outfit, idx) => (
                    <div key={idx} className="group animate-in fade-in slide-in-from-bottom-8 duration-500" style={{animationDelay: `${idx * 150}ms`}}>
                      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-lg border border-stone-100 h-full flex flex-col hover:shadow-2xl transition-all duration-300">
                        <div className={`p-6 ${outfit.type === 'Bold' ? 'bg-amber-900 text-white' : 'bg-stone-50 text-stone-800'} border-b border-stone-100`}>
                           <div className="flex justify-between items-center mb-1">
                             <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60">{outfit.type}</span>
                             {context.comfort >= 8 && outfit.type === 'Practical' && <i className="fa-solid fa-feather text-[10px] text-amber-600"></i>}
                           </div>
                           <h4 className="text-xl font-serif font-bold">{outfit.title}</h4>
                        </div>
                        <div className="p-6 flex-grow flex flex-col">
                          <div className="grid grid-cols-2 gap-3 mb-6">
                            {outfit.items.map(itemId => {
                              const item = wardrobe.find(w => w.id === itemId);
                              return item ? (
                                <div key={itemId} className="aspect-[3/4] rounded-xl overflow-hidden border border-stone-50 bg-stone-50 shadow-sm">
                                  <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                </div>
                              ) : null;
                            })}
                          </div>
                          <p className="text-xs text-stone-500 leading-relaxed mb-6 italic">{outfit.description}</p>
                          <div className="mt-auto pt-6 border-t border-stone-50 space-y-4">
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                               <span className="text-[9px] font-black uppercase text-amber-900 tracking-widest block mb-1">Architectural Flattery</span>
                               <p className="text-[10px] text-amber-800 italic leading-relaxed">{outfit.proportionNote}</p>
                            </div>
                            {outfit.sources && outfit.sources.length > 0 && (
                              <div className="pt-2">
                                <span className="text-[8px] font-black uppercase text-stone-300 tracking-widest block mb-2">Web Analysis</span>
                                <div className="flex flex-wrap gap-2">
                                  {outfit.sources.map((source, sIdx) => (
                                    <a key={sIdx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[8px] text-amber-700 hover:underline flex items-center gap-1 bg-white border border-amber-100 px-2 py-0.5 rounded-full transition-all hover:bg-amber-50">
                                      {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {!styling.suggestions && !styling.isGenerating && (
              <div className="text-center py-32 opacity-20">
                <i className="fa-solid fa-feather-pointed text-[8rem] text-stone-300"></i>
                <p className="font-serif italic text-xl mt-4">Select your ritual preferences to begin...</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
