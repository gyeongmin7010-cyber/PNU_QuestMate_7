const https = require('https');
const zlib = require('zlib');

const SOURCES = {
  meals: 'https://m.pusan.ac.kr/ko/meals',
  seats: 'https://m.pusan.ac.kr/ko/seat',
  notices: 'https://m.pusan.ac.kr/ko/notice/cover/list/1?current=notice',
  academic: 'https://m.pusan.ac.kr/ko/notice/cover/list/1?current=haksa'
};

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'no-store, max-age=0'
};

const FALLBACK = {
  meals: [
    { title:'금정회관 학생식당', meta:'부산대 식단 안내 대상 식당' },
    { title:'학생회관 학생식당', meta:'부산대 식단 안내 대상 식당' },
    { title:'문창회관·샛벌회관 식당 확인', meta:'학식 선택 후보' }
  ],
  seats: [
    { title:'새벽벌도서관 학습공간 확인', meta:'학습형 3시간 퀘스트 추천 장소' },
    { title:'미리내열람실 좌석현황 확인', meta:'조용한 학습공간 후보' },
    { title:'좌석 많은 공간 우선 추천', meta:'혼잡도 기반 추천 항목' }
  ],
  notices: [
    { title:'장학·비교과 공지 확인', meta:'공지 요약·마감일 확인 미션' },
    { title:'학생지원 공지 확인', meta:'대상자·신청방법 확인 미션' },
    { title:'이번 주 마감 공지 정리', meta:'공지 퀴즈형 미션' }
  ],
  academic: [
    { title:'기말고사 기간 확인', meta:'학사일정 기반 학습계획 미션' },
    { title:'성적입력·열람 기간 확인', meta:'다가오는 학사일정' },
    { title:'휴·복학 신청기간 확인', meta:'학사 행정 체크 미션' },
    { title:'수강신청·희망과목담기 일정 확인', meta:'다음 학기 준비 미션' }
  ]
};

function httpGet(url, timeoutMs=8000){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{
      timeout:timeoutMs,
      headers:{
        'user-agent':'Mozilla/5.0 (compatible; PNU QuestMate V7)',
        'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language':'ko-KR,ko;q=0.9,en;q=0.7',
        'accept-encoding':'gzip,deflate,br'
      }
    },res=>{
      const chunks=[];
      res.on('data',d=>chunks.push(d));
      res.on('end',()=>{
        const buffer=Buffer.concat(chunks);
        const enc=String(res.headers['content-encoding']||'').toLowerCase();
        const done=(err,decoded)=>{
          if(err) return reject(err);
          resolve({status:res.statusCode,text:decoded.toString('utf8')});
        };
        if(enc.includes('gzip')) zlib.gunzip(buffer,done);
        else if(enc.includes('deflate')) zlib.inflate(buffer,done);
        else if(enc.includes('br')) zlib.brotliDecompress(buffer,done);
        else done(null,buffer);
      });
    });
    req.on('timeout',()=>req.destroy(new Error('timeout')));
    req.on('error',reject);
  });
}

function decode(s){
  return String(s||'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&#039;|&#39;/g,"'").replace(/&quot;/g,'"')
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(parseInt(d,10)));
}
function strip(html){
  return decode(String(html||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/li>|<\/tr>|<\/p>|<\/div>|<\/a>|<\/span>|<\/h\d>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/[ \t\r]+/g,' ')
    .replace(/\n\s+/g,'\n')
    .replace(/\n{2,}/g,'\n')).trim();
}
function clean(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function junk(s){
  const x=clean(s);
  if(x.length<4 || x.length>90) return true;
  if(/\(46241\)|부산광역시|취업전략과|TEL|FAX|개인정보|저작권|로그인|전체메뉴|사이트맵|COPYRIGHT|PUSAN NATIONAL UNIVERSITY|바로가기|처음|끝/i.test(x)) return true;
  if(/^[\d\s.:-]+$/.test(x)) return true;
  return false;
}
function push(arr,title,meta){
  const t=clean(title);
  if(junk(t)) return;
  if(!arr.some(x=>x.title===t)) arr.push({title:t,meta});
}
function lines(text){
  return String(text||'').split(/\n|(?=20\d{2}\.\d{2}\.\d{2})|(?=조식)|(?=중식)|(?=석식)|(?=새벽벌)|(?=미리내)|(?=잔여)|(?=공지)|(?=학사)|(?=신청)|(?=장학)|(?=수강)|(?=시험)/g).map(clean).filter(Boolean);
}
function parseMeals(t,status){
  const arr=[], meta=`공개 식단 페이지 · HTTP ${status}`;
  const known=['금정회관 교직원 식당','금정회관 학생식당','학생회관 교직원 식당','학생회관 학생 식당','학생회관 학생식당','문창회관','샛벌회관'];
  if(t.includes('등록된 식단이 없습니다')) push(arr,'등록된 식단이 없습니다.',meta);
  for(const k of known) if(t.includes(k) || t.includes(k.replace(/\s+/g,''))) push(arr,k,meta);
  for(const l of lines(t)){
    if(/(조식|중식|석식|메뉴|식단|백반|정식|덮밥|국밥|돈까스|카레|비빔|찌개|라면)/.test(l)) push(arr,l,meta);
    if(arr.length>=8) break;
  }
  return arr.length?arr.slice(0,8):FALLBACK.meals;
}
function parseSeats(t,status){
  const arr=[], meta=`공개 좌석 페이지 · HTTP ${status}`;
  for(const l of lines(t)){
    if(/(새벽벌|미리내|열람실|좌석|잔여|도서관|이용가능|나노생명)/.test(l)) push(arr,l,meta);
    if(arr.length>=8) break;
  }
  return arr.length?arr.slice(0,8):FALLBACK.seats;
}
function parseNotices(t,status){
  const arr=[], meta=`공개 공지 페이지 · HTTP ${status}`;
  for(const l of lines(t)){
    if(/(공지|안내|모집|신청|장학|비교과|학생|프로그램|교육|마감|행사)/.test(l)) push(arr,l,meta);
    if(arr.length>=8) break;
  }
  return arr.length?arr.slice(0,8):FALLBACK.notices;
}
function parseAcademic(t,status){
  const arr=[], meta=`공개 학사일정 페이지 · HTTP ${status}`;
  const re=/([^\n]{2,70}?)\s+(20\d{2}\.\d{2}\.\d{2})\s*-\s*(20\d{2}\.\d{2}\.\d{2})/g;
  let m;
  const words=/(수업|성적|휴·복학|휴학|복학|등록금|기말고사|고사|계절|수강|정정|희망과목|학위수여식|출석부|폐강|졸업|개강|종강)/;
  while((m=re.exec(t)) && arr.length<8){
    const title=clean(m[1]).replace(/^\d+\s*/,'');
    if(words.test(title) && !/(공지|채용|모집|특강|기념식)/.test(title)) push(arr,title,`${m[2]} ~ ${m[3]} · ${meta}`);
  }
  return arr.length?arr:FALLBACK.academic;
}
function parse(kind,text,status){
  if(kind==='meals') return parseMeals(text,status);
  if(kind==='seats') return parseSeats(text,status);
  if(kind==='notices') return parseNotices(text,status);
  if(kind==='academic') return parseAcademic(text,status);
  return [];
}
async function source(kind,url){
  try{
    const r=await httpGet(url);
    const text=strip(r.text);
    const data=parse(kind,text,r.status);
    return {ok:true,status:r.status,count:data.length,data};
  }catch(e){
    return {ok:false,status:null,count:FALLBACK[kind].length,data:FALLBACK[kind]};
  }
}
function respond(statusCode,body){ return {statusCode,headers,body:JSON.stringify(body)}; }

exports.handler=async(event)=>{
  if(event && event.httpMethod==='OPTIONS') return {statusCode:204,headers,body:''};
  try{
    const entries=await Promise.all(Object.entries(SOURCES).map(async([k,u])=>[k,await source(k,u)]));
    const res=Object.fromEntries(entries);
    const okCount=Object.values(res).filter(x=>x.ok).length;
    return respond(200,{
      version:'v7-final',
      mode: okCount>=2?'live':'guided',
      fetchedAt:new Date().toISOString(),
      meals:res.meals.data,
      seats:res.seats.data,
      notices:res.notices.data,
      academic:res.academic.data
    });
  }catch(e){
    return respond(200,{version:'v7-final',mode:'guided',fetchedAt:new Date().toISOString(),...FALLBACK});
  }
};