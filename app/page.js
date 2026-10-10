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
function replyFor(input, personality) {
  const q = input.toLowerCase();
  let answer;
  if (q.includes("joke")) answer = "Why did the truck driver bring a ladder? To reach the next level of the highway. Keep on truckin'!";
  else if (q.includes("fuel")) answer = "Live fuel level and range will appear when a supported telemetry source is connected.";
  else if (q.includes("rest") || q.includes("sleep")) answer = "Your rest plan needs the game's current route, driving time, and fatigue data. Connect telemetry for a live estimate.";
  else if (q.includes("far") || q.includes("destination") || q.includes("mile")) answer = "Destination distance needs active navigation data from a connected game telemetry feed.";
  else if (q.includes("gear") || q.includes("shift")) answer = "Live shift coaching needs your truck's speed, RPM, gear, and engine data. Until connected, follow the RPM band and road load.";
  else if (q.includes("damage")) answer = "A live truck and cargo damage report needs a connected telemetry source.";
  else if (q.includes("make it") || q.includes("deadline")) answer = "Delivery estimates need the remaining distance, job deadline, and rest limits from your active job.";
  else answer = "I'm your BC Truck Works co-driver. Ask me about fuel, distance, rest, gear, delivery timing, damage, or ask for a joke. Live driving answers require a supported telemetry connection.";
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
    const answer=replyFor(q,personality);
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
  function addProfile(e){e.preventDefault();const name=profileInput.trim();if(!name)return;setCustomProfiles(old=>[...new Set([...old,name])]);setProfile(name);setProfileInput("");setNotice("Custom app profile saved in this browser.");}
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
  const toggle=(checked,setter,label)=><input className="toggle" type="checkbox" checked={checked} onChange={e=>setter(e.target.checked)} aria-label={label}/>;
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span>BC</span><small>TRUCK WORKS</small></div><strong>BC TRUCK WORKS</strong><b>LIVE COMPANION</b><small className="version">V1.0 · DRIVER EDITION</small></div>
      {navGroups.map(([group,items])=><section className="nav-group" key={group}><div className="nav-label">{group}</div>{items.map(([icon,label])=><button type="button" key={label} className={"nav-item "+(label==="Co-Driver"?"active":"")} onClick={()=>label!=="Co-Driver"&&setNotice(label+" module is planned for a future release. Co-Driver is the active V1 module.")}><span>{icon}</span>{label}</button>)}</section>)}
      <div className="sidebar-bottom"><b>DRIVE · BUILD · SUCCEED</b><span>Built for the road ahead.</span><span>BC Truck Works © 2026</span></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="page-title"><div className="mini-mark">BC</div><div><h1>BC TRUCK WORKS <span>• LIVE COMPANION</span></h1><p>YOUR RIDE · YOUR ROUTE · YOUR SUPPORT</p></div></div><div className={"status-pill "+(liveTelemetry?.connected&&liveTelemetry?.valuesAreLive?"status-live":liveTelemetry?"status-bridge":"status-web")}><i/> <b>{liveTelemetry?.connected&&liveTelemetry?.valuesAreLive?"LIVE":liveTelemetry?"BRIDGE":"WEB ONLINE"}</b> <span>{clock}</span></div></header>
      <div className="metrics">{metrics.map(m=><article className="metric" key={m[0]}><div className="metric-icon">{m[3]}</div><div className="metric-label">{m[0]}</div><strong>{m[1]}</strong><small>{m[2]}</small></article>)}</div>
      <div className="notice"><b>STATUS</b><span>{notice}</span></div>
      <div className="content-grid">
        <div className="left-column">
          <section className="panel chat-panel"><header className="panel-heading"><h2><i/> TALK TO YOUR CO-DRIVER</h2><button className="outline-button" onClick={listen}>{listening?"🎙 Listening…":"🎙 Speak to co-driver"}</button></header>
            <form className="ask-row" onSubmit={e=>{e.preventDefault();ask();}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Or type a question — e.g. fuel, distance, rest, gear" aria-label="Ask your co-driver"/><button className="primary-button">Ask</button></form>
            <div className="prompt-row">{prompts.map(p=><button key={p} onClick={()=>ask(p)}>{p}</button>)}</div>
            <div className="messages" aria-live="polite">{messages.map((m,i)=><article key={m.time+"-"+i} className={"message "+(m.from==="You"?"from-user":"")}><div className="message-head"><b>{m.from}</b><small>{m.time}</small></div><p>{m.text}</p></article>)}</div>
            <div className="chat-footer"><span><i/> CO-DRIVER READY</span><span>Responses may use demo data</span></div>
          </section>
          <section className="panel voice-commands"><header className="panel-heading"><h2><i/> VOICE COMMANDS</h2><span className="soft-tag">BROWSER AUDIO</span></header><div className="setting-row"><div><b>Listen for voice commands</b><p>Use your microphone to ask questions by voice. Browser support varies.</p></div>{toggle(voiceCommands,setVoiceCommands,"Enable voice commands")}</div>{voiceCommands&&<button className="primary-button full-button" onClick={listen}>{listening?"Listening — speak now":"Start voice command"}</button>}<div className="setting-fields"><label>PUSH-TO-TALK KEY<input value="V" readOnly aria-label="Push to talk key"/></label><label>ACTIVE APP PROFILE<select value={profile} onChange={e=>setProfile(e.target.value)}><option>American Truck Simulator</option><option>Euro Truck Simulator 2</option>{customProfiles.map(p=><option key={p}>{p}</option>)}</select></label></div><p className="helper-text">V1 works as a browser companion for any app. Game-aware readings require a compatible integration.</p></section>
        </div>
        <div className="right-column">
          <section className="panel"><header className="panel-heading"><h2><i/> VOICE & PERSONALITY</h2><button className="outline-button" onClick={()=>say("Welcome back to BC Truck Works. Keep on truckin'.")}>▶ Test voice</button></header><div className="setting-row"><div><b>Co-driver speaks</b><p>Uses this device's speech output.</p></div>{toggle(voiceOn,setVoiceOn,"Enable spoken responses")}</div><label className="field-label">PERSONALITY<select value={personality} onChange={e=>setPersonality(e.target.value)}><option>Friendly & Professional</option><option>Calm Long-Haul Partner</option><option>Energetic Convoy Buddy</option><option>Short & Straight to the Point</option><option>Funny Trucking Buddy</option></select></label><label className="field-label">VOICE<select value={voice} onChange={e=>setVoice(e.target.value)}>{["Automatic English voice",...new Set(voices)].map(v=><option key={v}>{v}</option>)}</select></label><div className="sliders">{[["SPEED",speed,setSpeed,.6,1.5,.1],["PITCH",pitch,setPitch,.6,1.5,.1],["VOLUME",volume,setVolume,0,1,.05]].map(([label,val,setter,min,max,step])=><label key={label}>{label}<input type="range" min={min} max={max} step={step} value={val} onChange={e=>setter(Number(e.target.value))}/></label>)}</div></section>
          <section className="panel callouts"><header className="panel-heading"><h2><i/> AUTOMATIC CALLOUTS</h2></header>{initialCallouts.map(([key,label])=><div className="callout-row" key={key}><span>{label}</span>{toggle(!!callouts[key],checked=>setCallouts(old=>({...old,[key]:checked})),label)}</div>)}</section>
          <section className="panel app-profiles"><header className="panel-heading"><h2><i/> APP PROFILES</h2><button className="text-button" onClick={()=>setShowProfiles(v=>!v)}>{showProfiles?"Close":"Manage"}</button></header><p>Current profile: <b>{profile}</b></p><p className="helper-text">No app whitelist. Add a profile for any game or application.</p>{showProfiles&&<form className="profile-form" onSubmit={addProfile}><input value={profileInput} onChange={e=>setProfileInput(e.target.value)} placeholder="Any app or game name"/><button className="primary-button">Add</button></form>}{showProfiles&&customProfiles.map(p=><div className="custom-profile" key={p}><button onClick={()=>setProfile(p)}>{p}</button><button onClick={()=>setCustomProfiles(old=>old.filter(x=>x!==p))}>Remove</button></div>)}</section>
        </div>
      </div>
      <footer className="footer"><span>BC TRUCK WORKS · DRIVE · BUILD · SUCCEED</span><span>LIVE COMPANION V1.0 · {clock}</span></footer>
    </section>
  </main>;
}
