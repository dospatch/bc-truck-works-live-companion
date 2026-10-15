"use client";
import { useEffect, useState } from "react";

const initialCallouts = [
  ["speed", "Speed limit changes"], ["speeding", "Speeding warnings"], ["milestones", "Miles-to-go milestones"],
  ["rest", "Rest reminders"], ["fuel", "Low fuel"], ["damage", "Damage and cargo hits"], ["shift", "Shift calls (up / down)"]
];
const prompts = ["How far?", "What gear?", "When do I rest?", "Fuel?", "Can I make it?", "Damage report", "Tell me a joke"];
const navGroups = [
  ["DRIVE", [["▶","Drive"],["♟","Co-Driver"],["➤","Navigation"],["▣","Truck Health"],["⚙","Under the Hood"],["⇅","Shift Coach"]]],
  ["WORK", [["▰","Dispatch & BOL"],["▤","Trip History"],["▥","Earnings & Stats"],["▧","Journal"],["▦","Company"],["★","Career"]]],
  ["CONVOY", [["◉","Convoy Hub"],["♧","Convoy"],["🏆","Leaderboard"],["⌖","Convoy Radar"]]]
];
function replyFor(input, personality, telemetry) {
  const q = input.toLowerCase();
  const live = telemetry?.connected && telemetry?.valuesAreLive ? telemetry : null;
  const truck = live?.truck || {};
  const job = live?.job || {};
  const val = (n, unit = "") => n === null || n === undefined || n === "" ? null : `${n}${unit}`;
  let answer;
  if (q.includes("joke")) {
    answer = "Why did the truck driver bring a ladder? To reach the next level of the highway. Keep on truckin'!";
  } else if (q.includes("fuel") || q.includes("range")) {
    if (!live) answer = "Live fuel level and range will appear when the desktop companion is connected to a supported telemetry source and the game is running.";
    else {
      const bits = [];
      const fuel = val(truck.fuelPercent, "%");
      const litres = val(truck.fuelLitres, " litres");
      const range = val(truck.fuelRangeMiles, " miles estimated range");
      if (fuel) bits.push(`fuel is at ${fuel}`);
      if (litres) bits.push(`about ${litres}`);
      if (range) bits.push(`estimated range is ${range}`);
      answer = bits.length ? `Live telemetry says ${bits.join(", ")}. Treat range as an estimate and refuel with a safe margin.` : "Telemetry is connected, but the game has not supplied usable fuel values yet.";
    }
  } else if (q.includes("rest") || q.includes("sleep")) {
    if (!live) answer = "Your rest plan needs the game's current route and fatigue data. Connect the desktop telemetry bridge and load into ATS or ETS2 for live readings.";
    else if (job.restMinutes !== null && job.restMinutes !== undefined) answer = `The game reports approximately ${job.restMinutes} game minutes until the next rest stop. Plan a safe stop and follow the game's fatigue rules.`;
    else answer = "Telemetry is connected, but the game has not supplied a next-rest value yet. Check the in-game fatigue setting and route.";
  } else if (q.includes("far") || q.includes("destination") || q.includes("mile") || q.includes("distance")) {
    if (!live) answer = "Destination distance needs active navigation data from a connected desktop telemetry feed.";
    else if (job.remainingDistanceMiles !== null && job.remainingDistanceMiles !== undefined) answer = `The game reports about ${job.remainingDistanceMiles} miles remaining${job.destination ? ` to ${job.destination}` : ""}.`;
    else answer = job.active ? "You're on a job, but the game hasn't provided remaining route distance yet. Check that navigation is active." : "I don't see an active delivery route right now.";
  } else if (q.includes("gear") || q.includes("shift") || q.includes("rpm")) {
    if (!live) answer = "Live shift coaching needs your truck's speed, RPM, gear, and engine data. Connect the desktop telemetry bridge and start a game.";
    else {
      const bits = [];
      if (truck.gear !== null && truck.gear !== undefined) bits.push(`gear ${truck.gear}`);
      if (truck.engineRpm !== null && truck.engineRpm !== undefined) bits.push(`${Math.round(truck.engineRpm)} RPM`);
      if (truck.speedMph !== null && truck.speedMph !== undefined) bits.push(`${truck.speedMph} mph`);
      answer = bits.length ? `Current truck readings: ${bits.join(", ")}. Shift according to engine load and the truck's RPM band; avoid abrupt shifts.` : "Telemetry is connected, but gear and RPM readings aren't available yet.";
    }
  } else if (q.includes("damage")) {
    if (!live) answer = "A live truck and cargo damage report needs a connected desktop telemetry source.";
    else {
      const bits = [];
      if (truck.truckDamagePercent !== null && truck.truckDamagePercent !== undefined) bits.push(`truck wear estimate ${truck.truckDamagePercent}%`);
      if (truck.cargoDamagePercent !== null && truck.cargoDamagePercent !== undefined) bits.push(`cargo damage ${truck.cargoDamagePercent}%`);
      answer = bits.length ? `Telemetry reports ${bits.join(" and ")}. Drive carefully and check the game's service and cargo screens for details.` : "Telemetry is connected, but damage values are not available yet.";
    }
  } else if (q.includes("make it") || q.includes("deadline") || q.includes("delivery")) {
    if (!live) answer = "Delivery estimates need the remaining distance, job deadline, and rest data from an active game session.";
    else if (!job.active) answer = "I don't see an active delivery in the current telemetry. Start or load a job to check its status.";
    else {
      const destination = job.destination ? ` to ${job.destination}` : "";
      const distance = val(job.remainingDistanceMiles, " miles remaining");
      const deadline = val(job.deadlineGameMinutes, " game minutes");
      answer = `Your delivery is active${destination}.${distance ? ` Distance: ${distance}.` : ""}${deadline ? ` Reported delivery-time field: ${deadline}.` : ""} I can't reliably promise you'll make the deadline from these readings alone; account for speed limits, traffic, fatigue, and route conditions.`;
    }
  } else if (q.includes("eco") || q.includes("score") || q.includes("alert")) {
    answer = "Eco scoring and automatic alert rules are not implemented in this V1 yet. The companion will not invent a score or claim an alert was triggered.";
  } else {
    answer = live
      ? `I'm your BC Truck Works co-driver. Current readings: ${truck.speedMph == null ? "speed unavailable" : truck.speedMph + " mph"}; ${truck.fuelPercent == null ? "fuel unavailable" : "fuel " + truck.fuelPercent + "%"}; ${job.remainingDistanceMiles == null ? "route distance unavailable" : job.remainingDistanceMiles + " miles to destination"}. Ask about fuel, distance, rest, gear, delivery timing, or damage.`
      : "I'm your BC Truck Works co-driver. Ask me about fuel, distance, rest, gear, delivery timing, damage, or ask for a joke. Live driving answers require the desktop companion and a supported telemetry connection.";
  }
  if (personality === "Calm Long-Haul Partner") return "No rush — let's take it one step at a time. " + answer;
  if (personality === "Energetic Convoy Buddy") return "Alright, driver! " + answer + " Let's keep those wheels rolling!";
  if (personality === "Short & Straight to the Point") return answer;
  if (personality === "Funny Trucking Buddy" && !q.includes("joke")) return answer + " Keep the shiny side up and the rubber side down!";
  return answer;
}
export default function Home() {
  const [question,setQuestion] = useState("");
  const [messages,setMessages] = useState([{from:"BC Co-Driver",text:"Welcome to BC Truck Works Live Companion! This is your V1 browser dashboard. Connect a supported telemetry source for live truck readings.",time:"READY"}]);
  const [voiceOn,setVoiceOn] = useState(true);
  const [voiceCommands,setVoiceCommands] = useState(false);
  const [personality,setPersonality] = useState("Friendly & Professional");
  const [voice,setVoice] = useState("Automatic English voice");
  const [voices,setVoices] = useState([]);
  const [speed,setSpeed] = useState(1);
  const [pitch,setPitch] = useState(1);
  const [volume,setVolume] = useState(1);
  const [callouts,setCallouts] = useState(Object.fromEntries(initialCallouts.map(([k])=>[k,true])));
  const [profile,setProfile] = useState("American Truck Simulator");
  const [customProfiles,setCustomProfiles] = useState([]);
  const [profileInput,setProfileInput] = useState("");
  const [showProfiles,setShowProfiles] = useState(false);
  const [mobileNavOpen,setMobileNavOpen] = useState(false);
  const [activeNav,setActiveNav] = useState("Co-Driver");
  const [selectedModule,setSelectedModule] = useState("");
  const [listening,setListening] = useState(false);
  const [clock,setClock] = useState("--:--");
  const [notice,setNotice] = useState("DEMO MODE · readings are placeholders until a compatible telemetry source is connected.");
  const [liveTelemetry,setLiveTelemetry] = useState(null);
  useEffect(()=>{
    const tick=()=>setClock(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
    tick(); const timer=setInterval(tick,15000);
    try {
      const saved=JSON.parse(localStorage.getItem("bc-live-companion-v1")||"{}");
      if(saved.callouts)setCallouts(saved.callouts);
      if(saved.voiceOn!==undefined)setVoiceOn(saved.voiceOn);
      if(saved.voiceCommands!==undefined)setVoiceCommands(saved.voiceCommands);
      if(saved.personality)setPersonality(saved.personality);
      if(saved.voice)setVoice(saved.voice);
      if(saved.speed)setSpeed(saved.speed);
      if(saved.pitch)setPitch(saved.pitch);
      if(saved.volume!==undefined)setVolume(saved.volume);
      if(saved.profile)setProfile(saved.profile);
      if(saved.customProfiles)setCustomProfiles(saved.customProfiles);
    } catch {}
    if("speechSynthesis" in window) {
      const load=()=>setVoices(window.speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)).map(v=>v.name));
      load(); window.speechSynthesis.onvoiceschanged=load;
    }
    fetch("/api/health",{cache:"no-store"}).then(r=>r.json()).then(d=>{if(d.ok)setNotice("WEBSITE ONLINE · browser features are ready. Game telemetry is not connected yet.");}).catch(()=>{});
    fetch("/api/telemetry/status",{cache:"no-store"}).then(r=>r.json()).then(d=>{if(d.telemetry?.connected){setNotice("TELEMETRY CONNECTED · "+d.telemetry.source+" data feed detected.");}else{setNotice("WEBSITE ONLINE · TELEMETRY NOT CONNECTED · "+(d.telemetry?.message||"Live game data is unavailable."));}}).catch(()=>setNotice("WEBSITE ONLINE · telemetry status could not be checked."));
    let stopped = false;
    const pollBridge = async () => {
      try {
        const r = await fetch("http://127.0.0.1:32146/status", { cache: "no-store", signal: AbortSignal.timeout(1200) });
        if (!r.ok) throw new Error("Bridge unavailable");
        const data = await r.json();
        if (stopped) return;
        setLiveTelemetry(data);
        if (data.connected && data.valuesAreLive) {
          setNotice("LIVE TELEMETRY · " + (data.source === "ats" ? "American Truck Simulator" : data.source === "ets2" ? "Euro Truck Simulator 2" : "Game") + (data.status === "paused" ? " · GAME PAUSED" : " · CONNECTED") + " · updated " + new Date(data.updatedAt).toLocaleTimeString());
        } else {
          setNotice("DESKTOP BRIDGE AVAILABLE · " + (data.message || "Start ATS/ETS2 with a compatible SCS telemetry plugin."));
        }
      } catch {
        if (!stopped) setLiveTelemetry(null);
      }
    };
    pollBridge();
    const bridgeTimer = setInterval(pollBridge, 1000);
    return ()=>{ stopped = true; clearInterval(timer); clearInterval(bridgeTimer); };
  },[]);
  useEffect(()=>{try{localStorage.setItem("bc-live-companion-v1",JSON.stringify({callouts,voiceOn,voiceCommands,personality,voice,speed,pitch,volume,profile,customProfiles}));}catch{}},[callouts,voiceOn,voiceCommands,personality,voice,speed,pitch,volume,profile,customProfiles]);
  useEffect(()=>{if(selectedModule){document.getElementById("nav-module-placeholder")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}},[selectedModule]);
  function say(text) {
    if(!voiceOn || !("speechSynthesis" in window))return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text); const available=window.speechSynthesis.getVoices();
    const chosen=voice==="Automatic English voice"?available.find(v=>/^en(-|_)/i.test(v.lang)):available.find(v=>v.name===voice);
    if(chosen)u.voice=chosen; u.rate=Number(speed);u.pitch=Number(pitch);u.volume=Number(volume);window.speechSynthesis.speak(u);
  }
  function ask(text=question) {
    const q=text.trim();if(!q)return;
    const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    const answer=replyFor(q,personality,liveTelemetry);
    setMessages(old=>[...old,{from:"You",text:q,time},{from:"BC Co-Driver",text:answer,time}]);setQuestion("");say(answer);
  }
  function listen() {
    const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Rec){setNotice("Speech recognition is unavailable in this browser. Try Chrome or Edge and allow microphone access.");return;}
    const rec=new Rec();rec.lang="en-US";rec.interimResults=false;
    rec.onstart=()=>setListening(true);rec.onend=()=>setListening(false);
    rec.onerror=()=>{setListening(false);setNotice("Microphone stopped. Check your browser microphone permission.");};
    rec.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript;if(t)ask(t);};rec.start();
  }
  function addProfile(e){e.preventDefault();const name=profileInput.trim();if(!name)return;const existing=["American Truck Simulator","Euro Truck Simulator 2",...customProfiles].some(p=>p.toLowerCase()===name.toLowerCase());if(existing){setNotice("That profile already exists. Choose it from the profile list instead.");return;}setCustomProfiles(old=>[...old,name]);setProfile(name);setProfileInput("");setNotice("Custom app profile saved in this browser.");}
  function removeProfile(name){setCustomProfiles(old=>old.filter(p=>p!==name));if(profile===name){const remaining=customProfiles.filter(p=>p!==name);setProfile(remaining[0]||"American Truck Simulator");}setNotice("Profile removed. Your active profile has been kept valid.");}
  useEffect(()=>{
    if(!voiceCommands)return;
    const onKeyDown=e=>{
      if(e.repeat || e.key.toLowerCase()!=="v" || e.ctrlKey || e.altKey || e.metaKey)return;
      const target=e.target;
      if(target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)))return;
      if(!listening)listen();
    };
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[voiceCommands,listening]);
  const live = liveTelemetry?.connected && liveTelemetry?.valuesAreLive ? liveTelemetry : null;
  const truck = live?.truck || {};
  const job = live?.job || {};
  const show = (value, suffix = "") => value === null || value === undefined || value === "" ? "—" : String(value) + suffix;
  const metrics=[
    ["SPEED",show(truck.speedMph),"mph","◉"],
    ["FUEL",show(truck.fuelPercent,"%"),truck.fuelLitres == null ? "live fuel unavailable" : Math.round(truck.fuelLitres)+" litres","⛽"],
    ["TO DESTINATION",show(job.remainingDistanceMiles),"miles remaining","⌖"],
    ["NEXT REST",show(job.restMinutes),"game minutes","◷"],
    ["DEADLINE",job.active && job.deadlineGameMinutes != null ? "Active job" : "—",job.active ? (job.destination ? "To "+job.destination : "job in progress") : "no active job","▤"],
    ["ECO SCORE","—","trip scoring not implemented","✦"],
    ["ALERTS",live ? "—" : "—",live ? "alert rules not implemented" : "no live telemetry","♧"]
  ];
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingWebsite, setPairingWebsite] = useState("https://bc-truck-works-live-companion.vercel.app");
  const [pairingStatus, setPairingStatus] = useState("");
  async function pairDesktop() {
    setPairingStatus("Connecting securely…");
    try {
      const response = await fetch("http://127.0.0.1:32146/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: pairingCode, website: pairingWebsite }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Pairing failed.");
      setPairingStatus("Paired successfully. This desktop will upload live telemetry when the game is running.");
      setPairingCode("");
    } catch (error) { setPairingStatus(error.message || "Pairing failed. Open this page in the desktop companion."); }
  }
  const toggle=(checked,setter,label)=><input className="toggle" type="checkbox" checked={checked} onChange={e=>setter(e.target.checked)} aria-label={label}/>;
  return <main className="app-shell">
    <button type="button" className="mobile-nav-toggle" aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileNavOpen} aria-controls="primary-sidebar" onClick={()=>setMobileNavOpen(open=>!open)}>{mobileNavOpen ? "✕ Close" : "☰ Menu"}</button>
    {mobileNavOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation menu" onClick={()=>setMobileNavOpen(false)} />}
    <aside id="primary-sidebar" className={"sidebar "+(mobileNavOpen ? "mobile-open" : "")}>
      <div className="brand"><div className="brand-mark"><img src="https://raw.githubusercontent.com/dospatch/bc-truck-works/main/web/public/bc-truck-works-logo.png" alt="BC Truck Works logo" /></div><strong>BC TRUCK WORKS</strong><b>LIVE COMPANION</b><small className="version">V1.0 · DRIVER EDITION</small></div>
      {navGroups.map(([group,items])=><section className="nav-group" key={group}><div className="nav-label">{group}</div>{items.map(([icon,label])=><button type="button" key={label} aria-current={activeNav===label?"page":undefined} className={"nav-item "+(activeNav===label?"active":"")} onClick={()=>{setActiveNav(label);setMobileNavOpen(false);const targets={"Drive":"dashboard-top","Co-Driver":"co-driver","Navigation":"status-notice","Truck Health":"truck-health","Under the Hood":"voice-settings","Shift Coach":"voice-commands","Career":"app-profiles"};const target=targets[label];if(target){setSelectedModule("");setNotice(label==="Drive"?"Dashboard selected.":label+" selected.");document.getElementById(target)?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}else{setSelectedModule(label);setNotice(label+" selected.");}}}><span>{icon}</span>{label}</button>)}</section>)}
      <div className="sidebar-bottom"><b>DRIVE · BUILD · SUCCEED</b><span>Built for the road ahead.</span><span>BC Truck Works © 2026</span></div>
    </aside>
    <section className="workspace" id="dashboard-top">
      <header className="topbar"><div className="page-title"><div className="mini-mark"><img src="https://raw.githubusercontent.com/dospatch/bc-truck-works/main/web/public/bc-truck-works-logo.png" alt="" /></div><div><h1>BC TRUCK WORKS <span>• LIVE COMPANION</span></h1><p>YOUR RIDE · YOUR ROUTE · YOUR SUPPORT</p></div></div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><a className="outline-button" href="/ideas" style={{textDecoration:"none"}}>💡 Submit an idea</a><button type="button" className="outline-button" onClick={()=>setPairingOpen(v=>!v)}>Connect my game</button><div className={"status-pill "+(liveTelemetry?.connected&&liveTelemetry?.valuesAreLive?"status-live":liveTelemetry?"status-bridge":"status-web")}><i/> <b>{liveTelemetry?.connected&&liveTelemetry?.valuesAreLive?"LIVE":liveTelemetry?"BRIDGE":"WEB ONLINE"}</b> <span>{clock}</span></div></div></header>
      <div className="metrics" id="truck-health">{metrics.map(m=><article className="metric" key={m[0]}><div className="metric-icon">{m[3]}</div><div className="metric-label">{m[0]}</div><strong>{m[1]}</strong><small>{m[2]}</small></article>)}</div>
      <div className="notice" id="status-notice"><b>STATUS</b><span>{notice}</span></div>
      {selectedModule&&<section className="panel nav-module-placeholder" id="nav-module-placeholder" aria-live="polite"><header className="panel-heading"><h2><i/> {selectedModule.toUpperCase()}</h2><span className="soft-tag">COMING IN A FUTURE UPDATE</span></header><p className="helper-text">{selectedModule} is not implemented in V1 yet. The navigation is responding correctly; this module will need its own features before it can display live information.</p><button type="button" className="outline-button" onClick={()=>{setSelectedModule("");setActiveNav("Drive");document.getElementById("dashboard-top")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}}>← Back to dashboard</button></section>}
      {pairingOpen&&<section className="panel" style={{marginBottom:14}}><header className="panel-heading"><h2><i/> PAIR THIS DESKTOP TO YOUR WEBSITE</h2><button className="outline-button" onClick={()=>setPairingOpen(false)}>Close</button></header><p className="helper-text">Open Connect my game on your website to generate a one-time code that expires after 10 minutes. Your per-driver token is stored locally by the desktop bridge.</p><div className="setting-fields" style={{gridTemplateColumns:"minmax(0,1fr) minmax(0,2fr)"}}><label>6-CHARACTER CODE<input autoComplete="off" maxLength={6} value={pairingCode} onChange={e=>setPairingCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,""))} placeholder="ABC234"/></label><label>WEBSITE URL<input value={pairingWebsite} onChange={e=>setPairingWebsite(e.target.value)} placeholder="https://your-site.vercel.app"/></label></div><button type="button" className="primary-button" style={{marginTop:12,minHeight:44}} onClick={pairDesktop} disabled={pairingCode.length!==6}>Pair desktop app</button>{pairingStatus&&<p role="status" className="helper-text">{pairingStatus}</p>}</section>}
      <div className="content-grid">
        <div className="left-column">
          <section className="panel chat-panel" id="co-driver"><header className="panel-heading"><h2><i/> TALK TO YOUR CO-DRIVER</h2><button className="outline-button" onClick={listen}>{listening?"🎙 Listening…":"🎙 Speak to co-driver"}</button></header>
            <form className="ask-row" onSubmit={e=>{e.preventDefault();ask();}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Or type a question — e.g. fuel, distance, rest, gear" aria-label="Ask your co-driver"/><button className="primary-button">Ask</button></form>
            <div className="prompt-row">{prompts.map(p=><button key={p} onClick={()=>ask(p)}>{p}</button>)}</div>
            <div className="messages" aria-live="polite">{messages.map((m,i)=><article key={m.time+"-"+i} className={"message "+(m.from==="You"?"from-user":"")}><div className="message-head"><b>{m.from}</b><small>{m.time}</small></div><p>{m.text}</p></article>)}</div>
            <div className="chat-footer"><span><i/> CO-DRIVER READY</span><span>Responses may use demo data</span></div>
          </section>
          <section className="panel voice-commands" id="voice-commands"><header className="panel-heading"><h2><i/> VOICE COMMANDS</h2><span className="soft-tag">BROWSER AUDIO</span></header><div className="setting-row"><div><b>Listen for voice commands</b><p>Enable the V keyboard shortcut to start a one-phrase voice command. Avoid typing in a field when using the shortcut.</p></div>{toggle(voiceCommands,setVoiceCommands,"Enable voice commands")}</div>{voiceCommands&&<button className="primary-button full-button" onClick={listen}>{listening?"Listening — speak now":"Start voice command"}</button>}<div className="setting-fields"><label>VOICE SHORTCUT KEY<input value="V" readOnly aria-label="Voice shortcut key"/></label><label>ACTIVE APP PROFILE<select value={profile} onChange={e=>setProfile(e.target.value)}><option>American Truck Simulator</option><option>Euro Truck Simulator 2</option>{customProfiles.map(p=><option key={p}>{p}</option>)}</select></label></div><p className="helper-text">V1 works as a browser companion for any app. Game-aware readings require a compatible integration.</p></section>
        </div>
        <div className="right-column">
          <section className="panel" id="voice-settings"><header className="panel-heading"><h2><i/> VOICE & PERSONALITY</h2><button className="outline-button" onClick={()=>say("Welcome back to BC Truck Works. Keep on truckin'.")}>▶ Test voice</button></header><div className="setting-row"><div><b>Co-driver speaks</b><p>Uses this device's speech output.</p></div>{toggle(voiceOn,setVoiceOn,"Enable spoken responses")}</div><label className="field-label">PERSONALITY<select value={personality} onChange={e=>setPersonality(e.target.value)}><option>Friendly & Professional</option><option>Calm Long-Haul Partner</option><option>Energetic Convoy Buddy</option><option>Short & Straight to the Point</option><option>Funny Trucking Buddy</option></select></label><label className="field-label">VOICE<select value={voice} onChange={e=>setVoice(e.target.value)}>{["Automatic English voice",...new Set(voices)].map(v=><option key={v}>{v}</option>)}</select></label><div className="sliders">{[["SPEED",speed,setSpeed,.6,1.5,.1],["PITCH",pitch,setPitch,.6,1.5,.1],["VOLUME",volume,setVolume,0,1,.05]].map(([label,val,setter,min,max,step])=><label key={label}>{label}<input type="range" min={min} max={max} step={step} value={val} onChange={e=>setter(Number(e.target.value))}/></label>)}</div></section>
          <section className="panel callouts" id="callouts"><header className="panel-heading"><h2><i/> AUTOMATIC CALLOUTS</h2></header>{initialCallouts.map(([key,label])=><div className="callout-row" key={key}><span>{label}</span>{toggle(!!callouts[key],checked=>setCallouts(old=>({...old,[key]:checked})),label)}</div>)}</section>
          <section className="panel app-profiles" id="app-profiles"><header className="panel-heading"><h2><i/> APP PROFILES</h2><button className="text-button" onClick={()=>setShowProfiles(v=>!v)}>{showProfiles?"Close":"Manage"}</button></header><p>Current profile: <b>{profile}</b></p><p className="helper-text">No app whitelist. Add a profile for any game or application.</p>{showProfiles&&<form className="profile-form" onSubmit={addProfile}><input value={profileInput} onChange={e=>setProfileInput(e.target.value)} placeholder="Any app or game name"/><button className="primary-button">Add</button></form>}{showProfiles&&customProfiles.map(p=><div className="custom-profile" key={p}><button onClick={()=>setProfile(p)}>{p}</button><button onClick={()=>removeProfile(p)}>Remove</button></div>)}</section>
        </div>
      </div>
      <footer className="footer"><span>BC TRUCK WORKS · DRIVE · BUILD · SUCCEED</span><span>LIVE COMPANION V1.0 · {clock}</span></footer>
    </section>
  </main>;
}
