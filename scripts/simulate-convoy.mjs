const base = process.env.CONVOY_BASE_URL || "http://localhost:3000";
const drivers = [
 {name:"RoadRunner",x:0,z:0,speed:82,fuel:310,limit:90,from:"Bakersfield",to:"Las Vegas",cargo:"Food products",distance:145,eta:118},
 {name:"BlueHaul",x:140,z:70,speed:0,fuel:220,limit:65,from:"Dallas",to:"Houston",cargo:"Machinery",distance:90,eta:80},
 {name:"NightShift",x:-80,z:120,speed:96,fuel:410,limit:100,from:"Seattle",to:"Portland",cargo:"Timber",distance:210,eta:140},
 {name:"CopperCab",x:60,z:-110,speed:54,fuel:125,limit:70,from:"Denver",to:"Cheyenne",cargo:"Auto parts",distance:105,eta:95},
];
async function request(path,body){const r=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||r.statusText);return d;}
for(const d of drivers){const p=await request("/api/pair",{});const paired=await request("/api/pair/complete",{code:p.code,name:d.name});const telemetry={speedKmh:d.speed/0.621371,speedLimitKmh:d.limit/0.621371,fuel:d.fuel,fuelCapacity:600,engineWear:0.08,transmissionWear:0.04,cabinWear:0.12,chassisWear:0.09,wheelWear:0.07,cargoWear:0.03,sourceCity:d.from,destinationCity:d.to,cargo:d.cargo,navigationDistanceKm:d.distance/0.621371,etaMinutes:d.eta,placement:{x:d.x,z:d.z},driving:d.speed>0};await fetch(base+"/api/telemetry",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+paired.token},body:JSON.stringify(telemetry)}).then(async r=>{if(!r.ok)throw new Error(await r.text());});console.log("Simulated",d.name);}
console.log("Four simulator drivers sent one telemetry update. Repeat with a loop for continuously refreshed demo data.");
