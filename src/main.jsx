import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const CLO_MAP={
  'Financial Markets':1,'Market Structure':1,'Market Participants':1,'Regulators':1,'Islamic Banking':1,'BNM':1,
  'Guidelines':2,'Product Disclosure':2,'KYC':2,'CMSA':2,'FSA':2,'FEA Rules':2,'PIDM':2,'AML':2,'Sophisticated Investors':2,'Qualifications':2,'Fit and Proper':2,'Conduct':2,
  'Debt Securities':3,'Bonds':3,'Derivatives':3,'Structured Products':3,'Portfolio':3
};
const TARGET={1:12,2:36,3:32};
const CLO_LABEL={1:'Financial system',2:'Regulations & conduct',3:'Debt & structured products'};
const REF_MAP={
  'Financial Markets':'Ch. 1.1 Structure of Malaysia’s Financial Markets','Market Structure':'Ch. 1.3 Market Structure','Market Participants':'Ch. 1.4 Market Participants','Regulators':'Ch. 1.5 Regulatory Authorities, Acts and Guidelines','Islamic Banking':'Ch. 1.2 Islamic Banking','BNM':'Ch. 1.5.1 Bank Negara Malaysia',
  'Guidelines':'Ch. 2.1 Roles and Responsibilities of Licensed Organisation','Product Disclosure':'Ch. 2.1.2 Product Disclosures','KYC':'Ch. 2.2.4 Know-Your-Client and Financial Needs Analysis','CMSA':'Ch. 2.2.1 Capital Markets and Services Act 2007','FSA':'Ch. 2.2.6 Secrecy Requirement and Permitted Disclosures','FEA Rules':'Ch. 2.3.2 BNM Foreign Exchange Policy Notices','PIDM':'Ch. 2.4 Deposit Insurance','AML':'Ch. 2.5 AML/CFT','Sophisticated Investors':'Ch. 2.3.1 Categories of Sophisticated Investors','Qualifications':'Ch. 2.2.2 Qualifications for Performing Regulated Activities','Fit and Proper':'Ch. 2.2.3 Fit and Proper Requirements','Conduct':'Ch. 2.2.4.9 Code of Conduct and Ethics',
  'Debt Securities':'Ch. 3.3 What are Debt Securities?','Bonds':'Ch. 3.7 Yield Measures / 3.9 Bond Risks','Derivatives':'Ch. 3.12 Understanding Derivatives','Structured Products':'Ch. 3.10–3.14 Structured Products','Portfolio':'Ch. 2.2.4.8 Risk-Return Analysis'
};
const HISTORY_KEY='ippc_attempt_history_v2';
const WRONG_KEY='ippc_wrong_question_ids_v2';
const THEME_KEY='ippc_theme_v1';
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const getHistory=()=>{try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return[]}};
const saveHistory=h=>localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,50)));
const getWrong=()=>{try{return new Set(JSON.parse(localStorage.getItem(WRONG_KEY)||'[]'))}catch{return new Set()}};
const saveWrong=s=>localStorage.setItem(WRONG_KEY,JSON.stringify([...s]));
const hasScenario=q=>/\b(client|customer|investor|relationship manager|rm|bank|financial institution|retiree|company|issuer|dealer|broker|wants|approaches|asks|offers|recommends|onboarding|during|after|before)\b/i.test(q.text);
const qualityProfile=q=>{
  const wordCount=q.text.split(/\s+/).filter(Boolean).length;
  const optionComplexity=q.options.join(' ').split(/\s+/).length;
  const scenario=hasScenario(q);
  const calculation=Boolean(q.calc)||/\b(calculate|computed?|current yield|bond value|present value|option payoff|intrinsic value|time value|modified duration|accrued interest|dirty price|clean price|participation-linked return)\b/i.test(q.text);
  const statementSet=/\bI{1,3}\.|IV\.|which of the following/i.test(`${q.text} ${q.options.join(' ')}`);
  const computedDifficulty=(scenario&&wordCount>45)||(statementSet&&optionComplexity>55)||wordCount>70?'Hard':(scenario||statementSet||q.clo===3||calculation)?'Medium':'Easy';
  const computedStyle=calculation?'Calculation':scenario?'Scenario-based':statementSet?'Statement-combination':'Recall';
  const difficulty=q.difficultyOverride||computedDifficulty;
  const style=q.styleOverride||computedStyle;
  const cognitive=style==='Scenario-based'||style==='Calculation'?'Applied':'Concept check';
  const score=Math.min(5,1+(style==='Scenario-based'?1:0)+(style==='Calculation'?1:0)+(style==='Statement-combination'?1:0)+(wordCount>45?1:0));
  return {difficulty,style,cognitive,score};
};
const difficulty=q=>qualityProfile(q).difficulty;
const qStyle=q=>qualityProfile(q).style;
const qualityLabel=q=>`${qualityProfile(q).cognitive} · Q${qualityProfile(q).score}/5`;

async function readJsonResponse(res){
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function readGzipJson(res){
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  if('DecompressionStream' in window){
    const stream=res.body.pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).json();
  }
  throw new Error('Browser does not support gzip stream decoding');
}
const DATA_VERSION='anti-repetition-v1';
async function fetchPackedData(){
  // Safer for Vercel/GitHub: load plain JSON first so the app never depends on browser gzip stream decoding.
  // The .gz file is still included for future optimisation, but JSON is the runtime source of truth.
  try{return await readJsonResponse(await fetch(`/questions.packed.json?v=${DATA_VERSION}`,{cache:'no-store'}));}
  catch(jsonError){
    try{return await readGzipJson(await fetch(`/questions.packed.json.gz?v=${DATA_VERSION}`,{cache:'no-store'}));}
    catch(gzipError){throw new Error(`Could not load question bank. JSON: ${jsonError.message}; GZIP: ${gzipError.message}`);}
  }
}
const cleanQuestionText=text=>String(text||'')
  .replace(/\n?\s*Scenario reference\s*:[^\n]*(?:Set\s*\d+\s*\.?|$)/gi,'')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
function splitRomanStem(text){
  const normalized=String(text||'').replace(/\s+/g,' ').trim();
  const matches=[...normalized.matchAll(/\b(I|II|III|IV|V|VI)\.\s/g)];
  if(matches.length<2) return null;
  const intro=normalized.slice(0,matches[0].index).trim();
  const lines=matches.map((m,i)=>normalized.slice(m.index, i+1<matches.length?matches[i+1].index:normalized.length).trim()).filter(Boolean);
  return {intro,lines};
}
function QuestionText({text,className=''}){
  const parsed=splitRomanStem(text);
  if(!parsed) return <div className={className}>{text}</div>;
  return <div className={`${className} formatted-question-text`.trim()}>{parsed.intro&&<p className="question-intro">{parsed.intro}</p>}{parsed.lines.map((line,i)=><p key={i} className="question-statement">{line}</p>)}</div>;
}
async function loadPacked(){
  const data = await fetchPackedData();
  return data.sets.flatMap((setQs,setIdx)=>setQs.map((q,i)=>({
    id:`${setIdx+1}_${String(i+1).padStart(2,'0')}`,
    set:setIdx+1,
    topic:data.topics[q[0]],
    clo:CLO_MAP[data.topics[q[0]]]||3,
    text:cleanQuestionText(q[1]),
    options:q[2],
    answer:q[3],
    calc:q[4],
    explanation:q[5],
    difficultyOverride:q[6]||'',
    styleOverride:q[7]||''
  })));
}
function Pill({children}){return <span className="soft-pill">{children}</span>}
function CalcHelper({q}){if(!q||q.clo!==3)return null;return <div className="calc-helper"><strong>Formula helper</strong><div>{q.topic==='Bonds'||q.topic==='Debt Securities'?'Bond price and yield move inversely. Current yield = annual coupon / market price. Approx YTM ≈ [coupon + (par − price)/years] / [(par + price)/2].':q.topic==='Structured Products'?'Principal protected products commonly combine a zero-coupon deposit/bond component with an option/derivative payoff. Participation payoff = principal × participation rate × underlying gain, subject to product terms.':q.topic==='Derivatives'?'Option premium = intrinsic value + time value. Call payoff = max(S − K, 0); put payoff = max(K − S, 0).':'Use the payoff formula and identify principal, return component, underlying movement, and product risks.'}</div></div>}


function MockApp({onBack=()=>{},onNotes=()=>{},theme:sharedTheme,toggleTheme:sharedToggleTheme=()=>{}}){
  const [bank,setBank]=useState([]),[screen,setScreen]=useState('home'),[mode,setMode]=useState('generated'),[qs,setQs]=useState([]),[idx,setIdx]=useState(0),[answers,setAnswers]=useState({}),[flags,setFlags]=useState({}),[conf,setConf]=useState({}),[showAns,setShowAns]=useState(false),[seconds,setSeconds]=useState(7200),[running,setRunning]=useState(false),[err,setErr]=useState(''),[count,setCount]=useState(80),[sets,setSets]=useState(new Set(Array.from({length:20},(_,i)=>i+1))),[topics,setTopics]=useState(new Set()),[clo,setClo]=useState(new Set()),[query,setQuery]=useState(''),[bankSet,setBankSet]=useState('all'),[bankTopic,setBankTopic]=useState('all'),[bankClo,setBankClo]=useState('all'),[bankDiff,setBankDiff]=useState('all'),[bankStyle,setBankStyle]=useState('all'),[bankPage,setBankPage]=useState(1),[history,setHistory]=useState([]),[review,setReview]=useState('wrong'),[navOpen,setNavOpen]=useState(false),[navFilter,setNavFilter]=useState('all'),[showStudy,setShowStudy]=useState(false),[compact,setCompact]=useState(()=>{try{return localStorage.getItem('ippc_compact_v1')==='1'}catch{return false}}),[settingsOpen,setSettingsOpen]=useState(false),[theme,setTheme]=useState(()=>sharedTheme||(()=>{try{return localStorage.getItem(THEME_KEY)||'dark'}catch{return 'dark'}})());
  useEffect(()=>{loadPacked().then(setBank).catch(e=>setErr(e.message));setHistory(getHistory())},[]);
  useEffect(()=>{if(sharedTheme&&sharedTheme!==theme)setTheme(sharedTheme)},[sharedTheme]);
  useEffect(()=>{try{localStorage.setItem(THEME_KEY,theme)}catch{}},[theme]);
  useEffect(()=>{try{localStorage.setItem('ippc_compact_v1',compact?'1':'0')}catch{}},[compact]);
  useEffect(()=>{if(!running)return;const t=setInterval(()=>setSeconds(s=>s<=1?(setRunning(false),submit(),0):s-1),1000);return()=>clearInterval(t)},[running]);
  useEffect(()=>setBankPage(1),[query,bankSet,bankTopic,bankClo,bankDiff,bankStyle]);
  const allTopics=useMemo(()=>[...new Set(bank.map(q=>q.topic))].sort(),[bank]);
  const setNumbers=useMemo(()=>[...new Set(bank.map(q=>q.set))].sort((a,b)=>a-b),[bank]);
  const available=useMemo(()=>bank.filter(q=>sets.has(q.set)&&(!topics.size||topics.has(q.topic))&&(!clo.size||clo.has(q.clo))),[bank,sets,topics,clo]);
  const sessionAvailableCount=mode==='wrong'?getWrong().size:available.length;
  const current=qs[idx], selected=answers[current?.id], correct=selected===current?.answer;
  const answeredCount=Object.keys(answers).length, flaggedCount=Object.values(flags).filter(Boolean).length, progressPct=qs.length?Math.round(answeredCount/qs.length*100):0;
  const score=qs.reduce((a,q)=>a+(answers[q.id]===q.answer?1:0),0), pct=qs.length?Math.round(score/qs.length*100):0;
  const wrongIds=useMemo(()=>qs.filter(q=>answers[q.id]!==q.answer).map(q=>q.id),[qs,answers]);

  function pickTopicBalanced(pool,target){
    const byTopic={};shuffle(pool).forEach(q=>{(byTopic[q.topic] ||= []).push(q)});
    const topicNames=shuffle(Object.keys(byTopic));
    const chosen=[];
    while(chosen.length<target && topicNames.some(t=>byTopic[t].length)){
      for(const t of topicNames){
        if(chosen.length>=target) break;
        const next=byTopic[t].shift();
        if(next) chosen.push(next);
      }
    }
    return chosen;
  }
  function pickOfficial(pool){const by={1:[],2:[],3:[]};pool.forEach(q=>by[q.clo].push(q));let chosen=[];[1,2,3].forEach(c=>chosen.push(...pickTopicBalanced(by[c],TARGET[c])));if(chosen.length<80)chosen.push(...shuffle(pool.filter(q=>!chosen.includes(q))).slice(0,80-chosen.length));return shuffle(chosen).slice(0,80)}
  function pickQuestions(kind=mode){let pool=available.length?available:bank;if(kind==='wrong'){const wrong=getWrong();pool=bank.filter(q=>wrong.has(q.id));return shuffle(pool).slice(0,Math.min(count,pool.length||bank.length))}if(kind==='calc'){pool=pool.filter(q=>q.calc||qStyle(q)==='Calculation'||difficulty(q)==='Calculation');return shuffle(pool).slice(0,Math.min(count,pool.length))}if(kind==='official')return pickOfficial(bank);if(kind==='generated')return pickOfficial(pool);return shuffle(pool).slice(0,Math.min(count,pool.length));}
  function start(kind=mode){const picked=pickQuestions(kind);if(!picked.length)return;setQs(picked);setIdx(0);setAnswers({});setFlags({});setConf({});setShowAns(false);setSeconds(kind==='official'||kind==='generated'?7200:kind==='mock'?Math.round(picked.length*90):0);setRunning(kind==='official'||kind==='generated'||kind==='mock');setMode(kind);setScreen('test')}
  function submit(){setRunning(false);setShowAns(false);setScreen('results');setReview('wrong');if(!qs.length)return;const wrongSet=getWrong();qs.forEach(q=>answers[q.id]===q.answer?wrongSet.delete(q.id):wrongSet.add(q.id));saveWrong(wrongSet);const attempt={id:Date.now(),date:new Date().toISOString(),mode,score,total:qs.length,pct,wrong:wrongIds.length,flagged:flaggedCount,clo:[1,2,3].map(c=>{const g=qs.filter(q=>q.clo===c);const s=g.reduce((a,q)=>a+(answers[q.id]===q.answer?1:0),0);return{clo:c,score:s,total:g.length,pct:g.length?Math.round(s/g.length*100):0}})};const h=[attempt,...getHistory()];saveHistory(h);setHistory(h)}
  function option(q,i){setAnswers(a=>({...a,[q.id]:i}));if(mode==='practice'||mode==='wrong'||mode==='calc')setShowAns(true)}
  function jump(n){const nextIdx=Math.max(0,Math.min(qs.length-1,n));const nextQ=qs[nextIdx];setIdx(nextIdx);setShowAns((mode==='practice'||mode==='wrong'||mode==='calc')&&nextQ&&answers[nextQ.id]!=null);setShowStudy(false)}
  function toggleSet(n){setSets(s=>{const x=new Set(s);x.has(n)?x.delete(n):x.add(n);return x})}
  function toggleTopic(t){setTopics(s=>{const x=new Set(s);x.has(t)?x.delete(t):x.add(t);return x})}
  function toggleClo(n){setClo(s=>{const x=new Set(s);x.has(n)?x.delete(n):x.add(n);return x})}
  function toggleTheme(){setTheme(t=>{const next=t==='dark'?'light':'dark';try{localStorage.setItem(THEME_KEY,next)}catch{};sharedToggleTheme();return next})}
  function finishSession(){if(window.confirm('Finish this session and submit your answers?')) submit()}
  const normalizedQuery=query.trim().toLowerCase();
  const filteredBank=bank.filter(q=>(bankSet==='all'||q.set===+bankSet)&&(bankTopic==='all'||q.topic===bankTopic)&&(bankClo==='all'||q.clo===+bankClo)&&(bankDiff==='all'||difficulty(q)===bankDiff)&&(bankStyle==='all'||qStyle(q)===bankStyle)&&(`${q.text} ${q.options.join(' ')} ${q.explanation}`.toLowerCase().includes(normalizedQuery)));
  const pageSize=24,pageCount=Math.max(1,Math.ceil(filteredBank.length/pageSize)),visibleBank=filteredBank.slice((bankPage-1)*pageSize,bankPage*pageSize);
  const reviewQs=qs.filter(q=>review==='all'||(review==='wrong'&&answers[q.id]!==q.answer)||(review==='flagged'&&flags[q.id])||(review==='unanswered'&&answers[q.id]==null)||String(q.clo)===review);
  const topWeak=history[0]?.clo?.slice().sort((a,b)=>a.pct-b.pct)[0];
  const countBy=(items,fn)=>items.reduce((acc,item)=>{const key=fn(item)||'Other';acc[key]=(acc[key]||0)+1;return acc;},{});
  const styleBreakdown=useMemo(()=>countBy(bank,q=>qStyle(q)),[bank]);
  const difficultyBreakdown=useMemo(()=>countBy(bank,q=>difficulty(q)),[bank]);
  const cloBreakdown=useMemo(()=>countBy(bank,q=>`CLO ${q.clo}`),[bank]);
  const topicBreakdown=useMemo(()=>Object.entries(countBy(bank,q=>q.topic)).sort((a,b)=>b[1]-a[1]),[bank]);
  const romanCount=useMemo(()=>bank.filter(q=>splitRomanStem(q.text)).length,[bank]);
  const scenarioCount=useMemo(()=>bank.filter(hasScenario).length,[bank]);
  const unansweredCount=qs.filter(q=>answers[q.id]==null).length;
  const guessedUnsureCount=Object.values(conf).filter(v=>v&&v!=='confident').length;
  const wrongConfidentCount=qs.filter(q=>answers[q.id]!=null&&answers[q.id]!==q.answer&&conf[q.id]==='confident').length;
  const correctGuessedCount=qs.filter(q=>answers[q.id]===q.answer&&conf[q.id]&&conf[q.id]!=='confident').length;
  const navItems=qs.map((q,i)=>({q,i,answered:answers[q.id]!=null,flagged:!!flags[q.id],wrong:answers[q.id]!=null&&answers[q.id]!==q.answer}));
  const filteredNavItems=navItems.filter(x=>navFilter==='all'||(navFilter==='unanswered'&&!x.answered)||(navFilter==='flagged'&&x.flagged)||(navFilter==='incorrect'&&x.wrong));
  if(err)return <div className={`app-shell theme-${theme} safe-loading-shell`}><main className="safe-loading-center"><section className="empty-card safe-loading-card error-state"><h1>Could not load Mock Test</h1><p>{err}</p><p>Check that public/questions.packed.json exists at the GitHub repository root after deployment.</p><button className="secondary-btn" onClick={onBack}>Back to Study Suite Menu</button></section></main></div>;
  if(!bank.length)return <div className={`app-shell theme-${theme} safe-loading-shell`}><main className="safe-loading-center"><section className="empty-card safe-loading-card"><div className="spin"/><h1>Loading Mock Test</h1><p>Loading the compact IPPC question bank…</p><button className="secondary-btn" onClick={onBack}>Back to Study Suite Menu</button></section></main></div>;

  return <div className={`app-shell theme-${theme} screen-${screen} ${compact?'compact-mode':''}`}>
    <header className="topbar"><button className="brand-btn" onClick={()=>setScreen('home')}><span className="brand-mark">IPPC</span><span className="brand-sub">Mock Suite</span></button><div className="topbar-actions"><nav className="topnav" aria-label="Main navigation"><button className={screen==='home'?'nav-btn active-nav':'nav-btn'} onClick={()=>setScreen('home')}>Home</button><button className="nav-btn" onClick={onBack}>Menu</button><button className="nav-btn" onClick={onNotes}>Notes</button><button className={screen==='summary'?'nav-btn active-nav':'nav-btn'} onClick={()=>setScreen('summary')}>Summary</button><button className={screen==='bank'?'nav-btn active-nav':'nav-btn'} onClick={()=>setScreen('bank')}>Bank</button><button className={screen==='history'||screen==='results'?'nav-btn active-nav':'nav-btn'} onClick={()=>setScreen('history')}>Progress</button></nav><button className="theme-toggle-btn" onClick={()=>setSettingsOpen(true)} aria-label="Open settings">⚙️ Settings</button></div></header>
    {settingsOpen&&<div className="settings-overlay"><button className="settings-backdrop" onClick={()=>setSettingsOpen(false)} aria-label="Close settings"/><aside className="settings-drawer"><div className="settings-head"><div><span className="eyebrow muted">Settings</span><h3>Display preferences</h3></div><button className="drawer-close-btn" onClick={()=>setSettingsOpen(false)} aria-label="Close settings">×</button></div><div className="settings-body"><button className="settings-row" onClick={toggleTheme}><span>Theme</span><strong>{theme==='dark'?'Dark':'Light'}</strong></button><button className="settings-row" onClick={()=>setCompact(v=>!v)}><span>Compact mode</span><strong>{compact?'On':'Off'}</strong></button><button className="settings-row" onClick={()=>{localStorage.removeItem(HISTORY_KEY);localStorage.removeItem(WRONG_KEY);setHistory([])}}><span>Reset local progress</span><strong>Clear</strong></button></div></aside></div>}

    {screen==='home'&&<main className="page page-home">
      <section className="hero-card surface"><div className="hero-copy"><span className="eyebrow">Mock generator mode</span><h1>Turn the bank into a real revision dashboard.</h1><p>Generated mocks lock to 80 questions and the 12/36/32 CLO split. Practice mode supports wrong-question drilling, confidence marking, review mode, and saved attempt history.</p><div className="quick-start-block"><h2>Quick Start</h2><div className="hero-actions"><button className="primary-btn" onClick={()=>start('generated')}>Generate fresh mock</button><button className="primary-btn practice-quick-btn" onClick={()=>start('practice')}>Practice</button><button className="secondary-btn calc-quick-btn" onClick={()=>start('calc')}>Calculation drill</button><button className="secondary-btn wrong-quick-btn" onClick={()=>start('wrong')}>Wrong questions only</button><button className="secondary-btn bank-quick-btn" onClick={()=>setScreen('bank')}>Browse bank</button></div></div></div><div className="hero-stats-grid"><div className="stat-card accent"><strong>80</strong><span>Generated mock questions</span></div><div className="stat-card"><strong>12</strong><span>CLO1 questions</span></div><div className="stat-card"><strong>36</strong><span>CLO2 questions</span></div><div className="stat-card"><strong>32</strong><span>CLO3 questions</span></div></div></section>
      <section className="home-grid"><div className="surface config-card"><div className="section-head"><div><h2>Build a custom session</h2><p>Use mock generator for exam simulation, or custom filters for targeted revision.</p></div></div><div className="mode-switch"><button className={mode==='generated'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('generated');setCount(80)}}><span>Mock generator</span><small>Fresh 80 Q · 2 hours · 12/36/32 split</small></button><button className={mode==='calc'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('calc');setCount(80)}}><span>Calculation drill</span><small>Bonds · options · payoffs</small></button><button className={mode==='mock'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('mock');setCount(80)}}><span>Custom timed</span><small>Your filters · timed</small></button><button className={mode==='practice'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('practice');setCount(80)}}><span>Practice</span><small>Instant answers</small></button><button className={mode==='wrong'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('wrong');setCount(80)}}><span>Wrong only</span><small>Drill previous mistakes</small></button></div>{mode!=='generated'&&<div className="control-block"><div className="section-label-row"><h3>Question count</h3><span className="soft-pill">Available: {mode==='wrong'?getWrong().size:mode==='calc'?available.filter(q=>q.calc||qStyle(q)==='Calculation'||difficulty(q)==='Calculation').length:available.length}</span></div><div className="number-count-card"><label className="count-input-wrap"><span>Number of questions</span><input type="number" min="1" max={sessionAvailableCount||bank.length||1600} value={count} onChange={e=>setCount(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label><div className="range-meta"><strong>{count}</strong><span>{mode==='mock'?`${Math.round(count*1.5)} min estimate`:'Custom practice session'}</span></div><p className="count-helper">You can type any number. The app will use all matching questions if the requested number is higher than available.</p></div></div>}<div className="control-block"><div className="section-label-row"><h3>Sets</h3><div className="filter-actions"><button className="text-btn" onClick={()=>setSets(new Set())}>Clear</button><button className="text-btn" onClick={()=>setSets(new Set(setNumbers))}>Select all</button></div></div><div className="chip-group">{setNumbers.map(n=><button key={n} className={sets.has(n)?'chip chip-on':'chip'} onClick={()=>toggleSet(n)}>Set {n}</button>)}</div></div><div className="control-block"><div className="section-label-row"><h3>CLO focus</h3><div className="filter-actions"><button className="text-btn" onClick={()=>setClo(new Set())}>Clear</button><button className="text-btn" onClick={()=>setClo(new Set([1,2,3]))}>Select all</button></div></div><div className="chip-group chip-group-wide">{[1,2,3].map(n=><button key={n} className={clo.has(n)?'chip chip-on':'chip'} onClick={()=>toggleClo(n)}>CLO {n}<small>{CLO_LABEL[n]}</small></button>)}</div></div><div className="control-block"><div className="section-label-row"><h3>Topics</h3><div className="filter-actions"><button className="text-btn" onClick={()=>setTopics(new Set())}>Clear</button><button className="text-btn" onClick={()=>setTopics(new Set(allTopics))}>Select all</button></div></div><div className="chip-group scroll-chips">{allTopics.map(t=><button key={t} className={topics.has(t)?'chip chip-on':'chip'} onClick={()=>toggleTopic(t)}>{t}</button>)}</div></div><div className="button-row sticky-actions"><button className="secondary-btn" onClick={()=>{setSets(new Set(setNumbers));setTopics(new Set());setClo(new Set());setCount(80)}}>Reset filters</button><button className="primary-btn" onClick={()=>start(mode)}>Begin session</button></div></div><div className="home-side-stack"><div className="surface info-card"><div className="section-head compact"><div><h2>Attempt history</h2><p>{history.length?`Last score: ${history[0].pct}% · Weakest: CLO ${topWeak?.clo}`:'No attempts saved yet.'}</p></div></div><div className="blueprint-list">{history.slice(0,4).map(h=><div className="blueprint-item" key={h.id}><div><strong>{h.pct}%</strong><span>{new Date(h.date).toLocaleDateString()} · {h.mode}</span></div><b>{h.score}/{h.total}</b></div>)}</div><div className="button-row" style={{marginTop:16}}><button className="secondary-btn" onClick={()=>setScreen('history')}>View history</button></div></div><div className="surface info-card"><div className="section-head compact"><div><h2>New study features</h2><p>Review mode, confidence labels, formula helpers, textbook references, and difficulty tags are now integrated.</p></div></div><ul className="feature-list"><li>Wrong-question practice from saved attempts</li><li>Review all wrong, flagged, unanswered, or by CLO</li><li>Confidence tracking: confident, guessed, unsure</li><li>Formula helper and calculation drill for quick-win formulas</li><li>Practice mode gives instant result and explanation after each answer</li><li>Fresh topic-balanced mock generator</li></ul></div></div></section>
    </main>}

    {screen==='test'&&current&&<main className="page page-test page-test-drawer">
      {navOpen&&<div className="test-nav-overlay">
        <button className="test-nav-backdrop" onClick={()=>setNavOpen(false)} aria-label="Close navigator overlay"/>
        <aside className="test-nav-drawer">
          <div className="test-nav-drawer-head">
            <div>
              <span className="eyebrow muted">Navigator</span>
              <h3>Questions</h3>
              <p>Jump to any question without leaving the test.</p>
            </div>
            <button className="drawer-close-btn" onClick={()=>setNavOpen(false)} aria-label="Close navigator">×</button>
          </div>

          <div className="drawer-stats">
            <div className="mini-stat"><span>Answered</span><strong>{answeredCount}/{qs.length}</strong></div>
            <div className="mini-stat"><span>Current</span><strong>{idx+1}</strong></div>
            <div className="mini-stat"><span>Flagged</span><strong>{flaggedCount}</strong></div>
          </div>

          <div className="drawer-scroll">
            <div className="legend-list drawer-legend">
              <div><span className="legend-dot current"/>Current</div>
              <div><span className="legend-dot answered"/>Answered</div>
              <div><span className="legend-dot flagged"/>Flagged</div>
              <div><span className="legend-dot incorrect"/>Incorrect</div>
            </div>
            <div className="drawer-filter-chips">
              {['all','unanswered','flagged','incorrect'].map(f=><button key={f} className={navFilter===f?'chip chip-on':'chip'} onClick={()=>setNavFilter(f)}>{f}</button>)}
            </div>
            <div className="drawer-nav-grid">
              {filteredNavItems.map(({q,i,answered,flagged,wrong})=><button key={q.id} className={`nav-cell ${i===idx?'now':''} ${answered?'done':''} ${flagged?'flagged':''} ${wrong?'wrong':''}`} onClick={()=>{jump(i);setNavOpen(false)}}>{i+1}</button>)}
            </div>
            {!filteredNavItems.length&&<div className="empty-card drawer-empty"><h3>No questions here</h3><p>Try another navigator filter.</p></div>}
          </div>
        </aside>
      </div>}

      <section className="surface question-panel drawer-test-panel">
        <div className="question-toolbar sticky-test-header">
          <div className="test-title-row">
            <button className="navigator-trigger" onClick={()=>setNavOpen(true)}><span>☰</span> Navigator</button>
            <div>
              <span className="eyebrow muted">{mode==='generated'?'Generated mock':mode==='calc'?'Calculation drill':mode==='wrong'?'Wrong-question practice':mode}</span>
              <h2>Question {idx+1} of {qs.length}</h2>
            </div>
          </div>
          <div className="test-toolbar-side"><div className="toolbar-pills"><Pill>Set {current.set}</Pill><Pill>{current.topic}</Pill><Pill>CLO {current.clo}</Pill><Pill>{difficulty(current)}</Pill>{running&&<span className="timer-pill">{fmt(seconds)}</span>}</div><button className="danger-btn" onClick={finishSession}>Finish</button></div>
        </div>

        <div className="exam-progress-strip">
          <div><span>Answered</span><strong>{answeredCount}/{qs.length}</strong></div>
          <div><span>Unanswered</span><strong>{unansweredCount}</strong></div>
          <div><span>Flagged</span><strong>{flaggedCount}</strong></div>
          <div><span>Time left</span><strong>{running?fmt(seconds):'Practice'}</strong></div>
        </div>

        <div className="progress-card">
          <div className="progress-topline"><span>{progressPct}% complete</span><span>{answeredCount} answered · {flaggedCount} flagged</span></div>
          <div className="progress-track"><div className="progress-fill" style={{width:`${progressPct}%`}}/></div>
        </div>

        <div className="question-copy enhanced-question-copy"><div className="question-copy-label"><strong>{idx+1}</strong><span>Question</span></div><QuestionText text={current.text} className="question-stem"/></div>
        <div className="study-aids-toggle-row">
          <button className="secondary-btn study-aids-toggle" onClick={()=>setShowStudy(v=>!v)}>
            {showStudy?'Hide study aids':'Show study aids'}
          </button>
          <span>Textbook reference and formula helper are hidden until opened.</span>
        </div>
        {showStudy&&<div className="study-aids-panel">
          <div className="reference-card"><strong>Textbook reference:</strong> {REF_MAP[current.topic]||`CLO ${current.clo}`}</div>
          <CalcHelper q={current}/>
        </div>}

        <div className="options-list">
          {current.options.map((o,i)=><button key={i} disabled={(mode==='practice'||mode==='wrong')&&selected!=null} className={`option-card ${selected===i?'selected':''} ${showAns&&i===current.answer?'correct':''} ${showAns&&selected===i&&selected!==current.answer?'incorrect':''}`} onClick={()=>option(current,i)}>
            <span className="option-letter">{String.fromCharCode(65+i)}</span>
            <span className="option-text">{o}</span>
          </button>)}
        </div>

        <div className="confidence-row"><span>Confidence:</span>{['confident','guessed','unsure'].map(c=><button key={c} className={conf[current.id]===c?'chip chip-on':'chip'} onClick={()=>setConf(v=>({...v,[current.id]:c}))}>{c}</button>)}</div>

        {showAns&&<div className={correct?'explanation-card okay':'explanation-card notokay'}>
          <div className="explanation-topline"><strong>{correct?'Correct':'Incorrect'}</strong><span>Correct answer: {String.fromCharCode(65+current.answer)}</span></div>
          {current.calc&&<pre>{current.calc}</pre>}
          <p>{current.explanation}</p>
        </div>}

        <div className="button-row split-mobile test-action-bar">
          <button className="secondary-btn mobile-nav-button action-btn" onClick={()=>setNavOpen(true)}><span className="action-icon">☰</span><span className="action-label">Navigator</span></button>
          <button className="secondary-btn action-btn" onClick={()=>jump(idx-1)} disabled={idx===0}><span className="action-icon">←</span><span className="action-label">Previous</span></button>
          <button className="secondary-btn action-btn" onClick={()=>setShowAns(!showAns)}><span className="action-icon">✓</span><span className="action-label">{showAns?'Hide answer':'Show answer'}</span></button>
          <button className="secondary-btn action-btn" onClick={()=>setFlags(f=>({...f,[current.id]:!f[current.id]}))}><span className="action-icon">⚑</span><span className="action-label">{flags[current.id]?'Unflag':'Flag'}</span></button>
          <button className="primary-btn next-primary action-btn primary-action" onClick={()=>idx===qs.length-1?finishSession():jump(idx+1)}><span className="action-icon">→</span><span className="action-label">{idx===qs.length-1?'Submit results':'Next question'}</span></button>
        </div>
      </section>
    </main>}

    {screen==='results'&&<main className="page page-results"><section className="surface score-hero"><div className="score-badge-wrap"><div className={pct>=70?'score-badge score-pass':'score-badge score-fail'}>{pct}%</div></div><div className="score-copy"><span className="eyebrow muted">Session complete</span><h1>{pct>=70?'Pass':'Keep practising'}</h1><p>You scored <strong>{score}</strong> out of <strong>{qs.length}</strong>. Wrong questions are saved automatically for targeted practice.</p></div></section><section className="results-grid"><div className="surface info-card"><div className="section-head compact"><div><h2>Performance summary</h2><p>Confidence and mistake review are now available below.</p></div></div><div className="summary-grid"><div className="mini-stat"><span>Correct</span><strong>{score}</strong></div><div className="mini-stat"><span>Wrong</span><strong>{wrongIds.length}</strong></div><div className="mini-stat"><span>Flagged</span><strong>{flaggedCount}</strong></div><div className="mini-stat"><span>Guessed / unsure</span><strong>{guessedUnsureCount}</strong></div></div><div className="priority-grid"><div className="priority-card high"><span>High priority</span><strong>{wrongConfidentCount}</strong><p>Wrong but marked confident</p></div><div className="priority-card"><span>Reinforce</span><strong>{correctGuessedCount}</strong><p>Correct but guessed or unsure</p></div></div></div><div className="surface info-card"><div className="section-head compact"><div><h2>CLO breakdown</h2><p>Use this to target weaker sections.</p></div></div><div className="breakdown-list">{[1,2,3].map(c=>{const group=qs.filter(q=>q.clo===c);const s=group.reduce((a,q)=>a+(answers[q.id]===q.answer?1:0),0);const cp=group.length?Math.round(s/group.length*100):0;return <div key={c} className="breakdown-item"><div className="breakdown-head"><div><strong>CLO {c}</strong><span>{CLO_LABEL[c]}</span></div><b>{s}/{group.length}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${cp}%`}}/></div></div>})}</div></div></section><section className="surface review-panel"><div className="section-head"><div><h2>Review mode</h2><p>Work through the highest-value review steps first.</p></div><div className="chip-group">{['wrong','flagged','unanswered','all','1','2','3'].map(r=><button key={r} className={review===r?'chip chip-on':'chip'} onClick={()=>setReview(r)}>{['1','2','3'].includes(r)?`CLO ${r}`:r}</button>)}</div></div><div className="review-steps"><button onClick={()=>setReview('wrong')}><strong>1</strong><span>Review wrong answers</span></button><button onClick={()=>setReview('flagged')}><strong>2</strong><span>Check flagged questions</span></button><button onClick={()=>setReview('unanswered')}><strong>3</strong><span>Finish unanswered items</span></button><button onClick={()=>start('wrong')}><strong>4</strong><span>Retry wrong questions</span></button></div><div className="bank-list upgraded-list">{reviewQs.map(q=><details key={q.id} className="bank-item upgraded-bank-item"><summary><div className="bank-card-head"><div className="summary-meta"><Pill>{q.id}</Pill><Pill>{q.topic}</Pill><Pill>{difficulty(q)}</Pill><Pill>{qStyle(q)}</Pill><Pill>{qualityLabel(q)}</Pill><Pill>{conf[q.id]||'no confidence tag'}</Pill></div><span className={answers[q.id]===q.answer?'answer-badge':'answer-badge wrong-badge'}>{answers[q.id]===q.answer?'Correct':'Wrong'} · Ans {String.fromCharCode(65+q.answer)}</span></div><QuestionText text={q.text} className="summary-text"/></summary><div className="bank-card-body"><div className="bank-card-actions"><button className="secondary-btn" onClick={()=>navigator.clipboard?.writeText(`${q.text}\n\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}`)}>Copy question</button><button className="secondary-btn" onClick={()=>{setBankTopic(q.topic);setBankPage(1)}}>Practice this topic</button></div><ol className="bank-options">{q.options.map((o,i)=><li key={i} className={i===q.answer?'answer-hit':answers[q.id]===i?'user-wrong':''}><span className="bank-option-label">{String.fromCharCode(65+i)}</span><span>{o}</span></li>)}</ol><p className="bank-explanation"><strong>Reference:</strong> {REF_MAP[q.topic]}<br/>{q.explanation}</p></div></details>)}</div><div className="button-row results-actions"><button className="secondary-btn" onClick={()=>start('wrong')}>Practice wrong questions</button><button className="primary-btn" onClick={()=>start('generated')}>Generate fresh mock</button></div></section></main>}

    {screen==='history'&&<main className="page"><section className="surface bank-panel"><div className="section-head"><div><h2>Saved progress</h2><p>Attempts are saved locally on this device.</p></div><button className="secondary-btn" onClick={()=>{localStorage.removeItem(HISTORY_KEY);localStorage.removeItem(WRONG_KEY);setHistory([])}}>Clear history</button></div><div className="bank-list">{history.length?history.map(h=><div className="blueprint-item" key={h.id}><div><strong>{h.pct}% · {h.score}/{h.total}</strong><span>{new Date(h.date).toLocaleString()} · {h.mode} · {h.wrong} wrong · {h.flagged} flagged</span></div><div className="toolbar-pills">{h.clo.map(c=><Pill key={c.clo}>CLO {c.clo}: {c.pct}%</Pill>)}</div></div>):<div className="empty-card"><h3>No history yet</h3><p>Finish a session to see score trends and weak CLOs here.</p></div>}</div></section></main>}

    {screen==='summary'&&<main className="page page-summary"><section className="surface summary-hero-panel"><div><span className="eyebrow">Summary Breakdown</span><h1>Question bank composition</h1><p>This shows the type of questions available in the mock test bank, so you can quickly decide whether to practise by style, difficulty, CLO, or topic.</p></div><div className="summary-hero-stats"><div className="mini-stat"><span>Total questions</span><strong>{bank.length}</strong></div><div className="mini-stat"><span>Sets</span><strong>{setNumbers.length}</strong></div><div className="mini-stat"><span>Roman numeral</span><strong>{romanCount}</strong></div><div className="mini-stat"><span>Scenario-style</span><strong>{scenarioCount}</strong></div></div></section><section className="summary-breakdown-grid"><div className="surface info-card"><div className="section-head compact"><div><h2>By question style</h2><p>Use this to choose the type of practice you want.</p></div></div><div className="breakdown-list">{['Scenario-based','Statement-combination','Calculation','Recall'].map(name=>{const total=styleBreakdown[name]||0;const pc=bank.length?Math.round(total/bank.length*100):0;return <div key={name} className="breakdown-item"><div className="breakdown-head"><div><strong>{name}</strong><span>{pc}% of bank</span></div><b>{total}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${pc}%`}}/></div></div>})}</div></div><div className="surface info-card"><div className="section-head compact"><div><h2>By difficulty</h2><p>Use this to balance foundational, intermediate and advanced revision.</p></div></div><div className="breakdown-list">{['Easy','Medium','Hard'].map(name=>{const total=difficultyBreakdown[name]||0;const pc=bank.length?Math.round(total/bank.length*100):0;return <div key={name} className="breakdown-item"><div className="breakdown-head"><div><strong>{name}</strong><span>{pc}% of bank</span></div><b>{total}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${pc}%`}}/></div></div>})}</div></div><div className="surface info-card"><div className="section-head compact"><div><h2>By exam CLO</h2><p>Aligned to the official generated mock target split.</p></div></div><div className="breakdown-list">{[1,2,3].map(n=>{const name=`CLO ${n}`;const total=cloBreakdown[name]||0;const pc=bank.length?Math.round(total/bank.length*100):0;return <div key={name} className="breakdown-item"><div className="breakdown-head"><div><strong>{name}</strong><span>{CLO_LABEL[n]}</span></div><b>{total}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${pc}%`}}/></div></div>})}</div></div><div className="surface info-card"><div className="section-head compact"><div><h2>Top topics</h2><p>The largest topic pools in the bank.</p></div></div><div className="topic-breakdown-list">{topicBreakdown.slice(0,12).map(([topic,total])=>{const pc=bank.length?Math.round(total/bank.length*100):0;return <button key={topic} className="topic-breakdown-row" onClick={()=>{setBankTopic(topic);setScreen('bank')}}><span>{topic}</span><strong>{total}</strong><em>{pc}%</em></button>})}</div></div></section><section className="surface info-card summary-action-panel"><div><h2>How to use this</h2><p>For exam simulation, use <strong>Generate fresh mock</strong>. For weak-area drilling, click a topic above or go to Question Bank and filter by Difficulty or Style.</p></div><div className="button-row"><button className="primary-btn" onClick={()=>start('generated')}>Generate fresh mock</button><button className="secondary-btn" onClick={()=>setScreen('bank')}>Open Question Bank</button></div></section></main>}

    {screen==='history'&&<main className="page"><section className="surface bank-panel"><div className="section-head"><div><h2>Saved progress</h2><p>Attempts are saved locally on this device.</p></div><button className="secondary-btn" onClick={()=>{localStorage.removeItem(HISTORY_KEY);localStorage.removeItem(WRONG_KEY);setHistory([])}}>Clear history</button></div><div className="bank-list">{history.length?history.map(h=><div className="blueprint-item" key={h.id}><div><strong>{h.pct}% · {h.score}/{h.total}</strong><span>{new Date(h.date).toLocaleString()} · {h.mode} · {h.wrong} wrong · {h.flagged} flagged</span></div><div className="toolbar-pills">{h.clo.map(c=><Pill key={c.clo}>CLO {c.clo}: {c.pct}%</Pill>)}</div></div>):<div className="empty-card"><h3>No history yet</h3><p>Finish a session to see score trends and weak CLOs here.</p></div>}</div></section></main>}

    {screen==='bank'&&<main className="page page-bank"><section className="surface bank-panel bank-panel-upgraded"><div className="bank-hero"><div><span className="eyebrow">Question library</span><h2>Search the full IPPC bank with cleaner navigation.</h2><p>Filter by set, topic, CLO, difficulty, and question style. Each card now includes a quality profile so you can target hard, applied and scenario-based items.</p></div><div className="bank-stats-grid"><div className="mini-stat bank-stat"><span>Total</span><strong>{bank.length}</strong></div><div className="mini-stat bank-stat"><span>Matches</span><strong>{filteredBank.length}</strong></div><div className="mini-stat bank-stat"><span>Wrong saved</span><strong>{getWrong().size}</strong></div></div></div><div className="bank-layout"><aside className="bank-sidebar"><div className="bank-filter-card"><div className="bank-filter-header"><div><span className="eyebrow muted">Filter panel</span><h3>Refine the bank</h3><p>Use the controls below to narrow the full question library quickly.</p></div><button className="secondary-btn bank-compact-reset" onClick={()=>{setQuery('');setBankSet('all');setBankTopic('all');setBankClo('all');setBankDiff('all');setBankStyle('all')}}>Reset all</button></div><label className="bank-field bank-search-field"><span>Search</span><input placeholder="Search callable bond, PIDM, CDD…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="bank-filter-section"><div className="bank-section-title">Main filters</div><div className="filter-grid bank-filter-grid"><label className="bank-field"><span>Set</span><select value={bankSet} onChange={e=>setBankSet(e.target.value)}><option value="all">All sets</option>{setNumbers.map(n=><option key={n} value={n}>Set {n}</option>)}</select></label><label className="bank-field"><span>CLO</span><select value={bankClo} onChange={e=>setBankClo(e.target.value)}><option value="all">All CLOs</option>{[1,2,3].map(n=><option key={n} value={n}>CLO {n}</option>)}</select></label><label className="bank-field bank-field-full"><span>Topic</span><select value={bankTopic} onChange={e=>setBankTopic(e.target.value)}><option value="all">All topics</option>{allTopics.map(t=><option key={t}>{t}</option>)}</select></label></div></div><div className="bank-filter-section"><div className="bank-section-title">Question profile</div><div className="filter-grid bank-profile-grid"><label className="bank-field"><span>Difficulty</span><select value={bankDiff} onChange={e=>setBankDiff(e.target.value)}><option value="all">All difficulty</option>{['Easy','Medium','Hard'].map(d=><option key={d}>{d}</option>)}</select></label><label className="bank-field"><span>Style</span><select value={bankStyle} onChange={e=>setBankStyle(e.target.value)}><option value="all">All styles</option>{['Scenario-based','Statement-combination','Calculation','Recall'].map(d=><option key={d}>{d}</option>)}</select></label></div></div><div className="bank-filter-section"><div className="section-label-row"><h3>CLO quick filter</h3><button className="text-btn" onClick={()=>setBankClo('all')}>Clear</button></div><div className="chip-group chip-group-wide">{[1,2,3].map(n=><button key={n} className={bankClo===String(n)?'chip chip-on':'chip'} onClick={()=>setBankClo(bankClo===String(n)?'all':String(n))}>CLO {n}<small>{CLO_LABEL[n]}</small></button>)}</div></div><div className="bank-filter-section bank-filter-section-soft"><div className="bank-mini-note"><strong>Tip:</strong> Use Search + Topic first, then refine by difficulty or Style = Scenario-based for applied exam practice.</div></div><div className="button-row bank-reset-row"><button className="secondary-btn" onClick={()=>{setQuery('');setBankSet('all');setBankTopic('all');setBankClo('all');setBankDiff('all');setBankStyle('all')}}>Reset all filters</button></div></div></aside><div className="bank-results-column"><div className="bank-results-header"><div><div className="bank-summary"><strong>{filteredBank.length}</strong> matches found</div><div className="bank-subsummary">Page {bankPage} of {pageCount}</div></div><div className="bank-results-actions"><Pill>{visibleBank.length} shown</Pill><Pill>{pageSize} per page</Pill></div></div>{!filteredBank.length&&<div className="empty-card bank-empty-state"><h3>No questions found.</h3><p>Try clearing the topic filter or searching a broader term.</p><button className="secondary-btn" onClick={()=>{setQuery('');setBankSet('all');setBankTopic('all');setBankClo('all');setBankDiff('all');setBankStyle('all')}}>Reset filters</button></div>}<div className="bank-list upgraded-list">{visibleBank.map(q=><details key={q.id} className="bank-item upgraded-bank-item"><summary><div className="bank-card-head"><div className="summary-meta"><Pill>{q.id}</Pill><Pill>Set {q.set}</Pill><Pill>CLO {q.clo}</Pill><Pill>{q.topic}</Pill><Pill>{difficulty(q)}</Pill><Pill>{qStyle(q)}</Pill><Pill>{qualityLabel(q)}</Pill></div><span className="answer-badge">Answer {String.fromCharCode(65+q.answer)}</span></div><QuestionText text={q.text} className="summary-text"/><div className="bank-card-hint">Quality: {qualityLabel(q)} · {qStyle(q)} · Reference: {REF_MAP[q.topic]||`CLO ${q.clo}`}</div></summary><div className="bank-card-body"><div className="bank-card-actions"><button className="secondary-btn" onClick={()=>navigator.clipboard?.writeText(`${q.text}\n\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}`)}>Copy question</button><button className="secondary-btn" onClick={()=>{setBankTopic(q.topic);setBankPage(1)}}>Practice this topic</button></div><ol className="bank-options">{q.options.map((o,i)=><li key={i} className={i===q.answer?'answer-hit':''}><span className="bank-option-label">{String.fromCharCode(65+i)}</span><span>{o}</span></li>)}</ol>{q.calc&&<pre className="bank-calc">{q.calc}</pre>}<div className="bank-explanation-wrap"><span className="answer-badge subtle-badge">Explanation</span><p className="bank-explanation">{q.explanation}</p></div></div></details>)}</div><div className="bank-pagination"><button className="secondary-btn" onClick={()=>setBankPage(p=>Math.max(1,p-1))} disabled={bankPage===1}>← Prev</button><div className="pagination-pills">{Array.from({length:Math.min(5,pageCount)},(_,i)=>{const start=Math.min(Math.max(1,bankPage-2),Math.max(1,pageCount-4));const n=start+i;if(n>pageCount)return null;return <button key={n} className={n===bankPage?'chip chip-on':'chip'} onClick={()=>setBankPage(n)}>{n}</button>})}</div><form className="page-jump" onSubmit={e=>{e.preventDefault();const value=Number(e.currentTarget.elements.bankPageJump.value);if(value) setBankPage(Math.min(pageCount,Math.max(1,Math.floor(value))))}}><label>Go to page</label><input name="bankPageJump" type="number" min="1" max={pageCount} placeholder={String(bankPage)}/><button className="secondary-btn" type="submit">Go</button></form><button className="secondary-btn" onClick={()=>setBankPage(p=>Math.min(pageCount,p+1))} disabled={bankPage===pageCount}>Next →</button></div></div></div></section></main>}
  </div>
}

function CombinedLanding({onEnter,theme,toggleTheme}){
  return <div className={`app-shell theme-${theme}`}>
  <main className="portal-shell">
    <header className="portal-menu-topbar">
      <button className="brand-btn" onClick={()=>onEnter('landing')}>
        <span className="brand-mark">IPPC</span>
        <span className="brand-sub">Study Suite</span>
      </button>
      <button className="theme-toggle-btn suite-menu-theme-btn" onClick={toggleTheme} aria-label="Toggle colour theme">
        {theme==='dark'?'☀️ Light':'🌙 Dark'} theme
      </button>
    </header>
    <section className="portal-hero portal-surface">
      <div className="portal-copy">
        <span className="eyebrow">IPPC Study Suite</span>
        <h1>Choose your study mode.</h1>
        <p>One Github/Vercel-ready app combining the exam-ready study notes and the full mock test question bank. Built for quick revision, focused practice, and mobile-friendly exam prep.</p>
        <div className="portal-actions">
          <button className="primary-btn" onClick={()=>onEnter('notes')}>Open Notes</button>
          <button className="secondary-btn" onClick={()=>onEnter('mock')}>Open Mock Test</button>
        </div>
      </div>
      <div className="portal-scorecard">
        <div><strong>Notes</strong><span>Key concepts, formulas, dates, fines, Acts and penalties.</span></div>
        <div><strong>1,600</strong><span>Mock questions across 20 sets with review tools.</span></div>
        <div><strong>80 MCQs</strong><span>Exam-style timed sessions aligned to the current IPPC format.</span></div>
      </div>
    </section>

    <section className="portal-choice-grid">
      <button className="portal-card portal-surface" onClick={()=>onEnter('notes')}>
        <div className="portal-card-icon">📘</div>
        <div>
          <span className="eyebrow muted">Study first</span>
          <h2>Notes Page</h2>
          <p>Use the polished notes app for chapter revision, key dates, fines, penalties, Acts, schedules and formulas.</p>
        </div>
        <span className="portal-arrow">Enter →</span>
      </button>
      <button className="portal-card portal-surface" onClick={()=>onEnter('mock')}>
        <div className="portal-card-icon">📝</div>
        <div>
          <span className="eyebrow muted">Practise next</span>
          <h2>Mock Test Page</h2>
          <p>Generate timed mocks, drill weak topics, browse the full bank, and review incorrect answers.</p>
        </div>
        <span className="portal-arrow">Enter →</span>
      </button>
    </section>
  </main>
  </div>
}

function NotesPortal({onBack,onMock,theme,toggleTheme}){
  const [settingsOpen,setSettingsOpen]=useState(false);
  const switchTheme=()=>{ toggleTheme(); };
  return <div className={`notes-portal-shell theme-${theme}`}>
    <header className="portal-topbar">
      <button className="brand-btn" onClick={onBack}>
        <span className="brand-mark">IPPC</span>
        <span className="brand-sub">Study Suite</span>
      </button>
      <div className="portal-topbar-actions">
        <button className="secondary-btn portal-short" onClick={onBack}><span className="wide-label">Study Suite Menu</span><span className="short-label">Menu</span></button>
        <button className="secondary-btn portal-short" onClick={onMock}><span className="wide-label">Mock Test Page</span><span className="short-label">Test</span></button>
        <button className="primary-btn portal-short" onClick={()=>window.open('/notes/index.html','_blank')}><span className="wide-label">Open full page</span><span className="short-label">Full</span></button>
        <button className="theme-toggle-btn notes-theme-btn" onClick={()=>setSettingsOpen(true)} aria-label="Open notes settings"><span aria-hidden="true">⚙︎</span></button>
      </div>
    </header>
    {settingsOpen&&<div className="settings-overlay notes-settings-shell">
      <button className="settings-backdrop" onClick={()=>setSettingsOpen(false)} aria-label="Close settings"/>
      <aside className="settings-drawer">
        <div className="settings-head">
          <div><span className="eyebrow muted">Settings</span><h3>Notes display</h3></div>
          <button className="drawer-close-btn" onClick={()=>setSettingsOpen(false)} aria-label="Close settings">×</button>
        </div>
        <div className="settings-body">
          <button className="settings-row" onClick={switchTheme}><span>Theme</span><strong>{theme==='dark'?'Dark':'Light'}</strong></button>
          <button className="settings-row" onClick={()=>window.open('/notes/index.html','_blank')}><span>Full notes page</span><strong>Open</strong></button>
          <button className="settings-row" onClick={()=>setSettingsOpen(false)}><span>Close settings</span><strong>Done</strong></button>
        </div>
      </aside>
    </div>}
    <iframe className="notes-frame" title="IPPC Study Notes" src={`/notes/index.html?theme=${theme}`} />
  </div>
}

function CombinedApp(){
  const [view,setView]=useState(()=>window.location.hash.replace('#','')||'landing');
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem(THEME_KEY)||'dark'}catch{return 'dark'}});
  const toggleTheme=()=>setTheme(t=>t==='dark'?'light':'dark');
  useEffect(()=>{try{localStorage.setItem(THEME_KEY,theme)}catch{}},[theme]);
  useEffect(()=>{
    const onMsg=(event)=>{if(event?.data?.type==='ippc-theme'&&(event.data.theme==='dark'||event.data.theme==='light')) setTheme(event.data.theme)};
    window.addEventListener('message',onMsg);
    return()=>window.removeEventListener('message',onMsg);
  },[]);
  useEffect(()=>{
    const onHash=()=>setView(window.location.hash.replace('#','')||'landing');
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);
  const go=(next)=>{try{setTheme(localStorage.getItem(THEME_KEY)||theme)}catch{};window.location.hash=next==='landing'?'':next;setView(next)};
  if(view==='mock') return <MockApp onBack={()=>go('landing')} onNotes={()=>go('notes')} theme={theme} toggleTheme={toggleTheme}/>;
  if(view==='notes') return <NotesPortal onBack={()=>go('landing')} onMock={()=>go('mock')} theme={theme} toggleTheme={toggleTheme}/>;
  return <CombinedLanding onEnter={go} theme={theme} toggleTheme={toggleTheme}/>;
}

createRoot(document.getElementById('root')).render(<CombinedApp/>);

