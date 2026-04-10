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

function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if (!d) return "";
  const [y,m,dd] = d.split("-");
  return `${dd}.${m}.${y}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function compressImage(file, maxPx = 1400, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
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
  const [syncBanner, setSyncBanner] = useState(false);
  const [online, setOnline]   = useState(true);

  // ЗАВАНТАЖЕННЯ ДАНИХ З SUPABASE ПРИ ЗАПУСКУ
        useEffect(() => {
          const fetchHistory = async () => {
            const { data, error } = await supabase
              .from('laundry_records')
              .select('*')
              .order('created_at', { ascending: false });

            if (!error && data) {
              // Заміни setRecords на назву своєї функції оновлення історії
              // Зазвичай це setRecords або setHistory
              setRecords(data); 
            }
          };
          fetchHistory();
        }, []); //

  function showSync() {
    setSyncBanner(true);
    setTimeout(() => setSyncBanner(false), 2500);
  }

  // ФУНКЦІЇ СИНХРОНІЗАЦІЇ З SUPABASE
  async function syncWithDB(key, value) {
    try {
      const { error } = await supabase
        .from('laundry_store')
        .upsert({ key: key, value: value });

      if (error) throw error;
      showSync();
    } catch (err) {
      console.error("Помилка синхронізації:", err);
      setOnline(false);
    }
  }

  function saveRecords(list) { setRecords(list); syncWithDB("records", list); }
  function saveApts(list)    { const sorted = [...list].sort((a,b)=>a.localeCompare(b,"ru",{numeric:true})); setApts(sorted); syncWithDB("apts", sorted); }
  function saveMaids(list)   { setMaids(list); syncWithDB("maids", list); }
  function saveLinen(list)   { setLinen(list); syncWithDB("linen", list); }

  if (!apts || !maids || !linen) return (
    <div style={{...s.root,display:"flex",alignItems:"center",justifyContent:"center",color:"#555"}}>Загрузка…</div>
  );

  return (
    <div style={s.root}>
      <div style={s.header}>
        <span style={{fontSize:26}}>🧺</span>
        <div style={{flex:1}}>
          <div style={s.headerTitle}>Учёт белья</div>
          <div style={s.headerSub}>Журнал прачечной</div>
        </div>
        {!online && <div style={s.offlinePill}>⚠️ Офлайн (проблема с БД)</div>}
        {online  && <div style={{...s.syncPill, opacity: syncBanner ? 1 : 0}}>🔄 Данные сохранены</div>}
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

      {tab==="log"     && <LogTab records={records} saveRecords={saveRecords} apts={apts} maids={maids} linen={linen}/>}
      {tab==="history" && <HistoryTab records={records} saveRecords={saveRecords} linen={linen}/>}
      {tab==="settings" && (
        settingsUnlocked
          ? <SettingsTab apts={apts} saveApts={saveApts} maids={maids} saveMaids={saveMaids} linen={linen} saveLinen={saveLinen} onLock={()=>setSettingsUnlocked(false)}/>
          : <PasswordGate onUnlock={()=>setSettingsUnlocked(true)}/>
      )}
    </div>
  );
}

// ─── PASSWORD GATE ───────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
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
      <div style={{fontSize:17, fontWeight:"bold", marginBottom:6}}>Настройки защищены</div>
      <div style={{fontSize:13, color:"#666", marginBottom:32}}>Введите пароль для доступа</div>

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
            border: err ? "1px solid #c03030" : "1px solid #2a2f3e",
            transition:"border 0.2s",
          }}
        />
        {err && <div style={{fontSize:12,color:"#c03030",marginTop:8}}>Неверный пароль</div>}
      </div>

      <button onClick={tryUnlock} style={{...s.saveBtn, marginTop:0}}>
        Войти
      </button>
    </div>
  );
}

// ─── LOG TAB ─────────────────────────────────────────────────────
function LogTab({ records, saveRecords, apts, maids, linen }) {
  const [step, setStep]           = useState(1);
  const [aptSearch, setAptSearch] = useState("");
  const [form, setForm]           = useState({date:today(),apartment:"",maid:"",linen:{},consumables:"",notes:"",photos:[]});
  const [saved, setSaved]         = useState(false);
  const photoRef                  = useRef();

  const filteredApts = apts.filter(a=>a.toLowerCase().includes(aptSearch.toLowerCase()));

  function selectApt(apt) { setForm(f=>({...f,apartment:apt})); setAptSearch(apt); setStep(2); }

  function setQty(id, val) {
    const num = val===""?"" : Math.max(0,parseInt(val)||0);
    setForm(f=>({...f,linen:{...f.linen,[id]:num}}));
  }

  async function handlePhoto(e) {
    const files = Array.from(e.target.files);
    const compressed = await Promise.all(files.map(f => compressImage(f)));
    setForm(f => ({...f, photos: [...f.photos, ...compressed]}));
    e.target.value = "";
  }

  const handleSaveRecord = async () => {
    // Перевіряємо, чи вибрана квартира та покоївка у твоєму об'єкті form
    if (!form.apartment || !form.maid) {
      alert("Выберите квартиру и сотрудника!");
      return;
    }

    const { error } = await supabase
      .from('laundry_records')
      .insert([{
        apartment_number: form.apartment, // беремо квартиру з форми
        worker_name: form.maid,           // беремо покоївку з форми
        items_json: form.counts,          // беремо кількість білизни
        notes: form.notes || ''            // додаємо нотатки, якщо є
      }]);

    if (error) {
      alert("Ошибка: " + error.message);
    } else {
      alert("✅ Запись добавлена в журнал!");
      // Очищаємо форму після збереження
      setForm({
        ...form,
        apartment: '',
        counts: {},
        notes: '',
        photos: []
      });
    }
  };



  return (
    <div style={s.page}>
      {saved && <div style={s.savedBanner}>✓ Запись сохранена!</div>}

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
              <div key={item.id} style={{...s.linenRow,background:i%2===0?"#161a24":"#131720"}}>
                <span style={s.linenIcon}>{item.icon}</span>
                <span style={s.linenLabel}>{item.label}</span>
                <input type="number" inputMode="numeric" min="0" placeholder="0"
                  value={form.linen[item.id]??""}
                  onChange={e=>setQty(item.id,e.target.value)}
                  style={s.qtyInput}/>
              </div>
            ))}
          </div>
        </>}

        <div style={s.sL}>Фото (необязательно)</div>
        <div style={s.photoRow}>
          {form.photos.map((src,i)=>(
            <div key={i} style={s.thumbWrap}>
              <img src={src} alt="" style={s.thumb}/>
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
          placeholder="Мыло, шампунь, тапочки, туалетная бумага…"
          rows={3} style={{...s.input,resize:"none",lineHeight:1.6}}/>

        <div style={s.sL}>Примечание</div>
        <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
          placeholder="Пятно, повреждение, особые замечания…"
          rows={2} style={{...s.input,resize:"none",lineHeight:1.6}}/>

        <button 
          onClick={handleSaveRecord} 
          style={s.saveBtn}
        >
          💾 Сохранить запись
        </button>
      </>}
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────
function HistoryTab({ records, saveRecords, linen }) {
  const [search,setSearch]         = useState("");
  const [dateFilter,setDateFilter] = useState("");
  const [expanded,setExpanded]     = useState(null);
  const [delId,setDelId]           = useState(null);
  const [lightbox,setLightbox]     = useState(null);

  const filtered = records
    .filter(r=>{
      const mA = !search     || r.apartment.toLowerCase().includes(search.toLowerCase());
      const mD = !dateFilter || r.date===dateFilter;
      return mA&&mD;
    })
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const linenTotal = l => Object.values(l||{}).reduce((sum,v)=>sum+(parseInt(v)||0),0);

  function doDelete() {
    saveRecords(records.filter(r=>r.id!==delId));
    if (expanded===delId) setExpanded(null);
    setDelId(null);
  }

  const linenMap = Object.fromEntries((linen||[]).map(l=>[l.id,l]));

  return (
    <div style={s.page}>
      <div style={{position:"relative",marginBottom:10}}>
        <input placeholder="Поиск по квартире…" value={search}
          onChange={e=>setSearch(e.target.value)}
          style={{...s.input,paddingLeft:40}}/>
        <span style={s.sIcon}>🔎</span>
      </div>
      <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
        style={{...s.input,marginBottom:0}}/>
      {(search||dateFilter) &&
        <button onClick={()=>{setSearch("");setDateFilter("");}} style={s.clearBtn}>✕ Очистить фильтры</button>}
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
                  <div style={s.cardApt}>🏠 {r.apartment}</div>
                  <div style={s.cardMeta}>
                    👤 {r.maid} · 📅 {fmtDate(r.date)}
                    {total>0 && <span style={s.cntBadge}>{total} ед.</span>}
                    {r.consumables?.trim() && <span style={s.consumBadge}>🔔</span>}
                    {r.photos?.length>0 && <span style={s.photoBadge}>📷 {r.photos.length}</span>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button onClick={e=>{e.stopPropagation();setDelId(r.id);}} style={s.delBtn}>✕</button>
                  <span style={{color:"#555",fontSize:13}}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>
              {isOpen && <div style={s.cardBody}>
                {linenEntries.length>0 && <>
                  <div style={s.subLabel}>Бельё</div>
                  {linenEntries.map(([id,qty])=>{
                    const item = linenMap[id];
                    return (
                      <div key={id} style={s.linenRowSmall}>
                        <span>{item ? `${item.icon} ${item.label}` : id}</span>
                        <span style={s.qtyBadge}>{qty}</span>
                      </div>
                    );
                  })}
                </>}
                {r.photos?.length>0 && <>
                  <div style={s.subLabel}>Фото — нажмите чтобы открыть</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {r.photos.map((src,i)=>(
                      <div key={i} onClick={()=>setLightbox(src)} style={s.photoThumbWrap}>
                        <img src={src} alt="" style={s.photoThumb}/>
                        <div style={s.photoThumbHint}>🔍</div>
                      </div>
                    ))}
                  </div>
                </>}
                {r.consumables?.trim() && <div style={s.consumBox}>
                  <div style={s.subLabel}>🔔 Нужно заказать</div>
                  <p style={{margin:0,fontSize:13,color:"#e8b84b",lineHeight:1.6}}>{r.consumables}</p>
                </div>}
                {r.notes?.trim() && <>
                  <div style={s.subLabel}>Примечание</div>
                  <p style={{margin:0,fontSize:13,color:"#888",fontStyle:"italic",lineHeight:1.5}}>{r.notes}</p>
                </>}
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
function SettingsTab({ apts, saveApts, maids, saveMaids, linen, saveLinen, onLock }) {
  const [section,    setSection]    = useState("apts");
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

      <div style={s.sectionTabs}>
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
          <div style={{fontSize:11,color:"#666",marginBottom:6}}>Иконка:</div>
          <button onClick={()=>setShowIconPicker(!showIconPicker)}
            style={{...s.iconPickerBtn, borderColor: showIconPicker?"#c9a84c":"#3a3f55"}}>
            <span style={{fontSize:20}}>{newIcon}</span>
            <span style={{fontSize:11,color:"#888"}}>▼</span>
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
            <div key={item.id} style={{...s.linenEditRow, background:i%2===0?"#161a24":"#131720"}}>
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
const s = {
  root:            { minHeight:"100vh", background:"#111318", color:"#ddd8cc", fontFamily:"'Georgia','Times New Roman',serif", maxWidth:480, margin:"0 auto", paddingBottom:70 },
  header:          { display:"flex", alignItems:"center", gap:12, padding:"22px 20px 14px", background:"#161a24", borderBottom:"1px solid #252a38", position:"sticky", top:0, zIndex:10 },
  headerTitle:     { fontSize:19, fontWeight:"bold", letterSpacing:0.5 },
  headerSub:       { fontSize:11, color:"#666", letterSpacing:1, textTransform:"uppercase" },
  tabBar:          { display:"flex", borderBottom:"1px solid #252a38", position:"sticky", top:64, zIndex:9, background:"#111318" },
  tab:             { flex:1, padding:"10px 0", background:"transparent", border:"none", borderBottom:"2px solid transparent", color:"#666", fontSize:13, fontFamily:"inherit", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, transition:"all 0.2s" },
  tabActive:       { background:"#161a24", borderBottom:"2px solid #c9a84c", color:"#c9a84c", fontWeight:"bold" },
  page:            { padding:"20px 16px" },
  sL:              { fontSize:10, color:"#666", textTransform:"uppercase", letterSpacing:1.4, marginBottom:8, marginTop:18 },
  input:           { width:"100%", padding:"11px 13px", background:"#1c2030", border:"1px solid #2a2f3e", borderRadius:10, color:"#ddd8cc", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none", WebkitAppearance:"none" },
  sIcon:           { position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" },
  aptGrid:         { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 },
  aptBtn:          { padding:"12px 4px", background:"#1c2030", border:"1px solid #2a2f3e", borderRadius:10, color:"#ddd8cc", fontSize:14, fontFamily:"inherit", cursor:"pointer" },
  aptHeader:       { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 },
  aptBadge:        { background:"#1e2844", border:"1px solid #2e3a5e", borderRadius:20, padding:"6px 14px", fontSize:14, color:"#8ab4f8", fontWeight:"bold" },
  backBtn:         { background:"none", border:"none", color:"#c9a84c", fontSize:13, cursor:"pointer", fontFamily:"inherit", padding:0 },
  row2:            { display:"flex", gap:12 },
  linenTable:      { borderRadius:12, border:"1px solid #252a38", overflow:"hidden" },
  linenRow:        { display:"flex", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #1a1e2a", gap:10 },
  linenIcon:       { fontSize:15, width:22, textAlign:"center", flexShrink:0 },
  linenLabel:      { flex:1, fontSize:13, color:"#aaa", lineHeight:1.3 },
  qtyInput:        { width:52, padding:"7px 6px", background:"#1c2030", border:"1px solid #3a3f55", borderRadius:8, color:"#ddd8cc", fontSize:16, fontFamily:"inherit", textAlign:"center", outline:"none", WebkitAppearance:"none", MozAppearance:"textfield" },
  photoRow:        { display:"flex", flexWrap:"wrap", gap:10, marginBottom:4 },
  thumbWrap:       { position:"relative", width:72, height:72 },
  thumb:           { width:72, height:72, objectFit:"cover", borderRadius:10, border:"1px solid #2a2f3e" },
  thumbDel:        { position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#c03030", border:"none", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  photoThumbWrap:  { position:"relative", width:90, height:90, cursor:"pointer", borderRadius:10, overflow:"hidden", border:"1px solid #2a2f3e", flexShrink:0 },
  photoThumb:      { width:90, height:90, objectFit:"cover", display:"block" },
  photoThumbHint:  { position:"absolute", bottom:0, right:0, width:24, height:24, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, borderTopLeftRadius:6 },
  lightboxOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.93)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16, cursor:"pointer" },
  lightboxImg:     { maxWidth:"100%", maxHeight:"100%", objectFit:"contain", borderRadius:8, cursor:"default", boxShadow:"0 4px 40px rgba(0,0,0,0.7)" },
  lightboxClose:   { position:"fixed", top:16, right:16, width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:201 },
  addPhotoBtn:     { width:72, height:72, background:"#1c2030", border:"1px dashed #3a3f55", borderRadius:10, color:"#666", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 },
  saveBtn:         { width:"100%", marginTop:20, padding:16, background:"linear-gradient(135deg,#c9a84c,#a07830)", border:"none", borderRadius:12, color:"#fff", fontSize:16, fontFamily:"inherit", fontWeight:"bold", cursor:"pointer", letterSpacing:0.5 },
  saveBtnOff:      { background:"#1c2030", color:"#3a3f4e", cursor:"not-allowed" },
  savedBanner:     { background:"#1a3020", border:"1px solid #2a5030", color:"#5cd87a", borderRadius:10, padding:"12px 16px", textAlign:"center", fontSize:14, marginBottom:16, fontWeight:"bold" },
  emptyHint:       { background:"#1c2030", border:"1px dashed #3a3f55", borderRadius:10, padding:"16px", textAlign:"center", fontSize:13, color:"#666" },
  clearBtn:        { background:"none", border:"none", color:"#c9a84c", fontSize:12, cursor:"pointer", padding:"6px 0", fontFamily:"inherit" },
  countLabel:      { fontSize:12, color:"#555", margin:"10px 0 12px" },
  empty:           { textAlign:"center", padding:"60px 0" },
  card:            { background:"#161a24", borderRadius:12, border:"1px solid #252a38", marginBottom:10, overflow:"hidden" },
  cardHeader:      { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px", cursor:"pointer" },
  cardApt:         { fontWeight:"bold", fontSize:15, marginBottom:4 },
  cardMeta:        { fontSize:12, color:"#666", display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" },
  cntBadge:        { background:"#1e2844", color:"#8ab4f8", borderRadius:10, padding:"2px 8px", fontSize:11 },
  consumBadge:     { background:"#2a2010", color:"#e8b84b", borderRadius:10, padding:"2px 7px", fontSize:11 },
  photoBadge:      { background:"#1a2820", color:"#6ab87a", borderRadius:10, padding:"2px 8px", fontSize:11 },
  delBtn:          { background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:15, padding:0 },
  cardBody:        { padding:"12px 14px 14px", borderTop:"1px solid #1e2330" },
  subLabel:        { fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:1.2, marginBottom:6, marginTop:12 },
  linenRowSmall:   { display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, color:"#999", padding:"5px 0", borderBottom:"1px solid #1a1e2a" },
  qtyBadge:        { background:"#1e2844", color:"#8ab4f8", borderRadius:8, padding:"2px 10px", fontSize:13, fontWeight:"bold" },
  consumBox:       { background:"#1e1a0e", border:"1px solid #3a2e10", borderRadius:8, padding:"10px 12px", marginTop:10 },
  syncPill:        { fontSize:11, color:"#5cd87a", background:"#1a3020", border:"1px solid #2a5030", borderRadius:20, padding:"4px 10px", transition:"opacity 0.4s", whiteSpace:"nowrap" },
  offlinePill:     { fontSize:11, color:"#e8b84b", background:"#2a2010", border:"1px solid #5a4010", borderRadius:20, padding:"4px 10px", whiteSpace:"nowrap" },
  discardBtn:      { background:"none", border:"1px solid #3a2f20", borderRadius:8, color:"#c9a84c", fontSize:12, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" },
  lockBtn:         { background:"none", border:"1px solid #2a2f3e", borderRadius:8, color:"#888", fontSize:12, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" },
  sectionTabs:     { display:"flex", gap:8, marginBottom:4 },
  sectionTab:      { flex:1, padding:"10px 6px", background:"#1c2030", border:"1px solid #2a2f3e", borderRadius:10, color:"#666", fontSize:12, fontFamily:"inherit", cursor:"pointer", transition:"all 0.2s" },
  sectionTabActive:{ background:"#222840", border:"1px solid #3a4a6e", color:"#8ab4f8", fontWeight:"bold" },
  importBtn:       { background:"#1c2030", border:"1px solid #3a3f55", borderRadius:8, color:"#c9a84c", fontSize:12, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" },
  importBox:       { background:"#111318", border:"1px solid #252a38", borderRadius:10, padding:14, marginBottom:14 },
  addBtn:          { padding:"11px 14px", background:"linear-gradient(135deg,#c9a84c,#a07830)", border:"none", borderRadius:10, color:"#fff", fontSize:13, fontFamily:"inherit", fontWeight:"bold", cursor:"pointer", whiteSpace:"nowrap" },
  listBox:         { background:"#111318", borderRadius:10, border:"1px solid #1e2330", overflow:"hidden", maxHeight:320, overflowY:"auto" },
  listRow:         { display:"flex", alignItems:"center", padding:"11px 14px", borderBottom:"1px solid #1a1e2a" },
  listLabel:       { flex:1, fontSize:14 },
  rowDelBtn:       { background:"none", border:"none", color:"#555", fontSize:14, cursor:"pointer", padding:"0 4px" },
  cancelSmall:     { flex:1, padding:"9px 0", background:"#1c2030", border:"1px solid #2a2f3e", borderRadius:8, color:"#888", cursor:"pointer", fontFamily:"inherit", fontSize:13 },
  confirmSmall:    { flex:1, padding:"9px 0", background:"linear-gradient(135deg,#c9a84c,#a07830)", border:"none", borderRadius:8, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:"bold" },
  linenAddBox:     { background:"#1c2030", border:"1px solid #2a2f3e", borderRadius:12, padding:14, marginBottom:14 },
  linenEditRow:    { display:"flex", alignItems:"center", padding:"9px 12px", borderBottom:"1px solid #1a1e2a" },
  arrowBtn:        { background:"none", border:"none", color:"#555", fontSize:11, cursor:"pointer", padding:"1px 3px", lineHeight:1, display:"block" },
  editBtn:         { background:"none", border:"none", fontSize:14, cursor:"pointer", padding:"0 2px" },
  editSaveBtn:     { background:"#1a3020", border:"1px solid #2a5030", color:"#5cd87a", borderRadius:6, fontSize:13, cursor:"pointer", padding:"2px 8px", fontFamily:"inherit" },
  iconPickerBtn:   { display:"flex", alignItems:"center", gap:8, background:"#1c2030", border:"1px solid #3a3f55", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontFamily:"inherit" },
  iconGrid:        { display:"flex", flexWrap:"wrap", gap:6, background:"#111318", border:"1px solid #252a38", borderRadius:10, padding:10, marginTop:6 },
  iconBtn:         { width:36, height:36, background:"#1c2030", border:"1px solid #2a2f3e", borderRadius:8, fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  iconBtnActive:   { background:"#2a2516", border:"1px solid #c9a84c" },
  modal:           { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:24 },
  modalBox:        { background:"#1c2030", borderRadius:16, padding:24, border:"1px solid #2a2f3e", width:"100%", maxWidth:300 },
  modalCancel:     { flex:1, padding:12, borderRadius:10, background:"#111318", border:"1px solid #2a2f3e", color:"#888", cursor:"pointer", fontFamily:"inherit", fontSize:14 },
  modalDelete:     { flex:1, padding:12, borderRadius:10, background:"#3a1515", border:"1px solid #5a2020", color:"#e06060", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:"bold" },
};
