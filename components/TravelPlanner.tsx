"use client";
import { useState, useCallback } from "react";

const AMADEUS_BASE = "https://test.api.amadeus.com";
const DEFAULT_KEY    = "MsO24cAqGMHsRUZoUrqsHW5LjDCi45OA";
const DEFAULT_SECRET = "nVgVzONG5lYdeom6";

const AIRPORTS: Record<string,string> = {
  HND:"Tokyo Haneda (HND)",NRT:"Tokyo Narita (NRT)",KIX:"Osaka Kansai (KIX)",
  NGO:"Nagoya (NGO)",FUK:"Fukuoka (FUK)",OKA:"Okinawa (OKA)",CTS:"Sapporo (CTS)",
  BKK:"Bangkok Suvarnabhumi (BKK)",DMK:"Bangkok Don Mueang (DMK)",SIN:"Singapore (SIN)",
  HKG:"Hong Kong (HKG)",TPE:"Taipei Taoyuan (TPE)",KUL:"Kuala Lumpur (KUL)",
  DPS:"Bali (DPS)",MNL:"Manila (MNL)",ICN:"Seoul Incheon (ICN)",
  SGN:"Ho Chi Minh City (SGN)",HAN:"Hanoi (HAN)",CGK:"Jakarta (CGK)",
  LHR:"London Heathrow (LHR)",CDG:"Paris CDG (CDG)",AMS:"Amsterdam (AMS)",
  FRA:"Frankfurt (FRA)",BCN:"Barcelona (BCN)",FCO:"Rome (FCO)",
  SYD:"Sydney (SYD)",LAX:"Los Angeles (LAX)",JFK:"New York JFK (JFK)",
  DXB:"Dubai (DXB)",DOH:"Doha (DOH)",
};

const CITY_MAP: Record<string,string> = {
  HND:"TYO",NRT:"TYO",KIX:"OSA",NGO:"NGO",FUK:"FUK",OKA:"OKA",CTS:"SPK",
  BKK:"BKK",DMK:"BKK",SIN:"SIN",HKG:"HKG",TPE:"TPE",KUL:"KUL",
  DPS:"DPS",MNL:"MNL",ICN:"SEL",SGN:"SGN",HAN:"HAN",CGK:"JKT",
  LHR:"LON",CDG:"PAR",AMS:"AMS",FRA:"FRA",BCN:"BCN",FCO:"ROM",
  SYD:"SYD",LAX:"LAX",JFK:"NYC",DXB:"DXB",DOH:"DOH",
};

const CITY_NAMES: Record<string,string> = {
  HND:"Tokyo",NRT:"Tokyo",KIX:"Osaka",NGO:"Nagoya",FUK:"Fukuoka",OKA:"Okinawa",CTS:"Sapporo",
  BKK:"Bangkok",DMK:"Bangkok",SIN:"Singapore",HKG:"Hong Kong",TPE:"Taipei",KUL:"Kuala Lumpur",
  DPS:"Bali",MNL:"Manila",ICN:"Seoul",SGN:"Ho Chi Minh City",HAN:"Hanoi",CGK:"Jakarta",
  LHR:"London",CDG:"Paris",AMS:"Amsterdam",FRA:"Frankfurt",BCN:"Barcelona",FCO:"Rome",
  SYD:"Sydney",LAX:"Los Angeles",JFK:"New York",DXB:"Dubai",DOH:"Doha",
};

const LCC = new Set(["MM","GK","BC","7G","AK","QZ","FD","XJ","DD","Z2","TR","3K","VJ","QH","JT","SL","FR","U2","VY","W6","NK","F9","B6","SB"]);
const GLOBAL_KEYWORDS = ["marriott","hilton","hyatt","ihg","accor","radisson","wyndham","bestwestern","sheraton","westin","intercontinental","crowneplaza","holidayinn","novotel","sofitel","mercure","ibis","pullman","fairmont","raffles","ritzcarlton","doubletree","courtyard","hamptoninn","fourseasons","stregis","jwmarriott","swissotel","renaissance","lemeridien","andaz","aloft","moxy","autograph"];
const BAGGAGE: Record<string,number> = {MM:3300,GK:3300,BC:3300,AK:3000,QZ:3500,FD:3500,TR:4000,FR:4500,U2:4000,VY:4000,default:3500};

const AIRLINE_NAMES: Record<string,string> = {
  NH:"ANA (All Nippon Airways)",JL:"Japan Airlines",MM:"Peach Aviation",
  GK:"Jetstar Japan",BC:"Skymark Airlines",
  AK:"AirAsia",QZ:"AirAsia Indonesia",FD:"Thai AirAsia",XJ:"Thai AirAsia X",
  DD:"Nok Air",Z2:"AirAsia Philippines",TR:"Scoot",
  TG:"Thai Airways",SQ:"Singapore Airlines",MH:"Malaysia Airlines",
  GA:"Garuda Indonesia",PR:"Philippine Airlines",VN:"Vietnam Airlines",
  KE:"Korean Air",OZ:"Asiana Airlines",CX:"Cathay Pacific",
  CI:"China Airlines",BR:"EVA Air",JX:"Starlux Airlines",
  EK:"Emirates",QR:"Qatar Airways",EY:"Etihad Airways",
  LH:"Lufthansa",BA:"British Airways",AF:"Air France",
  KL:"KLM Royal Dutch Airlines",IB:"Iberia",AZ:"ITA Airways",
  AA:"American Airlines",UA:"United Airlines",DL:"Delta Air Lines",QF:"Qantas",
};
const airlineName=(code:string)=>AIRLINE_NAMES[code]||code;
const airlineLogoUrl=(code:string)=>`https://content.airhex.com/content/logos/airlines_${code}_64_64_s.png`;

// price_level → estimated JPY per night range
const PRICE_BANDS: Record<number,{label:string;color:string}> = {
  0:{label:"Budget  (~¥5,000–15,000/night)",color:"#16A34A"},
  1:{label:"Economy  (~¥8,000–20,000/night)",color:"#16A34A"},
  2:{label:"Moderate  (~¥20,000–40,000/night)",color:"#0B7FBF"},
  3:{label:"Upscale  (~¥40,000–80,000/night)",color:"#7C3AED"},
  4:{label:"Luxury  (¥80,000+/night)",color:"#B45309"},
};

const toJPY = (v:number|string) => new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(Math.round(parseFloat(String(v))));
const fmtDur = (s?:string) => s?.replace("PT","").replace("H","h ").replace("M","m")||"";
const fmtTime = (s?:string) => s?.split("T")[1]?.slice(0,5)||"";
const fmtDate = (s?:string) => {if(!s)return"";const d=new Date(s);return d.toLocaleString("en",{month:"short",day:"numeric"});};
const getHour = (s?:string) => parseInt(s?.split("T")[1]?.split(":")[0]||"0");
const timeCat = (s?:string) => {const h=getHour(s);return h>=5&&h<12?"morning":h>=12&&h<18?"afternoon":"night";};
const isGlobal = (name?:string) => GLOBAL_KEYWORDS.some(g=>name?.toLowerCase().replace(/[^a-z]/g,"").includes(g));

// ── Amadeus ──────────────────────────────────────────────────
async function getToken(key:string,secret:string){
  const r=await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:`grant_type=client_credentials&client_id=${key}&client_secret=${secret}`});
  const d=await r.json();
  if(!r.ok) throw new Error(d.error_description||"Authentication failed");
  return d.access_token as string;
}
async function fetchFlights(token:string,params:{origin:string;dest:string;dep:string;ret:string}){
  const u=new URL(`${AMADEUS_BASE}/v2/shopping/flight-offers`);
  u.searchParams.set("originLocationCode",params.origin);
  u.searchParams.set("destinationLocationCode",params.dest);
  u.searchParams.set("departureDate",params.dep);
  if(params.ret) u.searchParams.set("returnDate",params.ret);
  u.searchParams.set("adults","1");u.searchParams.set("max","50");u.searchParams.set("currencyCode","JPY");
  const r=await fetch(u.toString(),{headers:{Authorization:`Bearer ${token}`}});
  const d=await r.json();
  if(!r.ok) throw new Error(d.errors?.[0]?.detail||"Flight search failed");
  return d.data as any[]||[];
}
async function fetchHotelList(token:string,cityCode:string){
  const u=new URL(`${AMADEUS_BASE}/v1/reference-data/locations/hotels/by-city`);
  u.searchParams.set("cityCode",cityCode);u.searchParams.set("radius","30");u.searchParams.set("radiusUnit","KM");u.searchParams.set("hotelSource","ALL");
  const r=await fetch(u.toString(),{headers:{Authorization:`Bearer ${token}`}});
  const d=await r.json();
  if(!r.ok) throw new Error(d.errors?.[0]?.detail||"Hotel search failed");
  return d.data as any[]||[];
}

// ── Google Places ────────────────────────────────────────────
async function searchPlace(hotelName:string,cityName:string,googleKey:string){
  const q=`${hotelName} hotel ${cityName}`;
  const r=await fetch(`/api/places?query=${encodeURIComponent(q)}&key=${encodeURIComponent(googleKey)}`);
  const d=await r.json();
  const result=d.results?.[0];
  if(!result) return null;
  return {
    placeId:result.place_id as string,
    rating:result.rating as number,
    userRatingsTotal:result.user_ratings_total as number,
    priceLevel:result.price_level as number,
    photoRef:result.photos?.[0]?.photo_reference as string|undefined,
  };
}
function photoUrl(photoRef:string,googleKey:string){
  return `/api/places?photo_reference=${encodeURIComponent(photoRef)}&key=${encodeURIComponent(googleKey)}`;
}

// ── Design tokens ────────────────────────────────────────────
const C={
  navy:"#0B1F4A",navyDark:"#071535",navyMid:"#1A3A6E",
  blue:"#1B5FBF",blueMid:"#2B72D8",blueLight:"#4A9EF5",
  sky:"#E8F2FD",skyMid:"#D0E6FA",
  white:"#FFFFFF",offWhite:"#F7FAFF",
  slate:"#64748B",slateLight:"#94A3B8",
  border:"#DCE8F5",success:"#16A34A",red:"#DC2626",
};
type CSSObj=React.CSSProperties;
const S:Record<string,CSSObj>={
  input:{width:"100%",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.navy,fontSize:14,outline:"none",boxSizing:"border-box"},
  select:{width:"100%",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.navy,fontSize:14,cursor:"pointer",outline:"none",boxSizing:"border-box",appearance:"none"},
  card:{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(11,31,74,0.06)"},
  label:{fontSize:11,color:C.slate,display:"block",marginBottom:7,letterSpacing:1.2,textTransform:"uppercase" as const,fontWeight:600},
  pill:{background:C.offWhite,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"7px 14px",color:C.slate,fontSize:12,cursor:"pointer",transition:"all 0.15s",fontWeight:500},
  pillOn:{background:C.sky,border:`1.5px solid ${C.blueMid}`,color:C.blue,fontWeight:600},
  btn:{background:`linear-gradient(135deg,${C.navy} 0%,${C.blueMid} 100%)`,border:"none",borderRadius:10,padding:"15px 40px",color:C.white,fontSize:15,fontWeight:600,cursor:"pointer",width:"100%",letterSpacing:0.3,boxShadow:"0 4px 16px rgba(27,95,191,0.35)"},
  back:{background:C.white,border:`1.5px solid ${C.border}`,borderRadius:8,padding:"9px 18px",color:C.slate,fontSize:13,cursor:"pointer",fontWeight:500},
  dim:{color:C.slateLight,fontSize:12},
};

// ── Sub-components ───────────────────────────────────────────
function StepHeader({n,title,subtitle}:{n:string;title:string;subtitle?:string}){
  return(
    <div style={{marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.navy},${C.blueMid})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.white,flexShrink:0}}>{n}</div>
        <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:22,margin:0,color:C.navy,fontWeight:700}}>{title}</h2>
      </div>
      {subtitle&&<div style={{fontSize:13,color:C.slate,marginLeft:40}}>{subtitle}</div>}
    </div>
  );
}
function Spin({dark=false}:{dark?:boolean}){
  return<span style={{display:"inline-block",width:16,height:16,border:`2px solid ${dark?"rgba(11,31,74,0.2)":"rgba(255,255,255,0.3)"}`,borderTopColor:dark?C.navy:C.white,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>;
}
function Tag({lcc}:{lcc:boolean}){
  return<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,letterSpacing:0.8,fontWeight:600,background:lcc?"#EFF6FF":"#F0FDF4",color:lcc?C.blueMid:C.success,border:lcc?`1px solid #BFDBFE`:`1px solid #BBF7D0`}}>{lcc?"LCC":"FSC"}</span>;
}
function Stars({rating,count}:{rating:number;count?:number}){
  const full=Math.floor(rating);
  const half=rating-full>=0.5;
  return(
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{display:"flex",gap:1}}>
        {[1,2,3,4,5].map(i=>(
          <span key={i} style={{fontSize:13,color:i<=full?"#F59E0B":i===full+1&&half?"#F59E0B":"#D1D5DB",opacity:i===full+1&&half?0.6:1}}>★</span>
        ))}
      </div>
      <span style={{fontSize:13,fontWeight:700,color:C.navy}}>{rating.toFixed(1)}</span>
      {count!=null&&<span style={{fontSize:11,color:C.slateLight}}>({count.toLocaleString()} reviews)</span>}
    </div>
  );
}
function Leg({label,segs,duration,style={}}:{label:string;segs:any[];duration:string;style?:CSSObj}){
  const dep=segs[0]?.departure,arr=segs[segs.length-1]?.arrival;
  return(
    <div style={style}>
      <div style={{fontSize:10,color:C.slateLight,letterSpacing:1.2,marginBottom:6,fontWeight:600,textTransform:"uppercase"}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div>
          <span style={{fontSize:22,fontWeight:300,color:C.navy,fontFamily:"'Sora',sans-serif"}}>{fmtTime(dep?.at)}</span>
          <div style={{fontSize:11,color:C.slate,marginTop:2}}>{dep?.iataCode}·{fmtDate(dep?.at)}</div>
        </div>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:11,color:C.slateLight,marginBottom:4}}>{fmtDur(duration)}</div>
          <div style={{position:"relative",height:1,background:C.border}}>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:C.white,padding:"0 4px",fontSize:14,color:C.blueMid}}>✈</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <span style={{fontSize:22,fontWeight:300,color:C.navy,fontFamily:"'Sora',sans-serif"}}>{fmtTime(arr?.at)}</span>
          <div style={{fontSize:11,color:C.slate,marginTop:2}}>{arr?.iataCode}·{fmtDate(arr?.at)}</div>
        </div>
      </div>
    </div>
  );
}
function AirlineLogo({code}:{code:string}){
  const [ok,setOk]=useState(true);
  if(!ok) return<div style={{width:40,height:40,borderRadius:8,background:C.sky,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.blue}}>{code}</div>;
  return<img src={airlineLogoUrl(code)} alt={code} width={40} height={40}
    style={{borderRadius:8,objectFit:"contain",border:`1px solid ${C.border}`,background:C.white,padding:3}}
    onError={()=>setOk(false)}/>;
}
function FlightRow({offer,onSelect,loading}:{offer:any;onSelect:(o:any)=>void;loading:boolean}){
  const [hov,setHov]=useState(false);
  const out=offer.itineraries[0],ret=offer.itineraries[1];
  const segs=out.segments,rSegs=ret?.segments;
  // collect all unique carriers across all legs
  const allCarriers=[...new Set([
    ...segs.map((s:any)=>s.carrierCode),
    ...(rSegs||[]).map((s:any)=>s.carrierCode),
  ])] as string[];
  const carrier=segs[0]?.carrierCode,lcc=LCC.has(carrier);
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{...S.card,borderLeft:`4px solid ${lcc?C.blueLight:C.navy}`,marginBottom:12,boxShadow:hov?"0 4px 20px rgba(11,31,74,0.1)":S.card.boxShadow as string,transition:"box-shadow 0.2s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:24}}>
        <div style={{flex:1}}>
          {/* Airline identity row */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:6}}>
              {allCarriers.map(c=><AirlineLogo key={c} code={c}/>)}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:C.navy,fontFamily:"'Sora',sans-serif",lineHeight:1.2}}>
                {allCarriers.map(c=>airlineName(c)).join(" · ")}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                <span style={{fontSize:11,color:C.slateLight}}>Flight {allCarriers.map((c,i)=>`${c}${segs[i]?.number||""}`).join(", ")}</span>
                <Tag lcc={lcc}/>
                {segs.length>1&&<span style={{...S.dim,fontSize:11}}>· {segs.length-1} stop{segs.length>2?"s":""}</span>}
              </div>
            </div>
          </div>
          <Leg label="Outbound" segs={segs} duration={out.duration}/>
          {rSegs&&<Leg label="Return" segs={rSegs} duration={ret.duration} style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}/>}
        </div>
        <div style={{textAlign:"right",minWidth:190,paddingLeft:20,borderLeft:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,color:C.slateLight,marginBottom:4,letterSpacing:0.8,textTransform:"uppercase",fontWeight:600}}>Total incl. baggage</div>
          <div style={{fontSize:28,fontWeight:700,color:C.navy,fontFamily:"'Sora',sans-serif",lineHeight:1.1}}>{toJPY(offer.totalWithBag)}</div>
          {offer.bagFee>0
            ?<div style={{fontSize:11,color:C.slate,marginTop:5}}>Fare {toJPY(offer.price.total)} + Baggage {toJPY(offer.bagFee)}</div>
            :<div style={{fontSize:11,color:C.success,marginTop:5,fontWeight:500}}>✓ Checked baggage included</div>}
          <button onClick={()=>onSelect(offer)} disabled={loading}
            style={{...S.btn,marginTop:14,padding:"9px 18px",fontSize:13,width:"100%"}}>
            {loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Spin/>Searching...</span>:"Find Hotels →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hotel Card with image + rating + price band ──────────────
function HotelCard({hotel,dep,ret,dest,googleKey}:{hotel:any;dep:string;ret:string;dest:string;googleKey:string}){
  const city=CITY_MAP[dest]||dest;
  const agodaUrl=`https://www.agoda.com/search?city=${city}&checkIn=${dep}&checkOut=${ret||dep}&adults=2&textToSearch=${encodeURIComponent(hotel.name||"")}`;
  const placeData=hotel._place;
  const priceBand=placeData?.priceLevel!=null?PRICE_BANDS[placeData.priceLevel]:null;
  const imgSrc=placeData?.photoRef&&googleKey?photoUrl(placeData.photoRef,googleKey):null;
  const fallback=`https://source.unsplash.com/600x300/?hotel,${encodeURIComponent(CITY_NAMES[dest]||"hotel")}`;

  return(
    <div style={{...S.card,padding:0,overflow:"hidden",display:"flex",flexDirection:"column"}}
      onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 6px 24px rgba(11,31,74,0.12)")}
      onMouseLeave={e=>(e.currentTarget.style.boxShadow=S.card.boxShadow as string)}
      >
      {/* Image */}
      <div style={{width:"100%",height:180,position:"relative",background:C.sky,overflow:"hidden"}}>
        <img
          src={imgSrc||fallback}
          alt={hotel.name}
          style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
          onError={e=>{(e.target as HTMLImageElement).src=fallback;}}
        />
        {/* Rating badge */}
        {placeData?.rating!=null&&(
          <div style={{position:"absolute",top:10,right:10,background:"rgba(255,255,255,0.95)",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:5,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
            <span style={{fontSize:14,color:"#F59E0B"}}>★</span>
            <span style={{fontSize:13,fontWeight:700,color:C.navy}}>{placeData.rating.toFixed(1)}</span>
            <span style={{fontSize:10,color:C.slate}}>Google</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{padding:"16px 18px 18px",display:"flex",flexDirection:"column",gap:10,flex:1}}>
        <div style={{fontSize:14,fontWeight:700,color:C.navy,lineHeight:1.4}}>{hotel.name}</div>

        {/* Rating row */}
        {placeData?.rating!=null&&(
          <Stars rating={placeData.rating} count={placeData.userRatingsTotal}/>
        )}

        {/* Price band */}
        {priceBand&&(
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,fontWeight:700,color:priceBand.color,background:`${priceBand.color}18`,border:`1px solid ${priceBand.color}44`,borderRadius:5,padding:"3px 8px"}}>
              💴 {priceBand.label}
            </span>
          </div>
        )}

        {hotel.address?.cityName&&<div style={{...S.dim,fontSize:12}}>📍 {hotel.address.cityName}</div>}

        <a href={agodaUrl} target="_blank" rel="noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:C.blue,textDecoration:"none",fontWeight:600,marginTop:"auto",padding:"8px 14px",background:C.sky,borderRadius:7,border:`1px solid ${C.skyMid}`,alignSelf:"flex-start",transition:"background 0.15s"}}>
          View on Agoda →
        </a>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function TravelPlanner(){
  const [apiKey,setApiKey]=useState(DEFAULT_KEY);
  const [apiSec,setApiSec]=useState(DEFAULT_SECRET);
  const [googleKey,setGoogleKey]=useState("");
  const [showCfg,setShowCfg]=useState(false);
  const [origin,setOrigin]=useState("HND");
  const [dest,setDest]=useState("BKK");
  const [dep,setDep]=useState("");
  const [ret,setRet]=useState("");
  const [lccOnly,setLccOnly]=useState(false);
  const [depT,setDepT]=useState({morning:true,afternoon:true,night:true});
  const [arrT,setArrT]=useState({morning:true,afternoon:true,night:true});
  const [keyword,setKeyword]=useState("");
  const [step,setStep]=useState<"form"|"flights"|"hotels">("form");
  const [loading,setLoading]=useState(false);
  const [hotelLoading,setHotelLoading]=useState(false);
  const [hotelProgress,setHotelProgress]=useState("");
  const [err,setErr]=useState("");
  const [flights,setFlights]=useState<any[]>([]);
  const [selFlight,setSelFlight]=useState<any>(null);
  const [globalH,setGlobalH]=useState<any[]>([]);
  const [localH,setLocalH]=useState<any[]>([]);

  const today=new Date().toISOString().split("T")[0];
  const toggle=(setter:React.Dispatch<React.SetStateAction<{morning:boolean;afternoon:boolean;night:boolean}>>,key:"morning"|"afternoon"|"night")=>setter(p=>({...p,[key]:!p[key]}));

  const searchFlights=async()=>{
    if(!dep){setErr("Please select a departure date.");return;}
    setErr("");setLoading(true);
    try{
      const tok=await getToken(apiKey,apiSec);
      let list=await fetchFlights(tok,{origin,dest,dep,ret});
      if(lccOnly) list=list.filter((o:any)=>LCC.has(o.itineraries[0].segments[0]?.carrierCode));
      list=list.filter((o:any)=>{
        const segs=o.itineraries[0].segments;
        const dc=timeCat(segs[0]?.departure?.at),ac=timeCat(segs[segs.length-1]?.arrival?.at);
        return depT[dc as keyof typeof depT]&&arrT[ac as keyof typeof arrT];
      });
      list.sort((a:any,b:any)=>parseFloat(a.price.total)-parseFloat(b.price.total));
      list=list.slice(0,5).map((o:any)=>{
        const carrier=o.itineraries[0].segments[0]?.carrierCode;
        const hasBag=(o.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity||0)>0;
        const bagFee=hasBag?0:(BAGGAGE[carrier]||BAGGAGE.default);
        return{...o,hasBag,bagFee,totalWithBag:parseFloat(o.price.total)+bagFee};
      });
      setFlights(list);setStep("flights");
    }catch(e:any){setErr(e.message);}
    finally{setLoading(false);}
  };

  const searchHotels=async(flight:any)=>{
    setSelFlight(flight);setHotelLoading(true);setErr("");setHotelProgress("Fetching hotel list…");
    try{
      const tok=await getToken(apiKey,apiSec);
      const city=CITY_MAP[dest]||dest;
      let hotels=await fetchHotelList(tok,city);

      // keyword filter
      if(keyword){
        const kw=keyword.toLowerCase();
        const f=hotels.filter((h:any)=>h.name?.toLowerCase().includes(kw));
        if(f.length>=10) hotels=f;
      }

      // pre-classify to avoid enriching too many
      const candidates=hotels.slice(0,60);
      const gl_raw=candidates.filter((h:any)=>isGlobal(h.name)).slice(0,20);
      const lo_raw=candidates.filter((h:any)=>!isGlobal(h.name)).slice(0,20);

      // enrich with Google Places
      const enrich=async(list:any[],label:string)=>{
        const results:any[]=[];
        for(let i=0;i<list.length;i++){
          setHotelProgress(`Looking up ${label} hotels… (${i+1}/${list.length})`);
          const h=list[i];
          let placeData=null;
          if(googleKey){
            try{
              placeData=await searchPlace(h.name,CITY_NAMES[dest]||"",googleKey);
              // small delay to avoid rate limiting
              await new Promise(r=>setTimeout(r,150));
            }catch(_){}
          }
          // filter: require rating ≥ 4.0 if google key provided, else include all
          if(placeData&&placeData.rating<4.0) continue;
          results.push({...h,_place:placeData});
          if(results.length>=10) break;
        }
        return results;
      };

      const [glEnriched,loEnriched]=await Promise.all([
        enrich(gl_raw,"global brand"),
        enrich(lo_raw,"local"),
      ]);

      setGlobalH(glEnriched);
      setLocalH(loEnriched);
      setStep("hotels");
    }catch(e:any){setErr(e.message);}
    finally{setHotelLoading(false);setHotelProgress("");}
  };

  // Build a Skyscanner deep-link that pre-selects the specific carrier & date
  const skyscannerUrl=(flight?:any)=>{
    if(!dep) return"#";
    const[y,m,d]=dep.split("-");
    const depDateShort=`${y.slice(2)}${m}${d}`;
    const carrier=flight?.itineraries[0]?.segments[0]?.carrierCode||"";
    const isRoundTrip=!!(flight?.itineraries[1]);
    const retDate=ret?ret.split("-").reduce((a:string,v:string,i:number)=>i===0?a+v.slice(2):a+v,""):"";
    // Skyscanner URL with carrier filter (-IATA = include only that carrier)
    const base=`https://www.skyscanner.jp/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${depDateShort}${isRoundTrip&&retDate?"/"+retDate:"/"}`
    const params=new URLSearchParams({adults:"1",ref:"home"});
    if(carrier) params.set("carriers",`-${carrier}`);
    return`${base}?${params.toString()}`;
  };
  const resetAll=()=>{setStep("form");setFlights([]);setGlobalH([]);setLocalH([]);setSelFlight(null);setErr("");};

  const stepLabels=["Search Flights","Select Flight","Choose Hotel"];
  const stepIdx=step==="form"?0:step==="flights"?1:2;
  const hasGoogle=!!googleKey;

  return(
    <div style={{minHeight:"100vh",background:C.offWhite,fontFamily:"'DM Sans',sans-serif",color:C.navy}}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      {/* Header */}
      <header style={{background:`linear-gradient(135deg,${C.navyDark} 0%,${C.navy} 60%,${C.navyMid} 100%)`,padding:"0 48px",boxShadow:"0 2px 16px rgba(7,21,53,0.25)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",height:72}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#4A9EF5,#1B5FBF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✈</div>
            <div>
              <div style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:700,color:C.white,letterSpacing:-0.3}}>Instant Travel Planner</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",letterSpacing:1,textTransform:"uppercase"}}>Powered by Amadeus</div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {step!=="form"&&<button onClick={resetAll} style={{...S.back,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.7)"}}>← New Search</button>}
            <button onClick={()=>setShowCfg(!showCfg)} style={{...S.back,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",gap:6}}>
              ⚙ Settings
              {!hasGoogle&&<span style={{fontSize:10,background:"#F59E0B",color:"#fff",borderRadius:4,padding:"1px 6px",fontWeight:700}}>SETUP</span>}
            </button>
          </div>
        </div>
        {/* Progress */}
        <div style={{maxWidth:1100,margin:"0 auto",paddingBottom:20}}>
          <div style={{display:"flex",alignItems:"center"}}>
            {stepLabels.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",flex:i<stepLabels.length-1?1:"none" as any}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:i<=stepIdx?C.blueLight:"rgba(255,255,255,0.15)",color:i<=stepIdx?C.navyDark:"rgba(255,255,255,0.4)",transition:"all 0.3s"}}>{i<stepIdx?"✓":i+1}</div>
                  <span style={{fontSize:12,color:i===stepIdx?C.white:"rgba(255,255,255,0.4)",fontWeight:i===stepIdx?600:400,whiteSpace:"nowrap"}}>{s}</span>
                </div>
                {i<stepLabels.length-1&&<div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)",margin:"0 12px"}}><div style={{height:"100%",background:C.blueLight,width:i<stepIdx?"100%":"0%",transition:"width 0.4s"}}/></div>}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* API Config */}
      {showCfg&&(
        <div style={{background:C.sky,borderBottom:`1px solid ${C.skyMid}`,padding:"20px 48px"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <div style={{fontSize:12,fontWeight:600,color:C.navy,marginBottom:12,letterSpacing:0.5}}>API CONFIGURATION</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,alignItems:"end"}}>
              <div><label style={S.label}>Amadeus API Key</label><input value={apiKey} onChange={e=>setApiKey(e.target.value)} style={S.input}/></div>
              <div><label style={S.label}>Amadeus API Secret</label><input type="password" value={apiSec} onChange={e=>setApiSec(e.target.value)} style={S.input}/></div>
              <div>
                <label style={S.label}>
                  Google Maps API Key
                  <span style={{marginLeft:6,color:C.blue,fontSize:10,fontWeight:400,textTransform:"none",letterSpacing:0}}>
                    — enables hotel photos, ratings &amp; price bands
                  </span>
                </label>
                <input placeholder="AIza…" value={googleKey} onChange={e=>setGoogleKey(e.target.value)} style={{...S.input,borderColor:hasGoogle?C.success:C.border}}/>
              </div>
            </div>
            {!hasGoogle&&(
              <div style={{marginTop:12,fontSize:12,color:C.slate,background:C.white,borderRadius:8,padding:"10px 14px",border:`1px solid ${C.border}`}}>
                💡 Without a Google Maps API key, hotels will show fallback images and no ratings filter will be applied.
                Get a free key at <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{color:C.blue}}>console.cloud.google.com</a> (enable <strong>Places API</strong>).
              </div>
            )}
            <div style={{marginTop:14,display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setShowCfg(false)} style={{...S.btn,width:"auto",padding:"10px 24px",fontSize:13}}>Save & Close</button>
            </div>
          </div>
        </div>
      )}

      <main style={{padding:"36px 48px 80px",maxWidth:1100,margin:"0 auto"}}>
        {err&&<div style={{background:"#FEF2F2",border:`1px solid #FECACA`,borderRadius:8,padding:"12px 18px",marginBottom:24,fontSize:14,color:C.red,display:"flex",alignItems:"center",gap:10}}><span>⚠</span>{err}</div>}

        {/* STEP 1 */}
        {step==="form"&&(
          <div style={{animation:"fadeIn 0.35s ease"}}>
            <StepHeader n="1" title="Flight Preferences" subtitle="Set your route, dates, and travel filters"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
              <div><label style={S.label}>Origin</label><select value={origin} onChange={e=>setOrigin(e.target.value)} style={S.select}>{Object.entries(AIRPORTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={S.label}>Destination</label><select value={dest} onChange={e=>setDest(e.target.value)} style={S.select}>{Object.entries(AIRPORTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={S.label}>Departure Date</label><input type="date" min={today} value={dep} onChange={e=>setDep(e.target.value)} style={S.input}/></div>
              <div><label style={S.label}>Return Date <span style={{color:C.slateLight,fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label><input type="date" min={dep||today} value={ret} onChange={e=>setRet(e.target.value)} style={S.input}/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
              <div style={S.card}>
                <label style={S.label}>Carrier Type</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                  {[["all","All airlines"],["lcc","LCC only"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setLccOnly(v==="lcc")} style={{...S.pill,...(lccOnly===(v==="lcc")?S.pillOn:{})}}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <label style={S.label}>Departure Time</label>
                <div style={{display:"flex",gap:8}}>
                  {([["morning","AM"],["afternoon","PM"],["night","Night"]] as const).map(([k,l])=>(
                    <button key={k} onClick={()=>toggle(setDepT,k)} style={{...S.pill,...(depT[k]?S.pillOn:{})}}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <label style={S.label}>Arrival Time</label>
                <div style={{display:"flex",gap:8}}>
                  {([["morning","AM"],["afternoon","PM"],["night","Night"]] as const).map(([k,l])=>(
                    <button key={k} onClick={()=>toggle(setArrT,k)} style={{...S.pill,...(arrT[k]?S.pillOn:{})}}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{...S.card,marginBottom:28}}>
              <label style={S.label}>Hotel Keyword <span style={{color:C.slateLight,fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
              <input placeholder="e.g. beach resort, spa, golf, boutique, city center…" value={keyword} onChange={e=>setKeyword(e.target.value)} style={S.input}/>
            </div>
            <button onClick={searchFlights} disabled={loading} style={{...S.btn,opacity:loading?0.7:1}}>
              {loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><Spin/>Searching flights…</span>:"Search Cheapest Flights →"}
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step==="flights"&&(
          <div style={{animation:"fadeIn 0.35s ease"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap" as const,gap:12}}>
              <StepHeader n="2" title="Select a Flight" subtitle={`${AIRPORTS[origin]} → ${AIRPORTS[dest]}  ·  ${dep}${ret?` → ${ret}`:""}  ·  ${flights.length} result${flights.length!==1?"s":""}`}/>
              <button onClick={()=>setStep("form")} style={S.back}>← Edit Search</button>
            </div>
            {flights.length===0
              ?<div style={{textAlign:"center",padding:"60px 0",color:C.slateLight}}><div style={{fontSize:40,marginBottom:12}}>✈</div>No flights found. Try relaxing your filters.</div>
              :flights.map((o:any)=><FlightRow key={o.id} offer={o} onSelect={searchHotels} loading={hotelLoading}/>)
            }
            {/* Hotel loading overlay */}
            {hotelLoading&&(
              <div style={{position:"fixed",inset:0,background:"rgba(7,21,53,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
                <div style={{background:C.white,borderRadius:16,padding:"32px 48px",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
                  <Spin dark/>
                  <div style={{marginTop:16,fontWeight:600,color:C.navy,fontSize:15}}>{hotelProgress||"Searching hotels…"}</div>
                  <div style={{marginTop:6,color:C.slate,fontSize:12}}>Fetching ratings &amp; photos from Google</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step==="hotels"&&(
          <div style={{animation:"fadeIn 0.35s ease"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap" as const,gap:12}}>
              <StepHeader n="3" title="Choose Your Hotel"
                subtitle={hasGoogle?"Filtered to Google Rating ≥ 4.0 · with photos, ratings, and estimated nightly rates":"Showing available hotels · Add Google API key for ratings filter & photos"}/>
              <button onClick={()=>setStep("flights")} style={S.back}>← Back to Flights</button>
            </div>

            {/* Flight banner */}
            {selFlight&&(
              <div style={{background:`linear-gradient(135deg,${C.sky},${C.white})`,border:`1px solid ${C.skyMid}`,borderRadius:12,padding:"16px 22px",marginBottom:32,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap" as const,gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div style={{fontSize:22}}>✈</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.navy}}>
                      {selFlight.itineraries[0].segments[0]?.carrierCode} {selFlight.itineraries[0].segments[0]?.number}
                      <span style={{marginLeft:12,color:C.blue,fontFamily:"'Sora',sans-serif",fontSize:16}}>{toJPY(selFlight.totalWithBag)}</span>
                    </div>
                    <div style={{...S.dim,marginTop:2}}>Total incl. checked baggage · 1 adult</div>
                  </div>
                </div>
                <a href={skyscannerUrl(selFlight)} target="_blank" rel="noreferrer"
                  style={{background:`linear-gradient(135deg,${C.navy},${C.blueMid})`,color:C.white,textDecoration:"none",padding:"9px 18px",borderRadius:8,fontSize:13,fontWeight:600,boxShadow:"0 2px 8px rgba(27,95,191,0.3)"}}>
                  Book on Skyscanner →
                </a>
              </div>
            )}

            {/* Global */}
            <section style={{marginBottom:40}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:6,height:24,borderRadius:3,background:`linear-gradient(${C.navy},${C.blueMid})`}}/>
                <h3 style={{fontFamily:"'Sora',sans-serif",fontSize:18,margin:0,color:C.navy,fontWeight:700}}>Global Brands</h3>
                <span style={S.dim}>Marriott · Hilton · Hyatt · IHG · Accor</span>
                <span style={{fontSize:11,color:C.slateLight}}>{globalH.length} hotels</span>
              </div>
              <div style={{height:1,background:C.border,marginBottom:18}}/>
              {globalH.length===0
                ?<div style={{...S.dim,padding:"20px 0"}}>No global brand hotels found matching filters.</div>
                :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                  {globalH.map((h:any,i:number)=><HotelCard key={i} hotel={h} dep={dep} ret={ret} dest={dest} googleKey={googleKey}/>)}
                </div>
              }
            </section>

            {/* Local */}
            <section>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:6,height:24,borderRadius:3,background:`linear-gradient(${C.blueLight},${C.skyMid})`}}/>
                <h3 style={{fontFamily:"'Sora',sans-serif",fontSize:18,margin:0,color:C.navy,fontWeight:700}}>Local & Boutique</h3>
                <span style={S.dim}>Independent · Design hotels</span>
                <span style={{fontSize:11,color:C.slateLight}}>{localH.length} hotels</span>
              </div>
              <div style={{height:1,background:C.border,marginBottom:18}}/>
              {localH.length===0
                ?<div style={{...S.dim,padding:"20px 0"}}>No local hotels found matching filters.</div>
                :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                  {localH.map((h:any,i:number)=><HotelCard key={i} hotel={h} dep={dep} ret={ret} dest={dest} googleKey={googleKey}/>)}
                </div>
              }
            </section>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        input[type=date]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:0.6}
        button:disabled{opacity:0.55!important;cursor:not-allowed!important}
        input:focus,select:focus{border-color:${C.blueMid}!important;box-shadow:0 0 0 3px rgba(43,114,216,0.12)}
      `}</style>
    </div>
  );
}
