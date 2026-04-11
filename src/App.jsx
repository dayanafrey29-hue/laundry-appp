import { useState, useEffect, useRef } from "react";
import { supabase } from '../supabaseClient'; // ПІДКЛЮЧАЄМО SUPABASE

const SETTINGS_PASSWORD = "2026";

const DEFAULT_LINEN = [
  { id: "sheet_2",       label: "Простыня двуспальная",    icon: "🛏" },
  { id: "sheet_1",       label: "Простыня односпальная",   icon: "🛏" },
  { id: "pillow_case",   label: "Наволочка",               icon: "🟫" },
  { id: "duvet_cover_2", label: "Пододеяльник двусп.",     icon: "🌿" },
  { id: "duvet_cover_1", label: "Пододеяльник односп.",    icon: "🌿" },
  { id: "towel_bath",    label: "Полотенце банное",        icon: "🪣" },
  { id: "towel_hand",    label: "Полотенце для рук",       icon: "🪣" },
  { id: "towel_face",    label: "Полотенце для лица",      icon: "🪣" },
  { id: "bath_mat",      label: "Коврик для ванной",       icon: "⬜" },
  { id: "blanket",       label: "Плед / Одеяло",           icon: "🧣" },
  { id: "curtain",       label: "Шторы",                   icon: "🪟" },
  { id: "tablecloth",    label: "Скатерть",                icon: "🍽" },
];

const DEFAULT_APTS  = ["101","102","103","201","202","203"];
const DEFAULT_MAIDS = ["Анна","Мария","Светлана","Ольга"];

const THEMES = [
  { id:"blue",    label:"Лаванда",    accent:"#8B9ACA", dark:"#6B7DB5", dim:"#EDEEF6" },
  { id:"rose",    label:"Розовый",    accent:"#C49AAD", dark:"#A6788E", dim:"#F3E8EC" },
  { id:"green",   label:"Мята",       accent:"#7DB896", dark:"#5F9C7A", dim:"#E6F2EB" },
  { id:"peach",   label:"Персик",     accent:"#CDA082", dark:"#B08568", dim:"#F3ECE5" },
  { id:"purple",  label:"Фиалка",     accent:"#9F92C8", dark:"#7E6EAD", dim:"#EDEBF5" },
];

function applyTheme(id) {
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  const r = document.documentElement.style;
  r.setProperty("--accent",      t.accent);
  r.setProperty("--accent-dark", t.dark);
  r.setProperty("--accent-dim",  t.dim);
  r.setProperty("--accent-grad", `linear-gradient(135deg,${t.accent},${t.dark})`);
}
applyTheme("blue");

const BG_THEMES = [
  { id:"snow",    label:"Снег",     bg:"#F5F5F7", bg2:"#FFFFFF", bg3:"#EBEBF0" },
  { id:"cream",   label:"Крем",     bg:"#F8F6F3", bg2:"#FFFFFF", bg3:"#F0EDE8" },
  { id:"sky",     label:"Небо",     bg:"#F2F4F8", bg2:"#FFFFFF", bg3:"#E8ECF2" },
  { id:"mint",    label:"Мята",     bg:"#F2F6F4", bg2:"#FFFFFF", bg3:"#E6EDE9" },
  { id:"blush",   label:"Румянец",  bg:"#F7F3F4", bg2:"#FFFFFF", bg3:"#EDE8EA" },
];

function applyBg(id) {
  const t = BG_THEMES.find(x => x.id === id) || BG_THEMES[0];
  const r = document.documentElement.style;
  r.setProperty("--bg",  t.bg);
  r.setProperty("--bg2", t.bg2);
  r.setProperty("--bg3", t.bg3);
}
applyBg("snow");

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtDate(d) {
  if (!d) return "";
  const [y,m,dd] = d.split("-");
  return `${dd}.${m}.${y}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function compressImage(file, maxPx = 1200, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не вдалося прочитати файл"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не вдалося завантажити зображення"));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const preview = canvas.toDataURL("image/jpeg", quality);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error("Не вдалося стиснути зображення"));
          resolve({ preview, blob });
        }, "image/jpeg", quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── ROOT ────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]         = useState("log");
  const [records, setRecords] = useState([]);
  const [apts, setApts]       = useState(null);
  const [maids, setMaids]     = useState(null);
  const [linen, setLinen]     = useState(null);
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [orderUnlocked, setOrderUnlocked] = useState(false);
  const [syncBanner, setSyncBanner] = useState(false);
  const [online, setOnline]   = useState(navigator.onLine);
  const [theme, setTheme]     = useState("blue");
  const [bgTheme, setBgTheme] = useState("snow");
  const [pendingCount, setPendingCount] = useState(0);
  const [bgImage, setBgImage] = useState(() => localStorage.getItem("tca_bg_image") || "");

  function getPending() {
    try { return JSON.parse(localStorage.getItem("tca_pending") || "[]"); }
    catch { return []; }
  }
  function savePending(list) {
    localStorage.setItem("tca_pending", JSON.stringify(list));
    setPendingCount(list.length);
  }

  async function flushPending() {
    const pending = getPending();
    if (!pending.length) return;
    const still = [];
    for (const rec of pending) {
      try {
        const uploadedUrls = [];
        if (rec._offlinePhotos && rec._offlinePhotos.length) {
          for (const dataUrl of rec._offlinePhotos) {
            const resp = await fetch(dataUrl);
            const blob = await resp.blob();
            const fileName = `${Date.now()}_${uid()}.jpg`;
            const { data, error: upErr } = await supabase.storage
              .from('laundry').upload(fileName, blob, { contentType: 'image/jpeg' });
            if (!upErr && data) {
              const { data: urlData } = supabase.storage.from('laundry').getPublicUrl(data.path);
              uploadedUrls.push(urlData.publicUrl);
            }
          }
        }
        const { _offlinePhotos, _offlineId, ...clean } = rec;
        clean.photos = uploadedUrls;
        const { data, error } = await supabase.from('laundry_records').insert([clean]).select();
        if (error) throw error;
        if (data) setRecords(prev => [data[0], ...prev.filter(r => r.id !== _offlineId)]);
      } catch {
        still.push(rec);
      }
    }
    savePending(still);
    if (still.length < pending.length) showSync();
  }

  useEffect(() => {
    setPendingCount(getPending().length);
    const goOnline = () => { setOnline(true); flushPending(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  useEffect(() => {
    supabase
      .from('laundry_records')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setRecords(prev => {
            const pending = getPending();
            const offlineIds = pending.map(p => p._offlineId);
            const offlineRecords = prev.filter(r => offlineIds.includes(r.id));
            return [...offlineRecords, ...data];
          });
          flushPending();
        }
      });
  }, []);

  // ЗАВАНТАЖЕННЯ НАЛАШТУВАНЬ З SUPABASE (з fallback на дефолти)
  useEffect(() => {
    supabase
      .from('laundry_store')
      .select('*')
      .then(({ data, error }) => {
        const map = (!error && data)
          ? Object.fromEntries(data.map(r => [r.key, r.value]))
          : {};
        const a  = map['apts']  || DEFAULT_APTS;
        const m  = map['maids'] || DEFAULT_MAIDS;
        const l  = map['linen'] || DEFAULT_LINEN;
        const rawTh = map['theme'] || 'blue';
        const rawBg = map['bg']    || 'snow';
        const th = THEMES.find(x => x.id === rawTh) ? rawTh : 'blue';
        const bg = BG_THEMES.find(x => x.id === rawBg) ? rawBg : 'snow';
        setApts(a); setMaids(m); setLinen(l);
        setTheme(th); applyTheme(th);
        setBgTheme(bg); applyBg(bg);
        if (th !== rawTh) syncKey('theme', th);
        if (bg !== rawBg) syncKey('bg', bg);
        if (!map['apts'])  syncKey('apts',  a);
        if (!map['maids']) syncKey('maids', m);
        if (!map['linen']) syncKey('linen', l);
        if (!map['theme']) syncKey('theme', th);
        if (!map['bg'])    syncKey('bg',    bg);
      });
  }, []);

  function showSync() {
    setSyncBanner(true);
    setTimeout(() => setSyncBanner(false), 2500);
  }

  async function syncKey(key, value) {
    try {
      const { error } = await supabase
        .from('laundry_store')
        .upsert({ key, value });
      if (error) throw error;
      showSync();
    } catch (err) {
      console.error("Помилка синхронізації:", err);
      setOnline(false);
    }
  }

  async function addRecord(record, offlinePhotos) {
    try {
      const { data, error } = await supabase
        .from('laundry_records')
        .insert([record])
        .select();
      if (error) {
        console.error("Supabase insert error:", error.message, error.details, error.hint);
        throw error;
      }
      if (data) setRecords(prev => [data[0], ...prev]);
      showSync();
      setOnline(true);
      return { ok: true };
    } catch (err) {
      console.error("addRecord failed, saving offline:", err);
      setOnline(false);
      const offlineId = `offline_${uid()}`;
      const pending = getPending();
      pending.push({ ...record, _offlineId: offlineId, _offlinePhotos: offlinePhotos || [] });
      savePending(pending);
      setRecords(prev => [{ ...record, id: offlineId, created_at: new Date().toISOString(), _offline: true }, ...prev]);
      return { ok: false, offline: true };
    }
  }

  async function updateRecord(id, updates) {
    try {
      const { data, error } = await supabase
        .from('laundry_records')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      if (data) setRecords(prev => prev.map(r => r.id === id ? data[0] : r));
      showSync();
      return { ok: true };
    } catch (err) {
      console.error("Update error:", err);
      return { ok: false };
    }
  }

  async function deleteRecord(id) {
    const { error } = await supabase
      .from('laundry_records')
      .delete()
      .eq('id', id);
    if (!error) setRecords(prev => prev.filter(r => r.id !== id));
  }

  function saveApts(list)   { const sorted = [...list].sort((a,b)=>a.localeCompare(b,"ru",{numeric:true})); setApts(sorted); syncKey("apts", sorted); }
  function saveMaids(list)  { const sorted = [...list].sort((a,b)=>a.localeCompare(b,"ru")); setMaids(sorted); syncKey("maids", sorted); }
  function saveLinen(list)  { setLinen(list); syncKey("linen", list); }
  function saveTheme(id)    { setTheme(id);   applyTheme(id); syncKey("theme", id); }
  function saveBgTheme(id)  { setBgTheme(id); applyBg(id);   syncKey("bg",    id); }
  function saveBgImage(dataUrl) { setBgImage(dataUrl); if (dataUrl) localStorage.setItem("tca_bg_image", dataUrl); else localStorage.removeItem("tca_bg_image"); }

  if (!apts || !maids || !linen) return (
    <div style={s.shell}><div style={{...s.root,display:"flex",alignItems:"center",justifyContent:"center",color:"#8E8E93"}}>Загрузка…</div></div>
  );

  return (
    <div style={s.shell}>
      {bgImage && <div style={{position:"fixed",inset:0,zIndex:0,backgroundImage:`url(${bgImage})`,backgroundSize:"cover",backgroundPosition:"center",filter:"blur(28px) brightness(0.92) saturate(0.7)",transform:"scale(1.15)",pointerEvents:"none"}}/>}
      {bgImage && <div style={{position:"fixed",inset:0,zIndex:0,background:"rgba(255,255,255,0.45)",pointerEvents:"none"}}/>}
      <style>{`
        @media(min-width:600px){
          .tca-root{max-width:540px!important;border-radius:18px!important;margin-top:24px!important;margin-bottom:24px!important;box-shadow:0 4px 30px rgba(0,0,0,0.08)!important;overflow:hidden!important}
        }
        @media(min-width:900px){
          .tca-root{max-width:620px!important}
        }
      `}</style>
      <div style={s.root} className="tca-root">
        <div style={s.header}>
          <span style={{fontSize:26}}>🧺</span>
          <div style={{flex:1}}>
            <div style={s.headerTitle}>TCA</div>
            <div style={s.headerSub}>Журнал прачечной</div>
          </div>
          {!online && <div style={s.offlinePill}>⚠️ Офлайн</div>}
          {pendingCount > 0 && <div style={s.pendingPill}>📱 {pendingCount} в очереди</div>}
          {online && pendingCount === 0 && <div style={{...s.syncPill, opacity: syncBanner ? 1 : 0}}>🔄 Сохранено</div>}
          <button onClick={() => setTab("task")} style={{
            background: tab === "task" ? "var(--accent)" : "var(--bg2)",
            color: tab === "task" ? "#fff" : "var(--accent)",
            border: tab === "task" ? "none" : "1.5px solid var(--accent)",
            borderRadius: 10, padding: "6px 14px", fontFamily: "inherit",
            fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            transition: "all 0.2s", letterSpacing: 0.3
          }}>📋 Order</button>
        </div>

        <div style={s.tabBar}>
          {[["log","📝","Записать"],["history","🔍","История"],["settings","⚙️","Настройки"]].map(([key,icon,label])=>(
            <button key={key} onClick={()=>setTab(key)}
              style={{...s.tab,...(tab===key?s.tabActive:{})}}>
              <span style={{fontSize:18}}>{icon}</span>
              <span style={{fontSize:11}}>{label}</span>
            </button>
          ))}
        </div>

        <div style={{display: tab==="log" ? undefined : "none"}}>
          <LogTab addRecord={addRecord} apts={apts} maids={maids} linen={linen}/>
        </div>
        {tab==="history" && <HistoryTab records={records} deleteRecord={deleteRecord} updateRecord={updateRecord} linen={linen} maids={maids} apts={apts}/>}
        {tab==="task" && (
          orderUnlocked
            ? <TaskTab apts={apts} linen={linen} syncKey={syncKey}/>
            : <PasswordGate onUnlock={()=>setOrderUnlocked(true)} title="Order" subtitle="Введите пароль для доступа"/>
        )}
        {tab==="settings" && (
          settingsUnlocked
            ? <SettingsTab apts={apts} saveApts={saveApts} maids={maids} saveMaids={saveMaids} linen={linen} saveLinen={saveLinen} theme={theme} saveTheme={saveTheme} bgTheme={bgTheme} saveBgTheme={saveBgTheme} bgImage={bgImage} saveBgImage={saveBgImage} onLock={()=>setSettingsUnlocked(false)}/>
            : <PasswordGate onUnlock={()=>setSettingsUnlocked(true)}/>
        )}
      </div>
    </div>
  );
}

// ─── PASSWORD GATE ───────────────────────────────────────────────
function PasswordGate({ onUnlock, title, subtitle }) {
  const [val, setVal]     = useState("");
  const [err, setErr]     = useState(false);
  const [shake, setShake] = useState(false);

  function tryUnlock() {
    if (val === SETTINGS_PASSWORD) {
      onUnlock();
    } else {
      setErr(true);
      setShake(true);
      setTimeout(()=>setShake(false), 500);
      setTimeout(()=>setErr(false), 2000);
      setVal("");
    }
  }

  return (
    <div style={{padding:"60px 32px 32px", textAlign:"center"}}>
      <div style={{fontSize:48, marginBottom:16}}>🔒</div>
      <div style={{fontSize:17, fontWeight:600, marginBottom:6, color:"#1C1C1E"}}>{title || "Настройки защищены"}</div>
      <div style={{fontSize:13, color:"#8E8E93", marginBottom:32}}>{subtitle || "Введите пароль для доступа"}</div>

      <div style={{animation: shake ? "shake 0.4s ease" : "none", marginBottom:16}}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <input
          type="password"
          inputMode="numeric"
          placeholder="••••"
          value={val}
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&tryUnlock()}
          autoFocus
          style={{
            ...s.input,
            textAlign:"center",
            fontSize:24,
            letterSpacing:8,
            border: err ? "1px solid #FF3B30" : brd,
            transition:"border 0.2s",
          }}
        />
        {err && <div style={{fontSize:12,color:"#FF3B30",marginTop:8}}>Неверный пароль</div>}
      </div>

      <button onClick={tryUnlock} style={{...s.saveBtn, marginTop:0}}>
        Войти
      </button>
    </div>
  );
}

// ─── LOG TAB ─────────────────────────────────────────────────────
function LogTab({ addRecord, apts, maids, linen }) {
  const [step, setStep]           = useState(1);
  const [aptSearch, setAptSearch] = useState("");
  const [form, setForm]           = useState({date:today(),apartment:"",maid:"",linen:{},consumables:"",notes:"",photos:[]});
  const [saved, setSaved]         = useState(false);
  const [savedMsg, setSavedMsg]   = useState("");
  const [saving, setSaving]       = useState(false);
  const photoRef                  = useRef();

  useEffect(() => {
    if (step === 1) setForm(f => ({...f, date: today()}));
  }, [step]);

  const filteredApts = apts.filter(a=>a.toLowerCase().includes(aptSearch.toLowerCase()));

  function selectApt(apt) { setForm(f=>({...f,apartment:apt})); setAptSearch(apt); setStep(2); }

  function setQty(id, val) {
    const num = val===""?"" : Math.max(0,parseInt(val)||0);
    setForm(f=>{
      const newLinen = {...f.linen, [id]:num};
      delete newLinen._no_linen;
      return {...f, linen: newLinen};
    });
  }

  async function handlePhoto(e) {
    const files = Array.from(e.target.files);
    const compressed = await Promise.all(files.map(f => compressImage(f)));
    setForm(f => ({ ...f, photos: [...f.photos, ...compressed] }));
    e.target.value = "";
  }

  const handleSaveRecord = async () => {
    if (!form.apartment || !form.maid) {
      alert("Выберите квартиру и сотрудника!");
      return;
    }
    setSaving(true);
    try {
      const offlinePreviews = form.photos.map(p => p.preview);
      let uploadedUrls = [];
      let photoUploadFailed = false;

      for (const photo of form.photos) {
        try {
          const fileName = `${Date.now()}_${uid()}.jpg`;
          const { data, error: uploadError } = await supabase.storage
            .from('laundry')
            .upload(fileName, photo.blob, { contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage
            .from('laundry')
            .getPublicUrl(data.path);
          uploadedUrls.push(urlData.publicUrl);
        } catch {
          photoUploadFailed = true;
        }
      }

      const linenReadable = {};
      for (const [id, qty] of Object.entries(form.linen)) {
        if (id === "_no_linen") { linenReadable._no_linen = true; continue; }
        const item = linen.find(l => l.id === id);
        const key = item ? `${item.icon} ${item.label}` : id;
        linenReadable[key] = qty;
      }

      const record = {
        apartment:   form.apartment,
        maid:        form.maid,
        date:        form.date,
        linen:       linenReadable,
        consumables: form.consumables,
        notes:       form.notes,
        photos:      photoUploadFailed ? [] : uploadedUrls,
      };

      const result = await addRecord(record, offlinePreviews);

      if (result.offline) {
        setSavedMsg("📱 Сохранено офлайн — синхронизируется при подключении");
      } else {
        setSavedMsg("✓ Запись сохранена!");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setForm({ date: today(), apartment: "", maid: "", linen: {}, consumables: "", notes: "", photos: [] });
      setAptSearch("");
      setStep(1);
    } catch (error) {
      console.error("Помилка збереження:", error);
      alert("Ошибка сохранения: " + error.message);
    } finally {
      setSaving(false);
    }
  };




  
  return (
    <div style={s.page}>
      {saved && <div style={s.savedBanner}>{savedMsg}</div>}

      {step===1 && <>
        <div style={s.sL}>Выберите квартиру</div>
        <div style={{position:"relative",marginBottom:14}}>
          <input autoFocus placeholder="Введите номер или название…" value={aptSearch}
            onChange={e=>setAptSearch(e.target.value)}
            style={{...s.input,paddingLeft:40}}/>
          <span style={s.sIcon}>🔎</span>
        </div>
        {apts.length===0
          ? <div style={s.emptyHint}>Список квартир пуст — добавьте в ⚙️ Настройках</div>
          : <div style={s.aptGrid}>
              {filteredApts.map(apt=>(
                <button key={apt} onClick={()=>selectApt(apt)} style={s.aptBtn}>{apt}</button>
              ))}
              {filteredApts.length===0 && <p style={{color:"#555",fontSize:13,gridColumn:"1/-1",textAlign:"center",padding:"16px 0"}}>Не найдено</p>}
            </div>
        }
      </>}

      {step===2 && <>
        <div style={s.aptHeader}>
          <button onClick={()=>{setStep(1);setForm(f=>({...f,apartment:""}));}} style={s.backBtn}>← Назад</button>
          <div style={s.aptBadge}>🏠 {form.apartment}</div>
        </div>

        <div style={s.row2}>
          <div style={{flex:1}}>
            <div style={s.sL}>Дата</div>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={s.input}/>
          </div>
          <div style={{flex:1}}>
            <div style={s.sL}>Горничная</div>
            <select value={form.maid} onChange={e=>setForm(f=>({...f,maid:e.target.value}))} style={s.input}>
              <option value="">— Выбрать —</option>
              {maids.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {linen.length > 0 && <>
          <div style={s.sL}>Бельё — количество</div>
          <div style={s.linenTable}>
            {linen.map((item,i)=>(
              <div key={item.id} style={{...s.linenRow,background:i%2===0?"var(--bg2)":"var(--bg)"}}>
                <span style={s.linenIcon}>{item.icon}</span>
                <span style={s.linenLabel}>{item.label}</span>
                <input type="number" inputMode="numeric" min="0" placeholder="0"
                  value={form.linen[item.id]??""}
                  onChange={e=>setQty(item.id,e.target.value)}
                  style={s.qtyInput}/>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const cleared = {};
              linen.forEach(item => { cleared[item.id] = 0; });
              setForm(f => ({...f, linen: {...cleared, _no_linen: true}}));
            }}
            style={{
              width:"100%", marginTop:8, padding:"10px 0",
              background: form.linen._no_linen ? "#FFF0F0" : "var(--bg2)",
              border: form.linen._no_linen ? "1.5px solid #FF3B30" : brd,
              borderRadius:12, cursor:"pointer", fontFamily:"inherit",
              fontSize:13, fontWeight:600,
              color: form.linen._no_linen ? "#FF3B30" : "#8E8E93",
              transition:"all 0.15s"
            }}>
            {form.linen._no_linen ? "⚠️ Нет белья!" : "⚠️ Нет белья"}
          </button>
        </>}

        <div style={s.sL}>Фото (необязательно)</div>
        <div style={s.photoRow}>
          {form.photos.map((photo,i)=>(
            <div key={i} style={s.thumbWrap}>
              <img src={photo.preview} alt="" style={s.thumb}/>
              <button onClick={()=>setForm(f=>({...f,photos:f.photos.filter((_,idx)=>idx!==i)}))} style={s.thumbDel}>✕</button>
            </div>
          ))}
          <button onClick={()=>photoRef.current.click()} style={s.addPhotoBtn}>
            📷<br/><span style={{fontSize:11}}>Добавить</span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{display:"none"}}/>
        </div>

        <div style={s.sL}>🔔 Расходники (что заказать)</div>
        <textarea value={form.consumables} onChange={e=>setForm(f=>({...f,consumables:e.target.value}))}
          placeholder="Туалетная бумага, кофе, чай, утенок, Rituals..."
          rows={3} style={{...s.input,resize:"none",lineHeight:1.6}}/>

        <button
          onClick={handleSaveRecord}
          disabled={saving}
          style={{...s.saveBtn, ...(saving ? s.saveBtnOff : {})}}>
          {saving ? "⏳ Сохранение…" : "💾 Сохранить запись"}
        </button>
      </>}
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────
function HistoryTab({ records, deleteRecord, updateRecord, linen, maids, apts }) {
  const [search,setSearch]         = useState("");
  const [dateFilter,setDateFilter] = useState("");
  const [maidFilter,setMaidFilter] = useState("");
  const [expanded,setExpanded]     = useState(null);
  const [delId,setDelId]           = useState(null);
  const [lightbox,setLightbox]     = useState(null);
  const [editRec,setEditRec]       = useState(null);

  const filtered = records
    .filter(r=>{
      const mA = !search     || r.apartment.toLowerCase().includes(search.toLowerCase());
      const mD = !dateFilter || r.date===dateFilter;
      const mM = !maidFilter || r.maid===maidFilter;
      return mA&&mD&&mM;
    })
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const linenTotal = l => Object.values(l||{}).reduce((sum,v)=>sum+(parseInt(v)||0),0);

  async function doDelete() {
    await deleteRecord(delId);
    if (expanded===delId) setExpanded(null);
    setDelId(null);
  }

  const linenMap = Object.fromEntries((linen||[]).map(l=>[l.id,l]));

  if (editRec) {
    return <EditRecordForm record={editRec} linen={linen} maids={maids} apts={apts}
      onSave={async (updates) => {
        const res = await updateRecord(editRec.id, updates);
        if (res.ok) setEditRec(null);
        return res;
      }}
      onCancel={() => setEditRec(null)}
    />;
  }

  return (
    <div style={s.page}>
      <div style={{position:"relative",marginBottom:10}}>
        <input placeholder="Поиск по квартире…" value={search}
          onChange={e=>setSearch(e.target.value)}
          style={{...s.input,paddingLeft:40}}/>
        <span style={s.sIcon}>🔎</span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:0}}>
        <div style={{flex:1,position:"relative"}}>
          <div style={{fontSize:11,color:"#8E8E93",marginBottom:4,fontWeight:600,letterSpacing:0.5}}>ДАТА</div>
          <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
            style={s.input}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:"#8E8E93",marginBottom:4,fontWeight:600,letterSpacing:0.5}}>ГОРНИЧНАЯ</div>
          <select value={maidFilter} onChange={e=>setMaidFilter(e.target.value)}
            style={{...s.input,color:maidFilter?"#1C1C1E":"#8E8E93"}}>
            <option value="">Все</option>
            {(maids||[]).map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      {(search||dateFilter||maidFilter) &&
        <button onClick={()=>{setSearch("");setDateFilter("");setMaidFilter("");}} style={s.clearBtn}>✕ Очистить фильтры</button>}
      <p style={s.countLabel}>{filtered.length} запис{filtered.length===1?"ь":"ей"}</p>

      {filtered.length===0
        ? <div style={s.empty}><div style={{fontSize:44,marginBottom:12}}>🧺</div><p style={{margin:0,color:"#555"}}>Записей нет</p></div>
        : filtered.map(r=>{
          const isOpen=expanded===r.id;
          const total=linenTotal(r.linen);
          const linenEntries = Object.entries(r.linen||{}).filter(([,v])=>parseInt(v)>0);
          return (
            <div key={r.id} style={s.card}>
              <div onClick={()=>setExpanded(isOpen?null:r.id)} style={s.cardHeader}>
                <div>
                  <div style={s.cardApt}>🏠 {r.apartment} {r._offline && <span style={s.pendingPill}>ожидает синхр.</span>}</div>
                  <div style={s.cardMeta}>
                    👤 {r.maid} · 📅 {fmtDate(r.date)}
                    {r.linen?._no_linen && <span style={s.noLinenBadge}>⚠️ Нет белья</span>}
                    {!r.linen?._no_linen && total>0 && <span style={s.cntBadge}>{total} ед.</span>}
                    {r.consumables?.trim() && <span style={s.consumBadge}>🔔</span>}
                    {r.photos?.length>0 && <span style={s.photoBadge}>📷 {r.photos.length}</span>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {!r._offline && <button onClick={e=>{e.stopPropagation();setEditRec(r);}} style={s.editBtn}>✏️</button>}
                  <button onClick={e=>{e.stopPropagation();setDelId(r.id);}} style={s.delBtn}>✕</button>
                  <span style={{color:"#555",fontSize:13}}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>
              {isOpen && <div style={s.cardBody}>
                {r.linen?._no_linen && <div style={{background:"#FFF0F0",border:"1px solid #FFD4D4",borderRadius:12,padding:"10px 14px",textAlign:"center",fontSize:14,fontWeight:600,color:"#FF3B30",marginBottom:8}}>⚠️ Нет белья</div>}
                {!r.linen?._no_linen && linenEntries.length>0 && <>
                  <div style={s.subLabel}>Бельё</div>
                  {linenEntries.map(([key,qty])=>(
                    <div key={key} style={s.linenRowSmall}>
                      <span>{key}</span>
                      <span style={s.qtyBadge}>{qty}</span>
                    </div>
                  ))}
                </>}
                {r.photos?.length>0 && <>
                  <div style={s.subLabel}>Фото — нажмите чтобы открыть</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {r.photos && Array.isArray(r.photos) && r.photos.map((src, i) => (
                      <div key={i} onClick={() => setLightbox(src)} style={s.photoThumbWrap}>
                        <img src={src} alt="" style={s.photoThumb} />
                        <div style={s.photoThumbHint}>🔍</div>
                      </div>
                    ))}
                  </div>
                </>}
                {r.consumables?.trim() && <div style={s.consumBox}>
                  <div style={s.subLabel}>🔔 Нужно заказать</div>
                  <p style={{margin:0,fontSize:13,color:"#e8b84b",lineHeight:1.6}}>{r.consumables}</p>
                </div>}
              </div>}
            </div>
          );
        })
      }
      {delId && <Modal text="Удалить эту запись?" onCancel={()=>setDelId(null)} onConfirm={doDelete}/>}
      {lightbox && <PhotoLightbox src={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}

// ─── TASK TAB (SUPERVISOR) ────────────────────────────────────────
function doPrint(html) {
  let el = document.getElementById('tca-print-zone');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tca-print-zone';
    el.className = 'print-sheet';
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.style.display = 'block';
  setTimeout(() => {
    window.print();
    el.style.display = 'none';
    el.innerHTML = '';
  }, 200);
}

function TaskTab({ apts, linen, syncKey }) {
  const [orders, setOrders] = useState([]);
  const [orderDate, setOrderDate] = useState(today());
  const [editingApt, setEditingApt] = useState(null);
  const [editData, setEditData] = useState({ linen: {}, consumables: "" });
  const [aptSearch, setAptSearch] = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);

  useEffect(() => {
    supabase.from('laundry_store').select('*').eq('key', 'order_history').single()
      .then(({ data }) => { if (data?.value) setHistory(data.value); });
  }, []);

  const filteredApts = apts.filter(a => a.toLowerCase().includes(aptSearch.toLowerCase()));
  const orderApts = orders.map(o => o.apt);

  function addApt(apt) {
    setEditingApt(apt);
    const existing = orders.find(o => o.apt === apt);
    setEditData(existing ? { linen: { ...existing.linen }, consumables: existing.consumables } : { linen: {}, consumables: "" });
    setAptSearch("");
  }

  function setQty(id, val) {
    const num = val === "" ? "" : Math.max(0, parseInt(val) || 0);
    setEditData(prev => ({ ...prev, linen: { ...prev.linen, [id]: num } }));
  }

  function saveAptOrder() {
    const linenEntries = Object.entries(editData.linen).filter(([, v]) => parseInt(v) > 0);
    if (linenEntries.length === 0 && !editData.consumables?.trim()) {
      setEditingApt(null);
      return;
    }
    setOrders(prev => {
      const filtered = prev.filter(o => o.apt !== editingApt);
      return [...filtered, { apt: editingApt, linen: editData.linen, consumables: editData.consumables }]
        .sort((a, b) => a.apt.localeCompare(b.apt, "ru", { numeric: true }));
    });
    setEditingApt(null);
  }

  function removeOrder(apt) {
    setOrders(prev => prev.filter(o => o.apt !== apt));
  }

  function saveToHistory() {
    const entry = { id: uid(), date: orderDate, items: orders, createdAt: new Date().toISOString() };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    syncKey('order_history', updated);
  }

  function deleteHistoryEntry(id) {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    syncKey('order_history', updated);
    if (historyDetail?.id === id) setHistoryDetail(null);
  }

  function buildPrintHtml(date, itemsList) {
    let html = `<div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:6px"><div style="font-size:14px;font-weight:700">Задание на ${fmtDate(date)}</div></div>`;
    for (const { apt, linen: ln, consumables } of itemsList) {
      const items = Object.entries(ln).filter(([, v]) => parseInt(v) > 0);
      const consParts = consumables?.trim() ? consumables.trim().split(/[,;]+/).map(c => c.trim()).filter(Boolean) : [];
      if (items.length === 0 && consParts.length === 0) continue;
      html += `<div style="margin-bottom:10px"><div style="font-size:13px;font-weight:700">${apt}:</div>`;
      for (const [id, qty] of items) {
        const item = linen.find(l => l.id === id);
        html += `<div style="font-size:12px;padding-left:12px">— ${item ? item.label : id} ${qty}</div>`;
      }
      for (const c of consParts) {
        html += `<div style="font-size:12px;padding-left:12px">— ${c}</div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  function handlePrint() {
    saveToHistory();
    doPrint(buildPrintHtml(orderDate, orders));
  }

  function reprintFromHistory(entry) {
    doPrint(buildPrintHtml(entry.date, entry.items));
  }

  if (historyDetail) {
    const e = historyDetail;
    return (
      <div style={s.page}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <button onClick={() => setHistoryDetail(null)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--accent)", padding:0 }}>←</button>
          <div style={{ fontSize:16, fontWeight:700 }}>📋 {fmtDate(e.date)}</div>
        </div>
        {e.items.map(({ apt, linen: ln, consumables }) => {
          const items = Object.entries(ln).filter(([, v]) => parseInt(v) > 0);
          return (
            <div key={apt} style={{ ...s.card, marginBottom:8, padding:"10px 14px" }}>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>🏠 {apt}</div>
              {items.map(([id, qty]) => {
                const item = linen.find(l => l.id === id);
                return <div key={id} style={{ fontSize:12, color:"#555", paddingLeft:8 }}>— {item ? `${item.icon} ${item.label}` : id} {qty}</div>;
              })}
              {consumables?.trim() && <div style={{ fontSize:11, color:"#B8860B", marginTop:4, paddingLeft:8 }}>🔔 {consumables}</div>}
            </div>
          );
        })}
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <button onClick={() => reprintFromHistory(e)} style={{ ...s.saveBtn, flex:1, marginTop:0 }}>🖨️ Печать</button>
          <button onClick={() => { deleteHistoryEntry(e.id); }} style={{ ...s.saveBtn, flex:1, marginTop:0, background:"#FF3B30" }}>🗑 Удалить</button>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div style={s.page}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <button onClick={() => setShowHistory(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--accent)", padding:0 }}>←</button>
          <div style={{ fontSize:16, fontWeight:700 }}>История заказов</div>
        </div>
        {history.length === 0 && (
          <div style={s.empty}>
            <div style={{ fontSize:44, marginBottom:12 }}>📭</div>
            <p style={{ margin:0, color:"#555" }}>Пока нет заказов</p>
          </div>
        )}
        {history.map(entry => (
          <div key={entry.id} onClick={() => setHistoryDetail(entry)}
            style={{ ...s.card, marginBottom:8, padding:"12px 14px", cursor:"pointer" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>📋 {fmtDate(entry.date)}</div>
                <div style={{ fontSize:11, color:"#8E8E93", marginTop:2 }}>
                  {entry.items.length} кв. · {entry.items.map(i => i.apt).join(", ")}
                </div>
              </div>
              <span style={{ color:"#C7C7CC", fontSize:16 }}>›</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (editingApt) {
    return (
      <div style={s.page}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <button onClick={() => setEditingApt(null)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--accent)", padding:0 }}>←</button>
          <div style={{ fontSize:16, fontWeight:700 }}>🏠 {editingApt}</div>
        </div>
        <div style={s.sL}>Бельё</div>
        <div style={s.card}>
          <div style={{ padding:"8px 14px" }}>
            {linen.map((item, i) => (
              <div key={item.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom: i < linen.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                <span style={{ fontSize:13 }}>{item.icon} {item.label}</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <button onClick={() => setQty(item.id, (parseInt(editData.linen[item.id]) || 0) - 1)} style={s.qtyBtn}>−</button>
                  <input value={editData.linen[item.id] ?? ""} onChange={e => setQty(item.id, e.target.value)}
                    style={{ ...s.qtyInput, width:40 }} inputMode="numeric"/>
                  <button onClick={() => setQty(item.id, (parseInt(editData.linen[item.id]) || 0) + 1)} style={s.qtyBtn}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...s.sL, marginTop:16 }}>Расходники</div>
        <textarea value={editData.consumables} onChange={e => setEditData(prev => ({ ...prev, consumables: e.target.value }))}
          placeholder="Туалетная бумага, кофе, чай..."
          rows={2} style={{ ...s.input, resize:"none", fontSize:13 }}/>
        <button onClick={saveAptOrder} style={{ ...s.saveBtn, marginTop:16 }}>
          ✓ Добавить
        </button>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.sL}>Дата заказа</div>
      <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
        style={{ ...s.input, marginBottom:14, fontSize:14 }}/>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={s.sL}>Добавить квартиру</div>
        <button onClick={() => setShowHistory(true)} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", padding:"0 0 4px" }}>
          📜 История ({history.length})
        </button>
      </div>
      <input value={aptSearch} onChange={e => setAptSearch(e.target.value)}
        placeholder="🔍 Поиск квартиры..."
        style={{ ...s.input, marginBottom:10 }}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16, maxHeight:180, overflowY:"auto" }}>
        {filteredApts.filter(a => !orderApts.includes(a)).map(a => (
          <button key={a} onClick={() => addApt(a)} style={{
            padding:"10px 4px", borderRadius:12, border: brd,
            background:"var(--bg2)", color:"#1C1C1E",
            fontWeight:500, fontSize:13, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s"
          }}>{a}</button>
        ))}
      </div>

      {orders.length > 0 && <>
        <div style={s.sL}>Добавлено ({orders.length})</div>
        {orders.map(({ apt, linen: ln, consumables }) => {
          const items = Object.entries(ln).filter(([, v]) => parseInt(v) > 0);
          const summary = items.map(([id, qty]) => {
            const item = linen.find(l => l.id === id);
            return `${item ? item.icon : ""} ${qty}`;
          }).join("  ");
          return (
            <div key={apt} style={{ ...s.card, marginBottom:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }} onClick={() => addApt(apt)}>
                <div style={{ fontWeight:600, fontSize:14 }}>🏠 {apt}</div>
                <div style={{ fontSize:11, color:"#8E8E93", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {summary}{consumables?.trim() ? ` 🔔` : ""}
                </div>
              </div>
              <button onClick={() => removeOrder(apt)} style={{ background:"none", border:"none", color:"#C7C7CC", cursor:"pointer", fontSize:16 }}>✕</button>
            </div>
          );
        })}

        <button onClick={handlePrint} style={{ ...s.saveBtn, marginTop:16 }} className="no-print">
          🖨️ Печать ({orders.length} кв.)
        </button>
      </>}

      {orders.length === 0 && !aptSearch && (
        <div style={s.empty}>
          <div style={{ fontSize:44, marginBottom:12 }}>📋</div>
          <p style={{ margin:0, color:"#555" }}>Выберите квартиры и заполните задание</p>
        </div>
      )}
    </div>
  );
}

function EditRecordForm({ record, linen, maids, apts, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    const linenById = {};
    const recLinen = record.linen || {};
    for (const [key, qty] of Object.entries(recLinen)) {
      if (key === "_no_linen") { linenById._no_linen = true; continue; }
      const item = linen.find(l => `${l.icon} ${l.label}` === key);
      linenById[item ? item.id : key] = qty;
    }
    return {
      apartment: record.apartment || "",
      maid: record.maid || "",
      date: record.date || today(),
      linen: linenById,
      consumables: record.consumables || "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setQty(id, val) {
    const num = val === "" ? "" : Math.max(0, parseInt(val) || 0);
    setForm(f => {
      const newLinen = { ...f.linen, [id]: num };
      delete newLinen._no_linen;
      return { ...f, linen: newLinen };
    });
  }

  async function handleSave() {
    if (!form.apartment || !form.maid) { alert("Выберите квартиру и сотрудника!"); return; }
    setSaving(true);
    const linenReadable = {};
    for (const [id, qty] of Object.entries(form.linen)) {
      if (id === "_no_linen") { linenReadable._no_linen = true; continue; }
      const item = linen.find(l => l.id === id);
      const key = item ? `${item.icon} ${item.label}` : id;
      linenReadable[key] = qty;
    }
    const res = await onSave({
      apartment: form.apartment,
      maid: form.maid,
      date: form.date,
      linen: linenReadable,
      consumables: form.consumables,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert("Ошибка сохранения");
    }
  }

  return (
    <div style={s.page}>
      <button onClick={onCancel} style={{...s.backBtn, marginBottom:16, fontSize:14}}>← Назад</button>
      {saved && <div style={s.savedBanner}>✓ Изменения сохранены!</div>}

      <div style={s.sL}>🏠 Квартира</div>
      <select value={form.apartment} onChange={e => setForm(f => ({...f, apartment: e.target.value}))} style={{...s.input, marginBottom:14, color: form.apartment ? "#1C1C1E" : "#8E8E93"}}>
        <option value="">Выберите…</option>
        {(apts||[]).map(a => <option key={a} value={a}>{a}</option>)}
      </select>

      <div style={s.sL}>👤 Сотрудник</div>
      <select value={form.maid} onChange={e => setForm(f => ({...f, maid: e.target.value}))} style={{...s.input, marginBottom:14, color: form.maid ? "#1C1C1E" : "#8E8E93"}}>
        <option value="">Выберите…</option>
        {(maids||[]).map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      <div style={s.sL}>📅 Дата</div>
      <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} style={{...s.input, marginBottom:14}}/>

      <div style={s.sL}>🛏 Бельё</div>
      <div style={{...s.linenTable, marginBottom:14}}>
        {(linen||[]).map((item, i) => (
          <div key={item.id} style={{...s.linenRow, background: i % 2 === 0 ? "var(--bg2)" : "var(--bg)"}}>
            <span style={s.linenLabel}>{item.icon} {item.label}</span>
            <div style={s.linenQty}>
              <button onClick={() => setQty(item.id, (parseInt(form.linen[item.id]) || 0) - 1)} style={s.qtyBtn}>−</button>
              <input value={form.linen[item.id] ?? ""} onChange={e => setQty(item.id, e.target.value)} style={s.qtyInput} inputMode="numeric"/>
              <button onClick={() => setQty(item.id, (parseInt(form.linen[item.id]) || 0) + 1)} style={s.qtyBtn}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div style={s.sL}>🔔 Нужно заказать</div>
      <textarea value={form.consumables} onChange={e => setForm(f => ({...f, consumables: e.target.value}))} rows={2} placeholder="Туалетная бумага, кофе, чай, утенок, Rituals..." style={{...s.input, resize:"vertical", marginBottom:14}}/>


      <button onClick={handleSave} disabled={saving} style={{...s.saveBtn, ...(saving ? s.saveBtnOff : {})}}>
        {saving ? "Сохраняю…" : "💾 Сохранить изменения"}
      </button>
    </div>
  );
}

// ─── PHOTO LIGHTBOX ───────────────────────────────────────────────
function PhotoLightbox({ src, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={s.lightboxOverlay}>
      <button onClick={onClose} style={s.lightboxClose}>✕</button>
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        style={s.lightboxImg}
      />
    </div>
  );
}

// ─── SETTINGS TAB ────────────────────────────────────────────────
function SettingsTab({ apts, saveApts, maids, saveMaids, linen, saveLinen, theme, saveTheme, bgTheme, saveBgTheme, bgImage, saveBgImage, onLock }) {
  const [section,    setSection]    = useState("apts");
  const [showThemes, setShowThemes] = useState(false);
  const [draftApts,  setDraftApts]  = useState(() => apts);
  const [draftMaids, setDraftMaids] = useState(() => maids);
  const [draftLinen, setDraftLinen] = useState(() => linen);
  const [saved,      setSaved]      = useState(false);

  const dirty =
    JSON.stringify(draftApts)  !== JSON.stringify(apts)  ||
    JSON.stringify(draftMaids) !== JSON.stringify(maids) ||
    JSON.stringify(draftLinen) !== JSON.stringify(linen);

  function handleSave() {
    saveApts(draftApts);
    saveMaids(draftMaids);
    saveLinen(draftLinen);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleDiscard() {
    setDraftApts(apts);
    setDraftMaids(maids);
    setDraftLinen(linen);
  }

  if (showThemes) {
    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    const currentBg = BG_THEMES.find(t => t.id === bgTheme) || BG_THEMES[0];
    return (
      <div style={s.page}>
        <button onClick={() => setShowThemes(false)} style={{...s.backBtn, marginBottom:16, fontSize:14}}>
          ← Назад
        </button>

        <div style={s.sL}>🎨 Цвет акцента</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
          {THEMES.map(t=>(
            <button key={t.id} onClick={()=>saveTheme(t.id)} style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:6,
              background: theme===t.id ? t.dim : "var(--bg2)",
              border: `2px solid ${theme===t.id ? t.accent : "rgba(0,0,0,0.06)"}`,
              borderRadius:14, padding:"12px 14px", cursor:"pointer", fontFamily:"inherit",
              transition:"all 0.2s", minWidth:60,
              boxShadow: theme===t.id ? `0 2px 8px ${t.accent}30` : "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${t.accent},${t.dark})`}}/>
              <span style={{fontSize:11,color: theme===t.id ? t.dark : "#8E8E93", fontWeight: theme===t.id ? 600 : 400}}>{t.label}</span>
            </button>
          ))}
        </div>

        <div style={s.sL}>🌤 Цвет фона</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
          {BG_THEMES.map(t=>(
            <button key={t.id} onClick={()=>saveBgTheme(t.id)} style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:6,
              background: bgTheme===t.id ? "var(--accent-dim)" : "var(--bg2)",
              border: `2px solid ${bgTheme===t.id ? "var(--accent)" : "rgba(0,0,0,0.06)"}`,
              borderRadius:14, padding:"12px 14px", cursor:"pointer", fontFamily:"inherit",
              transition:"all 0.2s", minWidth:60,
              boxShadow: bgTheme===t.id ? "0 2px 8px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{width:28,height:28,borderRadius:"50%",background:t.bg,border:"1px solid rgba(0,0,0,0.08)"}}/>
              <span style={{fontSize:11,color: bgTheme===t.id ? "var(--accent-dark)" : "#8E8E93", fontWeight: bgTheme===t.id ? 600 : 400}}>{t.label}</span>
            </button>
          ))}
        </div>

      </div>
    );
  }

  return (
    <div style={s.page}>
      {saved && <div style={s.savedBanner}>✓ Настройки сохранены!</div>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        {dirty
          ? <button onClick={handleDiscard} style={s.discardBtn}>↩ Отменить</button>
          : <div/>
        }
        <button onClick={onLock} style={s.lockBtn}>🔒 Заблокировать</button>
      </div>

      <button onClick={() => setShowThemes(true)} style={s.themeMenuBtn}>
        <span style={{fontSize:18}}>🎨</span>
        <div style={{flex:1,textAlign:"left"}}>
          <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>Оформление</div>
          <div style={{fontSize:12,color:"#8E8E93"}}>{(THEMES.find(t=>t.id===theme)||THEMES[0]).label} · {(BG_THEMES.find(t=>t.id===bgTheme)||BG_THEMES[0]).label}</div>
        </div>
        <span style={{color:"#C7C7CC",fontSize:16}}>›</span>
      </button>

      <div style={{...s.sectionTabs, marginTop:18}}>
        {[["apts","🏠 Квартиры"],["maids","👤 Горничные"],["linen","🧺 Бельё"]].map(([key,label])=>(
          <button key={key} onClick={()=>setSection(key)}
            style={{...s.sectionTab,...(section===key?s.sectionTabActive:{})}}>
            {label}
          </button>
        ))}
      </div>

      {section==="apts"  && <ListEditor items={draftApts}  saveItems={setDraftApts}  addPlaceholder="Номер / название…" sortAlpha />}
      {section==="maids" && <ListEditor items={draftMaids} saveItems={setDraftMaids} addPlaceholder="Имя горничной…" />}
      {section==="linen" && <LinenEditor linen={draftLinen} saveLinen={setDraftLinen}/>}

      <button
        onClick={handleSave}
        disabled={!dirty}
        style={{...s.saveBtn, marginTop:28, ...(!dirty ? s.saveBtnOff : {})}}>
        💾 Сохранить настройки
      </button>
    </div>
  );
}

// ─── LIST EDITOR ─────────────────────────────────────────────────
function ListEditor({ items, saveItems, addPlaceholder, sortAlpha }) {
  const [input,   setInput]   = useState("");
  const [importT, setImportT] = useState("");
  const [showImp, setShowImp] = useState(false);
  const [delItem, setDelItem] = useState(null);

  function add() {
    const v=input.trim();
    if (!v||items.includes(v)) return;
    const next = [...items,v];
    saveItems(sortAlpha ? next.sort((a,b)=>a.localeCompare(b,"ru",{numeric:true})) : next);
    setInput("");
  }

  function doImport() {
    const lines = importT.split(/[\n,;]+/).map(l=>l.trim()).filter(Boolean);
    const merged = [...new Set([...items,...lines])];
    saveItems(sortAlpha ? merged.sort((a,b)=>a.localeCompare(b,"ru",{numeric:true})) : merged);
    setImportT(""); setShowImp(false);
  }

  return (
    <div style={{marginTop:16}}>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
        <button onClick={()=>setShowImp(!showImp)} style={s.importBtn}>
          📋 Вставить список
        </button>
      </div>

      {showImp && <div style={s.importBox}>
        <div style={{fontSize:12,color:"#888",marginBottom:8}}>
          Вставьте список через запятую, «;» или с новой строки:
        </div>
        <textarea value={importT} onChange={e=>setImportT(e.target.value)}
          placeholder={"101, 102, 103\n201, 202"} rows={5}
          style={{...s.input,resize:"none",lineHeight:1.6,marginBottom:10}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setShowImp(false);setImportT("");}} style={s.cancelSmall}>Отмена</button>
          <button onClick={doImport} style={s.confirmSmall}>Добавить</button>
        </div>
      </div>}

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <input placeholder={addPlaceholder} value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&add()}
          style={{...s.input,flex:1}}/>
        <button onClick={add} style={s.addBtn}>+ Добавить</button>
      </div>

      <div style={s.listBox}>
        {items.length===0
          ? <div style={{...s.emptyHint,border:"none"}}>Список пуст</div>
          : items.map(item=>(
            <div key={item} style={s.listRow}>
              <span style={s.listLabel}>{item}</span>
              <button onClick={()=>setDelItem(item)} style={s.rowDelBtn}>✕</button>
            </div>
          ))
        }
      </div>

      {delItem && <Modal text={`Удалить "${delItem}"?`}
        onCancel={()=>setDelItem(null)}
        onConfirm={()=>{saveItems(items.filter(i=>i!==delItem));setDelItem(null);}}/>}
    </div>
  );
}

// ─── LINEN EDITOR ────────────────────────────────────────────────
const ICON_OPTIONS = ["🛏","🪽","☁️","🧺","🫶🏻","🦵🏼","💗","🐾","🍓","🍽️","🍍","🍑","🛁","✨","🌸","🦄"];

function LinenEditor({ linen, saveLinen }) {
  const [newLabel, setNewLabel]         = useState("");
  const [newIcon,  setNewIcon]          = useState("🛏");
  const [editId,   setEditId]           = useState(null);
  const [editLabel,setEditLabel]        = useState("");
  const [delId,    setDelId]            = useState(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  function addItem() {
    const v=newLabel.trim();
    if (!v) return;
    saveLinen([...linen,{id:uid(),label:v,icon:newIcon}]);
    setNewLabel(""); setNewIcon("🛏");
  }

  function startEdit(item) { setEditId(item.id); setEditLabel(item.label); }

  function saveEdit() {
    const v=editLabel.trim();
    if (!v) return;
    saveLinen(linen.map(l=>l.id===editId?{...l,label:v}:l));
    setEditId(null);
  }

  function moveUp(i)   { if(i===0)return; const n=[...linen];[n[i-1],n[i]]=[n[i],n[i-1]];saveLinen(n); }
  function moveDown(i) { if(i===linen.length-1)return; const n=[...linen];[n[i],n[i+1]]=[n[i+1],n[i]];saveLinen(n); }

  return (
    <div style={{marginTop:16}}>
      <div style={s.linenAddBox}>
        <div style={{fontSize:12,color:"#888",marginBottom:10,letterSpacing:0.5}}>ДОБАВИТЬ ПОЗИЦИЮ</div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:"#8E8E93",marginBottom:6}}>Иконка:</div>
          <button onClick={()=>setShowIconPicker(!showIconPicker)}
            style={{...s.iconPickerBtn, borderColor: showIconPicker?"var(--accent)":"rgba(0,0,0,0.08)"}}>
            <span style={{fontSize:20}}>{newIcon}</span>
            <span style={{fontSize:11,color:"#8E8E93"}}>▼</span>
          </button>
          {showIconPicker && (
            <div style={s.iconGrid}>
              {ICON_OPTIONS.map(ic=>(
                <button key={ic} onClick={()=>{setNewIcon(ic);setShowIconPicker(false);}}
                  style={{...s.iconBtn,...(newIcon===ic?s.iconBtnActive:{})}}>
                  {ic}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:8}}>
          <input placeholder="Название (напр. Наволочка)" value={newLabel}
            onChange={e=>setNewLabel(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addItem()}
            style={{...s.input,flex:1}}/>
          <button onClick={addItem} style={s.addBtn}>+</button>
        </div>
      </div>

      <div style={s.listBox}>
        {linen.length===0
          ? <div style={{...s.emptyHint,border:"none"}}>Список пуст</div>
          : linen.map((item,i)=>(
            <div key={item.id} style={{...s.linenEditRow, background:i%2===0?"var(--bg2)":"var(--bg)"}}>
              <div style={{display:"flex",flexDirection:"column",gap:1,marginRight:8}}>
                <button onClick={()=>moveUp(i)}   style={s.arrowBtn} disabled={i===0}>▲</button>
                <button onClick={()=>moveDown(i)} style={s.arrowBtn} disabled={i===linen.length-1}>▼</button>
              </div>

              <span style={{fontSize:18,marginRight:10,flexShrink:0}}>{item.icon}</span>

              {editId===item.id
                ? <input value={editLabel} onChange={e=>setEditLabel(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter")saveEdit(); if(e.key==="Escape")setEditId(null); }}
                    autoFocus
                    style={{...s.input,flex:1,padding:"6px 10px",fontSize:13}}/>
                : <span style={{flex:1,fontSize:13,color:"#bbb"}}>{item.label}</span>
              }

              <div style={{display:"flex",gap:6,marginLeft:8}}>
                {editId===item.id
                  ? <button onClick={saveEdit} style={s.editSaveBtn}>✓</button>
                  : <button onClick={()=>startEdit(item)} style={s.editBtn}>✏️</button>
                }
                <button onClick={()=>setDelId(item.id)} style={s.rowDelBtn}>✕</button>
              </div>
            </div>
          ))
        }
      </div>
      <div style={{fontSize:11,color:"#555",marginTop:8,textAlign:"center"}}>
        ▲▼ — менять порядок · ✏️ — переименовать
      </div>

      {delId && <Modal text="Удалить эту позицию белья?"
        onCancel={()=>setDelId(null)}
        onConfirm={()=>{saveLinen(linen.filter(l=>l.id!==delId));setDelId(null);}}/>}
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────
function Modal({ text, onCancel, onConfirm }) {
  return (
    <div style={s.modal}>
      <div style={s.modalBox}>
        <p style={{margin:"0 0 20px",textAlign:"center",fontSize:15}}>{text}</p>
        <div style={{display:"flex",gap:12}}>
          <button onClick={onCancel}  style={s.modalCancel}>Отмена</button>
          <button onClick={onConfirm} style={s.modalDelete}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────
const brd = "1px solid rgba(0,0,0,0.06)";
const s = {
  shell:           { minHeight:"100vh", background:"var(--bg3)", display:"flex", justifyContent:"center", position:"relative" },
  root:            { minHeight:"100vh", background:"var(--bg)", color:"#1C1C1E", fontFamily:"'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", width:"100%", maxWidth:480, paddingBottom:70, position:"relative", zIndex:1 },
  header:          { display:"flex", alignItems:"center", gap:12, padding:"18px 20px 14px", background:"var(--bg)", borderBottom:brd, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" },
  headerTitle:     { fontSize:22, fontWeight:700, letterSpacing:-0.3, color:"#1C1C1E" },
  headerSub:       { fontSize:11, color:"#8E8E93", letterSpacing:0.6, textTransform:"uppercase", fontWeight:500 },
  tabBar:          { display:"flex", borderBottom:brd, position:"sticky", top:56, zIndex:9, background:"var(--bg)", padding:"0 16px" },
  tab:             { flex:1, padding:"10px 0", background:"transparent", border:"none", borderBottom:"2.5px solid transparent", color:"#8E8E93", fontSize:13, fontFamily:"inherit", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, transition:"all 0.2s", fontWeight:500 },
  tabActive:       { borderBottom:"2.5px solid var(--accent)", color:"var(--accent)", fontWeight:600 },
  page:            { padding:"20px 16px" },
  sL:              { fontSize:11, color:"#8E8E93", textTransform:"uppercase", letterSpacing:0.8, marginBottom:8, marginTop:18, fontWeight:600 },
  input:           { width:"100%", padding:"12px 14px", background:"var(--bg2)", border:brd, borderRadius:12, color:"#1C1C1E", fontSize:15, fontFamily:"inherit", boxSizing:"border-box", outline:"none", WebkitAppearance:"none", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  sIcon:           { position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" },
  aptGrid:         { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 },
  aptBtn:          { padding:"12px 4px", background:"var(--bg2)", border:brd, borderRadius:12, color:"#1C1C1E", fontSize:14, fontFamily:"inherit", cursor:"pointer", fontWeight:500, boxShadow:"0 1px 3px rgba(0,0,0,0.04)", transition:"all 0.15s" },
  aptHeader:       { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 },
  aptBadge:        { background:"var(--accent-dim)", border:"none", borderRadius:20, padding:"6px 14px", fontSize:14, color:"var(--accent-dark)", fontWeight:600 },
  backBtn:         { background:"none", border:"none", color:"var(--accent)", fontSize:13, cursor:"pointer", fontFamily:"inherit", padding:0, fontWeight:500 },
  row2:            { display:"flex", gap:12 },
  linenTable:      { borderRadius:12, border:brd, overflow:"hidden", background:"var(--bg2)", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  linenRow:        { display:"flex", alignItems:"center", padding:"11px 14px", borderBottom:"1px solid rgba(0,0,0,0.04)", gap:10 },
  linenIcon:       { fontSize:15, width:22, textAlign:"center", flexShrink:0 },
  linenLabel:      { flex:1, fontSize:14, color:"#3A3A3C", lineHeight:1.3 },
  qtyInput:        { width:52, padding:"8px 6px", background:"var(--bg)", border:brd, borderRadius:10, color:"#1C1C1E", fontSize:16, fontFamily:"inherit", textAlign:"center", outline:"none", WebkitAppearance:"none", MozAppearance:"textfield", fontWeight:600 },
  photoRow:        { display:"flex", flexWrap:"wrap", gap:10, marginBottom:4 },
  thumbWrap:       { position:"relative", width:72, height:72 },
  thumb:           { width:72, height:72, objectFit:"cover", borderRadius:12, border:brd },
  thumbDel:        { position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#FF3B30", border:"2px solid var(--bg2)", color:"#fff", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 },
  photoThumbWrap:  { position:"relative", width:90, height:90, cursor:"pointer", borderRadius:12, overflow:"hidden", border:brd, flexShrink:0 },
  photoThumb:      { width:90, height:90, objectFit:"cover", display:"block" },
  photoThumbHint:  { position:"absolute", bottom:0, right:0, width:24, height:24, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, borderTopLeftRadius:8 },
  lightboxOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16, cursor:"pointer" },
  lightboxImg:     { maxWidth:"100%", maxHeight:"100%", objectFit:"contain", borderRadius:12, cursor:"default", boxShadow:"0 8px 40px rgba(0,0,0,0.5)" },
  lightboxClose:   { position:"fixed", top:16, right:16, width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.18)", border:"none", color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:201 },
  addPhotoBtn:     { width:72, height:72, background:"var(--bg2)", border:"1.5px dashed #C7C7CC", borderRadius:12, color:"#8E8E93", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 },
  saveBtn:         { width:"100%", marginTop:20, padding:16, background:"var(--accent-grad)", border:"none", borderRadius:14, color:"#fff", fontSize:16, fontFamily:"inherit", fontWeight:600, cursor:"pointer", letterSpacing:-0.2, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" },
  saveBtnOff:      { background:"var(--bg3)", color:"#C7C7CC", cursor:"not-allowed", boxShadow:"none" },
  savedBanner:     { background:"#E8F9ED", border:"none", color:"#34C759", borderRadius:12, padding:"12px 16px", textAlign:"center", fontSize:14, marginBottom:16, fontWeight:600 },
  emptyHint:       { background:"var(--bg2)", border:"1.5px dashed #C7C7CC", borderRadius:12, padding:"16px", textAlign:"center", fontSize:13, color:"#8E8E93" },
  clearBtn:        { background:"none", border:"none", color:"var(--accent)", fontSize:12, cursor:"pointer", padding:"6px 0", fontFamily:"inherit", fontWeight:500 },
  countLabel:      { fontSize:12, color:"#8E8E93", margin:"10px 0 12px" },
  empty:           { textAlign:"center", padding:"60px 0" },
  card:            { background:"var(--bg2)", borderRadius:14, border:brd, marginBottom:10, overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  cardHeader:      { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px", cursor:"pointer" },
  cardApt:         { fontWeight:600, fontSize:15, marginBottom:4, color:"#1C1C1E" },
  cardMeta:        { fontSize:12, color:"#8E8E93", display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" },
  cntBadge:        { background:"var(--accent-dim)", color:"var(--accent-dark)", borderRadius:10, padding:"2px 8px", fontSize:11, fontWeight:500 },
  consumBadge:     { background:"#FFF3CD", color:"#B8860B", borderRadius:10, padding:"2px 7px", fontSize:11, fontWeight:500 },
  photoBadge:      { background:"#E8F9ED", color:"#34C759", borderRadius:10, padding:"2px 8px", fontSize:11, fontWeight:500 },
  noLinenBadge:    { background:"#FFF0F0", color:"#FF3B30", borderRadius:10, padding:"2px 8px", fontSize:11, fontWeight:600 },
  editBtn:         { background:"none", border:"none", cursor:"pointer", fontSize:14, padding:0 },
  delBtn:          { background:"none", border:"none", color:"#C7C7CC", cursor:"pointer", fontSize:15, padding:0 },
  cardBody:        { padding:"12px 14px 14px", borderTop:"1px solid rgba(0,0,0,0.04)" },
  subLabel:        { fontSize:11, color:"#8E8E93", textTransform:"uppercase", letterSpacing:0.8, marginBottom:6, marginTop:12, fontWeight:600 },
  linenRowSmall:   { display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, color:"#3A3A3C", padding:"5px 0", borderBottom:"1px solid rgba(0,0,0,0.04)" },
  qtyBadge:        { background:"var(--accent-dim)", color:"var(--accent-dark)", borderRadius:8, padding:"2px 10px", fontSize:13, fontWeight:600 },
  consumBox:       { background:"#FFFBF0", border:"1px solid #F0E6CC", borderRadius:10, padding:"10px 12px", marginTop:10 },
  syncPill:        { fontSize:11, color:"#34C759", background:"#E8F9ED", border:"none", borderRadius:20, padding:"4px 10px", transition:"opacity 0.4s", whiteSpace:"nowrap", fontWeight:500 },
  offlinePill:     { fontSize:11, color:"#FF9500", background:"#FFF3CD", border:"none", borderRadius:20, padding:"4px 10px", whiteSpace:"nowrap", fontWeight:500 },
  pendingPill:     { fontSize:11, color:"#5856D6", background:"#EDEDFA", border:"none", borderRadius:20, padding:"4px 10px", whiteSpace:"nowrap", fontWeight:500 },
  themeMenuBtn:    { display:"flex", alignItems:"center", gap:12, width:"100%", padding:"14px 16px", background:"var(--bg2)", border:brd, borderRadius:14, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 1px 3px rgba(0,0,0,0.04)", transition:"all 0.15s" },
  discardBtn:      { background:"none", border:"1px solid var(--accent-dim)", borderRadius:10, color:"var(--accent)", fontSize:12, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontWeight:500 },
  lockBtn:         { background:"none", border:brd, borderRadius:10, color:"#8E8E93", fontSize:12, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontWeight:500 },
  sectionTabs:     { display:"flex", gap:8, marginBottom:4 },
  sectionTab:      { flex:1, padding:"10px 6px", background:"var(--bg2)", border:brd, borderRadius:10, color:"#8E8E93", fontSize:12, fontFamily:"inherit", cursor:"pointer", transition:"all 0.2s", fontWeight:500 },
  sectionTabActive:{ background:"var(--accent-dim)", border:"1px solid var(--accent)", color:"var(--accent-dark)", fontWeight:600 },
  importBtn:       { background:"var(--bg2)", border:brd, borderRadius:10, color:"var(--accent)", fontSize:12, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontWeight:500 },
  importBox:       { background:"var(--bg)", border:brd, borderRadius:12, padding:14, marginBottom:14 },
  addBtn:          { padding:"11px 14px", background:"var(--accent-grad)", border:"none", borderRadius:10, color:"#fff", fontSize:13, fontFamily:"inherit", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" },
  listBox:         { background:"var(--bg2)", borderRadius:12, border:brd, overflow:"hidden", maxHeight:320, overflowY:"auto", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  listRow:         { display:"flex", alignItems:"center", padding:"11px 14px", borderBottom:"1px solid rgba(0,0,0,0.04)" },
  listLabel:       { flex:1, fontSize:14, color:"#1C1C1E" },
  rowDelBtn:       { background:"none", border:"none", color:"#C7C7CC", fontSize:14, cursor:"pointer", padding:"0 4px" },
  cancelSmall:     { flex:1, padding:"9px 0", background:"var(--bg2)", border:brd, borderRadius:10, color:"#8E8E93", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:500 },
  confirmSmall:    { flex:1, padding:"9px 0", background:"var(--accent-grad)", border:"none", borderRadius:10, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 },
  linenAddBox:     { background:"var(--bg2)", border:brd, borderRadius:12, padding:14, marginBottom:14 },
  linenEditRow:    { display:"flex", alignItems:"center", padding:"9px 12px", borderBottom:"1px solid rgba(0,0,0,0.04)" },
  arrowBtn:        { background:"none", border:"none", color:"#C7C7CC", fontSize:11, cursor:"pointer", padding:"1px 3px", lineHeight:1, display:"block" },
  editBtn:         { background:"none", border:"none", fontSize:14, cursor:"pointer", padding:"0 2px" },
  editSaveBtn:     { background:"#E8F9ED", border:"none", color:"#34C759", borderRadius:8, fontSize:13, cursor:"pointer", padding:"3px 10px", fontFamily:"inherit", fontWeight:600 },
  iconPickerBtn:   { display:"flex", alignItems:"center", gap:8, background:"var(--bg2)", border:brd, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontFamily:"inherit" },
  iconGrid:        { display:"flex", flexWrap:"wrap", gap:6, background:"var(--bg)", border:brd, borderRadius:12, padding:10, marginTop:6 },
  iconBtn:         { width:36, height:36, background:"var(--bg2)", border:brd, borderRadius:10, fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  iconBtnActive:   { background:"var(--accent-dim)", border:"1px solid var(--accent)" },
  modal:           { position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:24 },
  modalBox:        { background:"var(--bg2)", borderRadius:16, padding:24, border:brd, width:"100%", maxWidth:300, boxShadow:"0 10px 40px rgba(0,0,0,0.12)" },
  modalCancel:     { flex:1, padding:12, borderRadius:12, background:"var(--bg)", border:brd, color:"#8E8E93", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:500 },
  modalDelete:     { flex:1, padding:12, borderRadius:12, background:"#FFE5E5", border:"none", color:"#FF3B30", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:600 },
};
