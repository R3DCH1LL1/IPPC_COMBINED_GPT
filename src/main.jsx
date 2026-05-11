import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CurtainThemeButton} from './components/ui/curtain-theme-toggle.jsx';
import './style.css';

const CLO_MAP={
  'Financial Markets':1,'Market Structure':1,'Market Participants':1,'Regulators':1,'Islamic Banking':1,'BNM':1,
  'Guidelines':2,'Product Disclosure':2,'KYC':2,'CMSA':2,'FSA':2,'FEA Rules':2,'PIDM':2,'AML':2,'Sophisticated Investors':2,'Qualifications':2,'Fit and Proper':2,'Conduct':2,
  'Portfolio':2,
  'Debt Securities':3,'Bonds':3,'Derivatives':3,'Structured Products':3
};
const TARGET={1:12,2:36,3:32};
const CLO_LABEL={1:'Financial system',2:'Regulations & conduct',3:'Debt & structured products'};
const REF_MAP={
  'Financial Markets':'Ch. 1.1 Structure of Malaysia’s Financial Markets','Market Structure':'Ch. 1.3 Market Structure','Market Participants':'Ch. 1.4 Market Participants','Regulators':'Ch. 1.5 Regulatory Authorities, Acts and Guidelines','Islamic Banking':'Ch. 1.2 Islamic Banking','BNM':'Ch. 1.5.1 Bank Negara Malaysia',
  'Guidelines':'Ch. 2.1 Roles and Responsibilities of Licensed Organisation','Product Disclosure':'Ch. 2.1.2 Product Disclosures','KYC':'Ch. 2.2.4 Know-Your-Client and Financial Needs Analysis','CMSA':'Ch. 2.2.1 Capital Markets and Services Act 2007','FSA':'Ch. 2.2.6 Secrecy Requirement and Permitted Disclosures','FEA Rules':'Ch. 2.3.2 BNM Foreign Exchange Policy Notices','PIDM':'Ch. 2.4 Deposit Insurance','AML':'Ch. 2.5 AML/CFT','Sophisticated Investors':'Ch. 2.3.1 Categories of Sophisticated Investors','Qualifications':'Ch. 2.2.2 Qualifications for Performing Regulated Activities','Fit and Proper':'Ch. 2.2.3 Fit and Proper Requirements','Conduct':'Ch. 2.2.4.9 Code of Conduct and Ethics',
  'Debt Securities':'Ch. 3.3 What are Debt Securities?','Bonds':'Ch. 3.7 Yield Measures / 3.9 Bond Risks','Derivatives':'Ch. 3.12 Understanding Derivatives','Structured Products':'Ch. 3.10–3.14 Structured Products','Portfolio':'Ch. 2.2.4.8 Risk-Return Analysis',
  'Acts, Schedules, Fines & Penalties':'Key Acts, schedules, breaches, fines and penalties'
};

const LEGAL_FILTER_TOPIC='Acts, Schedules, Fines & Penalties';
const LEGAL_FILTER_RE=/\b(CMSA|Capital Markets and Services Act|FSA|Financial Services Act|IFSA|Islamic Financial Services Act|AMLA|Anti-Money Laundering(?:,|\b)|Malaysia Deposit Insurance Corporation Act|PIDM Act|Central Bank of Malaysia Act|Securities Commission Act|Companies Act|Development Financial Institutions Act|Labuan Financial Services Authority Act|Schedule\s*(?:2|7|11)|S\.\s*\d+[A-Z]?|Section\s*\d+[A-Z]?|Sections\s*\d+[A-Z]?|fine|fines|penalt(?:y|ies)|imprisonment|offen[cs]e|offender|breach(?:es)?|contravention|contravene(?:s|d)?|non[-\s]?compliance|permitted disclosure|secrecy|unauthorised disclosure|false\s*\/\s*misleading|misleading information|market manipulation|insider trading|tipping[-\s]?off|client order priority|dealing as principal|reasonable basis|prospectus requirement|regulated activities)\b/i;
const LEGAL_FILTER_TOPICS=new Set(['CMSA','FSA','AML']);
function isLegalFilterQuestion(q){
  const text=`${q?.topic||''} ${q?.text||''} ${(q?.options||[]).join(' ')}`;
  return LEGAL_FILTER_TOPICS.has(q?.topic)||LEGAL_FILTER_RE.test(text);
}
function matchesTopicFilter(q,t){
  return t===LEGAL_FILTER_TOPIC?isLegalFilterQuestion(q):q.topic===t;
}
function matchesAnyTopic(q,topicSet){
  if(!topicSet?.size) return true;
  return [...topicSet].some(t=>matchesTopicFilter(q,t));
}

const HISTORY_KEY='ippc_attempt_history_v2';
const WRONG_KEY='ippc_wrong_question_ids_v2';
const THEME_KEY='ippc_theme_v1';
function applyGlobalTheme(theme){
  if(typeof document==='undefined') return;
  const next=theme==='light'?'light':'dark';
  const root=document.documentElement;
  const body=document.body;
  root.dataset.theme=next;
  root.style.colorScheme=next;
  root.classList.toggle('dark',next==='dark');
  root.classList.toggle('light',next==='light');
  root.classList.toggle('theme-dark',next==='dark');
  root.classList.toggle('theme-light',next==='light');
  if(body){
    body.dataset.theme=next;
    body.classList.toggle('dark',next==='dark');
    body.classList.toggle('light',next==='light');
    body.classList.toggle('theme-dark',next==='dark');
    body.classList.toggle('theme-light',next==='light');
  }
}
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
  const difficulty=normalizeDifficultyValue(q.difficultyOverride)||computedDifficulty;
  const style=normalizeStyleValue(q.styleOverride)||computedStyle;
  const cognitive=style==='Scenario-based'||style==='Calculation'?'Applied':'Concept check';
  const score=Math.min(5,1+(style==='Scenario-based'?1:0)+(style==='Calculation'?1:0)+(style==='Statement-combination'?1:0)+(wordCount>45?1:0));
  return {difficulty,style,cognitive,score};
};
const normalizeDifficultyValue=value=>{
  const v=String(value||'').trim().replace(/[.!?]+$/,'');
  return ['Easy','Medium','Hard'].includes(v)?v:'';
};
const normalizeStyleValue=value=>{
  const v=String(value||'').trim().replace(/[.!?]+$/,'');
  return ['Scenario-based','Statement-combination','Calculation','Recall'].includes(v)?v:'';
};
const difficulty=q=>normalizeDifficultyValue(qualityProfile(q).difficulty)||qualityProfile({...q,difficultyOverride:''}).difficulty;
const qStyle=q=>normalizeStyleValue(qualityProfile(q).style)||qualityProfile({...q,styleOverride:''}).style;
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
const DATA_VERSION='v149-alignment-visibility-pass';
async function fetchPackedData(){
  if(window.__IPPC_PACKED_DATA__) return window.__IPPC_PACKED_DATA__;
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
const setLabel=n=>Number(n)>20?`Hard ${Number(n)-20}`:`Set ${n}`;
function Pill({children}){return <span className="soft-pill">{children}</span>}
function isCalculationQuestion(q){return Boolean(q?.calc)||qStyle(q)==='Calculation'||difficulty(q)==='Calculation'||/\bFormula\s*:/i.test(String(q?.explanation||''));}
function extractExplanationFormula(explanation){
  const text=String(explanation||'');
  const match=text.match(/Formula:\s*([\s\S]*?)(?:\n\s*(?:Working|Check|Calculation cue|Exam cue|Why this is correct|Why the other options are wrong):|$)/i);
  if(!match) return '';
  return match[1].replace(/\n{3,}/g,'\n\n').trim();
}
function extractCalculationCue(explanation){
  const text=String(explanation||'');
  const match=text.match(/Calculation cue:\s*([\s\S]*?)(?:\n\s*(?:Answer|Formula|Working|Check|Exam cue|Why this is correct|Why the other options are wrong):|$)/i);
  return match?match[1].replace(/\n{3,}/g,'\n\n').trim():'';
}
function formulaFallback(q){
  const body=`${q?.text||''} ${q?.options?.join(' ')||''} ${q?.topic||''}`.toLowerCase();
  if(/current yield/.test(body))return 'Current yield = Annual coupon ÷ Current market price × 100.';
  if(/ytm|yield to maturity/.test(body))return 'Approximate YTM = [Annual coupon + (Par − Price) ÷ years] ÷ [(Par + Price) ÷ 2] × 100.';
  if(/duration|modified duration|price change/.test(body))return 'Approximate % price change = −Modified duration × Change in yield.';
  if(/discount yield/.test(body))return 'Discount yield = [(Face − Price) ÷ Face] × [365 ÷ Days] × 100.';
  if(/effective yield|annualised yield|annualized yield/.test(body))return 'Effective annualised yield = [(Redemption value − Purchase price) ÷ Purchase price] × [365 ÷ Days] × 100.';
  if(/real interest|inflation/.test(body))return 'Approximate real interest rate ≈ Nominal interest rate − Inflation rate.';
  if(/pidm|deposit insurance|coverage/.test(body))return 'Insured amount = lower of eligible deposit balance and PIDM coverage limit per depositor per member institution.';
  if(/exchange rate|usd|foreign currency|ringgit|rm per/.test(body))return 'Converted amount = Foreign currency amount × quoted exchange rate.';
  if(/allocation|portfolio/.test(body))return 'Allocation amount = Portfolio value × Target allocation percentage.';
  if(/score|pass|correct answers|percentage/.test(body))return 'Score percentage = Correct answers ÷ Total questions × 100.';
  if(/zero[- ]coupon|zcb|znid|present value|principal[- ]protected/.test(body))return 'Present value / zero-coupon cost = Future value ÷ (1 + yield)^n.';
  if(/participation/.test(body))return 'Investor return = Principal × Underlying gain × Participation rate; total payoff adds protected principal where applicable.';
  if(/call option|call intrinsic|call payoff/.test(body))return 'Call payoff / intrinsic value = max(Spot − Strike, 0). Breakeven = Strike + Premium.';
  if(/put option|put payoff|put intrinsic/.test(body))return 'Put payoff / intrinsic value = max(Strike − Spot, 0). Breakeven = Strike − Premium.';
  if(/option premium|time value|intrinsic value/.test(body))return 'Option premium = Intrinsic value + Time value.';
  if(q?.topic==='Bonds'||q?.topic==='Debt Securities')return 'Bond price and yield move inversely. Current yield = annual coupon ÷ market price. Approximate YTM uses coupon plus annualised capital gain/loss over average of par and price.';
  if(q?.topic==='Structured Products')return 'Structured product payoff depends on the product terms. Principal protected products usually combine a zero-coupon component with a derivative/option payoff.';
  if(q?.topic==='Derivatives')return 'Option premium = intrinsic value + time value. Call = right to buy; put = right to sell.';
  return '';
}
function CalcHelper({q}){
  if(!q)return null;
  const exact=extractExplanationFormula(q.explanation);
  const fallback=formulaFallback(q);
  const formula=exact||fallback;
  if(!formula)return null;
  const cue=extractCalculationCue(q.explanation);
  const isExact=Boolean(exact);
  return <div className="calc-helper"><strong>{isExact?'Relevant formula':'Formula reference'}</strong><div className="formula-lines">{formula.split('\n').filter(Boolean).map((line,i)=><p key={i}>{line}</p>)}</div>{cue&&<div className="formula-cue"><strong>How to use it:</strong> {cue}</div>}{isCalculationQuestion(q)&&!isExact&&<div className="formula-cue"><strong>Check:</strong> Use the full worked calculation in the explanation after answering.</div>}</div>
}


function answerLetter(index){return index==null?'—':String.fromCharCode(65+Number(index));}
function normalizeExplanationText(raw){
  const markerWords=[
    'Statement-by-statement analysis:',
    'Why this is correct:',
    'Why this answer is correct:',
    'Worked calculation:',
    'Why the other options are wrong:'
  ];
  let text=String(raw||'')
    .replace(/\s+/g,' ')
    .replace(/\s+([,.;:])/g,'$1')
    .replace(/\.\s*\./g,'.')
    .trim();
  markerWords.forEach(marker=>{
    const escaped=marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    text=text.replace(new RegExp(`\\s*(${escaped})\\s*`,'gi'), '\n$1 ');
  });
  return text.replace(/^\n+/,'').trim();
}
function splitExplanationSections(raw){
  const normalized=normalizeExplanationText(raw);
  const labels=[
    'Statement-by-statement analysis:',
    'Why this is correct:',
    'Why this answer is correct:',
    'Worked calculation:',
    'Why the other options are wrong:'
  ];
  const answerMatch=normalized.match(/^Answer:\s*([A-D])\s*-\s*([\s\S]*?)(?=\n(?:Statement-by-statement analysis:|Why this is correct:|Why this answer is correct:|Worked calculation:|Why the other options are wrong:)|$)/i);
  const answerLetterValue=answerMatch?.[1]||'';
  const answerText=(answerMatch?.[2]||'').trim();
  const pick=(label,nextLabels=labels)=>{
    const start=normalized.toLowerCase().indexOf(label.toLowerCase());
    if(start<0)return '';
    const from=start+label.length;
    let end=normalized.length;
    nextLabels.filter(next=>next.toLowerCase()!==label.toLowerCase()).forEach(next=>{
      const i=normalized.toLowerCase().indexOf(next.toLowerCase(),from);
      if(i>=0&&i<end)end=i;
    });
    return normalized.slice(from,end).trim();
  };
  const correct=pick('Why this is correct:')||pick('Why this answer is correct:');
  return {
    answerLetterValue,
    answerText,
    correct,
    statements:pick('Statement-by-statement analysis:'),
    calc:pick('Worked calculation:'),
    wrong:pick('Why the other options are wrong:')
  };
}
function textBlocks(text){
  return String(text||'')
    .replace(/\s+(?=(?:I|II|III|IV|V|VI)\.\s+(?:Correct|Wrong)\s+-)/g,'\n')
    .split(/\n+|(?<=[.!?])\s+(?=(?:[A-Z0-9“']|RM|CLO|PIDM|BNM|SC|FSA|IFSA|CMSA|AMLA))/)
    .map(t=>t.trim())
    .filter(Boolean);
}
function wrongOptionBlocks(text){
  return String(text||'')
    .replace(/\s+(?=[A-D]\s[-–]\s)/g,'\n')
    .split(/\n+/g)
    .map(t=>t.trim())
    .filter(Boolean);
}
function statementBlocks(text){
  return String(text||'')
    .replace(/\s+(?=(?:I|II|III|IV|V|VI)\.\s+(?:Correct|Wrong)\s+-)/g,'\n')
    .split(/\n+/g)
    .map(t=>t.trim())
    .filter(Boolean);
}
function optionNoteLabel(line){
  const m=String(line||'').match(/^([A-D])\s[-–]\s([\s\S]*)$/);
  if(!m)return null;
  return {letter:m[1],body:m[2].trim()};
}
function WrongOptionNote({line}){
  const parsed=optionNoteLabel(line);
  if(!parsed)return <div className="wrong-option-note">{line}</div>;
  return <div className="wrong-option-note parsed-wrong-option"><span className="wrong-option-letter">{parsed.letter}</span><span>{parsed.body}</span></div>;
}
function StatementNote({line}){
  const wrong=/\bWrong\b/i.test(line);
  return <div className={wrong?'statement-pill statement-wrong':'statement-pill statement-correct'}>{line}</div>;
}
function ExplanationPanel({q,selected,correct,compact=false}){
  const parsed=splitExplanationSections(q?.explanation||'');
  const correctLetter=answerLetter(q?.answer);
  const selectedLetter=answerLetter(selected);
  const answerLabel=parsed.answerText||q?.options?.[q?.answer]||'';
  const statusText=selected==null?'Review answer':correct?'Correct':'Incorrect';
  const statusClass=selected==null?'review':correct?'correct':'incorrect';
  let sectionNumber=1;
  const sectionLabel=()=>String(sectionNumber++).padStart(2,'0');
  const sections=[];
  if(parsed.correct){
    sections.push(<section key="correct" className="explanation-section why-correct"><div className="explanation-section-title"><span>{sectionLabel()}</span><h4>Why this is correct</h4></div>{textBlocks(parsed.correct).map((line,i)=><p key={i}>{line}</p>)}</section>);
  }
  if(parsed.statements){
    sections.push(<section key="statements" className="explanation-section statement-review"><div className="explanation-section-title"><span>{sectionLabel()}</span><h4>Statement-by-statement review</h4></div><div className="statement-grid">{statementBlocks(parsed.statements).map((line,i)=><StatementNote key={i} line={line}/>)}</div></section>);
  }
  if(q?.calc||parsed.calc){
    sections.push(<section key="calc" className="explanation-section worked-calc"><div className="explanation-section-title"><span>{sectionLabel()}</span><h4>Worked calculation</h4></div><pre>{q?.calc||parsed.calc}</pre></section>);
  }
  if(parsed.wrong){
    sections.push(<section key="wrong" className="explanation-section wrong-options"><div className="explanation-section-title"><span>{sectionLabel()}</span><h4>Why the other options are wrong</h4></div><div className="wrong-option-grid">{wrongOptionBlocks(parsed.wrong).map((line,i)=><WrongOptionNote key={i} line={line}/>)}</div></section>);
  }
  if(!sections.length){
    sections.push(<section key="plain" className="explanation-section"><div className="explanation-section-title"><span>{sectionLabel()}</span><h4>Explanation</h4></div>{textBlocks(q?.explanation||'').map((line,i)=><p key={i}>{line}</p>)}</section>);
  }
  return <div className={`${correct?'explanation-card okay':'explanation-card notokay'} modern-explanation ${compact?'compact-explanation':''}`.trim()}>
    <div className="explanation-hero">
      <div className="explanation-hero-main">
        <span className={`explanation-status ${statusClass}`}>{statusText}</span>
        <h3>Answer {correctLetter}</h3>
        <p>{answerLabel}</p>
      </div>
      <div className="explanation-meta-grid">
        <div><span>Your choice</span><strong>{selected==null?'Not selected':selectedLetter}</strong></div>
        <div><span>Topic</span><strong>{q?.topic||'—'}</strong></div>
        <div><span>Reference</span><strong>{REF_MAP[q?.topic]||`CLO ${q?.clo||'—'}`}</strong></div>
      </div>
    </div>
    <div className="explanation-sections">{sections}</div>
  </div>;
}




function MockApp({onBack=()=>{},onNotes=()=>{},theme:sharedTheme,toggleTheme:sharedToggleTheme=()=>{}}){
  const [bank,setBank]=useState([]),[screen,setScreen]=useState('home'),[mode,setMode]=useState('generated'),[hardSet,setHardSet]=useState('1'),[qs,setQs]=useState([]),[idx,setIdx]=useState(0),[answers,setAnswers]=useState({}),[flags,setFlags]=useState({}),[conf,setConf]=useState({}),[showAns,setShowAns]=useState(false),[seconds,setSeconds]=useState(7200),[running,setRunning]=useState(false),[err,setErr]=useState(''),[count,setCount]=useState(80),[sets,setSets]=useState(new Set(Array.from({length:20},(_,i)=>i+1))),[topics,setTopics]=useState(new Set()),[clo,setClo]=useState(new Set()),[query,setQuery]=useState(''),[bankSet,setBankSet]=useState('all'),[bankTopic,setBankTopic]=useState('all'),[bankClo,setBankClo]=useState('all'),[bankDiff,setBankDiff]=useState('all'),[bankStyle,setBankStyle]=useState('all'),[bankPage,setBankPage]=useState(1),[history,setHistory]=useState([]),[review,setReview]=useState('wrong'),[navOpen,setNavOpen]=useState(false),[navFilter,setNavFilter]=useState('all'),[showStudy,setShowStudy]=useState(false),[compact,setCompact]=useState(()=>{try{return localStorage.getItem('ippc_compact_v1')==='1'}catch{return false}}),[settingsOpen,setSettingsOpen]=useState(false),[theme,setTheme]=useState(()=>sharedTheme||(()=>{try{return localStorage.getItem(THEME_KEY)||'light'}catch{return 'light'}})());
  useEffect(()=>{loadPacked().then(setBank).catch(e=>setErr(e.message));setHistory(getHistory())},[]);
  useEffect(()=>{if(sharedTheme&&sharedTheme!==theme)setTheme(sharedTheme)},[sharedTheme]);
  useEffect(()=>{applyGlobalTheme(theme);try{localStorage.setItem(THEME_KEY,theme)}catch{}},[theme]);
  useEffect(()=>{try{localStorage.setItem('ippc_compact_v1',compact?'1':'0')}catch{}},[compact]);
  useEffect(()=>{if(!running)return;const t=setInterval(()=>setSeconds(s=>s<=1?(setRunning(false),submit(),0):s-1),1000);return()=>clearInterval(t)},[running]);
  useEffect(()=>setBankPage(1),[query,bankSet,bankTopic,bankClo,bankDiff,bankStyle]);
  const allTopics=useMemo(()=>{const base=[...new Set(bank.map(q=>q.topic))].sort();return bank.some(isLegalFilterQuestion)?[LEGAL_FILTER_TOPIC,...base]:base},[bank]);
  const setNumbers=useMemo(()=>[...new Set(bank.map(q=>q.set))].sort((a,b)=>a-b),[bank]);
  const available=useMemo(()=>bank.filter(q=>sets.has(q.set)&&matchesAnyTopic(q,topics)&&(!clo.size||clo.has(q.clo))),[bank,sets,topics,clo]);
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
  function pickQuestions(kind=mode){let pool=available.length?available:bank;if(kind==='hard'){let hardPool=bank.filter(q=>q.set>=21&&q.set<=25);if(hardSet!=='mixed')hardPool=hardPool.filter(q=>q.set===20+Number(hardSet));return hardSet==='mixed'?shuffle(hardPool).slice(0,80):hardPool.slice(0,80)}if(kind==='wrong'){const wrong=getWrong();pool=bank.filter(q=>wrong.has(q.id));return shuffle(pool).slice(0,Math.min(count,pool.length||bank.length))}if(kind==='calc'){pool=pool.filter(q=>q.calc||qStyle(q)==='Calculation'||difficulty(q)==='Calculation');return shuffle(pool).slice(0,Math.min(count,pool.length))}if(kind==='official')return pickOfficial(bank);if(kind==='generated')return pickOfficial(pool);return shuffle(pool).slice(0,Math.min(count,pool.length));}
  function start(kind=mode){const picked=pickQuestions(kind);if(!picked.length)return;setQs(picked);setIdx(0);setAnswers({});setFlags({});setConf({});setShowAns(false);setSeconds(kind==='official'||kind==='generated'||kind==='hard'?7200:kind==='mock'?Math.round(picked.length*90):0);setRunning(kind==='official'||kind==='generated'||kind==='hard'||kind==='mock');setMode(kind);setScreen('test')}
  function submit(){setRunning(false);setShowAns(false);setScreen('results');setReview('wrong');if(!qs.length)return;const wrongSet=getWrong();qs.forEach(q=>answers[q.id]===q.answer?wrongSet.delete(q.id):wrongSet.add(q.id));saveWrong(wrongSet);const questionHistory=qs.map((q,n)=>({n:n+1,id:q.id,set:q.set,setLabel:setLabel(q.set),clo:q.clo,topic:q.topic,style:qStyle(q),difficulty:difficulty(q),selected:answers[q.id]==null?null:answers[q.id],selectedLabel:answers[q.id]==null?'Not answered':String.fromCharCode(65+answers[q.id]),answer:q.answer,answerLabel:String.fromCharCode(65+q.answer),correct:answers[q.id]===q.answer,flagged:Boolean(flags[q.id]),confidence:conf[q.id]||''}));const setSummary=Object.entries(questionHistory.reduce((acc,q)=>{const key=q.setLabel||setLabel(q.set);acc[key]=(acc[key]||0)+1;return acc},{})).map(([label,total])=>({label,total}));const topicSummary=Object.entries(questionHistory.reduce((acc,q)=>{acc[q.topic]=(acc[q.topic]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([topic,total])=>({topic,total}));const attempt={id:Date.now(),date:new Date().toISOString(),mode,score,total:qs.length,pct,wrong:wrongIds.length,flagged:flaggedCount,sets:setSummary,topics:topicSummary,questions:questionHistory,clo:[1,2,3].map(c=>{const g=qs.filter(q=>q.clo===c);const s=g.reduce((a,q)=>a+(answers[q.id]===q.answer?1:0),0);return{clo:c,score:s,total:g.length,pct:g.length?Math.round(s/g.length*100):0}})};const h=[attempt,...getHistory()];saveHistory(h);setHistory(h)}
  function option(q,i){setAnswers(a=>({...a,[q.id]:i}));if(mode==='practice'||mode==='wrong'||mode==='calc')setShowAns(true)}
  function jump(n){const nextIdx=Math.max(0,Math.min(qs.length-1,n));const nextQ=qs[nextIdx];setIdx(nextIdx);setShowAns((mode==='practice'||mode==='wrong'||mode==='calc')&&nextQ&&answers[nextQ.id]!=null);setShowStudy(false)}
  function toggleSet(n){setSets(s=>{const x=new Set(s);x.has(n)?x.delete(n):x.add(n);return x})}
  function toggleTopic(t){setTopics(s=>{const x=new Set(s);x.has(t)?x.delete(t):x.add(t);return x})}
  function toggleClo(n){setClo(s=>{const x=new Set(s);x.has(n)?x.delete(n):x.add(n);return x})}
  function toggleTheme(requestedTheme){setTheme(t=>{const next=requestedTheme==='dark'||requestedTheme==='light'?requestedTheme:(t==='dark'?'light':'dark');try{localStorage.setItem(THEME_KEY,next)}catch{};sharedToggleTheme(next);return next})}
  function finishSession(){if(window.confirm('Finish this session and submit your answers?')) submit()}
  const normalizedQuery=query.trim().toLowerCase();
  const filteredBank=bank.filter(q=>(bankSet==='all'||q.set===+bankSet)&&(bankTopic==='all'||matchesTopicFilter(q,bankTopic))&&(bankClo==='all'||q.clo===+bankClo)&&(bankDiff==='all'||difficulty(q)===bankDiff)&&(bankStyle==='all'||qStyle(q)===bankStyle)&&(`${q.text} ${q.options.join(' ')} ${q.explanation}`.toLowerCase().includes(normalizedQuery)));
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
  const incorrectCount=navItems.filter(x=>x.wrong).length;
  const filteredNavItems=navItems.filter(x=>navFilter==='all'||(navFilter==='unanswered'&&!x.answered)||(navFilter==='flagged'&&x.flagged)||(navFilter==='incorrect'&&x.wrong));
  if(err)return <div className={`app-shell theme-${theme} safe-loading-shell`}><main className="safe-loading-center"><section className="empty-card safe-loading-card error-state"><h1>Could not load Mock Test</h1><p>{err}</p><p>Check that public/questions.packed.json exists at the GitHub repository root after deployment.</p><button className="secondary-btn" onClick={onBack}>Back to Study Suite Menu</button></section></main></div>;
  if(!bank.length)return <div className={`app-shell theme-${theme} safe-loading-shell`}><main className="safe-loading-center"><section className="empty-card safe-loading-card"><div className="spin"/><h1>Loading Mock Test</h1><p>Loading the compact IPPC question bank…</p><button className="secondary-btn" onClick={onBack}>Back to Study Suite Menu</button></section></main></div>;

  return <div className={`app-shell book-landing book-module book-mock-page theme-${theme} screen-${screen} ${compact?'compact-mode':''}`}>
    <BookTopbar current="mock" onLanding={onBack} onNotes={onNotes} onMock={()=>setScreen('home')} onFlashcards={()=>{window.location.hash='flashcards'}} onReport={()=>{window.location.hash='report'}} theme={theme} toggleTheme={toggleTheme} folio={screen==='test'?'Fol. 004':screen==='history'?'Fol. 010':'Fol. 003'} extra={<button className="book-nav-small-btn" onClick={()=>setSettingsOpen(true)}>Settings</button>} />
    {settingsOpen&&<div className="settings-overlay"><button className="settings-backdrop" onClick={()=>setSettingsOpen(false)} aria-label="Close settings"/><aside className="settings-drawer"><div className="settings-head"><div><span className="eyebrow muted">Settings</span><h3>Display preferences</h3></div><button className="drawer-close-btn" onClick={()=>setSettingsOpen(false)} aria-label="Close settings">×</button></div><div className="settings-body"><div className="settings-row settings-theme-row"><span>Theme</span><CurtainThemeButton theme={theme} onThemeChange={toggleTheme} label /></div><button className="settings-row" onClick={()=>setCompact(v=>!v)}><span>Compact mode</span><strong>{compact?'On':'Off'}</strong></button><button className="settings-row" onClick={()=>{localStorage.removeItem(HISTORY_KEY);localStorage.removeItem(WRONG_KEY);setHistory([])}}><span>Reset local progress</span><strong>Clear</strong></button></div></aside></div>}

    {screen==='home'&&<main className="page page-home">
      <BookPageHead eyebrow="Examination hall · 80 questions · 120 minutes" title="The" em="examination hall" lede="Generate a fresh sitting, drill the topics you keep losing, or build a custom paper from the bank." stats={[["2,000","Question bank"],["25","Sets + 5 Hard"],["12/36/32","CLO split"],["120m","Per sitting"]]} />
      <section className="hero-card surface"><div className="hero-copy"><span className="eyebrow">Mock generator mode</span><h1>Turn the bank into a real revision dashboard.</h1><p>Generated mocks lock to 80 questions and the 12/36/32 CLO split. Practice mode supports wrong-question drilling, confidence marking, review mode, and saved attempt history.</p><div className="quick-start-block"><h2>Quick Start</h2><div className="hero-actions"><button className="primary-btn" onClick={()=>start('generated')}>Generate fresh mock</button><button className="primary-btn practice-quick-btn" onClick={()=>start('practice')}>Practice</button><button className="secondary-btn calc-quick-btn" onClick={()=>start('calc')}>Calculation drill</button><button className="secondary-btn wrong-quick-btn" onClick={()=>start('wrong')}>Wrong questions only</button><button className="secondary-btn bank-quick-btn" onClick={()=>setScreen('bank')}>Browse bank</button></div></div></div><div className="hero-stats-grid"><div className="stat-card accent"><strong>80</strong><span>Generated mock questions</span></div><div className="stat-card"><strong>12</strong><span>CLO1 questions</span></div><div className="stat-card"><strong>36</strong><span>CLO2 questions</span></div><div className="stat-card"><strong>32</strong><span>CLO3 questions</span></div></div></section>
      <section className="home-grid"><div className="surface config-card"><div className="section-head"><div><h2>Build a custom session</h2><p>Use mock generator for exam simulation, or custom filters for targeted revision.</p></div></div><div className="mode-switch"><button className={mode==='generated'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('generated');setCount(80)}}><span>Mock generator</span><small>Fresh 80 Q · 2 hours · 12/36/32 split</small></button><button className={mode==='hard'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('hard');setCount(80)}}><span>Hard Mode</span><small>5 advanced sets · only hard traps</small></button><button className={mode==='calc'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('calc');setCount(80)}}><span>Calculation drill</span><small>Bonds · options · payoffs</small></button><button className={mode==='mock'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('mock');setCount(80)}}><span>Custom timed</span><small>Your filters · timed</small></button><button className={mode==='practice'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('practice');setCount(80)}}><span>Practice</span><small>Instant answers</small></button><button className={mode==='wrong'?'mode-btn active-mode':'mode-btn'} onClick={()=>{setMode('wrong');setCount(80)}}><span>Wrong only</span><small>Drill previous mistakes</small></button></div>{mode==='hard'&&<div className="control-block hard-mode-panel"><div className="section-label-row"><h3>Advanced Hard Mode</h3><span className="soft-pill">80 Q · 2 hours · 100% Hard</span></div><p className="count-helper">Choose one fixed hard set, or use Mixed to draw 80 questions across all five advanced sets.</p><div className="chip-group"><button className={hardSet==='mixed'?'chip chip-on':'chip'} onClick={()=>setHardSet('mixed')}>Mixed hard</button>{[1,2,3,4,5].map(n=><button key={n} className={hardSet===String(n)?'chip chip-on':'chip'} onClick={()=>setHardSet(String(n))}>Hard {n}</button>)}</div></div>}{mode!=='generated'&&mode!=='hard'&&<div className="control-block"><div className="section-label-row"><h3>Question count</h3><span className="soft-pill">Available: {mode==='wrong'?getWrong().size:mode==='calc'?available.filter(q=>q.calc||qStyle(q)==='Calculation'||difficulty(q)==='Calculation').length:available.length}</span></div><div className="number-count-card"><label className="count-input-wrap"><span>Number of questions</span><input type="number" min="1" max={sessionAvailableCount||bank.length||1600} value={count} onChange={e=>setCount(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label><div className="range-meta"><strong>{count}</strong><span>{mode==='mock'?`${Math.round(count*1.5)} min estimate`:'Custom practice session'}</span></div><p className="count-helper">You can type any number. The app will use all matching questions if the requested number is higher than available.</p></div></div>}<div className="control-block"><div className="section-label-row"><h3>Sets</h3><div className="filter-actions"><button className="text-btn" onClick={()=>setSets(new Set())}>Clear</button><button className="text-btn" onClick={()=>setSets(new Set(setNumbers.filter(n=>n<=20)))}>Select core</button></div></div><div className="chip-group">{setNumbers.map(n=><button key={n} className={sets.has(n)?'chip chip-on':'chip'} onClick={()=>toggleSet(n)}>{setLabel(n)}</button>)}</div></div><div className="control-block"><div className="section-label-row"><h3>CLO focus</h3><div className="filter-actions"><button className="text-btn" onClick={()=>setClo(new Set())}>Clear</button><button className="text-btn" onClick={()=>setClo(new Set([1,2,3]))}>Select all</button></div></div><div className="chip-group chip-group-wide">{[1,2,3].map(n=><button key={n} className={clo.has(n)?'chip chip-on':'chip'} onClick={()=>toggleClo(n)}>CLO {n}<small>{CLO_LABEL[n]}</small></button>)}</div></div><div className="control-block"><div className="section-label-row"><h3>Topics</h3><div className="filter-actions"><button className="text-btn" onClick={()=>setTopics(new Set())}>Clear</button><button className="text-btn" onClick={()=>setTopics(new Set(allTopics))}>Select all</button></div></div><div className="chip-group scroll-chips">{allTopics.map(t=><button key={t} className={topics.has(t)?'chip chip-on':'chip'} onClick={()=>toggleTopic(t)}>{t}</button>)}</div></div><div className="button-row sticky-actions"><button className="secondary-btn" onClick={()=>{setSets(new Set(setNumbers.filter(n=>n<=20)));setTopics(new Set());setClo(new Set());setCount(80)}}>Reset filters</button><button className="primary-btn" onClick={()=>start(mode)}>Begin session</button></div></div><div className="home-side-stack"><div className="surface info-card"><div className="section-head compact"><div><h2>Attempt history</h2><p>{history.length?`Last score: ${history[0].pct}% · Weakest: CLO ${topWeak?.clo}`:'No attempts saved yet.'}</p></div></div><div className="blueprint-list">{history.slice(0,4).map(h=><div className="blueprint-item" key={h.id}><div><strong>{h.pct}%</strong><span>{new Date(h.date).toLocaleDateString()} · {h.mode}</span></div><b>{h.score}/{h.total}</b></div>)}</div><div className="button-row" style={{marginTop:16}}><button className="secondary-btn" onClick={()=>setScreen('history')}>View history</button></div></div><div className="surface info-card"><div className="section-head compact"><div><h2>New study features</h2><p>Review mode, confidence labels, formula helpers, textbook references, and difficulty tags are now integrated.</p></div></div><ul className="feature-list"><li>Wrong-question practice from saved attempts</li><li>Review all wrong, flagged, unanswered, or by CLO</li><li>Confidence tracking: confident, guessed, unsure</li><li>Formula helper and calculation drill for quick-win formulas</li><li>Practice mode gives instant result and explanation after each answer</li><li>Fresh topic-balanced mock generator</li><li>Advanced Hard Mode: 5 dedicated 80-question trap sets</li></ul></div></div></section>
    </main>}

    {screen==='test'&&current&&<main className="page page-test page-test-drawer">
      <BookPageHead eyebrow={`Mock paper · ${setLabel(current.set)} · In session`} title="In" em="session." lede="Eighty questions. One hundred and twenty minutes. Mark your confidence — review what you flagged afterwards." stats={[[`${answeredCount}/${qs.length}`,"Answered"],[fmt(seconds),"Time remaining"],[String(flaggedCount),"Flagged"],[`CLO ${current.clo}`,"Current section"]]} />
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
            <div className="drawer-status-grid">
              <div className="drawer-status-card current"><span className="legend-dot current"/><div><strong>Current</strong><small>Question {idx+1}</small></div></div>
              <div className="drawer-status-card answered"><span className="legend-dot answered"/><div><strong>Answered</strong><small>{answeredCount} questions</small></div></div>
              <div className="drawer-status-card unanswered"><span className="legend-dot unanswered"/><div><strong>Unanswered</strong><small>{unansweredCount} questions</small></div></div>
              <div className="drawer-status-card flagged"><span className="legend-dot flagged"/><div><strong>Flagged</strong><small>{flaggedCount} questions</small></div></div>
              <div className="drawer-status-card incorrect"><span className="legend-dot incorrect"/><div><strong>Incorrect</strong><small>{incorrectCount} questions</small></div></div>
            </div>
            <div className="drawer-filter-chips">
              {[
                ['all',`All (${qs.length})`],
                ['unanswered',`Unanswered (${unansweredCount})`],
                ['flagged',`Flagged (${flaggedCount})`],
                ['incorrect',`Incorrect (${incorrectCount})`]
              ].map(([f,label])=><button key={f} className={navFilter===f?'chip chip-on':'chip'} onClick={()=>setNavFilter(f)}>{label}</button>)}
            </div>
            <div className="drawer-nav-grid">
              {filteredNavItems.map(({q,i,answered,flagged,wrong})=><button key={q.id} className={`nav-cell ${i===idx?'now':''} ${answered?'done':''} ${flagged?'flagged':''} ${wrong?'wrong':''} ${!answered?'open':''}`} onClick={()=>{jump(i);setNavOpen(false)}} aria-label={`Question ${i+1}${i===idx?', current':''}${flagged?', flagged':''}${wrong?', incorrect':answered?', answered':', unanswered'}`}>
                <span className="nav-cell-topline">
                  <span className="nav-cell-number">{i+1}</span>
                  <span className="nav-cell-icons">
                    {i===idx&&<span className="nav-cell-current-dot" aria-hidden="true"/>}
                    {flagged&&<span className="nav-cell-flag-dot" aria-hidden="true">⚑</span>}
                  </span>
                </span>
              </button>)}
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
          <div className="test-toolbar-side"><div className="toolbar-pills"><Pill>{setLabel(current.set)}</Pill><Pill>{current.topic}</Pill><Pill>CLO {current.clo}</Pill><Pill>{difficulty(current)}</Pill>{running&&<span className="timer-pill">{fmt(seconds)}</span>}</div><button className="danger-btn" onClick={finishSession}>Finish</button></div>
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

        {showAns&&<ExplanationPanel q={current} selected={selected} correct={correct}/>}

        <div className="button-row split-mobile test-action-bar">
          <button className="secondary-btn mobile-nav-button action-btn" onClick={()=>setNavOpen(true)}><span className="action-icon">☰</span><span className="action-label">Navigator</span></button>
          <button className="secondary-btn action-btn" onClick={()=>jump(idx-1)} disabled={idx===0}><span className="action-icon">←</span><span className="action-label">Previous</span></button>
          <button className="secondary-btn action-btn" onClick={()=>setShowAns(!showAns)}><span className="action-icon">✓</span><span className="action-label">{showAns?'Hide answer':'Show answer'}</span></button>
          <button className="secondary-btn action-btn" onClick={()=>setFlags(f=>({...f,[current.id]:!f[current.id]}))}><span className="action-icon">⚑</span><span className="action-label">{flags[current.id]?'Unflag':'Flag'}</span></button>
          <button className="primary-btn next-primary action-btn primary-action" onClick={()=>idx===qs.length-1?finishSession():jump(idx+1)}><span className="action-icon">→</span><span className="action-label">{idx===qs.length-1?'Submit results':'Next question'}</span></button>
        </div>
      </section>
    </main>}

    {screen==='results'&&<main className="page page-results"><section className="surface score-hero"><div className="score-badge-wrap"><div className={pct>=70?'score-badge score-pass':'score-badge score-fail'}>{pct}%</div></div><div className="score-copy"><span className="eyebrow muted">Session complete</span><h1>{pct>=70?'Pass':'Keep practising'}</h1><p>You scored <strong>{score}</strong> out of <strong>{qs.length}</strong>. Wrong questions are saved automatically for targeted practice.</p></div></section><section className="results-grid"><div className="surface info-card"><div className="section-head compact"><div><h2>Performance summary</h2><p>Confidence and mistake review are now available below.</p></div></div><div className="summary-grid"><div className="mini-stat"><span>Correct</span><strong>{score}</strong></div><div className="mini-stat"><span>Wrong</span><strong>{wrongIds.length}</strong></div><div className="mini-stat"><span>Flagged</span><strong>{flaggedCount}</strong></div><div className="mini-stat"><span>Guessed / unsure</span><strong>{guessedUnsureCount}</strong></div></div><div className="priority-grid"><div className="priority-card high"><span>High priority</span><strong>{wrongConfidentCount}</strong><p>Wrong but marked confident</p></div><div className="priority-card"><span>Reinforce</span><strong>{correctGuessedCount}</strong><p>Correct but guessed or unsure</p></div></div></div><div className="surface info-card"><div className="section-head compact"><div><h2>CLO breakdown</h2><p>Use this to target weaker sections.</p></div></div><div className="breakdown-list">{[1,2,3].map(c=>{const group=qs.filter(q=>q.clo===c);const s=group.reduce((a,q)=>a+(answers[q.id]===q.answer?1:0),0);const cp=group.length?Math.round(s/group.length*100):0;return <div key={c} className="breakdown-item"><div className="breakdown-head"><div><strong>CLO {c}</strong><span>{CLO_LABEL[c]}</span></div><b>{s}/{group.length}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${cp}%`}}/></div></div>})}</div></div></section><section className="surface review-panel"><div className="section-head"><div><h2>Review mode</h2><p>Work through the highest-value review steps first.</p></div><div className="chip-group">{['wrong','flagged','unanswered','all','1','2','3'].map(r=><button key={r} className={review===r?'chip chip-on':'chip'} onClick={()=>setReview(r)}>{['1','2','3'].includes(r)?`CLO ${r}`:r}</button>)}</div></div><div className="review-steps"><button onClick={()=>setReview('wrong')}><strong>1</strong><span>Review wrong answers</span></button><button onClick={()=>setReview('flagged')}><strong>2</strong><span>Check flagged questions</span></button><button onClick={()=>setReview('unanswered')}><strong>3</strong><span>Finish unanswered items</span></button><button onClick={()=>start('wrong')}><strong>4</strong><span>Retry wrong questions</span></button></div><div className="bank-list upgraded-list">{reviewQs.map(q=><details key={q.id} className="bank-item upgraded-bank-item"><summary><div className="bank-card-head"><div className="summary-meta"><Pill>{q.id}</Pill><Pill>{q.topic}</Pill><Pill>{difficulty(q)}</Pill><Pill>{qStyle(q)}</Pill><Pill>{qualityLabel(q)}</Pill><Pill>{conf[q.id]||'no confidence tag'}</Pill></div><span className={answers[q.id]===q.answer?'answer-badge':'answer-badge wrong-badge'}>{answers[q.id]===q.answer?'Correct':'Wrong'} · Ans {String.fromCharCode(65+q.answer)}</span></div><QuestionText text={q.text} className="summary-text"/></summary><div className="bank-card-body"><div className="bank-card-actions"><button className="secondary-btn" onClick={()=>navigator.clipboard?.writeText(`${q.text}\n\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}`)}>Copy question</button><button className="secondary-btn" onClick={()=>{setBankTopic(q.topic);setBankPage(1)}}>Practice this topic</button></div><ol className="bank-options">{q.options.map((o,i)=><li key={i} className={i===q.answer?'answer-hit':answers[q.id]===i?'user-wrong':''}><span className="bank-option-label">{String.fromCharCode(65+i)}</span><span>{o}</span></li>)}</ol><ExplanationPanel q={q} selected={answers[q.id]} correct={answers[q.id]===q.answer} compact/></div></details>)}</div><div className="button-row results-actions"><button className="secondary-btn" onClick={()=>start('wrong')}>Practice wrong questions</button><button className="primary-btn" onClick={()=>start('generated')}>Generate fresh mock</button></div></section></main>}



    {screen==='summary'&&<main className="page page-summary"><section className="surface summary-hero-panel"><div><span className="eyebrow">Summary Breakdown</span><h1>Question bank composition</h1><p>This shows the type of questions available in the mock test bank, so you can quickly decide whether to practise by style, difficulty, CLO, or topic.</p></div><div className="summary-hero-stats"><div className="mini-stat"><span>Total questions</span><strong>{bank.length}</strong></div><div className="mini-stat"><span>Sets</span><strong>{setNumbers.length}</strong></div><div className="mini-stat"><span>Roman numeral</span><strong>{romanCount}</strong></div><div className="mini-stat"><span>Scenario-style</span><strong>{scenarioCount}</strong></div></div></section><section className="summary-breakdown-grid"><div className="surface info-card"><div className="section-head compact"><div><h2>By question style</h2><p>Use this to choose the type of practice you want.</p></div></div><div className="breakdown-list">{['Scenario-based','Statement-combination','Calculation','Recall'].map(name=>{const total=styleBreakdown[name]||0;const pc=bank.length?Math.round(total/bank.length*100):0;return <div key={name} className="breakdown-item"><div className="breakdown-head"><div><strong>{name}</strong><span>{pc}% of bank</span></div><b>{total}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${pc}%`}}/></div></div>})}</div></div><div className="surface info-card"><div className="section-head compact"><div><h2>By difficulty</h2><p>Use this to balance foundational, intermediate and advanced revision.</p></div></div><div className="breakdown-list">{['Easy','Medium','Hard'].map(name=>{const total=difficultyBreakdown[name]||0;const pc=bank.length?Math.round(total/bank.length*100):0;return <div key={name} className="breakdown-item"><div className="breakdown-head"><div><strong>{name}</strong><span>{pc}% of bank</span></div><b>{total}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${pc}%`}}/></div></div>})}</div></div><div className="surface info-card"><div className="section-head compact"><div><h2>By exam CLO</h2><p>Aligned to the official generated mock target split.</p></div></div><div className="breakdown-list">{[1,2,3].map(n=>{const name=`CLO ${n}`;const total=cloBreakdown[name]||0;const pc=bank.length?Math.round(total/bank.length*100):0;return <div key={name} className="breakdown-item"><div className="breakdown-head"><div><strong>{name}</strong><span>{CLO_LABEL[n]}</span></div><b>{total}</b></div><div className="progress-track slim"><div className="progress-fill" style={{width:`${pc}%`}}/></div></div>})}</div></div><div className="surface info-card"><div className="section-head compact"><div><h2>Top topics</h2><p>The largest topic pools in the bank.</p></div></div><div className="topic-breakdown-list">{topicBreakdown.slice(0,12).map(([topic,total])=>{const pc=bank.length?Math.round(total/bank.length*100):0;return <button key={topic} className="topic-breakdown-row" onClick={()=>{setBankTopic(topic);setScreen('bank')}}><span>{topic}</span><strong>{total}</strong><em>{pc}%</em></button>})}</div></div></section><section className="surface info-card summary-action-panel"><div><h2>How to use this</h2><p>For exam simulation, use <strong>Generate fresh mock</strong>. For weak-area drilling, click a topic above or go to Question Bank and filter by Difficulty or Style.</p></div><div className="button-row"><button className="primary-btn" onClick={()=>start('generated')}>Generate fresh mock</button><button className="secondary-btn" onClick={()=>{setMode('hard');setScreen('home')}}>Open Hard Mode</button><button className="secondary-btn" onClick={()=>setScreen('bank')}>Open Question Bank</button></div></section></main>}

    {screen==='history'&&<main className="page page-history"><section className="surface bank-panel history-panel"><div className="section-head"><div><span className="eyebrow muted">Progress tracker</span><h2>Saved progress</h2><p>Attempts are saved locally on this device. Open an attempt to see the set mix, CLO split, topics and question-level history.</p></div><button className="secondary-btn" onClick={()=>{localStorage.removeItem(HISTORY_KEY);localStorage.removeItem(WRONG_KEY);setHistory([])}}>Clear history</button></div><div className="bank-list history-list">{history.length?history.map(h=>{const setMix=h.sets||[];const topicMix=h.topics||[];const detail=h.questions||[];return <details className="history-attempt-card" key={h.id}><summary><div className="history-attempt-main"><strong>{h.pct}% · {h.score}/{h.total}</strong><span>{new Date(h.date).toLocaleString()} · {h.mode} · {h.wrong} wrong · {h.flagged} flagged</span></div><div className="toolbar-pills history-pills">{(h.clo||[]).map(c=><Pill key={c.clo}>CLO {c.clo}: {c.score}/{c.total} · {c.pct}%</Pill>)}<Pill>{detail.length?`${detail.length} question records`:'summary only'}</Pill></div></summary><div className="history-detail-grid"><div className="history-detail-card"><h3>Set breakdown</h3>{setMix.length?<div className="history-chip-list">{setMix.map(s=><span key={s.label}>{s.label}: <strong>{s.total}</strong></span>)}</div>:<p>Detailed set data is available for attempts saved from V131 onwards.</p>}</div><div className="history-detail-card"><h3>Topic mix</h3>{topicMix.length?<div className="history-chip-list">{topicMix.map(t=><span key={t.topic}>{t.topic}: <strong>{t.total}</strong></span>)}</div>:<p>Topic-level history was not stored for this older attempt.</p>}</div></div>{detail.length?<div className="history-question-table-wrap"><table className="history-question-table"><thead><tr><th>#</th><th>ID</th><th>Set</th><th>CLO</th><th>Topic</th><th>Style</th><th>Difficulty</th><th>Your answer</th><th>Correct</th><th>Status</th></tr></thead><tbody>{detail.map(q=><tr key={`${h.id}-${q.id}`} className={q.correct?'history-row-correct':'history-row-wrong'}><td>{q.n}</td><td>{q.id}</td><td>{q.setLabel||setLabel(q.set)}</td><td>CLO {q.clo}</td><td>{q.topic}</td><td>{q.style}</td><td>{q.difficulty}</td><td>{q.selectedLabel}{q.flagged?' · flagged':''}{q.confidence?` · ${q.confidence}`:''}</td><td>{q.answerLabel}</td><td>{q.correct?'Correct':'Wrong'}</td></tr>)}</tbody></table></div>:<div className="empty-card history-empty-detail"><h3>No detailed attempt breakdown saved</h3><p>This older attempt only contains the score and CLO summary. Finish a new session to store question-level set, topic and answer history.</p></div>}</details>}):<div className="empty-card"><h3>No history yet</h3><p>Finish a session to see score trends, set mix, topic mix and weak CLOs here.</p></div>}</div></section></main>}

    {screen==='bank'&&<main className="page page-bank"><section className="surface bank-panel bank-panel-upgraded"><div className="bank-hero"><div><span className="eyebrow">Question library</span><h2>Search the full IPPC bank with cleaner navigation.</h2><p>Filter by set, topic, CLO, difficulty, and question style. Each card now includes a quality profile so you can target hard, applied and scenario-based items.</p></div><div className="bank-stats-grid"><div className="mini-stat bank-stat"><span>Total</span><strong>{bank.length}</strong></div><div className="mini-stat bank-stat"><span>Matches</span><strong>{filteredBank.length}</strong></div><div className="mini-stat bank-stat"><span>Wrong saved</span><strong>{getWrong().size}</strong></div></div></div><div className="bank-layout"><aside className="bank-sidebar"><div className="bank-filter-card"><div className="bank-filter-header"><div><span className="eyebrow muted">Filter panel</span><h3>Refine the bank</h3><p>Use the controls below to narrow the full question library quickly.</p></div><button className="secondary-btn bank-compact-reset" onClick={()=>{setQuery('');setBankSet('all');setBankTopic('all');setBankClo('all');setBankDiff('all');setBankStyle('all')}}>Reset all</button></div><label className="bank-field bank-search-field"><span>Search</span><input placeholder="Search callable bond, PIDM, CDD…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="bank-filter-section"><div className="bank-section-title">Main filters</div><div className="filter-grid bank-filter-grid"><label className="bank-field"><span>Set</span><select value={bankSet} onChange={e=>setBankSet(e.target.value)}><option value="all">All sets</option>{setNumbers.map(n=><option key={n} value={n}>{setLabel(n)}</option>)}</select></label><label className="bank-field"><span>CLO</span><select value={bankClo} onChange={e=>setBankClo(e.target.value)}><option value="all">All CLOs</option>{[1,2,3].map(n=><option key={n} value={n}>CLO {n}</option>)}</select></label><label className="bank-field bank-field-full"><span>Topic</span><select value={bankTopic} onChange={e=>setBankTopic(e.target.value)}><option value="all">All topics</option>{allTopics.map(t=><option key={t}>{t}</option>)}</select></label></div></div><div className="bank-filter-section"><div className="bank-section-title">Question profile</div><div className="filter-grid bank-profile-grid"><label className="bank-field"><span>Difficulty</span><select value={bankDiff} onChange={e=>setBankDiff(e.target.value)}><option value="all">All difficulty</option>{['Easy','Medium','Hard'].map(d=><option key={d}>{d}</option>)}</select></label><label className="bank-field"><span>Style</span><select value={bankStyle} onChange={e=>setBankStyle(e.target.value)}><option value="all">All styles</option>{['Scenario-based','Statement-combination','Calculation','Recall'].map(d=><option key={d}>{d}</option>)}</select></label></div></div><div className="bank-filter-section"><div className="section-label-row"><h3>CLO quick filter</h3><button className="text-btn" onClick={()=>setBankClo('all')}>Clear</button></div><div className="chip-group chip-group-wide">{[1,2,3].map(n=><button key={n} className={bankClo===String(n)?'chip chip-on':'chip'} onClick={()=>setBankClo(bankClo===String(n)?'all':String(n))}>CLO {n}<small>{CLO_LABEL[n]}</small></button>)}</div></div><div className="bank-filter-section bank-filter-section-soft"><div className="bank-mini-note"><strong>Tip:</strong> Use Search + Topic first, then refine by difficulty or Style = Scenario-based for applied exam practice.</div></div><div className="button-row bank-reset-row"><button className="secondary-btn" onClick={()=>{setQuery('');setBankSet('all');setBankTopic('all');setBankClo('all');setBankDiff('all');setBankStyle('all')}}>Reset all filters</button></div></div></aside><div className="bank-results-column"><div className="bank-results-header"><div><div className="bank-summary"><strong>{filteredBank.length}</strong> matches found</div><div className="bank-subsummary">Page {bankPage} of {pageCount}</div></div><div className="bank-results-actions"><Pill>{visibleBank.length} shown</Pill><Pill>{pageSize} per page</Pill></div></div>{!filteredBank.length&&<div className="empty-card bank-empty-state"><h3>No questions found.</h3><p>Try clearing the topic filter or searching a broader term.</p><button className="secondary-btn" onClick={()=>{setQuery('');setBankSet('all');setBankTopic('all');setBankClo('all');setBankDiff('all');setBankStyle('all')}}>Reset filters</button></div>}<div className="bank-list upgraded-list">{visibleBank.map(q=><details key={q.id} className="bank-item upgraded-bank-item"><summary><div className="bank-card-head"><div className="summary-meta"><Pill>{q.id}</Pill><Pill>{setLabel(q.set)}</Pill><Pill>CLO {q.clo}</Pill><Pill>{q.topic}</Pill><Pill>{difficulty(q)}</Pill><Pill>{qStyle(q)}</Pill><Pill>{qualityLabel(q)}</Pill></div><span className="answer-badge">Answer {String.fromCharCode(65+q.answer)}</span></div><QuestionText text={q.text} className="summary-text"/><div className="bank-card-hint">Quality: {qualityLabel(q)} · {qStyle(q)} · Reference: {REF_MAP[q.topic]||`CLO ${q.clo}`}</div></summary><div className="bank-card-body"><div className="bank-card-actions"><button className="secondary-btn" onClick={()=>navigator.clipboard?.writeText(`${q.text}\n\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}`)}>Copy question</button><button className="secondary-btn" onClick={()=>{setBankTopic(q.topic);setBankPage(1)}}>Practice this topic</button></div><ol className="bank-options">{q.options.map((o,i)=><li key={i} className={i===q.answer?'answer-hit':''}><span className="bank-option-label">{String.fromCharCode(65+i)}</span><span>{o}</span></li>)}</ol>{q.calc&&<pre className="bank-calc">{q.calc}</pre>}<div className="bank-explanation-wrap"><span className="answer-badge subtle-badge">Explanation</span><ExplanationPanel q={q} selected={null} correct={true} compact/></div></div></details>)}</div><div className="bank-pagination"><button className="secondary-btn" onClick={()=>setBankPage(p=>Math.max(1,p-1))} disabled={bankPage===1}>← Prev</button><div className="pagination-pills">{Array.from({length:Math.min(5,pageCount)},(_,i)=>{const start=Math.min(Math.max(1,bankPage-2),Math.max(1,pageCount-4));const n=start+i;if(n>pageCount)return null;return <button key={n} className={n===bankPage?'chip chip-on':'chip'} onClick={()=>setBankPage(n)}>{n}</button>})}</div><form className="page-jump" onSubmit={e=>{e.preventDefault();const value=Number(e.currentTarget.elements.bankPageJump.value);if(value) setBankPage(Math.min(pageCount,Math.max(1,Math.floor(value))))}}><label>Go to page</label><input name="bankPageJump" type="number" min="1" max={pageCount} placeholder={String(bankPage)}/><button className="secondary-btn" type="submit">Go</button></form><button className="secondary-btn" onClick={()=>setBankPage(p=>Math.min(pageCount,p+1))} disabled={bankPage===pageCount}>Next →</button></div></div></div></section></main>}
  </div>
}


const REPORT_PDF_PATH='/IPPC_Question_Bank_Audit_Report_V153.pdf#toolbar=0&navpanes=0&scrollbar=1';
const AUDIT_SITE_PATH='/about/index.html';
const PRINTABLE_NOTES_PDF_PATH='/IPPC_Printable_Study_Notes_Audited_Fixed_Pages_36_38_Consistent.pdf';
const PRINTABLE_NOTES_VIEW_PATH=PRINTABLE_NOTES_PDF_PATH+'#toolbar=0&navpanes=0&scrollbar=1';
const PRINTABLE_NOTES_PAGE_COUNT=38;

function BookThemeToggle({theme,toggleTheme}){
  const isDark=theme==='dark';
  const [phase,setPhase]=useState('idle');
  const curtainColor=useRef(isDark?'#f3ead7':'#16110a');
  const duration=620;
  const nextTheme=isDark?'light':'dark';
  const switchTheme=()=>{
    if(phase!=='idle')return;
    curtainColor.current=nextTheme==='dark'?'#16110a':'#f3ead7';
    setPhase('falling');
    window.setTimeout(()=>{
      toggleTheme(nextTheme);
      setPhase('rising');
      window.setTimeout(()=>setPhase('idle'),duration+90);
    },duration);
  };
  return <>
    <div aria-hidden="true" className={`book-curtain-overlay ${phase}`} style={{background:curtainColor.current,transition:phase==='idle'?'none':`transform ${duration}ms cubic-bezier(0.76,0,0.24,1)`}} />
    <button type="button" className="book-theme-toggle" onClick={switchTheme} aria-label={isDark?'Switch to light mode':'Switch to dark mode'} aria-pressed={isDark}>
      <span className="book-tt-track">
        <span className="book-tt-icon sun" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round"/></svg></span>
        <span className="book-tt-icon moon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round"/></svg></span>
        <span className="book-tt-knob" />
      </span>
      <span className="book-tt-label">{isDark?'Dawn':'Dusk'}</span>
    </button>
  </>;
}
function BookTopbar({current='front',onLanding=()=>{},onNotes=()=>{},onMock=()=>{},onFlashcards=()=>{},onReport=()=>{},theme='light',toggleTheme=()=>{},folio='Fol. 001',extra=null}){
  const item=(id,label,fn)=><button type="button" className={current===id?'current':''} onClick={fn}>{label}</button>;
  return <header className="book-topbar" aria-label="IPPC Study Suite navigation">
    <button type="button" className="book-brand" onClick={onLanding}>
      <span className="book-mark">IPPC <span>&amp;</span> Co.</span>
      <span className="book-vol">Vol. V153 · Study Suite</span>
    </button>
    <nav className="book-nav" aria-label="Main menu">
      {item('front','Frontispiece',onLanding)}
      {item('notes','Notes',onNotes)}
      {item('mock','Mock Test',onMock)}
      {item('flashcards','Flashcards',onFlashcards)}
      {item('audit','Audit',onReport)}
      <button type="button" className={current==='about'?'current':''} onClick={()=>{window.location.href=AUDIT_SITE_PATH}}>Colophon</button>
    </nav>
    <div className="book-top-right">
      {extra}
      <BookThemeToggle theme={theme} toggleTheme={toggleTheme}/>
      <div className="book-folio">{folio}</div>
    </div>
  </header>;
}
function BookPageHead({eyebrow,title,em='',lede,stats=[]}){
  return <section className="book-page-head">
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title} {em&&<span className="em">{em}</span>}</h1>
      {lede&&<p className="lede">{lede}</p>}
    </div>
    <div className="meta-stack">
      {stats.map(([v,l])=><div className="ms" key={`${v}-${l}`}><div className="v">{v}</div><div className="l">{l}</div></div>)}
    </div>
  </section>;
}

function AppIcon({name}) {
  const paths = {
    notes: <><path d="M7 4h8a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z"/><path d="M8 4v16"/><path d="M11 8h4"/><path d="M11 12h3"/></>,
    mock: <><path d="M8 4h8l3 3v13H6V4h2Z"/><path d="M15 4v4h4"/><path d="m9 13 2 2 4-5"/><path d="M9 18h6"/></>,
    cards: <><rect x="4" y="6" width="12" height="14" rx="2"/><path d="M8 4h8a2 2 0 0 1 2 2v11"/><path d="M8 11h4"/><path d="M8 15h3"/></>,
    report: <><path d="M5 19V5"/><path d="M5 19h14"/><path d="M9 15V9"/><path d="M13 15V7"/><path d="M17 15v-4"/></>,
    print: <><path d="M7 9V4h10v5"/><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/></>,
    about: <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v5h1"/></>,
  };
  return (
    <svg className="app-line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.notes}
    </svg>
  );
}

const FLASHCARD_DATA=[{"id": "fc001", "category": "Dates", "tag": "Effective dates", "front": "What happened on 26 Jan 1959?", "answer": "Bank Negara Malaysia started operations.", "detail": "Bank Negara Malaysia started operations."}, {"id": "fc002", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Bank Negara Malaysia started operations.", "answer": "26 Jan 1959", "detail": "26 Jan 1959"}, {"id": "fc003", "category": "Dates", "tag": "Effective dates", "front": "What happened on 1 Mar 1993?", "answer": "Securities Commission Malaysia started operations under the Securities Commission Act 1993.", "detail": "Securities Commission Malaysia started operations under the Securities Commission Act 1993."}, {"id": "fc004", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Securities Commission Malaysia started operations under the Securities Commission Act 1993.", "answer": "1 Mar 1993", "detail": "1 Mar 1993"}, {"id": "fc005", "category": "Dates", "tag": "Effective dates", "front": "What happened on 15 Feb 1996?", "answer": "Labuan FSA was established under the Labuan Financial Services Authority Act 1996.", "detail": "Labuan FSA was established under the Labuan Financial Services Authority Act 1996."}, {"id": "fc006", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Labuan FSA was established under the Labuan Financial Services Authority Act 1996.", "answer": "15 Feb 1996", "detail": "15 Feb 1996"}, {"id": "fc007", "category": "Dates", "tag": "Effective dates", "front": "What happened on 1 Sep 2006?", "answer": "Threshold reporting under AMLA notes became effective; it is separate from suspicious transaction reporting.", "detail": "Threshold reporting under AMLA notes became effective; it is separate from suspicious transaction reporting."}, {"id": "fc008", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Threshold reporting under AMLA notes became effective; it is separate from suspicious transaction reporting.", "answer": "1 Sep 2006", "detail": "1 Sep 2006"}, {"id": "fc009", "category": "Dates", "tag": "Effective dates", "front": "What happened on 28 Sep 2007?", "answer": "Capital Markets and Services Act 2007 came into force.", "detail": "Capital Markets and Services Act 2007 came into force."}, {"id": "fc010", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Capital Markets and Services Act 2007 came into force.", "answer": "28 Sep 2007", "detail": "28 Sep 2007"}, {"id": "fc011", "category": "Dates", "tag": "Effective dates", "front": "What happened on 25 Nov 2009?", "answer": "Central Bank of Malaysia Act 2009 became effective, replacing CBA 1958.", "detail": "Central Bank of Malaysia Act 2009 became effective, replacing CBA 1958."}, {"id": "fc012", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Central Bank of Malaysia Act 2009 became effective, replacing CBA 1958.", "answer": "25 Nov 2009", "detail": "25 Nov 2009"}, {"id": "fc013", "category": "Dates", "tag": "Effective dates", "front": "What happened on 31 Dec 2010?", "answer": "PIDM role expanded to administer TIPS for eligible takaful certificates and insurance policies.", "detail": "PIDM role expanded to administer TIPS for eligible takaful certificates and insurance policies."}, {"id": "fc014", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: PIDM role expanded to administer TIPS for eligible takaful certificates and insurance policies.", "answer": "31 Dec 2010", "detail": "31 Dec 2010"}, {"id": "fc015", "category": "Dates", "tag": "Effective dates", "front": "What happened on 30 Jun 2013?", "answer": "Financial Services Act 2013 and Islamic Financial Services Act 2013 became effective.", "detail": "Financial Services Act 2013 and Islamic Financial Services Act 2013 became effective."}, {"id": "fc016", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Financial Services Act 2013 and Islamic Financial Services Act 2013 became effective.", "answer": "30 Jun 2013", "detail": "30 Jun 2013"}, {"id": "fc017", "category": "Dates", "tag": "Effective dates", "front": "What happened on 7 Mar 2014?", "answer": "BNM Guidelines on Introduction of New Products were issued.", "detail": "BNM Guidelines on Introduction of New Products were issued."}, {"id": "fc018", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: BNM Guidelines on Introduction of New Products were issued.", "answer": "7 Mar 2014", "detail": "7 Mar 2014"}, {"id": "fc019", "category": "Dates", "tag": "Effective dates", "front": "What happened on 13 Apr 2017?", "answer": "BNM Code of Conduct for Malaysia Wholesale Financial Markets was issued.", "detail": "BNM Code of Conduct for Malaysia Wholesale Financial Markets was issued."}, {"id": "fc020", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: BNM Code of Conduct for Malaysia Wholesale Financial Markets was issued.", "answer": "13 Apr 2017", "detail": "13 Apr 2017"}, {"id": "fc021", "category": "Dates", "tag": "Effective dates", "front": "What happened on 2 May 2017?", "answer": "BNM Code of Conduct for Malaysia Wholesale Financial Markets came into effect.", "detail": "BNM Code of Conduct for Malaysia Wholesale Financial Markets came into effect."}, {"id": "fc022", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: BNM Code of Conduct for Malaysia Wholesale Financial Markets came into effect.", "answer": "2 May 2017", "detail": "2 May 2017"}, {"id": "fc023", "category": "Dates", "tag": "Effective dates", "front": "What happened on 2017?", "answer": "LEAP Market was launched by Bursa Malaysia.", "detail": "LEAP Market was launched by Bursa Malaysia."}, {"id": "fc024", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: LEAP Market was launched by Bursa Malaysia.", "answer": "2017", "detail": "2017"}, {"id": "fc025", "category": "Dates", "tag": "Effective dates", "front": "What happened on 13 Nov 2020?", "answer": "Online Moneylending Guidelines were issued by the Ministry of Housing and Local Government.", "detail": "Online Moneylending Guidelines were issued by the Ministry of Housing and Local Government."}, {"id": "fc026", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Online Moneylending Guidelines were issued by the Ministry of Housing and Local Government.", "answer": "13 Nov 2020", "detail": "13 Nov 2020"}, {"id": "fc027", "category": "Dates", "tag": "Effective dates", "front": "What happened on 31 Dec 2021?", "answer": "Current version of the BNM Code of Conduct for Malaysia Wholesale Financial Markets referenced for revision.", "detail": "Current version of the BNM Code of Conduct for Malaysia Wholesale Financial Markets referenced for revision."}, {"id": "fc028", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Current version of the BNM Code of Conduct for Malaysia Wholesale Financial Markets referenced for revision.", "answer": "31 Dec 2021", "detail": "31 Dec 2021"}, {"id": "fc029", "category": "Dates", "tag": "Effective dates", "front": "What happened on 5 Feb 2024?", "answer": "BNM AML/CFT/CPF and TFS for FIs policy document was issued.", "detail": "BNM AML/CFT/CPF and TFS for FIs policy document was issued."}, {"id": "fc030", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: BNM AML/CFT/CPF and TFS for FIs policy document was issued.", "answer": "5 Feb 2024", "detail": "5 Feb 2024"}, {"id": "fc031", "category": "Dates", "tag": "Effective dates", "front": "What happened on Jul 2024?", "answer": "PitchIN Secondary Trading Market became operational for limited secondary trading of companies that raised via ECF.", "detail": "PitchIN Secondary Trading Market became operational for limited secondary trading of companies that raised via ECF."}, {"id": "fc032", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: PitchIN Secondary Trading Market became operational for limited secondary trading of companies that raised via ECF.", "answer": "Jul 2024", "detail": "Jul 2024"}, {"id": "fc033", "category": "Dates", "tag": "Effective dates", "front": "What happened on 2 Dec 2024?", "answer": "BNM Product Transparency and Disclosure Guidelines were issued.", "detail": "BNM Product Transparency and Disclosure Guidelines were issued."}, {"id": "fc034", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: BNM Product Transparency and Disclosure Guidelines were issued.", "answer": "2 Dec 2024", "detail": "2 Dec 2024"}, {"id": "fc035", "category": "Dates", "tag": "Effective dates", "front": "What happened in 2025?", "answer": "IPPC 3rd Edition / Version 3.0 was published.", "detail": "IPPC 3rd Edition / Version 3.0 was published."}, {"id": "fc036", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: IPPC 3rd Edition / Version 3.0 was published.", "answer": "2025", "detail": "2025"}, {"id": "fc037", "category": "Dates", "tag": "Effective dates", "front": "What happened on 1 Nov 2025?", "answer": "Updated IPPC module specifications were issued.", "detail": "Updated IPPC module specifications were issued."}, {"id": "fc038", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Updated IPPC module specifications were issued.", "answer": "1 Nov 2025", "detail": "1 Nov 2025"}, {"id": "fc039", "category": "Dates", "tag": "Effective dates", "front": "What happened on 1 Mar 2026?", "answer": "Updated IPPC examinations become effective for this syllabus.", "detail": "Updated IPPC examinations become effective for this syllabus."}, {"id": "fc040", "category": "Dates", "tag": "Effective dates", "front": "When did this happen: Updated IPPC examinations become effective for this syllabus.", "answer": "1 Mar 2026", "detail": "1 Mar 2026"}, {"id": "fc041", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Central Bank of Malaysia Act 2009?", "answer": "Legal framework for BNM functions, monetary policy, currency management, payment-system oversight and supervision of financial institutions.", "detail": "Repealed CBA 1958; effective 25 Nov 2009."}, {"id": "fc042", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Legal framework for BNM functions, monetary policy, currency management, payment-system oversight and supervision of financial institutions.", "answer": "Central Bank of Malaysia Act 2009", "detail": "Repealed CBA 1958; effective 25 Nov 2009."}, {"id": "fc043", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Central Bank of Malaysia Act 2009?", "answer": "Repealed CBA 1958; effective 25 Nov 2009.", "detail": "Legal framework for BNM functions, monetary policy, currency management, payment-system oversight and supervision of financial institutions."}, {"id": "fc044", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Financial Services Act 2013 (FSA)?", "answer": "Regulates and supervises conventional financial institutions, payment systems, money market and foreign exchange market.", "detail": "Consolidates BAFIA 1989, Exchange Control Act 1953, Insurance Act 1996 and Payment Systems Act 2003. Schedule 7 covers prohibited business conduct; Schedule 11 covers permitted disclosures."}, {"id": "fc045", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Regulates and supervises conventional financial institutions, payment systems, money market and foreign exchange market.", "answer": "Financial Services Act 2013 (FSA)", "detail": "Consolidates BAFIA 1989, Exchange Control Act 1953, Insurance Act 1996 and Payment Systems Act 2003. Schedule 7 covers prohibited business conduct; Schedule 11 covers permitted disclosures."}, {"id": "fc046", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Financial Services Act 2013 (FSA)?", "answer": "Consolidates BAFIA 1989, Exchange Control Act 1953, Insurance Act 1996 and Payment Systems Act 2003. Schedule 7 covers prohibited business conduct; Schedule 11 covers permitted disclosures.", "detail": "Regulates and supervises conventional financial institutions, payment systems, money market and foreign exchange market."}, {"id": "fc047", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Islamic Financial Services Act 2013 (IFSA)?", "answer": "Regulates and supervises Islamic financial institutions, Islamic payment systems, Islamic money market and Islamic FX market; ensures Shariah compliance.", "detail": "Replaces Islamic Banking Act 1983 and Takaful Act 1984."}, {"id": "fc048", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Regulates and supervises Islamic financial institutions, Islamic payment systems, Islamic money market and Islamic FX market; ensures Shariah compliance.", "answer": "Islamic Financial Services Act 2013 (IFSA)", "detail": "Replaces Islamic Banking Act 1983 and Takaful Act 1984."}, {"id": "fc049", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Islamic Financial Services Act 2013 (IFSA)?", "answer": "Replaces Islamic Banking Act 1983 and Takaful Act 1984.", "detail": "Regulates and supervises Islamic financial institutions, Islamic payment systems, Islamic money market and Islamic FX market; ensures Shariah compliance."}, {"id": "fc050", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Securities Commission Act 1993?", "answer": "Establishes the SC and its regulatory/development role over securities and futures markets.", "detail": "Part IV on fundraising was consolidated into CMSA 2007."}, {"id": "fc051", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Establishes the SC and its regulatory/development role over securities and futures markets.", "answer": "Securities Commission Act 1993", "detail": "Part IV on fundraising was consolidated into CMSA 2007."}, {"id": "fc052", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Securities Commission Act 1993?", "answer": "Part IV on fundraising was consolidated into CMSA 2007.", "detail": "Establishes the SC and its regulatory/development role over securities and futures markets."}, {"id": "fc053", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Capital Markets and Services Act 2007 (CMSA)?", "answer": "Main capital-market legislation for investor protection, market integrity, systemic stability, licensing and capital-market offences.", "detail": "Consolidates Securities Industry Act 1983, Futures Industry Act 1993 and Part IV of the Securities Commission Act 1993. Schedule 2 lists regulated activities."}, {"id": "fc054", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Main capital-market legislation for investor protection, market integrity, systemic stability, licensing and capital-market offences.", "answer": "Capital Markets and Services Act 2007 (CMSA)", "detail": "Consolidates Securities Industry Act 1983, Futures Industry Act 1993 and Part IV of the Securities Commission Act 1993. Schedule 2 lists regulated activities."}, {"id": "fc055", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Capital Markets and Services Act 2007 (CMSA)?", "answer": "Consolidates Securities Industry Act 1983, Futures Industry Act 1993 and Part IV of the Securities Commission Act 1993. Schedule 2 lists regulated activities.", "detail": "Main capital-market legislation for investor protection, market integrity, systemic stability, licensing and capital-market offences."}, {"id": "fc056", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Capital Markets and Services Regulations 2007?", "answer": "Introduced with CMSA to support the new capital-market regulatory framework.", "detail": "Linked to Guidelines on Regulation of Markets and SC Licensing Handbooks."}, {"id": "fc057", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Introduced with CMSA to support the new capital-market regulatory framework.", "answer": "Capital Markets and Services Regulations 2007", "detail": "Linked to Guidelines on Regulation of Markets and SC Licensing Handbooks."}, {"id": "fc058", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Capital Markets and Services Regulations 2007?", "answer": "Linked to Guidelines on Regulation of Markets and SC Licensing Handbooks.", "detail": "Introduced with CMSA to support the new capital-market regulatory framework."}, {"id": "fc059", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Guidelines on Investor Protection?", "answer": "Joint BNM/SC guidelines for RPs/ERPs carrying out permitted capital-market activities; covers fit and proper and investor protection.", "detail": "Revoked Guidelines for Exempt Dealers on Pass-Through Activities. CMSA S.76 links to S.91, S.92, S.93 and S.97."}, {"id": "fc060", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Joint BNM/SC guidelines for RPs/ERPs carrying out permitted capital-market activities; covers fit and proper and investor protection.", "answer": "Guidelines on Investor Protection", "detail": "Revoked Guidelines for Exempt Dealers on Pass-Through Activities. CMSA S.76 links to S.91, S.92, S.93 and S.97."}, {"id": "fc061", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Guidelines on Investor Protection?", "answer": "Revoked Guidelines for Exempt Dealers on Pass-Through Activities. CMSA S.76 links to S.91, S.92, S.93 and S.97.", "detail": "Joint BNM/SC guidelines for RPs/ERPs carrying out permitted capital-market activities; covers fit and proper and investor protection."}, {"id": "fc062", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Guidelines on Product Transparency and Disclosure?", "answer": "BNM disclosure expectations for FSPs: clear, timely and relevant product information plus customer suitability practices.", "detail": "PDS disclosure framework."}, {"id": "fc063", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: BNM disclosure expectations for FSPs: clear, timely and relevant product information plus customer suitability practices.", "answer": "Guidelines on Product Transparency and Disclosure", "detail": "PDS disclosure framework."}, {"id": "fc064", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Guidelines on Product Transparency and Disclosure?", "answer": "PDS disclosure framework.", "detail": "BNM disclosure expectations for FSPs: clear, timely and relevant product information plus customer suitability practices."}, {"id": "fc065", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Guidelines on Product Highlights Sheet?", "answer": "SC document for relevant unlisted capital-market products covering salient features, risks, fees, valuation/exit costs, contacts, responsibility statement and disclaimer.", "detail": "PHS requirement depends on product type and investor category."}, {"id": "fc066", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: SC document for relevant unlisted capital-market products covering salient features, risks, fees, valuation/exit costs, contacts, responsibility statement and disclaimer.", "answer": "Guidelines on Product Highlights Sheet", "detail": "PHS requirement depends on product type and investor category."}, {"id": "fc067", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Guidelines on Product Highlights Sheet?", "answer": "PHS requirement depends on product type and investor category.", "detail": "SC document for relevant unlisted capital-market products covering salient features, risks, fees, valuation/exit costs, contacts, responsibility statement and disclaimer."}, {"id": "fc068", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Guidelines on Unlisted Capital Market Products under the Lodge and Launch Framework?", "answer": "Framework for lodging and launching unlisted capital-market products without prior SC authorisation where requirements are met.", "detail": "Supersedes earlier wholesale funds, structured products, Private Debt Securities, sukuk and asset-backed securities guidelines."}, {"id": "fc069", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Framework for lodging and launching unlisted capital-market products without prior SC authorisation where requirements are met.", "answer": "Guidelines on Unlisted Capital Market Products under the Lodge and Launch Framework", "detail": "Supersedes earlier wholesale funds, structured products, Private Debt Securities, sukuk and asset-backed securities guidelines."}, {"id": "fc070", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Guidelines on Unlisted Capital Market Products under the Lodge and Launch Framework?", "answer": "Supersedes earlier wholesale funds, structured products, Private Debt Securities, sukuk and asset-backed securities guidelines.", "detail": "Framework for lodging and launching unlisted capital-market products without prior SC authorisation where requirements are met."}, {"id": "fc071", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Guidelines on Seasoned Corporate Bonds and Sukuk?", "answer": "Rules for making seasoned corporate bonds/sukuk available to retail investors.", "detail": "Requires 12-month seasoning period and eligible issuer/features."}, {"id": "fc072", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Rules for making seasoned corporate bonds/sukuk available to retail investors.", "answer": "Guidelines on Seasoned Corporate Bonds and Sukuk", "detail": "Requires 12-month seasoning period and eligible issuer/features."}, {"id": "fc073", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Guidelines on Seasoned Corporate Bonds and Sukuk?", "answer": "Requires 12-month seasoning period and eligible issuer/features.", "detail": "Rules for making seasoned corporate bonds/sukuk available to retail investors."}, {"id": "fc074", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Guidelines on Issuance of Corporate Bonds and Sukuk to Retail Investors?", "answer": "Rules for issuing eligible corporate bonds or sukuk directly to retail investors.", "detail": "Eligible issuers and product features broadly align with seasoned corporate bonds/sukuk; sukuk require Shariah adviser requirements."}, {"id": "fc075", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Rules for issuing eligible corporate bonds or sukuk directly to retail investors.", "answer": "Guidelines on Issuance of Corporate Bonds and Sukuk to Retail Investors", "detail": "Eligible issuers and product features broadly align with seasoned corporate bonds/sukuk; sukuk require Shariah adviser requirements."}, {"id": "fc076", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Guidelines on Issuance of Corporate Bonds and Sukuk to Retail Investors?", "answer": "Eligible issuers and product features broadly align with seasoned corporate bonds/sukuk; sukuk require Shariah adviser requirements.", "detail": "Rules for issuing eligible corporate bonds or sukuk directly to retail investors."}, {"id": "fc077", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Guidelines on Categories of Sophisticated Investors?", "answer": "Defines accredited investors, high-net-worth entities and high-net-worth individuals.", "detail": "Important for permitted activities, PHS requirements and product-distribution rules."}, {"id": "fc078", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Defines accredited investors, high-net-worth entities and high-net-worth individuals.", "answer": "Guidelines on Categories of Sophisticated Investors", "detail": "Important for permitted activities, PHS requirements and product-distribution rules."}, {"id": "fc079", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Guidelines on Categories of Sophisticated Investors?", "answer": "Important for permitted activities, PHS requirements and product-distribution rules.", "detail": "Defines accredited investors, high-net-worth entities and high-net-worth individuals."}, {"id": "fc080", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Malaysia Deposit Insurance Corporation Act 2011?", "answer": "PIDM statutory framework for deposit insurance, TIPS and financial-system stability.", "detail": "Deposit protection is RM250,000 per depositor per member bank; TIPS protection for eligible takaful certificates and insurance policies is RM500,000."}, {"id": "fc081", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: PIDM statutory framework for deposit insurance, TIPS and financial-system stability.", "answer": "Malaysia Deposit Insurance Corporation Act 2011", "detail": "Deposit protection is RM250,000 per depositor per member bank; TIPS protection for eligible takaful certificates and insurance policies is RM500,000."}, {"id": "fc082", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Malaysia Deposit Insurance Corporation Act 2011?", "answer": "Deposit protection is RM250,000 per depositor per member bank; TIPS protection for eligible takaful certificates and insurance policies is RM500,000.", "detail": "PIDM statutory framework for deposit insurance, TIPS and financial-system stability."}, {"id": "fc083", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is AMLA 2001?", "answer": "Anti-money laundering, anti-terrorism financing and proceeds of unlawful activities; imposes reporting institution duties.", "detail": "Key provisions include S.4, S.13-S.17, S.19 and AML reporting obligations."}, {"id": "fc084", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Anti-money laundering, anti-terrorism financing and proceeds of unlawful activities; imposes reporting institution duties.", "answer": "AMLA 2001", "detail": "Key provisions include S.4, S.13-S.17, S.19 and AML reporting obligations."}, {"id": "fc085", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for AMLA 2001?", "answer": "Key provisions include S.4, S.13-S.17, S.19 and AML reporting obligations.", "detail": "Anti-money laundering, anti-terrorism financing and proceeds of unlawful activities; imposes reporting institution duties."}, {"id": "fc086", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is BNM AML/CFT/CPF and TFS for FIs Policy Document?", "answer": "Risk-based approach, customer due diligence, counter proliferation financing and targeted financial sanctions for financial institutions.", "detail": "AML/CFT/CPF and TFS policy document for financial institutions."}, {"id": "fc087", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Risk-based approach, customer due diligence, counter proliferation financing and targeted financial sanctions for financial institutions.", "answer": "BNM AML/CFT/CPF and TFS for FIs Policy Document", "detail": "AML/CFT/CPF and TFS policy document for financial institutions."}, {"id": "fc088", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked note for BNM AML/CFT/CPF and TFS for FIs Policy Document?", "answer": "AML/CFT/CPF and TFS policy document for financial institutions.", "detail": "Risk-based approach, customer due diligence, counter proliferation financing and targeted financial sanctions for financial institutions."}, {"id": "fc089", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is SC AML/CFT/CPF Guidelines?", "answer": "AML/CFT/CPF and TFS obligations for reporting institutions in the capital market.", "detail": "AML/CFT/CPF and TFS obligations for capital-market reporting institutions."}, {"id": "fc090", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: AML/CFT/CPF and TFS obligations for reporting institutions in the capital market.", "answer": "SC AML/CFT/CPF Guidelines", "detail": "AML/CFT/CPF and TFS obligations for capital-market reporting institutions."}, {"id": "fc091", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked note for SC AML/CFT/CPF Guidelines?", "answer": "AML/CFT/CPF and TFS obligations for capital-market reporting institutions.", "detail": "AML/CFT/CPF and TFS obligations for reporting institutions in the capital market."}, {"id": "fc092", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Labuan Financial Services Authority Act 1996?", "answer": "Establishes Labuan FSA as the central regulatory, supervisory and enforcement authority for Labuan IBFC.", "detail": "Labuan FSA was established on 15 Feb 1996."}, {"id": "fc093", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Establishes Labuan FSA as the central regulatory, supervisory and enforcement authority for Labuan IBFC.", "answer": "Labuan Financial Services Authority Act 1996", "detail": "Labuan FSA was established on 15 Feb 1996."}, {"id": "fc094", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Labuan Financial Services Authority Act 1996?", "answer": "Labuan FSA was established on 15 Feb 1996.", "detail": "Establishes Labuan FSA as the central regulatory, supervisory and enforcement authority for Labuan IBFC."}, {"id": "fc095", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Development Financial Institutions Act 2002?", "answer": "Provides for prescribed development financial institutions under BNM purview.", "detail": "Relevant to financial institutions and DFIs."}, {"id": "fc096", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Provides for prescribed development financial institutions under BNM purview.", "answer": "Development Financial Institutions Act 2002", "detail": "Relevant to financial institutions and DFIs."}, {"id": "fc097", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Development Financial Institutions Act 2002?", "answer": "Relevant to financial institutions and DFIs.", "detail": "Provides for prescribed development financial institutions under BNM purview."}, {"id": "fc098", "category": "Acts & Guidelines", "tag": "What it does", "front": "What is Electronic Commerce Act 2006 / Digital Signatures Act 1997?", "answer": "Referenced for online moneylending documentation and digital/electronic signing context.", "detail": "Linked to Ministry of Housing and Local Government Online Moneylending Guidelines."}, {"id": "fc099", "category": "Acts & Guidelines", "tag": "Reverse recall", "front": "Which Act or guideline matches this role: Referenced for online moneylending documentation and digital/electronic signing context.", "answer": "Electronic Commerce Act 2006 / Digital Signatures Act 1997", "detail": "Linked to Ministry of Housing and Local Government Online Moneylending Guidelines."}, {"id": "fc100", "category": "Acts & Guidelines", "tag": "Linked schedule / replacement", "front": "What is the key linked schedule, replacement or exam note for Electronic Commerce Act 2006 / Digital Signatures Act 1997?", "answer": "Linked to Ministry of Housing and Local Government Online Moneylending Guidelines.", "detail": "Referenced for online moneylending documentation and digital/electronic signing context."}, {"id": "fc101", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is FSA S.133 / IFSA S.145?", "answer": "Secrecy and confidentiality of customer information.", "detail": "Duty continues after employment; unauthorised disclosure is an offence."}, {"id": "fc102", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Secrecy and confidentiality of customer information.", "answer": "FSA S.133 / IFSA S.145", "detail": "Duty continues after employment; unauthorised disclosure is an offence."}, {"id": "fc103", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is FSA S.133 / IFSA S.145 commonly tested?", "answer": "Duty continues after employment; unauthorised disclosure is an offence.", "detail": "Secrecy and confidentiality of customer information."}, {"id": "fc104", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is FSA S.134 + Schedule 11?", "answer": "Permitted disclosures of customer information.", "detail": "Examples include written consent, BNM/regulator request, court/legal requirement, bankruptcy/winding up, criminal/civil proceedings, tax/credit reporting and other specified cases."}, {"id": "fc105", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Permitted disclosures of customer information.", "answer": "FSA S.134 + Schedule 11", "detail": "Examples include written consent, BNM/regulator request, court/legal requirement, bankruptcy/winding up, criminal/civil proceedings, tax/credit reporting and other specified cases."}, {"id": "fc106", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is FSA S.134 + Schedule 11 commonly tested?", "answer": "Examples include written consent, BNM/regulator request, court/legal requirement, bankruptcy/winding up, criminal/civil proceedings, tax/credit reporting and other specified cases.", "detail": "Permitted disclosures of customer information."}, {"id": "fc107", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is FSA Schedule 7?", "answer": "Prohibited business conduct.", "detail": "Use for BNM/FSA questions on unfair, misleading or improper conduct by financial institutions."}, {"id": "fc108", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Prohibited business conduct.", "answer": "FSA Schedule 7", "detail": "Use for BNM/FSA questions on unfair, misleading or improper conduct by financial institutions."}, {"id": "fc109", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is FSA Schedule 7 commonly tested?", "answer": "Use for BNM/FSA questions on unfair, misleading or improper conduct by financial institutions.", "detail": "Prohibited business conduct."}, {"id": "fc110", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA Schedule 2?", "answer": "Regulated activities.", "detail": "Includes dealing in securities, dealing in derivatives, fund management, investment advice, financial planning, advising on corporate finance, dealing in PRS and clearing."}, {"id": "fc111", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Regulated activities.", "answer": "CMSA Schedule 2", "detail": "Includes dealing in securities, dealing in derivatives, fund management, investment advice, financial planning, advising on corporate finance, dealing in PRS and clearing."}, {"id": "fc112", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA Schedule 2 commonly tested?", "answer": "Includes dealing in securities, dealing in derivatives, fund management, investment advice, financial planning, advising on corporate finance, dealing in PRS and clearing.", "detail": "Regulated activities."}, {"id": "fc113", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.76?", "answer": "Registered persons and permitted capital-market activities.", "detail": "RPs/ERPs must comply with investor protection provisions including S.91, S.92, S.93 and S.97."}, {"id": "fc114", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Registered persons and permitted capital-market activities.", "answer": "CMSA S.76", "detail": "RPs/ERPs must comply with investor protection provisions including S.91, S.92, S.93 and S.97."}, {"id": "fc115", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.76 commonly tested?", "answer": "RPs/ERPs must comply with investor protection provisions including S.91, S.92, S.93 and S.97.", "detail": "Registered persons and permitted capital-market activities."}, {"id": "fc116", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.91?", "answer": "Investor protection provisions referenced by Guidelines on Investor Protection.", "detail": "Know it as part of the RP/ERP investor-protection framework."}, {"id": "fc117", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Investor protection provisions referenced by Guidelines on Investor Protection.", "answer": "CMSA S.91", "detail": "Know it as part of the RP/ERP investor-protection framework."}, {"id": "fc118", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.91 commonly tested?", "answer": "Know it as part of the RP/ERP investor-protection framework.", "detail": "Investor protection provisions referenced by Guidelines on Investor Protection."}, {"id": "fc119", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.92?", "answer": "Reasonable basis for recommendations.", "detail": "Requires KYC information, product investigation and a recommendation suitable for the client."}, {"id": "fc120", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Reasonable basis for recommendations.", "answer": "CMSA S.92", "detail": "Requires KYC information, product investigation and a recommendation suitable for the client."}, {"id": "fc121", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.92 commonly tested?", "answer": "Requires KYC information, product investigation and a recommendation suitable for the client.", "detail": "Reasonable basis for recommendations."}, {"id": "fc122", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.92A?", "answer": "False or misleading information or material omission to investors.", "detail": "High-risk mis-selling/misrepresentation provision."}, {"id": "fc123", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: False or misleading information or material omission to investors.", "answer": "CMSA S.92A", "detail": "High-risk mis-selling/misrepresentation provision."}, {"id": "fc124", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.92A commonly tested?", "answer": "High-risk mis-selling/misrepresentation provision.", "detail": "False or misleading information or material omission to investors."}, {"id": "fc125", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.93?", "answer": "Priority to client orders.", "detail": "Front-running or client-priority type MCQs."}, {"id": "fc126", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Priority to client orders.", "answer": "CMSA S.93", "detail": "Front-running or client-priority type MCQs."}, {"id": "fc127", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.93 commonly tested?", "answer": "Front-running or client-priority type MCQs.", "detail": "Priority to client orders."}, {"id": "fc128", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.97?", "answer": "Dealings as principal.", "detail": "Must disclose acting as principal and state it in the contract note."}, {"id": "fc129", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Dealings as principal.", "answer": "CMSA S.97", "detail": "Must disclose acting as principal and state it in the contract note."}, {"id": "fc130", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.97 commonly tested?", "answer": "Must disclose acting as principal and state it in the contract note.", "detail": "Dealings as principal."}, {"id": "fc131", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.178?", "answer": "Fraudulently inducing persons to deal in securities.", "detail": "Covers false guaranteed-return statements and misleading forecasts."}, {"id": "fc132", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Fraudulently inducing persons to deal in securities.", "answer": "CMSA S.178", "detail": "Covers false guaranteed-return statements and misleading forecasts."}, {"id": "fc133", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.178 commonly tested?", "answer": "Covers false guaranteed-return statements and misleading forecasts.", "detail": "Fraudulently inducing persons to deal in securities."}, {"id": "fc134", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.179?", "answer": "Manipulative and deceptive devices.", "detail": "Covers fraud, deceit, untrue statements and material omissions."}, {"id": "fc135", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Manipulative and deceptive devices.", "answer": "CMSA S.179", "detail": "Covers fraud, deceit, untrue statements and material omissions."}, {"id": "fc136", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.179 commonly tested?", "answer": "Covers fraud, deceit, untrue statements and material omissions.", "detail": "Manipulative and deceptive devices."}, {"id": "fc137", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.232?", "answer": "Prospectus registration requirement.", "detail": "No public issue, offer or invitation for securities without a registered prospectus unless exempt or authorised."}, {"id": "fc138", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Prospectus registration requirement.", "answer": "CMSA S.232", "detail": "No public issue, offer or invitation for securities without a registered prospectus unless exempt or authorised."}, {"id": "fc139", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.232 commonly tested?", "answer": "No public issue, offer or invitation for securities without a registered prospectus unless exempt or authorised.", "detail": "Prospectus registration requirement."}, {"id": "fc140", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is CMSA S.362(3)?", "answer": "Prohibition on use of certain titles by unlicensed persons.", "detail": "Only CMSL/CMSRL holders can use titles implying they perform regulated activities in Schedule 2."}, {"id": "fc141", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Prohibition on use of certain titles by unlicensed persons.", "answer": "CMSA S.362(3)", "detail": "Only CMSL/CMSRL holders can use titles implying they perform regulated activities in Schedule 2."}, {"id": "fc142", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is CMSA S.362(3) commonly tested?", "answer": "Only CMSL/CMSRL holders can use titles implying they perform regulated activities in Schedule 2.", "detail": "Prohibition on use of certain titles by unlicensed persons."}, {"id": "fc143", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is AMLA S.4?", "answer": "Offence of money laundering.", "detail": "Money or property from unlawful activity is given a legitimate appearance."}, {"id": "fc144", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Offence of money laundering.", "answer": "AMLA S.4", "detail": "Money or property from unlawful activity is given a legitimate appearance."}, {"id": "fc145", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is AMLA S.4 commonly tested?", "answer": "Money or property from unlawful activity is given a legitimate appearance.", "detail": "Offence of money laundering."}, {"id": "fc146", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is AMLA S.13?", "answer": "Transaction record keeping by reporting institutions.", "detail": "Record prescribed details for transactions exceeding specified amount."}, {"id": "fc147", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Transaction record keeping by reporting institutions.", "answer": "AMLA S.13", "detail": "Record prescribed details for transactions exceeding specified amount."}, {"id": "fc148", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is AMLA S.13 commonly tested?", "answer": "Record prescribed details for transactions exceeding specified amount.", "detail": "Transaction record keeping by reporting institutions."}, {"id": "fc149", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is AMLA S.14?", "answer": "Reporting by reporting institutions.", "detail": "Covers threshold reporting and suspicious transaction reporting; STR is suspicion-based."}, {"id": "fc150", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Reporting by reporting institutions.", "answer": "AMLA S.14", "detail": "Covers threshold reporting and suspicious transaction reporting; STR is suspicion-based."}, {"id": "fc151", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is AMLA S.14 commonly tested?", "answer": "Covers threshold reporting and suspicious transaction reporting; STR is suspicion-based.", "detail": "Reporting by reporting institutions."}, {"id": "fc152", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is AMLA S.16?", "answer": "Identification of account holder.", "detail": "No anonymous, fictitious or false-name account; identity must be verified."}, {"id": "fc153", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Identification of account holder.", "answer": "AMLA S.16", "detail": "No anonymous, fictitious or false-name account; identity must be verified."}, {"id": "fc154", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is AMLA S.16 commonly tested?", "answer": "No anonymous, fictitious or false-name account; identity must be verified.", "detail": "Identification of account holder."}, {"id": "fc155", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is AMLA S.17?", "answer": "Retention of records.", "detail": "Six-year retention from account closure, transaction completion or termination."}, {"id": "fc156", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Retention of records.", "answer": "AMLA S.17", "detail": "Six-year retention from account closure, transaction completion or termination."}, {"id": "fc157", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is AMLA S.17 commonly tested?", "answer": "Six-year retention from account closure, transaction completion or termination.", "detail": "Retention of records."}, {"id": "fc158", "category": "Schedules & Sections", "tag": "Direct section recall", "front": "What is AMLA S.19?", "answer": "Compliance programme.", "detail": "Internal policies, procedures, controls, training and independent audit."}, {"id": "fc159", "category": "Schedules & Sections", "tag": "Reverse section recall", "front": "Which section or schedule covers: Compliance programme.", "answer": "AMLA S.19", "detail": "Internal policies, procedures, controls, training and independent audit."}, {"id": "fc160", "category": "Schedules & Sections", "tag": "Exam use", "front": "How is AMLA S.19 commonly tested?", "answer": "Internal policies, procedures, controls, training and independent audit.", "detail": "Compliance programme."}, {"id": "fc161", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for FSA S.8 / authorised business?", "answer": "Imprisonment up to 10 years, fine up to RM50 million, or both.", "detail": "Carrying on authorised business without being licensed or approved."}, {"id": "fc162", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Carrying on authorised business without being licensed or approved.", "answer": "FSA S.8 / authorised business", "detail": "Imprisonment up to 10 years, fine up to RM50 million, or both."}, {"id": "fc163", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Imprisonment up to 10 years, fine up to RM50 million, or both.", "answer": "Carrying on authorised business without being licensed or approved.", "detail": "FSA S.8 / authorised business"}, {"id": "fc164", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for FSA S.133 / IFSA S.145?", "answer": "Imprisonment up to 5 years, fine up to RM10 million, or both.", "detail": "Breach of secrecy or unauthorised customer-information disclosure."}, {"id": "fc165", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Breach of secrecy or unauthorised customer-information disclosure.", "answer": "FSA S.133 / IFSA S.145", "detail": "Imprisonment up to 5 years, fine up to RM10 million, or both."}, {"id": "fc166", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Imprisonment up to 5 years, fine up to RM10 million, or both.", "answer": "Breach of secrecy or unauthorised customer-information disclosure.", "detail": "FSA S.133 / IFSA S.145"}, {"id": "fc167", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for CMSA S.92?", "answer": "Offence under S.92(3); investor may claim damages for loss caused by reliance on the recommendation.", "detail": "Recommendation without reasonable basis."}, {"id": "fc168", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Recommendation without reasonable basis.", "answer": "CMSA S.92", "detail": "Offence under S.92(3); investor may claim damages for loss caused by reliance on the recommendation."}, {"id": "fc169", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Offence under S.92(3); investor may claim damages for loss caused by reliance on the recommendation.", "answer": "Recommendation without reasonable basis.", "detail": "CMSA S.92"}, {"id": "fc170", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for CMSA S.92A?", "answer": "Fine up to RM3 million, imprisonment up to 10 years, or both.", "detail": "False or misleading information, false statement or wilful material omission to an investor in a capital-market product."}, {"id": "fc171", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: False or misleading information, false statement or wilful material omission to an investor in a capital-market product.", "answer": "CMSA S.92A", "detail": "Fine up to RM3 million, imprisonment up to 10 years, or both."}, {"id": "fc172", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Fine up to RM3 million, imprisonment up to 10 years, or both.", "answer": "False or misleading information, false statement or wilful material omission to an investor in a capital-market product.", "detail": "CMSA S.92A"}, {"id": "fc173", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for CMSA S.93?", "answer": "Fine up to RM1 million, imprisonment up to 5 years, or both.", "detail": "Failure to give priority to client orders."}, {"id": "fc174", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Failure to give priority to client orders.", "answer": "CMSA S.93", "detail": "Fine up to RM1 million, imprisonment up to 5 years, or both."}, {"id": "fc175", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Fine up to RM1 million, imprisonment up to 5 years, or both.", "answer": "Failure to give priority to client orders.", "detail": "CMSA S.93"}, {"id": "fc176", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for CMSA S.97?", "answer": "Purchaser/vendor may rescind within 14 days; fine up to RM1 million, imprisonment up to 10 years, or both.", "detail": "Failure to disclose dealing as principal or failure to state principal capacity in contract note."}, {"id": "fc177", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Failure to disclose dealing as principal or failure to state principal capacity in contract note.", "answer": "CMSA S.97", "detail": "Purchaser/vendor may rescind within 14 days; fine up to RM1 million, imprisonment up to 10 years, or both."}, {"id": "fc178", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Purchaser/vendor may rescind within 14 days; fine up to RM1 million, imprisonment up to 10 years, or both.", "answer": "Failure to disclose dealing as principal or failure to state principal capacity in contract note.", "detail": "CMSA S.97"}, {"id": "fc179", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for CMSA S.178?", "answer": "Fine not less than RM1 million and imprisonment up to 10 years.", "detail": "Fraudulently inducing persons to deal in securities."}, {"id": "fc180", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Fraudulently inducing persons to deal in securities.", "answer": "CMSA S.178", "detail": "Fine not less than RM1 million and imprisonment up to 10 years."}, {"id": "fc181", "category": "Penalties", "tag": "Reverse penalty", "front": "Under CMSA S.178, which breach leads to this consequence: fine not less than RM1 million and imprisonment up to 10 years?", "answer": "Fraudulently inducing persons to deal in securities.", "detail": "CMSA S.178"}, {"id": "fc182", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for CMSA S.179?", "answer": "Fine not less than RM1 million and imprisonment up to 10 years.", "detail": "Manipulative/deceptive devices, fraud/deceit, untrue statement or material omission."}, {"id": "fc183", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Manipulative/deceptive devices, fraud/deceit, untrue statement or material omission.", "answer": "CMSA S.179", "detail": "Fine not less than RM1 million and imprisonment up to 10 years."}, {"id": "fc184", "category": "Penalties", "tag": "Reverse penalty", "front": "Under CMSA S.179, which breach leads to this consequence: fine not less than RM1 million and imprisonment up to 10 years?", "answer": "Manipulative/deceptive devices, fraud/deceit, untrue statement or material omission.", "detail": "CMSA S.179"}, {"id": "fc185", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for CMSA S.232?", "answer": "Fine up to RM10 million, imprisonment up to 10 years, or both.", "detail": "Public issue, offer, invitation or application for securities without registered prospectus unless exempt/authorised."}, {"id": "fc186", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Public issue, offer, invitation or application for securities without registered prospectus unless exempt/authorised.", "answer": "CMSA S.232", "detail": "Fine up to RM10 million, imprisonment up to 10 years, or both."}, {"id": "fc187", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Fine up to RM10 million, imprisonment up to 10 years, or both.", "answer": "Public issue, offer, invitation or application for securities without registered prospectus unless exempt/authorised.", "detail": "CMSA S.232"}, {"id": "fc188", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for AMLA S.4(1)?", "answer": "Money-laundering offence; verify current AMLA if using outside the exam context.", "detail": "Money laundering, attempt or abetment."}, {"id": "fc189", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Money laundering, attempt or abetment.", "answer": "AMLA S.4(1)", "detail": "Money-laundering offence; verify current AMLA if using outside the exam context."}, {"id": "fc190", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Money-laundering offence; verify current AMLA if using outside the exam context.", "answer": "Money laundering, attempt or abetment.", "detail": "AMLA S.4(1)"}, {"id": "fc191", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for AMLA S.13?", "answer": "Fine not exceeding RM1 million under S.86.", "detail": "Failure to keep required transaction records."}, {"id": "fc192", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Failure to keep required transaction records.", "answer": "AMLA S.13", "detail": "Fine not exceeding RM1 million under S.86."}, {"id": "fc193", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Fine not exceeding RM1 million under S.86.", "answer": "Failure to keep required transaction records.", "detail": "AMLA S.13"}, {"id": "fc194", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for AMLA S.16?", "answer": "Maximum fine of RM1 million under S.86.", "detail": "Anonymous, fictitious, false or incorrect-name account; failure to verify identity."}, {"id": "fc195", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Anonymous, fictitious, false or incorrect-name account; failure to verify identity.", "answer": "AMLA S.16", "detail": "Maximum fine of RM1 million under S.86."}, {"id": "fc196", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Maximum fine of RM1 million under S.86.", "answer": "Anonymous, fictitious, false or incorrect-name account; failure to verify identity.", "detail": "AMLA S.16"}, {"id": "fc197", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for AMLA S.17?", "answer": "Maximum fine of RM3 million, imprisonment up to 5 years, or both.", "detail": "Failure to retain records for the required six-year period."}, {"id": "fc198", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Failure to retain records for the required six-year period.", "answer": "AMLA S.17", "detail": "Maximum fine of RM3 million, imprisonment up to 5 years, or both."}, {"id": "fc199", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Maximum fine of RM3 million, imprisonment up to 5 years, or both.", "answer": "Failure to retain records for the required six-year period.", "detail": "AMLA S.17"}, {"id": "fc200", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for AMLA S.13-S.17?", "answer": "Where S.22 applies: fine up to RM1 million, imprisonment up to 3 years, or both.", "detail": "Reporting, record-keeping and account-holder identification obligations."}, {"id": "fc201", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Reporting, record-keeping and account-holder identification obligations.", "answer": "AMLA S.13-S.17", "detail": "Where S.22 applies: fine up to RM1 million, imprisonment up to 3 years, or both."}, {"id": "fc202", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Where S.22 applies: fine up to RM1 million, imprisonment up to 3 years, or both.", "answer": "Reporting, record-keeping and account-holder identification obligations.", "detail": "AMLA S.13-S.17"}, {"id": "fc203", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for AMLA S.19?", "answer": "RI must adopt internal programmes, policies, procedures and controls, including training, independent audit and compliance officer oversight.", "detail": "Compliance programme duties for reporting institutions."}, {"id": "fc204", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Compliance programme duties for reporting institutions.", "answer": "AMLA S.19", "detail": "RI must adopt internal programmes, policies, procedures and controls, including training, independent audit and compliance officer oversight."}, {"id": "fc205", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: RI must adopt internal programmes, policies, procedures and controls, including training, independent audit and compliance officer oversight.", "answer": "Compliance programme duties for reporting institutions.", "detail": "AMLA S.19"}, {"id": "fc206", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for Wholesale Financial Markets Code?", "answer": "FI must notify BNM and FMAM in writing within one week of initiating or concluding an inquiry; internal actions may include suspension or restriction.", "detail": "Dealer or broker non-compliance inquiry."}, {"id": "fc207", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Dealer or broker non-compliance inquiry.", "answer": "Wholesale Financial Markets Code", "detail": "FI must notify BNM and FMAM in writing within one week of initiating or concluding an inquiry; internal actions may include suspension or restriction."}, {"id": "fc208", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: FI must notify BNM and FMAM in writing within one week of initiating or concluding an inquiry; internal actions may include suspension or restriction.", "answer": "Dealer or broker non-compliance inquiry.", "detail": "Wholesale Financial Markets Code"}, {"id": "fc209", "category": "Penalties", "tag": "Penalty recall", "front": "What is the penalty / consequence for Investor Protection register?", "answer": "Full particulars of change, date and reasons must be entered within 14 days.", "detail": "Change to RP/ERP register details."}, {"id": "fc210", "category": "Penalties", "tag": "Breach recall", "front": "Which provision or area is linked to this breach: Change to RP/ERP register details.", "answer": "Investor Protection register", "detail": "Full particulars of change, date and reasons must be entered within 14 days."}, {"id": "fc211", "category": "Penalties", "tag": "Reverse penalty", "front": "Which breach leads to this consequence: Full particulars of change, date and reasons must be entered within 14 days.", "answer": "Change to RP/ERP register details.", "detail": "Investor Protection register"}, {"id": "fc212", "category": "Rules & Thresholds", "tag": "Exam format", "front": "What should you remember about Exam format?", "answer": "2 hours, 80 MCQs, pass mark 70 and above.", "detail": "2 hours, 80 MCQs, pass mark 70 and above."}, {"id": "fc213", "category": "Rules & Thresholds", "tag": "Exam format", "front": "Which rule or threshold is described: 2 hours, 80 MCQs, pass mark 70 and above.", "answer": "Exam format", "detail": "Exam format"}, {"id": "fc214", "category": "Rules & Thresholds", "tag": "Official CLO weighting", "front": "What should you remember about Official CLO weighting?", "answer": "CLO1 15%, CLO2 45%, CLO3 40%.", "detail": "CLO1 15%, CLO2 45%, CLO3 40%."}, {"id": "fc215", "category": "Rules & Thresholds", "tag": "Official CLO weighting", "front": "Which rule or threshold is described: CLO1 15%, CLO2 45%, CLO3 40%.", "answer": "Official CLO weighting", "detail": "Official CLO weighting"}, {"id": "fc216", "category": "Rules & Thresholds", "tag": "PIDM deposit protection", "front": "What should you remember about PIDM deposit protection?", "answer": "RM250,000 per depositor per member bank.", "detail": "RM250,000 per depositor per member bank."}, {"id": "fc217", "category": "Rules & Thresholds", "tag": "PIDM deposit protection", "front": "Which rule or threshold is described: RM250,000 per depositor per member bank.", "answer": "PIDM deposit protection", "detail": "PIDM deposit protection"}, {"id": "fc218", "category": "Rules & Thresholds", "tag": "PIDM TIPS protection", "front": "What should you remember about PIDM TIPS protection?", "answer": "RM500,000 for eligible takaful certificates and insurance policies.", "detail": "RM500,000 for eligible takaful certificates and insurance policies."}, {"id": "fc219", "category": "Rules & Thresholds", "tag": "PIDM TIPS protection", "front": "Which rule or threshold is described: RM500,000 for eligible takaful certificates and insurance policies.", "answer": "PIDM TIPS protection", "detail": "PIDM TIPS protection"}, {"id": "fc220", "category": "Rules & Thresholds", "tag": "PIDM exclusions", "front": "What should you remember about PIDM exclusions?", "answer": "NIDs, repos, unit trusts, stocks/shares, investment accounts and gold-related products are excluded.", "detail": "NIDs, repos, unit trusts, stocks/shares, investment accounts and gold-related products are excluded."}, {"id": "fc221", "category": "Rules & Thresholds", "tag": "PIDM exclusions", "front": "Which rule or threshold is described: NIDs, repos, unit trusts, stocks/shares, investment accounts and gold-related products are excluded.", "answer": "PIDM exclusions", "detail": "PIDM exclusions"}, {"id": "fc222", "category": "Rules & Thresholds", "tag": "PIDM foreign-currency deposits", "front": "What should you remember about PIDM foreign-currency deposits?", "answer": "Foreign-currency deposits at Malaysian member banks may be eligible for PIDM protection, subject to PIDM rules.", "detail": "Foreign-currency deposits at Malaysian member banks may be eligible for PIDM protection, subject to PIDM rules."}, {"id": "fc223", "category": "Rules & Thresholds", "tag": "PIDM foreign-currency deposits", "front": "Which rule or threshold is described: Foreign-currency deposits at Malaysian member banks may be eligible for PIDM protection, subject to PIDM rules.", "answer": "PIDM foreign-currency deposits", "detail": "PIDM foreign-currency deposits"}, {"id": "fc224", "category": "Rules & Thresholds", "tag": "AMLA suspicious transaction report", "front": "What should you remember about AMLA suspicious transaction report?", "answer": "An STR is filed when there is suspicion; it is not dependent on the threshold amount, proof of crime or court confirmation.", "detail": "An STR is filed when there is suspicion; it is not dependent on the threshold amount, proof of crime or court confirmation."}, {"id": "fc225", "category": "Rules & Thresholds", "tag": "AMLA suspicious transaction report", "front": "Which rule or threshold is described: An STR is filed when there is suspicion; it is not dependent on the threshold amount, proof of crime or court confirmation.", "answer": "AMLA suspicious transaction report", "detail": "AMLA suspicious transaction report"}, {"id": "fc226", "category": "Rules & Thresholds", "tag": "AMLA tipping-off rule", "front": "What should you remember about AMLA tipping-off rule?", "answer": "Do not alert the customer that an STR has been or may be filed.", "detail": "Do not alert the customer that an STR has been or may be filed."}, {"id": "fc227", "category": "Rules & Thresholds", "tag": "AMLA tipping-off rule", "front": "Which rule or threshold is described: Do not alert the customer that an STR has been or may be filed.", "answer": "AMLA tipping-off rule", "detail": "AMLA tipping-off rule"}, {"id": "fc228", "category": "Rules & Thresholds", "tag": "Threshold reporting vs STR", "front": "What should you remember about Threshold reporting vs STR?", "answer": "Threshold reporting is amount-based; STR is suspicion-based. They are separate obligations.", "detail": "Threshold reporting is amount-based; STR is suspicion-based. They are separate obligations."}, {"id": "fc229", "category": "Rules & Thresholds", "tag": "Threshold reporting vs STR", "front": "Which rule or threshold is described: Threshold reporting is amount-based; STR is suspicion-based. They are separate obligations.", "answer": "Threshold reporting vs STR", "detail": "Threshold reporting vs STR"}, {"id": "fc230", "category": "Rules & Thresholds", "tag": "CDD trigger: new relationship", "front": "What should you remember about CDD trigger: new relationship?", "answer": "CDD is conducted when establishing a business relationship with any customer.", "detail": "CDD is conducted when establishing a business relationship with any customer."}, {"id": "fc231", "category": "Rules & Thresholds", "tag": "CDD trigger: new relationship", "front": "Which rule or threshold is described: CDD is conducted when establishing a business relationship with any customer.", "answer": "CDD trigger: new relationship", "detail": "CDD trigger: new relationship"}, {"id": "fc232", "category": "Rules & Thresholds", "tag": "CDD trigger: suspicion", "front": "What should you remember about CDD trigger: suspicion?", "answer": "CDD is conducted where there is suspicion of money laundering or terrorism financing.", "detail": "CDD is conducted where there is suspicion of money laundering or terrorism financing."}, {"id": "fc233", "category": "Rules & Thresholds", "tag": "CDD trigger: suspicion", "front": "Which rule or threshold is described: CDD is conducted where there is suspicion of money laundering or terrorism financing.", "answer": "CDD trigger: suspicion", "detail": "CDD trigger: suspicion"}, {"id": "fc234", "category": "Rules & Thresholds", "tag": "CDD trigger: doubt", "front": "What should you remember about CDD trigger: doubt?", "answer": "CDD is conducted when there is doubt about the veracity or adequacy of previously obtained customer information.", "detail": "CDD is conducted when there is doubt about the veracity or adequacy of previously obtained customer information."}, {"id": "fc235", "category": "Rules & Thresholds", "tag": "CDD trigger: doubt", "front": "Which rule or threshold is described: CDD is conducted when there is doubt about the veracity or adequacy of previously obtained customer information.", "answer": "CDD trigger: doubt", "detail": "CDD trigger: doubt"}, {"id": "fc236", "category": "Rules & Thresholds", "tag": "CDD refusal", "front": "What should you remember about CDD refusal?", "answer": "If required CDD information cannot be obtained, the institution should not proceed or should terminate the relationship and consider filing an STR.", "detail": "If required CDD information cannot be obtained, the institution should not proceed or should terminate the relationship and consider filing an STR."}, {"id": "fc237", "category": "Rules & Thresholds", "tag": "CDD refusal", "front": "Which rule or threshold is described: If required CDD information cannot be obtained, the institution should not proceed or should terminate the relationship and consider filing an STR.", "answer": "CDD refusal", "detail": "CDD refusal"}, {"id": "fc238", "category": "Rules & Thresholds", "tag": "Risk-based approach", "front": "What should you remember about Risk-based approach?", "answer": "Higher-risk customers, products, channels or jurisdictions require enhanced due diligence and stronger controls.", "detail": "Higher-risk customers, products, channels or jurisdictions require enhanced due diligence and stronger controls."}, {"id": "fc239", "category": "Rules & Thresholds", "tag": "Risk-based approach", "front": "Which rule or threshold is described: Higher-risk customers, products, channels or jurisdictions require enhanced due diligence and stronger controls.", "answer": "Risk-based approach", "detail": "Risk-based approach"}, {"id": "fc240", "category": "Rules & Thresholds", "tag": "Politically Exposed Persons", "front": "What should you remember about Politically Exposed Persons?", "answer": "PEPs are higher-risk and require enhanced due diligence and appropriate senior management approval.", "detail": "PEPs are higher-risk and require enhanced due diligence and appropriate senior management approval."}, {"id": "fc241", "category": "Rules & Thresholds", "tag": "Politically Exposed Persons", "front": "Which rule or threshold is described: PEPs are higher-risk and require enhanced due diligence and appropriate senior management approval.", "answer": "Politically Exposed Persons", "detail": "Politically Exposed Persons"}, {"id": "fc242", "category": "Rules & Thresholds", "tag": "MCC record retention", "front": "What should you remember about MCC record retention?", "answer": "Wholesale financial market transaction and dealing records should be retained for at least seven years.", "detail": "Wholesale financial market transaction and dealing records should be retained for at least seven years."}, {"id": "fc243", "category": "Rules & Thresholds", "tag": "MCC record retention", "front": "Which rule or threshold is described: Wholesale financial market transaction and dealing records should be retained for at least seven years.", "answer": "MCC record retention", "detail": "MCC record retention"}, {"id": "fc244", "category": "Rules & Thresholds", "tag": "MCC trainee dealers/brokers", "front": "What should you remember about MCC trainee dealers/brokers?", "answer": "Trainee dealers/brokers may assist under close supervision but cannot conclude deals independently.", "detail": "Trainee dealers/brokers may assist under close supervision but cannot conclude deals independently."}, {"id": "fc245", "category": "Rules & Thresholds", "tag": "MCC trainee dealers/brokers", "front": "Which rule or threshold is described: Trainee dealers/brokers may assist under close supervision but cannot conclude deals independently.", "answer": "MCC trainee dealers/brokers", "detail": "MCC trainee dealers/brokers"}, {"id": "fc246", "category": "Rules & Thresholds", "tag": "MCC best execution", "front": "What should you remember about MCC best execution?", "answer": "Client orders must be executed promptly and fairly, following specific client instructions and using truthful, clear communication.", "detail": "Client orders must be executed promptly and fairly, following specific client instructions and using truthful, clear communication."}, {"id": "fc247", "category": "Rules & Thresholds", "tag": "MCC best execution", "front": "Which rule or threshold is described: Client orders must be executed promptly and fairly, following specific client instructions and using truthful, clear communication.", "answer": "MCC best execution", "detail": "MCC best execution"}, {"id": "fc248", "category": "Rules & Thresholds", "tag": "MCC prohibited conduct", "front": "What should you remember about MCC prohibited conduct?", "answer": "Market manipulation, misinformation/rumour and insider trading are prohibited.", "detail": "Market manipulation, misinformation/rumour and insider trading are prohibited."}, {"id": "fc249", "category": "Rules & Thresholds", "tag": "MCC prohibited conduct", "front": "Which rule or threshold is described: Market manipulation, misinformation/rumour and insider trading are prohibited.", "answer": "MCC prohibited conduct", "detail": "MCC prohibited conduct"}, {"id": "fc250", "category": "Rules & Thresholds", "tag": "MCC non-current rates", "front": "What should you remember about MCC non-current rates?", "answer": "Non-current rates require proper controls and audit trails; misuse can conceal profit/loss, fraud, tax evasion or unauthorised credit.", "detail": "Non-current rates require proper controls and audit trails; misuse can conceal profit/loss, fraud, tax evasion or unauthorised credit."}, {"id": "fc251", "category": "Rules & Thresholds", "tag": "MCC non-current rates", "front": "Which rule or threshold is described: Non-current rates require proper controls and audit trails; misuse can conceal profit/loss, fraud, tax evasion or unauthorised credit.", "answer": "MCC non-current rates", "detail": "MCC non-current rates"}, {"id": "fc252", "category": "Rules & Thresholds", "tag": "Offshore Ringgit NDF", "front": "What should you remember about Offshore Ringgit NDF?", "answer": "Market participants must not participate in offshore Ringgit non-deliverable derivatives or facilitate offshore NDF-related dealing.", "detail": "Market participants must not participate in offshore Ringgit non-deliverable derivatives or facilitate offshore NDF-related dealing."}, {"id": "fc253", "category": "Rules & Thresholds", "tag": "Offshore Ringgit NDF", "front": "Which rule or threshold is described: Market participants must not participate in offshore Ringgit non-deliverable derivatives or facilitate offshore NDF-related dealing.", "answer": "Offshore Ringgit NDF", "detail": "Offshore Ringgit NDF"}, {"id": "fc254", "category": "Rules & Thresholds", "tag": "BNM jurisdiction", "front": "What should you remember about BNM jurisdiction?", "answer": "BNM supervises financial institutions, money/FX markets and payment systems.", "detail": "BNM supervises financial institutions, money/FX markets and payment systems."}, {"id": "fc255", "category": "Rules & Thresholds", "tag": "BNM jurisdiction", "front": "Which rule or threshold is described: BNM supervises financial institutions, money/FX markets and payment systems.", "answer": "BNM jurisdiction", "detail": "BNM jurisdiction"}, {"id": "fc256", "category": "Rules & Thresholds", "tag": "SC jurisdiction", "front": "What should you remember about SC jurisdiction?", "answer": "SC regulates capital-market activities, securities and derivatives markets and licensed persons.", "detail": "SC regulates capital-market activities, securities and derivatives markets and licensed persons."}, {"id": "fc257", "category": "Rules & Thresholds", "tag": "SC jurisdiction", "front": "Which rule or threshold is described: SC regulates capital-market activities, securities and derivatives markets and licensed persons.", "answer": "SC jurisdiction", "detail": "SC jurisdiction"}, {"id": "fc258", "category": "Rules & Thresholds", "tag": "PIDM jurisdiction", "front": "What should you remember about PIDM jurisdiction?", "answer": "PIDM administers deposit insurance and TIPS; it does not guarantee investment products.", "detail": "PIDM administers deposit insurance and TIPS; it does not guarantee investment products."}, {"id": "fc259", "category": "Rules & Thresholds", "tag": "PIDM jurisdiction", "front": "Which rule or threshold is described: PIDM administers deposit insurance and TIPS; it does not guarantee investment products.", "answer": "PIDM jurisdiction", "detail": "PIDM jurisdiction"}, {"id": "fc260", "category": "Rules & Thresholds", "tag": "Bursa Malaysia role", "front": "What should you remember about Bursa Malaysia role?", "answer": "Operates a fully integrated exchange with trading, clearing, settlement and depository services.", "detail": "Operates a fully integrated exchange with trading, clearing, settlement and depository services."}, {"id": "fc261", "category": "Rules & Thresholds", "tag": "Bursa Malaysia role", "front": "Which rule or threshold is described: Operates a fully integrated exchange with trading, clearing, settlement and depository services.", "answer": "Bursa Malaysia role", "detail": "Bursa Malaysia role"}, {"id": "fc262", "category": "Rules & Thresholds", "tag": "Labuan FSA role", "front": "What should you remember about Labuan FSA role?", "answer": "Central regulatory, supervisory and enforcement authority of Labuan IBFC.", "detail": "Central regulatory, supervisory and enforcement authority of Labuan IBFC."}, {"id": "fc263", "category": "Rules & Thresholds", "tag": "Labuan FSA role", "front": "Which rule or threshold is described: Central regulatory, supervisory and enforcement authority of Labuan IBFC.", "answer": "Labuan FSA role", "detail": "Labuan FSA role"}, {"id": "fc264", "category": "Rules & Thresholds", "tag": "Ministry of Housing and Local Government role", "front": "What should you remember about Ministry of Housing and Local Government role?", "answer": "Develops and regulates moneylenders, credit companies and pawnbrokers.", "detail": "Develops and regulates moneylenders, credit companies and pawnbrokers."}, {"id": "fc265", "category": "Rules & Thresholds", "tag": "Ministry of Housing and Local Government role", "front": "Which rule or threshold is described: Develops and regulates moneylenders, credit companies and pawnbrokers.", "answer": "Ministry of Housing and Local Government role", "detail": "Ministry of Housing and Local Government role"}, {"id": "fc266", "category": "Rules & Thresholds", "tag": "PDS", "front": "What should you remember about PDS?", "answer": "Product Disclosure Sheet under BNM disclosure framework; supports product transparency and customer understanding.", "detail": "Product Disclosure Sheet under BNM disclosure framework; supports product transparency and customer understanding."}, {"id": "fc267", "category": "Rules & Thresholds", "tag": "PDS", "front": "Which rule or threshold is described: Product Disclosure Sheet under BNM disclosure framework; supports product transparency and customer understanding.", "answer": "PDS", "detail": "PDS"}, {"id": "fc268", "category": "Rules & Thresholds", "tag": "PHS", "front": "What should you remember about PHS?", "answer": "Product Highlights Sheet under SC framework for relevant unlisted capital-market products.", "detail": "Product Highlights Sheet under SC framework for relevant unlisted capital-market products."}, {"id": "fc269", "category": "Rules & Thresholds", "tag": "PHS", "front": "Which rule or threshold is described: Product Highlights Sheet under SC framework for relevant unlisted capital-market products.", "answer": "PHS", "detail": "PHS"}, {"id": "fc270", "category": "Rules & Thresholds", "tag": "PHS first page", "front": "What should you remember about PHS first page?", "answer": "Contains responsibility statement and SC disclaimer statement.", "detail": "Contains responsibility statement and SC disclaimer statement."}, {"id": "fc271", "category": "Rules & Thresholds", "tag": "PHS first page", "front": "Which rule or threshold is described: Contains responsibility statement and SC disclaimer statement.", "answer": "PHS first page", "detail": "PHS first page"}, {"id": "fc272", "category": "Rules & Thresholds", "tag": "Product Transparency three stages", "front": "What should you remember about Product Transparency three stages?", "answer": "Pre-contractual stage, point of entering into contract, and during the term of the contract.", "detail": "Pre-contractual stage, point of entering into contract, and during the term of the contract."}, {"id": "fc273", "category": "Rules & Thresholds", "tag": "Product Transparency three stages", "front": "Which rule or threshold is described: Pre-contractual stage, point of entering into contract, and during the term of the contract.", "answer": "Product Transparency three stages", "detail": "Product Transparency three stages"}, {"id": "fc274", "category": "Rules & Thresholds", "tag": "New products fair treatment", "front": "What should you remember about New products fair treatment?", "answer": "Board-approved policies should avoid mis-selling, unfair terms and business practices restricting freedom of choice.", "detail": "Board-approved policies should avoid mis-selling, unfair terms and business practices restricting freedom of choice."}, {"id": "fc275", "category": "Rules & Thresholds", "tag": "New products fair treatment", "front": "Which rule or threshold is described: Board-approved policies should avoid mis-selling, unfair terms and business practices restricting freedom of choice.", "answer": "New products fair treatment", "detail": "New products fair treatment"}, {"id": "fc276", "category": "Rules & Thresholds", "tag": "Customer suitability procedures", "front": "What should you remember about Customer suitability procedures?", "answer": "Recommend products only when reasonably satisfied they are suitable based on customer information.", "detail": "Recommend products only when reasonably satisfied they are suitable based on customer information."}, {"id": "fc277", "category": "Rules & Thresholds", "tag": "Customer suitability procedures", "front": "Which rule or threshold is described: Recommend products only when reasonably satisfied they are suitable based on customer information.", "answer": "Customer suitability procedures", "detail": "Customer suitability procedures"}, {"id": "fc278", "category": "Rules & Thresholds", "tag": "Seasoned bond seasoning period", "front": "What should you remember about Seasoned bond seasoning period?", "answer": "12 months from issuance to sophisticated investors before retail availability.", "detail": "12 months from issuance to sophisticated investors before retail availability."}, {"id": "fc279", "category": "Rules & Thresholds", "tag": "Seasoned bond seasoning period", "front": "Which rule or threshold is described: 12 months from issuance to sophisticated investors before retail availability.", "answer": "Seasoned bond seasoning period", "detail": "Seasoned bond seasoning period"}, {"id": "fc280", "category": "Rules & Thresholds", "tag": "Seasoned bond denomination", "front": "What should you remember about Seasoned bond denomination?", "answer": "Eligible seasoned corporate bonds/sukuk must be denominated in MYR.", "detail": "Eligible seasoned corporate bonds/sukuk must be denominated in MYR."}, {"id": "fc281", "category": "Rules & Thresholds", "tag": "Seasoned bond denomination", "front": "Which rule or threshold is described: Eligible seasoned corporate bonds/sukuk must be denominated in MYR.", "answer": "Seasoned bond denomination", "detail": "Seasoned bond denomination"}, {"id": "fc282", "category": "Rules & Thresholds", "tag": "Seasoned bond tenure", "front": "What should you remember about Seasoned bond tenure?", "answer": "Eligible seasoned corporate bonds/sukuk must have tenure of more than one year.", "detail": "Eligible seasoned corporate bonds/sukuk must have tenure of more than one year."}, {"id": "fc283", "category": "Rules & Thresholds", "tag": "Seasoned bond tenure", "front": "Which rule or threshold is described: Eligible seasoned corporate bonds/sukuk must have tenure of more than one year.", "answer": "Seasoned bond tenure", "detail": "Seasoned bond tenure"}, {"id": "fc284", "category": "Rules & Thresholds", "tag": "Seasoned bond rating", "front": "What should you remember about Seasoned bond rating?", "answer": "Minimum credit rating is A or equivalent.", "detail": "Minimum credit rating is A or equivalent."}, {"id": "fc285", "category": "Rules & Thresholds", "tag": "Seasoned bond rating", "front": "Which rule or threshold is described: Minimum credit rating is A or equivalent.", "answer": "Seasoned bond rating", "detail": "Seasoned bond rating"}, {"id": "fc286", "category": "Rules & Thresholds", "tag": "Seasoned bond derivatives restriction", "front": "What should you remember about Seasoned bond derivatives restriction?", "answer": "Must not embed swaps, options or other derivatives except specified convertible/exchangeable structures where the investor controls conversion/exchange.", "detail": "Must not embed swaps, options or other derivatives except specified convertible/exchangeable structures where the investor controls conversion/exchange."}, {"id": "fc287", "category": "Rules & Thresholds", "tag": "Seasoned bond derivatives restriction", "front": "Which rule or threshold is described: Must not embed swaps, options or other derivatives except specified convertible/exchangeable structures where the investor controls conversion/exchange.", "answer": "Seasoned bond derivatives restriction", "detail": "Seasoned bond derivatives restriction"}, {"id": "fc288", "category": "Rules & Thresholds", "tag": "Eligible seasoned bond issuers", "front": "What should you remember about Eligible seasoned bond issuers?", "answer": "Licensed bank, licensed investment bank, licensed Islamic bank, listed public company, Cagamas, Danajamin and Khazanah.", "detail": "Licensed bank, licensed investment bank, licensed Islamic bank, listed public company, Cagamas, Danajamin and Khazanah."}, {"id": "fc289", "category": "Rules & Thresholds", "tag": "Eligible seasoned bond issuers", "front": "Which rule or threshold is described: Licensed bank, licensed investment bank, licensed Islamic bank, listed public company, Cagamas, Danajamin and Khazanah.", "answer": "Eligible seasoned bond issuers", "detail": "Eligible seasoned bond issuers"}, {"id": "fc290", "category": "Rules & Thresholds", "tag": "Eligible distributors for seasoned bonds", "front": "What should you remember about Eligible distributors for seasoned bonds?", "answer": "Licensed banks, licensed investment banks, licensed Islamic banks, CMSL holders for dealing in securities, and CMSL holders for dealing in OTC bonds.", "detail": "Licensed banks, licensed investment banks, licensed Islamic banks, CMSL holders for dealing in securities, and CMSL holders for dealing in OTC bonds."}, {"id": "fc291", "category": "Rules & Thresholds", "tag": "Eligible distributors for seasoned bonds", "front": "Which rule or threshold is described: Licensed banks, licensed investment banks, licensed Islamic banks, CMSL holders for dealing in securities, and CMSL holders for dealing in OTC bonds.", "answer": "Eligible distributors for seasoned bonds", "detail": "Eligible distributors for seasoned bonds"}, {"id": "fc292", "category": "Rules & Thresholds", "tag": "Selling seasoned bonds qualifications", "front": "What should you remember about Selling seasoned bonds qualifications?", "answer": "Modules 6 and 7, IPPC, PKMC, or other SC-specified qualification.", "detail": "Modules 6 and 7, IPPC, PKMC, or other SC-specified qualification."}, {"id": "fc293", "category": "Rules & Thresholds", "tag": "Selling seasoned bonds qualifications", "front": "Which rule or threshold is described: Modules 6 and 7, IPPC, PKMC, or other SC-specified qualification.", "answer": "Selling seasoned bonds qualifications", "detail": "Selling seasoned bonds qualifications"}, {"id": "fc294", "category": "Rules & Thresholds", "tag": "Structured products qualification", "front": "What should you remember about Structured products qualification?", "answer": "For non-treasury dealers: IPPC. For treasury dealers: PKMC Modules I to IV.", "detail": "For non-treasury dealers: IPPC. For treasury dealers: PKMC Modules I to IV."}, {"id": "fc295", "category": "Rules & Thresholds", "tag": "Structured products qualification", "front": "Which qualification rule is described for selling and marketing structured products: for non-treasury dealers IPPC; for treasury dealers PKMC Modules I to IV?", "answer": "Structured products qualification", "detail": "Structured products qualification"}, {"id": "fc296", "category": "Rules & Thresholds", "tag": "Unlisted debt securities qualification", "front": "What should you remember about Unlisted debt securities qualification?", "answer": "For non-treasury dealers: IPPC. For treasury dealers: PKMC Modules I to IV.", "detail": "For non-treasury dealers: IPPC. For treasury dealers: PKMC Modules I to IV."}, {"id": "fc297", "category": "Rules & Thresholds", "tag": "Unlisted debt securities qualification", "front": "Which qualification rule is described for dealing in or marketing unlisted debt securities: for non-treasury dealers IPPC; for treasury dealers PKMC Modules I to IV?", "answer": "Unlisted debt securities qualification", "detail": "Unlisted debt securities qualification"}, {"id": "fc298", "category": "Rules & Thresholds", "tag": "Dealing in securities qualification", "front": "What should you remember about Dealing in securities qualification?", "answer": "SC Licensing Examination Modules 6 and 7 for dealing in securities excluding listed and unlisted debt securities.", "detail": "SC Licensing Examination Modules 6 and 7 for dealing in securities excluding listed and unlisted debt securities."}, {"id": "fc299", "category": "Rules & Thresholds", "tag": "Dealing in securities qualification", "front": "Which rule or threshold is described: SC Licensing Examination Modules 6 and 7 for dealing in securities excluding listed and unlisted debt securities.", "answer": "Dealing in securities qualification", "detail": "Dealing in securities qualification"}, {"id": "fc300", "category": "Rules & Thresholds", "tag": "Fund management qualification", "front": "What should you remember about Fund management qualification?", "answer": "SC Licensing Examination Modules 9 and 10.", "detail": "SC Licensing Examination Modules 9 and 10."}, {"id": "fc301", "category": "Rules & Thresholds", "tag": "Fund management qualification", "front": "Which rule or threshold is described: SC Licensing Examination Modules 9 and 10.", "answer": "Fund management qualification", "detail": "Fund management qualification"}, {"id": "fc302", "category": "Rules & Thresholds", "tag": "Unit trust distribution qualification", "front": "What should you remember about Unit trust distribution qualification?", "answer": "FIMM examinations.", "detail": "FIMM examinations."}, {"id": "fc303", "category": "Rules & Thresholds", "tag": "Unit trust distribution qualification", "front": "Which rule or threshold is described: FIMM examinations.", "answer": "Unit trust distribution qualification", "detail": "Unit trust distribution qualification"}, {"id": "fc304", "category": "Rules & Thresholds", "tag": "CPE requirement", "front": "What should you remember about CPE requirement?", "answer": "Employees must obtain 20 CPE points every year for licence renewal.", "detail": "Employees must obtain 20 CPE points every year for licence renewal."}, {"id": "fc305", "category": "Rules & Thresholds", "tag": "CPE requirement", "front": "Which rule or threshold is described: Employees must obtain 20 CPE points every year for licence renewal.", "answer": "CPE requirement", "detail": "CPE requirement"}, {"id": "fc306", "category": "Rules & Thresholds", "tag": "Fit and proper standard", "front": "What should you remember about Fit and proper standard?", "answer": "Minimum fit and proper criteria, examination requirements and Continuing Professional Education requirements.", "detail": "Minimum fit and proper criteria, examination requirements and Continuing Professional Education requirements."}, {"id": "fc307", "category": "Rules & Thresholds", "tag": "Fit and proper standard", "front": "Which rule or threshold is described: Minimum fit and proper criteria, examination requirements and Continuing Professional Education requirements.", "answer": "Fit and proper standard", "detail": "Fit and proper standard"}, {"id": "fc308", "category": "Rules & Thresholds", "tag": "Fit and proper: bankruptcy", "front": "What should you remember about Fit and proper: bankruptcy?", "answer": "An undischarged bankrupt does not meet the minimum fit and proper criteria.", "detail": "An undischarged bankrupt does not meet the minimum fit and proper criteria."}, {"id": "fc309", "category": "Rules & Thresholds", "tag": "Fit and proper: bankruptcy", "front": "Which rule or threshold is described: An undischarged bankrupt does not meet the minimum fit and proper criteria.", "answer": "Fit and proper: bankruptcy", "detail": "Fit and proper: bankruptcy"}, {"id": "fc310", "category": "Rules & Thresholds", "tag": "Fit and proper: offences", "front": "What should you remember about Fit and proper: offences?", "answer": "Conviction for fraud, dishonesty, violence, banking/securities/insurance offences is a fit and proper red flag.", "detail": "Conviction for fraud, dishonesty, violence, banking/securities/insurance offences is a fit and proper red flag."}, {"id": "fc311", "category": "Rules & Thresholds", "tag": "Fit and proper: offences", "front": "Which rule or threshold is described: Conviction for fraud, dishonesty, violence, banking/securities/insurance offences is a fit and proper red flag.", "answer": "Fit and proper: offences", "detail": "Fit and proper: offences"}, {"id": "fc312", "category": "Rules & Thresholds", "tag": "Fit and proper: business practices", "front": "What should you remember about Fit and proper: business practices?", "answer": "Deceitful or oppressive business practices fail fit and proper criteria.", "detail": "Deceitful or oppressive business practices fail fit and proper criteria."}, {"id": "fc313", "category": "Rules & Thresholds", "tag": "Fit and proper: business practices", "front": "Which rule or threshold is described: Deceitful or oppressive business practices fail fit and proper criteria.", "answer": "Fit and proper: business practices", "detail": "Fit and proper: business practices"}, {"id": "fc314", "category": "Rules & Thresholds", "tag": "ERP exam validity", "front": "What should you remember about ERP exam validity?", "answer": "Examination results are valid for two years from passing if the employee does not undertake the activity within that period.", "detail": "Examination results are valid for two years from passing if the employee does not undertake the activity within that period."}, {"id": "fc315", "category": "Rules & Thresholds", "tag": "ERP exam validity", "front": "Which rule or threshold is described: Examination results are valid for two years from passing if the employee does not undertake the activity within that period.", "answer": "ERP exam validity", "detail": "ERP exam validity"}, {"id": "fc316", "category": "Rules & Thresholds", "tag": "RP/ERP register update", "front": "What should you remember about RP/ERP register update?", "answer": "Change details must be entered with full particulars, date and reasons within 14 days.", "detail": "Change details must be entered with full particulars, date and reasons within 14 days."}, {"id": "fc317", "category": "Rules & Thresholds", "tag": "RP/ERP register update", "front": "Which rule or threshold is described: Change details must be entered with full particulars, date and reasons within 14 days.", "answer": "RP/ERP register update", "detail": "RP/ERP register update"}, {"id": "fc318", "category": "Rules & Thresholds", "tag": "ECF retail investor limit", "front": "What should you remember about ECF retail investor limit?", "answer": "Up to RM10,000 per issuer per year and up to RM50,000 per year.", "detail": "Up to RM10,000 per issuer per year and up to RM50,000 per year."}, {"id": "fc319", "category": "Rules & Thresholds", "tag": "ECF retail investor limit", "front": "Which rule or threshold is described: Up to RM10,000 per issuer per year and up to RM50,000 per year.", "answer": "ECF retail investor limit", "detail": "ECF retail investor limit"}, {"id": "fc320", "category": "Rules & Thresholds", "tag": "ECF angel investor limit", "front": "What should you remember about ECF angel investor limit?", "answer": "Up to RM500,000 per year.", "detail": "Up to RM500,000 per year."}, {"id": "fc321", "category": "Rules & Thresholds", "tag": "ECF angel investor limit", "front": "Which rule or threshold is described: Up to RM500,000 per year.", "answer": "ECF angel investor limit", "detail": "ECF angel investor limit"}, {"id": "fc322", "category": "Rules & Thresholds", "tag": "ECF sophisticated investor limit", "front": "What should you remember about ECF sophisticated investor limit?", "answer": "No investment limit.", "detail": "No investment limit."}, {"id": "fc323", "category": "Rules & Thresholds", "tag": "ECF sophisticated investor limit", "front": "Which rule or threshold is described: No investment limit.", "answer": "ECF sophisticated investor limit", "detail": "ECF sophisticated investor limit"}, {"id": "fc324", "category": "Rules & Thresholds", "tag": "Angel investor income criterion", "front": "What should you remember about Angel investor income criterion?", "answer": "Gross annual income greater than RM180,000, or RM250,000 jointly with spouse.", "detail": "Gross annual income greater than RM180,000, or RM250,000 jointly with spouse."}, {"id": "fc325", "category": "Rules & Thresholds", "tag": "Angel investor income criterion", "front": "Which rule or threshold is described: Gross annual income greater than RM180,000, or RM250,000 jointly with spouse.", "answer": "Angel investor income criterion", "detail": "Angel investor income criterion"}, {"id": "fc326", "category": "Rules & Thresholds", "tag": "Angel investor asset criterion", "front": "What should you remember about Angel investor asset criterion?", "answer": "Total net personal assets exceeding RM3 million.", "detail": "Total net personal assets exceeding RM3 million."}, {"id": "fc327", "category": "Rules & Thresholds", "tag": "Angel investor asset criterion", "front": "Which rule or threshold is described: Total net personal assets exceeding RM3 million.", "answer": "Angel investor asset criterion", "detail": "Angel investor asset criterion"}, {"id": "fc328", "category": "Rules & Thresholds", "tag": "Sophisticated/HNWI asset criterion", "front": "What should you remember about Sophisticated/HNWI asset criterion?", "answer": "Total net assets exceeding RM3 million, with primary residence not contributing more than RM1 million.", "detail": "Total net assets exceeding RM3 million, with primary residence not contributing more than RM1 million."}, {"id": "fc329", "category": "Rules & Thresholds", "tag": "Sophisticated/HNWI asset criterion", "front": "Which rule or threshold is described: Total net assets exceeding RM3 million, with primary residence not contributing more than RM1 million.", "answer": "Sophisticated/HNWI asset criterion", "detail": "Sophisticated/HNWI asset criterion"}, {"id": "fc330", "category": "Rules & Thresholds", "tag": "Sophisticated/HNWI income criterion", "front": "What should you remember about Sophisticated/HNWI income criterion?", "answer": "Gross annual income greater than RM300,000, or RM400,000 jointly with spouse or child.", "detail": "Gross annual income greater than RM300,000, or RM400,000 jointly with spouse or child."}, {"id": "fc331", "category": "Rules & Thresholds", "tag": "Sophisticated/HNWI income criterion", "front": "Which rule or threshold is described: Gross annual income greater than RM300,000, or RM400,000 jointly with spouse or child.", "answer": "Sophisticated/HNWI income criterion", "detail": "Sophisticated/HNWI income criterion"}, {"id": "fc332", "category": "Rules & Thresholds", "tag": "Sophisticated/HNWI investment portfolio criterion", "front": "What should you remember about Sophisticated/HNWI investment portfolio criterion?", "answer": "Total net personal investment portfolio in capital-market products exceeding RM1 million.", "detail": "Total net personal investment portfolio in capital-market products exceeding RM1 million."}, {"id": "fc333", "category": "Rules & Thresholds", "tag": "Sophisticated/HNWI investment portfolio criterion", "front": "Which rule or threshold is described: Total net personal investment portfolio in capital-market products exceeding RM1 million.", "answer": "Sophisticated/HNWI investment portfolio criterion", "detail": "Sophisticated/HNWI investment portfolio criterion"}, {"id": "fc334", "category": "Rules & Thresholds", "tag": "High-net-worth entity broad anchor", "front": "What should you remember about High-net-worth entity broad anchor?", "answer": "A corporation or entity with net assets over RM10 million is a key HNWE-style anchor.", "detail": "A corporation or entity with net assets over RM10 million is a key HNWE-style anchor."}, {"id": "fc335", "category": "Rules & Thresholds", "tag": "High-net-worth entity broad anchor", "front": "Which rule or threshold is described: A corporation or entity with net assets over RM10 million is a key HNWE-style anchor.", "answer": "High-net-worth entity broad anchor", "detail": "High-net-worth entity broad anchor"}, {"id": "fc336", "category": "Rules & Thresholds", "tag": "LEAP Market investor access", "front": "What should you remember about LEAP Market investor access?", "answer": "LEAP Market shares are accessible only to sophisticated investors.", "detail": "LEAP Market shares are accessible only to sophisticated investors."}, {"id": "fc337", "category": "Rules & Thresholds", "tag": "LEAP Market investor access", "front": "Which rule or threshold is described: LEAP Market shares are accessible only to sophisticated investors.", "answer": "LEAP Market investor access", "detail": "LEAP Market investor access"}, {"id": "fc338", "category": "Rules & Thresholds", "tag": "DAX operator count as of publication", "front": "What should you remember about DAX operator count as of publication?", "answer": "As of publication, there are 6 registered DAX operators and 19 permitted digital assets on regulated DAX platforms.", "detail": "As of publication, there are 6 registered DAX operators and 19 permitted digital assets on regulated DAX platforms."}, {"id": "fc339", "category": "Rules & Thresholds", "tag": "DAX operator count as of publication", "front": "Which rule or threshold is described: As of publication, there are 6 registered DAX operators and 19 permitted digital assets on regulated DAX platforms.", "answer": "DAX operator count as of publication", "detail": "DAX operator count as of publication"}, {"id": "fc340", "category": "Rules & Thresholds", "tag": "ECF operator count as of publication", "front": "What should you remember about ECF operator count as of publication?", "answer": "As of publication, there are 13 ECF operators.", "detail": "As of publication, there are 13 ECF operators."}, {"id": "fc341", "category": "Rules & Thresholds", "tag": "ECF operator count as of publication", "front": "Which rule or threshold is described: As of publication, there are 13 ECF operators.", "answer": "ECF operator count as of publication", "detail": "ECF operator count as of publication"}, {"id": "fc342", "category": "Rules & Thresholds", "tag": "P2P operator count as of publication", "front": "What should you remember about P2P operator count as of publication?", "answer": "As of publication, there are 16 P2P financing platform operators.", "detail": "As of publication, there are 16 P2P financing platform operators."}, {"id": "fc343", "category": "Rules & Thresholds", "tag": "P2P operator count as of publication", "front": "Which rule or threshold is described: As of publication, there are 16 P2P financing platform operators.", "answer": "P2P operator count as of publication", "detail": "P2P operator count as of publication"}, {"id": "fc344", "category": "Rules & Thresholds", "tag": "P2P tenor", "front": "What should you remember about P2P tenor?", "answer": "P2P financing is typically short-term, often less than one year.", "detail": "P2P financing is typically short-term, often less than one year."}, {"id": "fc345", "category": "Rules & Thresholds", "tag": "P2P tenor", "front": "Which rule or threshold is described: P2P financing is typically short-term, often less than one year.", "answer": "P2P tenor", "detail": "P2P tenor"}, {"id": "fc346", "category": "Rules & Thresholds", "tag": "Money market maturity", "front": "What should you remember about Money market maturity?", "answer": "Money market instruments have original maturity up to one year.", "detail": "Money market instruments have original maturity up to one year."}, {"id": "fc347", "category": "Rules & Thresholds", "tag": "Money market maturity", "front": "Which rule or threshold is described: Money market instruments have original maturity up to one year.", "answer": "Money market maturity", "detail": "Money market maturity"}, {"id": "fc348", "category": "Rules & Thresholds", "tag": "Capital market maturity", "front": "What should you remember about Capital market maturity?", "answer": "Capital market instruments are typically longer than one year.", "detail": "Capital market instruments are typically longer than one year."}, {"id": "fc349", "category": "Rules & Thresholds", "tag": "Capital market maturity", "front": "Which rule or threshold is described: Capital market instruments are typically longer than one year.", "answer": "Capital market maturity", "detail": "Capital market maturity"}, {"id": "fc350", "category": "Rules & Thresholds", "tag": "Exchange-traded market", "front": "What should you remember about Exchange-traded market?", "answer": "Central clearing house becomes buyer to sellers and seller to buyers; more transparency and regulatory oversight.", "detail": "Central clearing house becomes buyer to sellers and seller to buyers; more transparency and regulatory oversight."}, {"id": "fc351", "category": "Rules & Thresholds", "tag": "Exchange-traded market", "front": "Which rule or threshold is described: Central clearing house becomes buyer to sellers and seller to buyers; more transparency and regulatory oversight.", "answer": "Exchange-traded market", "detail": "Exchange-traded market"}, {"id": "fc352", "category": "Rules & Thresholds", "tag": "OTC market", "front": "What should you remember about OTC market?", "answer": "Privately negotiated, more flexible, higher counterparty risk and typically less transparent/liquid.", "detail": "Privately negotiated, more flexible, higher counterparty risk and typically less transparent/liquid."}, {"id": "fc353", "category": "Rules & Thresholds", "tag": "OTC market", "front": "Which rule or threshold is described: Privately negotiated, more flexible, higher counterparty risk and typically less transparent/liquid.", "answer": "OTC market", "detail": "OTC market"}, {"id": "fc354", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Corporate bonds/sukuk other than seasoned bonds: accredited investors, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc355", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Corporate bonds/sukuk other than seasoned bonds: accredited investors — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Corporate bonds/sukuk other than seasoned bonds: accredited investors"}, {"id": "fc356", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Corporate bonds/sukuk other than seasoned bonds: HNWE, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc357", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Corporate bonds/sukuk other than seasoned bonds: HNWE — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Corporate bonds/sukuk other than seasoned bonds: HNWE"}, {"id": "fc358", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Corporate bonds/sukuk other than seasoned bonds: HNWI, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc359", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Corporate bonds/sukuk other than seasoned bonds: HNWI — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Corporate bonds/sukuk other than seasoned bonds: HNWI"}, {"id": "fc360", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Corporate bonds/sukuk other than seasoned bonds: RM250,000 acquisition person, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc361", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Corporate bonds/sukuk other than seasoned bonds: RM250,000 acquisition person — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Corporate bonds/sukuk other than seasoned bonds: RM250,000 acquisition person"}, {"id": "fc362", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Corporate bonds/sukuk other than seasoned bonds: retail investors, is a Product Highlights Sheet required?", "answer": "PHS required.", "detail": "PHS required."}, {"id": "fc363", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Corporate bonds/sukuk other than seasoned bonds: retail investors — required, not required, or opt-out?", "answer": "PHS required.", "detail": "Corporate bonds/sukuk other than seasoned bonds: retail investors"}, {"id": "fc364", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Seasoned bonds: accredited investors, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc365", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Seasoned bonds: accredited investors — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Seasoned bonds: accredited investors"}, {"id": "fc366", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Seasoned bonds: HNWE, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc367", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Seasoned bonds: HNWE — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Seasoned bonds: HNWE"}, {"id": "fc368", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Seasoned bonds: HNWI, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc369", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Seasoned bonds: HNWI — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Seasoned bonds: HNWI"}, {"id": "fc370", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Seasoned bonds: RM250,000 acquisition person, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc371", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Seasoned bonds: RM250,000 acquisition person — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Seasoned bonds: RM250,000 acquisition person"}, {"id": "fc372", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For Seasoned bonds: retail investors, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc373", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: Seasoned bonds: retail investors — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "Seasoned bonds: retail investors"}, {"id": "fc374", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For All other unlisted capital-market products: accredited investors, is a Product Highlights Sheet required?", "answer": "PHS not required.", "detail": "PHS not required."}, {"id": "fc375", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: All other unlisted capital-market products: accredited investors — required, not required, or opt-out?", "answer": "PHS not required.", "detail": "All other unlisted capital-market products: accredited investors"}, {"id": "fc376", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For All other unlisted capital-market products: HNWE, is a Product Highlights Sheet required?", "answer": "PHS required unless opt out.", "detail": "PHS required unless opt out."}, {"id": "fc377", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: All other unlisted capital-market products: HNWE — required, not required, or opt-out?", "answer": "PHS required unless opt out.", "detail": "All other unlisted capital-market products: HNWE"}, {"id": "fc378", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For All other unlisted capital-market products: HNWI, is a Product Highlights Sheet required?", "answer": "PHS required.", "detail": "PHS required."}, {"id": "fc379", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: All other unlisted capital-market products: HNWI — required, not required, or opt-out?", "answer": "PHS required.", "detail": "All other unlisted capital-market products: HNWI"}, {"id": "fc380", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For All other unlisted capital-market products: RM250,000 acquisition person, is a Product Highlights Sheet required?", "answer": "PHS required.", "detail": "PHS required."}, {"id": "fc381", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: All other unlisted capital-market products: RM250,000 acquisition person — required, not required, or opt-out?", "answer": "PHS required.", "detail": "All other unlisted capital-market products: RM250,000 acquisition person"}, {"id": "fc382", "category": "PHS Requirements", "tag": "Investor/product matrix", "front": "For All other unlisted capital-market products: retail investors, is a Product Highlights Sheet required?", "answer": "PHS required.", "detail": "PHS required."}, {"id": "fc383", "category": "PHS Requirements", "tag": "Reverse matrix", "front": "PHS matrix drill: All other unlisted capital-market products: retail investors — required, not required, or opt-out?", "answer": "PHS required.", "detail": "All other unlisted capital-market products: retail investors"}, {"id": "fc384", "category": "Penalty Anchors", "tag": "Number ladder", "front": "What does the penalty anchor 'RM50m / 10 years' usually point to?", "answer": "FSA S.8 unauthorised authorised business.", "detail": "FSA S.8 unauthorised authorised business."}, {"id": "fc385", "category": "Penalty Anchors", "tag": "Number ladder reverse", "front": "What is the penalty anchor for: FSA S.8 unauthorised authorised business.", "answer": "RM50m / 10 years", "detail": "RM50m / 10 years"}, {"id": "fc386", "category": "Penalty Anchors", "tag": "Number ladder", "front": "What does the penalty anchor 'RM10m / 5 years' usually point to?", "answer": "FSA S.133 / IFSA S.145 secrecy breach.", "detail": "FSA S.133 / IFSA S.145 secrecy breach."}, {"id": "fc387", "category": "Penalty Anchors", "tag": "Number ladder reverse", "front": "What is the penalty anchor for: FSA S.133 / IFSA S.145 secrecy breach.", "answer": "RM10m / 5 years", "detail": "RM10m / 5 years"}, {"id": "fc388", "category": "Penalty Anchors", "tag": "Number ladder", "front": "What does the penalty anchor 'RM3m / 10 years' usually point to?", "answer": "CMSA S.92A false or misleading information / material omission.", "detail": "CMSA S.92A false or misleading information / material omission."}, {"id": "fc389", "category": "Penalty Anchors", "tag": "Number ladder reverse", "front": "What is the penalty anchor for: CMSA S.92A false or misleading information / material omission.", "answer": "RM3m / 10 years", "detail": "RM3m / 10 years"}, {"id": "fc390", "category": "Penalty Anchors", "tag": "Number ladder", "front": "What does the penalty anchor 'RM1m / 5 years' usually point to?", "answer": "CMSA S.93 client-order priority breach.", "detail": "CMSA S.93 client-order priority breach."}, {"id": "fc391", "category": "Penalty Anchors", "tag": "Number ladder reverse", "front": "What is the penalty anchor for: CMSA S.93 client-order priority breach.", "answer": "RM1m / 5 years", "detail": "RM1m / 5 years"}, {"id": "fc392", "category": "Penalty Anchors", "tag": "Number ladder", "front": "What does the penalty anchor 'RM1m / 10 years + 14-day rescission' usually point to?", "answer": "CMSA S.97 dealing as principal breach.", "detail": "CMSA S.97 dealing as principal breach."}, {"id": "fc393", "category": "Penalty Anchors", "tag": "Number ladder reverse", "front": "What is the penalty anchor for: CMSA S.97 dealing as principal breach.", "answer": "RM1m / 10 years + 14-day rescission", "detail": "RM1m / 10 years + 14-day rescission"}, {"id": "fc394", "category": "Penalty Anchors", "tag": "Number ladder", "front": "What does the penalty anchor 'Not less than RM1m + 10 years' usually point to?", "answer": "CMSA S.178 fraudulent inducement and CMSA S.179 manipulative/deceptive devices.", "detail": "CMSA S.178 fraudulent inducement and CMSA S.179 manipulative/deceptive devices."}, {"id": "fc395", "category": "Penalty Anchors", "tag": "Number ladder reverse", "front": "What is the penalty anchor for: CMSA S.178 fraudulent inducement and CMSA S.179 manipulative/deceptive devices.", "answer": "Not less than RM1m + 10 years", "detail": "Not less than RM1m + 10 years"}, {"id": "fc396", "category": "Penalty Anchors", "tag": "Number ladder", "front": "What does the penalty anchor 'RM10m / 10 years' usually point to?", "answer": "CMSA S.232 prospectus registration breach.", "detail": "CMSA S.232 prospectus registration breach."}, {"id": "fc397", "category": "Penalty Anchors", "tag": "Number ladder reverse", "front": "What is the penalty anchor for: CMSA S.232 prospectus registration breach.", "answer": "RM10m / 10 years", "detail": "RM10m / 10 years"}];
const FLASHCARD_CATEGORIES=['All',...Array.from(new Set(FLASHCARD_DATA.map(c=>c.category)))];
const FLASHCARD_STORAGE_KEY='ippc_flashcard_stats_v1';
const FLASHCARD_VERSION='V81';


/* ── Animation helpers ─────────────────────────────────────────────────────── */
function useInView(threshold=0.18){
  const ref=useRef(null);
  const [inView,setInView]=useState(false);
  useEffect(()=>{
    const el=ref.current;
    if(!el||inView)return;
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setInView(true);obs.disconnect();}},{threshold});
    obs.observe(el);
    return()=>obs.disconnect();
  },[threshold,inView]);
  return [ref,inView];
}

function useCountUp(target,{duration=1600,active=true}={}){
  const [val,setVal]=useState(0);
  const raf=useRef(null);
  useEffect(()=>{
    if(!active){setVal(0);return;}
    const n=parseInt(String(target).replace(/[^0-9]/g,''),10);
    if(!n){setVal(0);return;}
    let t0=null;
    const step=ts=>{
      if(!t0)t0=ts;
      const p=Math.min((ts-t0)/duration,1);
      setVal(Math.floor((1-Math.pow(1-p,3))*n));
      if(p<1)raf.current=requestAnimationFrame(step);
    };
    raf.current=requestAnimationFrame(step);
    return()=>raf.current&&cancelAnimationFrame(raf.current);
  },[target,duration,active]);
  return val;
}

function AnimatedCount({value,suffix='',className=''}){
  const [ref,inView]=useInView(0.1);
  const count=useCountUp(value,{active:inView});
  const n=parseInt(String(value).replace(/[^0-9]/g,''),10);
  const display=count>=1000?count.toLocaleString():count;
  const suffix2=String(value).replace(/[0-9,]/g,'');
  return <span ref={ref} className={className}>{display}{suffix||suffix2}</span>;
}

function ParticleCanvas({theme}){
  const [reduced]=useReducedData();
  const canvasRef=useRef(null);
  useEffect(()=>{
    if(reduced)return;
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const isDark=theme!=='light';
    const c=isDark?[214,168,77]:[180,122,38];
    const resize=()=>{canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight;};
    resize();
    window.addEventListener('resize',resize);
    const N=55;
    let w=canvas.width,h=canvas.height;
    const pts=Array.from({length:N},()=>({
      x:Math.random()*w,y:Math.random()*h,
      vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,
      r:Math.random()*1.6+.5,
    }));
    let animId;
    const draw=()=>{
      w=canvas.width;h=canvas.height;
      ctx.clearRect(0,0,w,h);
      for(const p of pts){
        p.x=(p.x+p.vx+w)%w;
        p.y=(p.y+p.vy+h)%h;
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(${c},0.28)`;
        ctx.fill();
      }
      for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<115){
          ctx.beginPath();
          ctx.moveTo(pts[i].x,pts[i].y);
          ctx.lineTo(pts[j].x,pts[j].y);
          ctx.strokeStyle=`rgba(${c},${0.11*(1-d/115)})`;
          ctx.lineWidth=.8;
          ctx.stroke();
        }
      }
      animId=requestAnimationFrame(draw);
    };
    draw();
    return()=>{cancelAnimationFrame(animId);window.removeEventListener('resize',resize);};
  },[theme,reduced]);
  if(reduced)return null;
  return <canvas ref={canvasRef} className="particle-bg-canvas" aria-hidden="true"/>;
}

function TiltCard({children,className='',onClick,style={}}){
  const ref=useRef(null);
  const handleMove=useCallback(e=>{
    const el=ref.current;if(!el)return;
    const r=el.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5;
    const y=(e.clientY-r.top)/r.height-.5;
    el.style.transform=`perspective(700px) rotateY(${x*9}deg) rotateX(${-y*9}deg) scale(1.025) translateZ(8px)`;
    const sx=-x*22, sy=y*16+18;
    el.style.boxShadow=`${sx}px ${sy}px 42px rgba(0,0,0,0.18), ${sx*0.4}px ${sy*0.3+4}px 14px rgba(0,0,0,0.10)`;
    el.style.transition='transform .08s ease, box-shadow .08s ease';
  },[]);
  const handleLeave=useCallback(()=>{
    const el=ref.current;if(!el)return;
    el.style.transform='perspective(700px) rotateY(0deg) rotateX(0deg) scale(1) translateZ(0)';
    el.style.boxShadow='';
    el.style.transition='transform .45s cubic-bezier(.2,.8,.2,1), box-shadow .45s cubic-bezier(.2,.8,.2,1)';
  },[]);
  return(
    <button type="button" ref={ref} className={`tilt-card ${className}`} onClick={onClick} onMouseMove={handleMove} onMouseLeave={handleLeave} style={style}>
      {children}
    </button>
  );
}

/* ── Reduced-data setting (global, localStorage) ───────────────── */
function useReducedData(){
  const [reduced,setReduced]=useState(()=>{try{return localStorage.getItem('ippc_reduced_data')==='1'}catch{return false}});
  useEffect(()=>{
    const sync=()=>{try{setReduced(localStorage.getItem('ippc_reduced_data')==='1')}catch{}};
    window.addEventListener('storage',sync);
    window.addEventListener('ippc-reduced-data-change',sync);
    return()=>{window.removeEventListener('storage',sync);window.removeEventListener('ippc-reduced-data-change',sync);};
  },[]);
  const toggle=useCallback(()=>{
    setReduced(prev=>{
      const next=!prev;
      try{localStorage.setItem('ippc_reduced_data',next?'1':'0');}catch{}
      window.dispatchEvent(new Event('ippc-reduced-data-change'));
      return next;
    });
  },[]);
  return [reduced,toggle];
}

/* ── Back-to-top floating button ─────────────────────────────────── */
function BackToTop(){
  const [show,setShow]=useState(false);
  useEffect(()=>{
    const onScroll=()=>setShow(window.scrollY>420);
    window.addEventListener('scroll',onScroll,{passive:true});
    onScroll();
    return()=>window.removeEventListener('scroll',onScroll);
  },[]);
  const scrollUp=()=>window.scrollTo({top:0,behavior:'smooth'});
  return(
    <button type="button" className={`back-to-top ${show?'btt-visible':''}`} onClick={scrollUp} aria-label="Back to top" title="Back to top">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

/* ── Display toggle (reduced-data) ───────────────────────────────── */
function DisplayToggle(){
  const [reduced,toggle]=useReducedData();
  return(
    <button type="button" className={`display-toggle ${reduced?'dt-reduced':''}`} onClick={toggle}
      aria-label={reduced?'Restore visual effects':'Reduce visual effects'} aria-pressed={reduced}
      title={reduced?'Effects: minimal — click to restore':'Effects: full — click to reduce'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        {reduced
          ? <><path d="M1 12s4-8 11-8 11 8 11 8" strokeLinecap="round"/><path d="M1 12s4 8 11 8 11-8 11-8" strokeLinecap="round"/><line x1="3" y1="3" x2="21" y2="21" strokeLinecap="round"/></>
          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>}
      </svg>
    </button>
  );
}

/* ── Floating "Press ?" hint button ─────────────────────────────── */
function ShortcutHintButton(){
  const fire=()=>{
    const ev=new KeyboardEvent('keydown',{key:'?',shiftKey:true,bubbles:true,cancelable:true});
    window.dispatchEvent(ev);
  };
  return(
    <button type="button" className="kbd-hint-btn" onClick={fire} aria-label="Show keyboard shortcuts" title="Show keyboard shortcuts (or press ?)">
      <kbd className="kbd-hint-key">?</kbd>
    </button>
  );
}

/* ── Skip-to-content link (does NOT change URL hash) ─────────────── */
function SkipLink({target='main-content'}){
  const handleClick=(e)=>{
    e.preventDefault();
    const el=document.getElementById(target);
    if(el){el.setAttribute('tabindex','-1');el.focus({preventScroll:false});el.scrollIntoView({behavior:'smooth',block:'start'});}
  };
  return <a href={`#${target}`} className="skip-to-content" onClick={handleClick}>Skip to content</a>;
}

/* ── Scroll-position hook (for shrinking topbar) ─────────────────── */
function useScrolled(threshold=120){
  const [scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    const onScroll=()=>setScrolled(window.scrollY>threshold);
    onScroll();
    window.addEventListener('scroll',onScroll,{passive:true});
    return()=>window.removeEventListener('scroll',onScroll);
  },[threshold]);
  return scrolled;
}

/* ── Mouse parallax wrapper (subtle 4-8px drift) ─────────────────── */
function ParallaxLayer({children,intensity=8,className=''}){
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;
    if(!el)return;
    let raf=null;
    const onMove=(e)=>{
      if(raf)return;
      raf=requestAnimationFrame(()=>{
        const dx=(e.clientX/window.innerWidth-0.5)*intensity;
        const dy=(e.clientY/window.innerHeight-0.5)*intensity;
        el.style.transform=`translate3d(${dx}px,${dy}px,0)`;
        raf=null;
      });
    };
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!reduce)window.addEventListener('mousemove',onMove,{passive:true});
    return()=>{window.removeEventListener('mousemove',onMove);if(raf)cancelAnimationFrame(raf);};
  },[intensity]);
  return <div ref={ref} className={`parallax-layer ${className}`} style={{transition:'transform .35s cubic-bezier(.2,.8,.2,1)'}}>{children}</div>;
}

/* ── Section-nav rail (sticky right rail) ────────────────────────── */
function SectionNavRail({sections}){
  const [active,setActive]=useState(sections[0]?.id||'');
  useEffect(()=>{
    if(!sections.length)return;
    const onScroll=()=>{
      const y=window.scrollY+window.innerHeight*0.3;
      let current=sections[0].id;
      for(const s of sections){
        const el=document.getElementById(s.id);
        if(el&&el.offsetTop<=y)current=s.id;
      }
      setActive(current);
    };
    window.addEventListener('scroll',onScroll,{passive:true});
    onScroll();
    return()=>window.removeEventListener('scroll',onScroll);
  },[sections]);
  return(
    <nav className="rp-rail" aria-label="Section navigation">
      <ul>
        {sections.map(s=>(
          <li key={s.id}>
            <a href={`#${s.id}`} className={`rp-rail-dot ${active===s.id?'rp-rail-active':''}`} aria-current={active===s.id?'true':undefined}
              onClick={(e)=>{e.preventDefault();const el=document.getElementById(s.id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}}>
              <span className="rp-rail-tick" aria-hidden="true"/>
              <span className="rp-rail-label">{s.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Keyboard shortcuts modal (press ?) ─────────────────────────── */
function KeyboardHelp({onNav}){
  const [open,setOpen]=useState(false);
  const onNavRef=useRef(onNav);
  const openRef=useRef(open);
  const gKeyRef=useRef({key:null,timer:null});
  useEffect(()=>{onNavRef.current=onNav;},[onNav]);
  useEffect(()=>{openRef.current=open;},[open]);
  useEffect(()=>{
    const onKey=(e)=>{
      const tag=e.target?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||e.target?.isContentEditable)return;
      const k=(typeof e.key==='string'&&e.key.length===1)?e.key.toLowerCase():e.key;
      if(k==='Escape'||k==='escape'){setOpen(false);return;}
      if(k==='?'||(e.shiftKey&&k==='/')){e.preventDefault();setOpen(o=>!o);return;}
      if(openRef.current)return;
      if(k==='g'){
        gKeyRef.current.key='g';
        if(gKeyRef.current.timer)clearTimeout(gKeyRef.current.timer);
        gKeyRef.current.timer=setTimeout(()=>{gKeyRef.current.key=null;},1500);
        return;
      }
      if(gKeyRef.current.key==='g'){
        const map={h:'landing',n:'notes',m:'mock',a:'report',f:'flashcards',p:'printable',c:'colophon'};
        if(map[k]){e.preventDefault();onNavRef.current?.(map[k]);}
        gKeyRef.current.key=null;
        if(gKeyRef.current.timer){clearTimeout(gKeyRef.current.timer);gKeyRef.current.timer=null;}
        return;
      }
      if(k==='t'){
        const btn=document.querySelector('.curtain-theme-button,.book-theme-toggle');
        if(btn){e.preventDefault();btn.click();}
      }
    };
    // Listen on document with capture: true so the handler fires BEFORE
    // any page-level handler can stopPropagation. Also listen on window as a fallback.
    document.addEventListener('keydown',onKey,true);
    window.addEventListener('keydown',onKey);
    return()=>{
      document.removeEventListener('keydown',onKey,true);
      window.removeEventListener('keydown',onKey);
      if(gKeyRef.current.timer)clearTimeout(gKeyRef.current.timer);
    };
  },[]);
  if(!open)return null;
  const shortcuts=[
    {keys:['?'],desc:'Toggle this shortcuts panel'},
    {keys:['t'],desc:'Toggle light / dark theme'},
    {keys:['g','h'],desc:'Go to Home (frontispiece)'},
    {keys:['g','n'],desc:'Go to Notes (reading room)'},
    {keys:['g','m'],desc:'Go to Mock Test'},
    {keys:['g','f'],desc:'Go to Flashcards'},
    {keys:['g','a'],desc:'Go to Audit Report'},
    {keys:['g','p'],desc:'Go to Printable Notes'},
    {keys:['g','c'],desc:'Go to Colophon (about / project story)'},
    {keys:['Esc'],desc:'Close this panel / dialogs'},
  ];
  return(
    <div className="kbd-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="kbd-title" onClick={()=>setOpen(false)}>
      <div className="kbd-modal" onClick={(e)=>e.stopPropagation()}>
        <div className="kbd-modal-head">
          <span className="kbd-eyebrow">Press <kbd>?</kbd> any time</span>
          <h2 id="kbd-title">Keyboard <em>shortcuts</em></h2>
          <button className="kbd-close" onClick={()=>setOpen(false)} aria-label="Close shortcuts panel">×</button>
        </div>
        <dl className="kbd-list">
          {shortcuts.map((s,i)=>(
            <div key={i} className="kbd-row">
              <dt className="kbd-keys">{s.keys.map((k,j)=>(<React.Fragment key={j}>{j>0&&<span className="kbd-sep">then</span>}<kbd>{k}</kbd></React.Fragment>))}</dt>
              <dd className="kbd-desc">{s.desc}</dd>
            </div>
          ))}
        </dl>
        <div className="kbd-foot">Press <kbd>Esc</kbd> to dismiss.</div>
      </div>
    </div>
  );
}

/* ── Mobile bottom tab bar (visible at <= 760px) ─────────────────── */
function MobileTabBar({current,onNav}){
  const items=[
    {id:'landing',label:'Home',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 11l9-8 9 8M5 10v10h4v-6h6v6h4V10"/></svg>},
    {id:'notes',label:'Notes',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>},
    {id:'mock',label:'Mock',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>},
    {id:'flashcards',label:'Cards',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>},
    {id:'report',label:'Audit',icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>},
  ];
  return(
    <nav className="mobile-tab-bar" aria-label="Primary navigation">
      {items.map(it=>(
        <button key={it.id} type="button" className={`mtb-btn ${current===it.id?'mtb-active':''}`} onClick={()=>onNav?.(it.id)} aria-current={current===it.id?'page':undefined}>
          <span className="mtb-icon">{it.icon}</span>
          <span className="mtb-label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ── Tab cross-fade / page-flip wrapper ──────────────────────────── */
function TabFade({tabKey,children}){
  return <div key={tabKey} className="tab-fade-container">{children}</div>;
}

/* ── Pull-quote callout (editorial blockquote) ───────────────────── */
function PullQuote({children,attribution}){
  return(
    <blockquote className="book-pullquote">
      <span className="pq-rule" aria-hidden="true"/>
      <p>{children}</p>
      {attribution&&<cite>— {attribution}</cite>}
      <span className="pq-rule pq-rule-bottom" aria-hidden="true"/>
    </blockquote>
  );
}

/* ── Donut chart (pure SVG, no deps) ─────────────────────────────────────── */
function DonutChart({data,size=180,thickness=28,label='',sublabel=''}){
  const [ref,inView]=useInView(0.2);
  const r=size/2-thickness/2;
  const circ=2*Math.PI*r;
  let offset=0;
  const slices=data.map(d=>{
    const dash=inView?(d.pct/100)*circ:0;
    const slice={d,dash,offset,r,circ,cx:size/2,cy:size/2,thickness};
    offset+=dash;
    return slice;
  });
  return(
    <div ref={ref} className="donut-wrap" style={{width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={thickness}/>
        {slices.map(({d,dash,offset:off,r:sr,circ:sc,cx,cy,thickness:st})=>(
          <circle key={d.label} cx={cx} cy={cy} r={sr} fill="none"
            stroke={d.color} strokeWidth={st}
            strokeDasharray={`${dash} ${sc-dash}`}
            strokeDashoffset={-off}
            style={{transition:'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1) '+d.delay+'s'}}
          />
        ))}
      </svg>
      <div className="donut-center">
        <span className="donut-label-main">{label}</span>
        <span className="donut-label-sub">{sublabel}</span>
      </div>
    </div>
  );
}

function CombinedLanding({onEnter,theme,toggleTheme}){
  const chapterCards=[
    {id:'notes',roman:'I.',kicker:'Study first',title:'Notes',suffix:'— the reading room',body:'Audited chapter notes, formulas, key dates, Acts, schedules, fines, and exam traps — set in long form, with margins for your own annotation.',stats:[['14','Chapters'],['38','Printable pages'],['v134','Baseline']],enter:'Enter the reading room',icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>},
    {id:'mock',roman:'II.',kicker:'Practise next',title:'Mock Test',suffix:'— the examination hall',body:'Generate timed eighty-question sittings, drill the topics you keep losing, and review structured explanations alongside the source clause.',stats:[['2,000','Questions'],['25','Sets'],['120m','Per sitting']],enter:'Enter the examination hall',icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>},
    {id:'flashcards',roman:'III.',kicker:'Memorise rules',title:'Flashcards',suffix:'— the recall corridor',body:'Direct recall for sections, penalties, PIDM limits, AML and STR rules, and investor categories — tuned to the rhythms of a long study evening.',stats:[[String(FLASHCARD_DATA.length),'Cards'],['9','Decks'],['SR','Spaced']],enter:'Enter the recall corridor',icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 2v6"/><path d="M8 2v6"/><path d="M2 10h20"/></svg>},
  ];
  const referenceCards=[
    {action:()=>onEnter('report'),num:'i.',title:'V153 audit report',body:'Animated quality dashboard — CLO distribution, quality criteria, editorial timeline.',label:'Open'},
    {action:()=>onEnter('printable'),num:'ii.',title:'Printable notes',body:'Black-and-white PDF notes for offline revision and marginalia.',label:'Open'},
    {action:()=>{window.location.href=AUDIT_SITE_PATH},num:'iii.',title:'About / project story',body:'V1 to V153 editorial timeline, cleanup history and deployment baseline.',label:'Open'},
  ];
  const [heroRef,heroInView]=useInView(0.05);
  const scrolled=useScrolled(120);
  const navHandler=(id)=>{if(id==='landing')return; onEnter?.(id);};
  return <div className={`app-shell book-landing theme-${theme} theme-book-${theme==='dark'?'dark':'light'} ${scrolled?'is-scrolled':''}`} style={{position:'relative',overflow:'hidden'}}>
    <ParticleCanvas theme={theme}/>
    {/* Paper grain overlay */}
    <div className="book-page-grain" aria-hidden="true"/>
    {/* Floating ink specks */}
    <div className="book-ink-specks" aria-hidden="true">
      {Array.from({length:18}).map((_,i)=><span key={i} className={`ink-speck speck-${i%5}`} style={{left:`${(i*9+11)%100}%`,top:`${(i*13+5)%100}%`,animationDelay:`${i*0.55}s`,animationDuration:`${15+i%7}s`}}/>)}
    </div>
    {/* Corner ornaments */}
    <svg className="book-corner-ornament corner-tl" viewBox="0 0 80 80" aria-hidden="true">
      <path d="M2 2 L40 2 M2 2 L2 40 M2 2 Q20 8 30 20 Q38 30 40 50" fill="none" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4"/>
      <circle cx="2" cy="2" r="2" fill="currentColor" opacity="0.4"/>
    </svg>
    <svg className="book-corner-ornament corner-tr" viewBox="0 0 80 80" aria-hidden="true">
      <path d="M78 2 L40 2 M78 2 L78 40 M78 2 Q60 8 50 20 Q42 30 40 50" fill="none" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4"/>
      <circle cx="78" cy="2" r="2" fill="currentColor" opacity="0.4"/>
    </svg>
    <header className="book-topbar" aria-label="IPPC Study Suite navigation">
      <button type="button" className="book-brand" onClick={()=>onEnter('landing')}>
        <span className="book-mark">IPPC <span>&amp;</span> Co.</span>
        <span className="book-vol">Vol. V153 · Study Suite</span>
      </button>
      <nav className="book-nav" aria-label="Main menu">
        <button type="button" className="current" onClick={()=>onEnter('landing')}>Frontispiece</button>
        <button type="button" onClick={()=>onEnter('notes')}>Notes</button>
        <button type="button" onClick={()=>onEnter('mock')}>Mock Test</button>
        <button type="button" onClick={()=>onEnter('flashcards')}>Flashcards</button>
        <button type="button" onClick={()=>onEnter('report')}>Audit</button>
        <button type="button" onClick={()=>{window.location.href=AUDIT_SITE_PATH}}>Colophon</button>
      </nav>
      <div className="book-top-right">
        <BookThemeToggle theme={theme} toggleTheme={toggleTheme}/>
        <div className="book-folio">Fol. 001</div>
      </div>
    </header>

    <main id="main-content" className="book-page" ref={heroRef}>
      {/* ── Decorative floating shapes ─────────────────────────────── */}
      <div className="landing-deco-orbs" aria-hidden="true">
        <div className="deco-orb deco-orb-1"/>
        <div className="deco-orb deco-orb-2"/>
        <div className="deco-orb deco-orb-3"/>
      </div>

      <section className="book-frontispiece">
        <div className="book-left-col">
          <div className="book-colophon reveal d1">An exam-prep companion · Edition V153</div>
          <h1 className="book-title reveal d2">Study <span className="em anim-underline">clearly.</span><br/>Practise<br/><span className="em anim-underline">deliberately.</span></h1>
          <p className="book-subtitle reveal d3">A quiet desk for IPPC candidates — notes to the left, mock papers to the right.</p>
          <p className="book-lede reveal d4">A focused exam-prep suite assembled around audited chapter notes, two thousand mock questions, a flashcard ladder for direct recall, and the V153 quality trail — bound together as one deployable companion. Read in the morning, drill in the evening, and let the margins fill themselves.</p>
          <div className="book-cta-row reveal d5">
            <button type="button" className="book-btn book-btn-primary hero-primary-btn" onClick={()=>onEnter('notes')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>Open the notes</span><span className="arrow">→</span>
            </button>
            <button type="button" className="book-btn book-btn-secondary" onClick={()=>onEnter('mock')}><span>Begin a mock paper</span><span className="arrow">›</span></button>
          </div>
          {/* inline mini-stats bar */}
          <div className="hero-mini-stats reveal d5">
            <div className="hms-item has-tooltip" data-tooltip="2,000 audited MCQs across 25 sets — 20 core sets plus 5 advanced (Hard) sets." tabIndex={0}><AnimatedCount value={2000} className="hms-n"/><span className="hms-l">questions</span></div>
            <div className="hms-div"/>
            <div className="hms-item has-tooltip" data-tooltip="25 themed sets of 80 questions each — covering all three CLOs in topic-balanced proportions." tabIndex={0}><AnimatedCount value={25} className="hms-n"/><span className="hms-l">sets</span></div>
            <div className="hms-div"/>
            <div className="hms-item has-tooltip" data-tooltip={`${FLASHCARD_DATA.length} flashcards for direct recall — Acts, sections, fines, PIDM limits, AML and STR rules.`} tabIndex={0}><AnimatedCount value={FLASHCARD_DATA.length} className="hms-n"/><span className="hms-l">flashcards</span></div>
            <div className="hms-div"/>
            <div className="hms-item has-tooltip" data-tooltip="V153 — the current edition (May 2026). 153 versions of editorial refinement since V1." tabIndex={0}><span className="hms-n">V153</span><span className="hms-l">edition</span></div>
          </div>
        </div>
        <aside className="book-right-col">
          {/* Animated seal */}
          <div className="book-seal reveal d3 float-seal" aria-label="V153 interface edition">
            <span className="v">V153</span>
            <span className="lab"><span>Interface</span><span>Edition</span></span>
            <span className="book-seal-ring" aria-hidden="true">
              <svg viewBox="0 0 150 150" width="150" height="150">
                <defs><path id="bookSealPath" d="M 75,75 m -65,0 a 65,65 0 1,1 130,0 a 65,65 0 1,1 -130,0"/></defs>
                <text><textPath href="#bookSealPath" startOffset="0">IPPC · STUDY SUITE · VOLUME ONE HUNDRED &amp; FIFTY-THREE · FULL UI REFRESH · </textPath></text>
              </svg>
            </span>
          </div>
          {/* Animated figure grid */}
          <div className="book-figures reveal d4">
            <div className="book-fig animated-fig"><span className="num"><AnimatedCount value={2000}/>qs</span><span className="lab">Mock Bank</span><span className="desc">across 25 sets, with Hard Sets I–V</span></div>
            <div className="book-fig animated-fig"><span className="num"><AnimatedCount value={FLASHCARD_DATA.length}/></span><span className="lab">Flashcards</span><span className="desc">for legal anchors and section recall</span></div>
            <div className="book-fig animated-fig"><span className="num">80</span><span className="lab">Per Paper</span><span className="desc">timed, IPPC-aligned MCQs</span></div>
            <div className="book-fig animated-fig"><span className="num">3<span className="unit">clo</span></span><span className="lab">Blueprint</span><span className="desc">12 / 36 / 32 generated-paper split</span></div>
          </div>
        </aside>
      </section>

      <div className="book-ornament" aria-hidden="true"><span className="line"/><span className="glyph">·  ❦  ·</span><span className="line"/></div>

      <div className="book-section-head">
        <h2>Three rooms, <span className="em">one library.</span></h2>
        <span className="meta">Part I · pp. 12–214</span>
      </div>

      {/* ── 3-D Tilt Chapter Cards ──────────────────────────────────── */}
      <section className="book-chapters animated-chapters" aria-label="Main study rooms">
        {chapterCards.map((card,i)=>(
          <TiltCard key={card.id} className="book-chapter anim-chapter" onClick={()=>onEnter(card.id)} style={{animationDelay:`${0.1+i*0.14}s`}}>
            <div className="chapter-card-glow" aria-hidden="true"/>
            <div className="chapter-card-icon">{card.icon}</div>
            <span className="roman">{card.roman}</span>
            <span className="kicker">{card.kicker}</span>
            <h3>{card.title}<span className="it">{card.suffix}</span></h3>
            <p className="body">{card.body}</p>
            <div className="stats">{card.stats.map(([v,l])=><div className="pair" key={l}><span className="val">{v}</span><span className="lbl">{l}</span></div>)}</div>
            <span className="enter">{card.enter} <span className="arrow">→</span></span>
          </TiltCard>
        ))}
      </section>

      {/* ── Animated stats strip ────────────────────────────────────── */}
      <section className="book-stats-strip animated-stats-strip">
        <p className="book-stats-intro">A running tally <span className="em">of what is inside</span> — the volume's measure, in figures.</p>
        <div className="book-stat-block has-tooltip" data-tooltip="2,000 audited multiple-choice questions, every one with a verified answer key and full structured explanation." tabIndex={0}><div className="num"><AnimatedCount value={2000}/></div><div className="lab">Mock questions</div><div className="note">audited and explained</div></div>
        <div className="book-stat-block has-tooltip" data-tooltip={`${FLASHCARD_DATA.length} flashcards across nine decks for legal-anchor and section recall — built for spaced repetition.`} tabIndex={0}><div className="num amber"><AnimatedCount value={FLASHCARD_DATA.length}/></div><div className="lab">Flashcards</div><div className="note">section &amp; rule recall</div></div>
        <div className="book-stat-block has-tooltip" data-tooltip="25 question sets — 20 core sets plus 5 advanced (Hard) sets focused on trap scenarios and statement-combination items." tabIndex={0}><div className="num"><AnimatedCount value={25}/></div><div className="lab">Question sets</div><div className="note">including five hard sets</div></div>
        <div className="book-stat-block has-tooltip" data-tooltip="38 printable A4 pages of audited notes — black-and-white, designed for offline revision with marginalia space." tabIndex={0}><div className="num"><AnimatedCount value={38}/></div><div className="lab">Printable pages</div><div className="note">offline revision ready</div></div>
      </section>

      {/* ── Feature highlights ─────────────────────────────────────── */}
      <section className="landing-features-row">
        {[
          {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,title:'Audit-verified',body:'Every question checked against the official IPPC Study Text and BNM/SC guidelines.'},
          {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,title:'Timed sittings',body:'120-minute lock with CLO-balanced generation — just like the real examination hall.'},
          {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,title:'Progress tracked',body:'Attempt history, wrong-question drilling, and confidence labels — all persisted locally.'},
          {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,title:'Full explanations',body:'Why correct, why wrong (per distractor), worked calculations — every single question.'},
        ].map((f,i)=>(
          <div key={f.title} className="lf-card" style={{animationDelay:`${i*0.1}s`}}>
            <div className="lf-icon">{f.icon}</div>
            <div className="lf-title">{f.title}</div>
            <div className="lf-body">{f.body}</div>
          </div>
        ))}
      </section>

      <section className="book-appendix">
        <div className="title-col"><h3>Reports, printable<br/>notes, <span className="em">the project story.</span></h3><p>Materials for the desk drawer — quality trail, offline pages, and the editorial history of the volume.</p></div>
        <div className="book-appendix-list">
          {referenceCards.map(card=><button type="button" key={card.title} className="book-ap-row" onClick={card.action}>
            <span className="book-ap-num">{card.num}</span>
            <span className="book-ap-body"><span className="name">{card.title}</span><span className="desc">{card.body}</span></span>
            <span className="book-ap-action">{card.label} <span className="arrow">→</span></span>
          </button>)}
        </div>
      </section>

      <footer className="book-footer">
        <span>© MMXXVI · IPPC Study Suite</span>
        <span className="colophon-line">Set in Cormorant Garamond &amp; EB Garamond. Bound for V153.</span>
        <span>Fol. 001 / 009</span>
      </footer>
    </main>
    <div className="book-candle" aria-hidden="true" />
  </div>
}

/* ── ReportPortal sub-components (hooks at top-level) ─────────────── */
function RpMetricCard({m,i}){
  const [ref,inView]=useInView(0.1);
  const count=useCountUp(m.value,{active:inView,duration:1400});
  return(
    <div ref={ref} className="rp-metric-card has-tooltip" data-tooltip={m.detail||''}
      style={{animationDelay:`${i*0.1}s`,borderColor:m.color+'33'}}
      tabIndex={0} role="group" aria-label={`${m.label}: ${m.value}${m.suf||''}. ${m.detail||m.sub}`}>
      <span className="rp-mc-accent" aria-hidden="true" style={{background:m.color}}/>
      <div className="rp-mc-icon" style={{color:m.color,background:m.color+'18'}}>{m.icon}</div>
      <div className="rp-mc-value" style={{color:m.color}}>{count.toLocaleString()}{m.suf||''}</div>
      <div className="rp-mc-label">{m.label}</div>
      <div className="rp-mc-sub">{m.sub}</div>
    </div>
  );
}
function RpCloRow({d,i}){
  const [ref,inView]=useInView(0.2);
  return(
    <div ref={ref} className="rp-clo-row" style={{animationDelay:`${i*0.15}s`}}>
      <div className="rp-clo-meta">
        <span className="rp-clo-num" style={{color:d.color}}>CLO {d.clo}</span>
        <span className="rp-clo-name">{d.label}</span>
        <span className="rp-clo-count">{d.count}Q</span>
      </div>
      <div className="rp-clo-track">
        <div className="rp-clo-fill" style={{width:inView?`${d.pct}%`:0,background:d.color}}/>
        <span className="rp-clo-pct">{d.pct}%</span>
      </div>
      <div className="rp-clo-topics">
        {d.topics.slice(0,4).map(t=><span key={t} className="rp-topic-chip" style={{borderColor:d.color+'44',color:d.color}}>{t}</span>)}
        {d.topics.length>4&&<span className="rp-topic-more">+{d.topics.length-4} more</span>}
      </div>
    </div>
  );
}
function RpStyleLegRow({s,i}){
  const [ref,inView]=useInView(0.2);
  const pct=useCountUp(s.pct,{active:inView,duration:1000});
  const cnt=useCountUp(s.count,{active:inView,duration:1200});
  return(
    <div ref={ref} className="rp-sleg-row" style={{animationDelay:`${i*0.1}s`}}>
      <div className="rp-sleg-dot" style={{background:s.color}}/>
      <div className="rp-sleg-label">{s.label}</div>
      <div className="rp-sleg-bar-track"><div className="rp-sleg-bar" style={{width:inView?`${s.pct}%`:0,background:s.color}}/></div>
      <div className="rp-sleg-stats"><span>{cnt.toLocaleString()}</span><span className="rp-sleg-pct">{pct}%</span></div>
    </div>
  );
}
function RpDiffCard({d,i}){
  const [ref,inView]=useInView(0.2);
  const cnt=useCountUp(d.count,{active:inView,duration:1300});
  const circ=2*Math.PI*36;
  const dash=inView?(d.pct/100)*circ:0;
  return(
    <div ref={ref} className="rp-diff-card" style={{animationDelay:`${i*0.14}s`}}>
      <svg width="96" height="96" viewBox="0 0 96 96" className="rp-diff-ring">
        <circle cx="48" cy="48" r="36" fill="none" stroke={`${d.color}22`} strokeWidth="10"/>
        <circle cx="48" cy="48" r="36" fill="none" stroke={d.color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ*0.25}
          style={{transition:'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1) .3s',transformOrigin:'center',transform:'rotate(-90deg)'}}
        />
        <text x="48" y="52" textAnchor="middle" style={{fontSize:14,fontWeight:700,fill:d.color,fontFamily:'Cormorant Garamond,serif'}}>{d.pct}%</text>
      </svg>
      <div className="rp-diff-label" style={{color:d.color}}>{d.label}</div>
      <div className="rp-diff-count">{cnt.toLocaleString()} questions</div>
    </div>
  );
}
function RpQcCard({c,i}){
  const [ref,inView]=useInView(0.15);
  const pct=useCountUp(c.pct,{active:inView,duration:1000});
  return(
    <div ref={ref} className="rp-qc-card" style={{animationDelay:`${i*0.1}s`}}>
      <div className="rp-qc-head">
        <span className="rp-qc-title">{c.title}</span>
        <span className="rp-qc-score" style={{color:c.color}}>{pct}%</span>
      </div>
      <div className="rp-qc-track"><div className="rp-qc-fill" style={{width:inView?`${c.pct}%`:0,background:c.color}}/></div>
      <p className="rp-qc-desc">{c.desc}</p>
    </div>
  );
}

function ReportPortal({onBack,onMock,onNotes,theme,toggleTheme}){
  // Persist tab choice across reloads
  const [tab,setTab]=useState(()=>{try{return localStorage.getItem('ippc_audit_tab')||'overview'}catch{return 'overview'}});
  useEffect(()=>{try{localStorage.setItem('ippc_audit_tab',tab)}catch{}},[tab]);
  const [pdfOpen,setPdfOpen]=useState(false);
  const [expandedTl,setExpandedTl]=useState(null);
  const scrolled=useScrolled(120);
  const navHandler=(id)=>{
    if(id==='landing')onBack?.();
    else if(id==='notes')onNotes?.();
    else if(id==='mock')onMock?.();
    else window.location.hash=id;
  };

  const cloData=[
    {clo:1,label:'Financial System',count:12,pct:15,color:'#d6a84d',topics:['Financial Markets','Market Structure','Market Participants','Regulators','Islamic Banking','BNM']},
    {clo:2,label:'Regulations & Conduct',count:36,pct:45,color:'#4cc38a',topics:['Guidelines','Product Disclosure','KYC','CMSA','FSA','FEA Rules','PIDM','AML','Sophisticated Investors','Qualifications','Fit & Proper','Conduct']},
    {clo:3,label:'Debt & Structured',count:32,pct:40,color:'#9f7aea',topics:['Debt Securities','Bonds','Derivatives','Structured Products','Portfolio']},
  ];
  const styleData=[
    {label:'Recall',count:760,pct:38,color:'#4fc3f7',delay:0.1},
    {label:'Scenario-based',count:680,pct:34,color:'#d6a84d',delay:0.25},
    {label:'Statement-combination',count:380,pct:19,color:'#9f7aea',delay:0.4},
    {label:'Calculation',count:180,pct:9,color:'#f06f72',delay:0.55},
  ];
  const diffData=[
    {label:'Easy',count:640,pct:32,color:'#4cc38a'},
    {label:'Medium',count:900,pct:45,color:'#d6a84d'},
    {label:'Hard',count:460,pct:23,color:'#f06f72'},
  ];
  const qualityCriteria=[
    {title:'Answer accuracy',pct:100,color:'#4cc38a',desc:'Every correct answer verified against the IPPC Study Text 3rd Ed. and BNM/SC guidelines.'},
    {title:'Explanation completeness',pct:100,color:'#4cc38a',desc:'Each question includes Why correct, Why wrong per distractor, and worked calculation where applicable.'},
    {title:'CLO alignment',pct:98,color:'#4cc38a',desc:'Questions mapped to CLO 1, 2, or 3 and verified against the official 12/36/32 blueprint.'},
    {title:'Distractor quality',pct:94,color:'#d6a84d',desc:'All incorrect options are plausible, rooted in common misconceptions — not arbitrary.'},
    {title:'Language clarity',pct:97,color:'#4cc38a',desc:'All question stems reviewed for ambiguity, passive voice, and double negatives.'},
    {title:'Calculation accuracy',pct:100,color:'#4cc38a',desc:'All numerical questions include a Formula reference and Worked calculation section.'},
  ];
  const timeline=[
    {v:'V1–V50',date:'Early 2025',title:'Initial generation',desc:'First pass of 1,000 questions across core CLO topics with basic answer keys and single-sentence explanations.'},
    {v:'V51–V99',date:'Mid 2025',title:'Expansion & hard sets',desc:'Added 1,000 more questions, introduced Hard Sets 1–5 with trap scenarios and multi-statement items.'},
    {v:'V100–V130',date:'Late 2025',title:'Full editorial audit',desc:'Systematic review of all 2,000 questions for accuracy, clarity, and IPPC Study Text alignment. Explanations restructured.'},
    {v:'V131–V145',date:'Early 2026',title:'Quality baseline V134',desc:'V134 audit report published. Explanation standardisation: Why correct, Why wrong, Worked calculation sections normalised.'},
    {v:'V146–V152',date:'Apr 2026',title:'UI alignment pass',desc:'Book-bound interface, curtain theme toggle, topic balancing engine, CLO weighting fixes, and flashcard deck expansion.'},
    {v:'V153',date:'May 2026',title:'Current edition',desc:'Interactive audit dashboard, animated report page, editorial timeline evidence, and final printable notes alignment.'},
  ];
  const metrics=[
    {label:'Total Questions',value:2000,icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,sub:'Across 25 sets',color:'#d6a84d',detail:'2,000 multiple-choice questions distributed across 25 sets — 20 core sets plus 5 advanced (Hard) sets. Every question reviewed for accuracy against the IPPC Study Text 3rd Edition.'},
    {label:'Audited',value:100,suf:'%',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,sub:'V134 baseline',color:'#4cc38a',detail:'All 2,000 questions verified against the V134 quality baseline — answer keys, distractor plausibility, CLO mapping, and IPPC reference clauses all checked.'},
    {label:'CLO Accuracy',value:98,suf:'%',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,sub:'Blueprint adherence',color:'#9f7aea',detail:'98% of questions correctly map to their stated CLO (1, 2, or 3). The generated mock paper enforces the official 12 / 36 / 32 blueprint split exactly.'},
    {label:'Explained',value:100,suf:'%',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,sub:'Every question',color:'#4fc3f7',detail:'Every question includes a structured explanation: Why correct, Why each distractor is wrong, plus a Worked calculation section for numerical items.'},
  ];

  const TABS=['overview','quality','timeline'];
  const railSections=tab==='overview'
    ? [{id:'rp-sec-clo',label:'CLO Distribution'},{id:'rp-sec-style',label:'Question Style'},{id:'rp-sec-pdf',label:'PDF Report'}]
    : tab==='quality'
    ? [{id:'rp-sec-diff',label:'Difficulty'},{id:'rp-sec-criteria',label:'Quality Criteria'},{id:'rp-sec-pdf',label:'PDF Report'}]
    : [{id:'rp-sec-timeline',label:'Editorial Timeline'},{id:'rp-sec-pdf',label:'PDF Report'}];

  return <div className={`app-shell report-portal-shell theme-${theme} theme-book-${theme==='dark'?'dark':'light'} ${scrolled?'is-scrolled':''}`}>
    <SectionNavRail sections={railSections}/>
    <ParticleCanvas theme={theme}/>
    {/* Decorative ambient orbs */}
    <div className="landing-deco-orbs" aria-hidden="true">
      <div className="deco-orb deco-orb-1"/>
      <div className="deco-orb deco-orb-2"/>
      <div className="deco-orb deco-orb-3"/>
    </div>
    {/* Paper grain texture */}
    <div className="book-page-grain" aria-hidden="true"/>
    {/* Floating ink specks */}
    <div className="book-ink-specks" aria-hidden="true">
      {Array.from({length:14}).map((_,i)=><span key={i} className={`ink-speck speck-${i%5}`} style={{left:`${(i*7+13)%100}%`,top:`${(i*11+7)%100}%`,animationDelay:`${i*0.7}s`,animationDuration:`${14+i%6}s`}}/>)}
    </div>
    {/* Corner ornament */}
    <svg className="book-corner-ornament corner-tl" viewBox="0 0 80 80" aria-hidden="true">
      <path d="M2 2 L40 2 M2 2 L2 40 M2 2 Q20 8 30 20 Q38 30 40 50" fill="none" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4"/>
      <circle cx="2" cy="2" r="2" fill="currentColor" opacity="0.4"/>
    </svg>
    <svg className="book-corner-ornament corner-tr" viewBox="0 0 80 80" aria-hidden="true">
      <path d="M78 2 L40 2 M78 2 L78 40 M78 2 Q60 8 50 20 Q42 30 40 50" fill="none" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4"/>
      <circle cx="78" cy="2" r="2" fill="currentColor" opacity="0.4"/>
    </svg>
    {/* ── Header ──────────────────────────────────────────────────── */}
    <header className="rp-topbar">
      <button className="rp-brand" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        <span className="rp-brand-mark">IPPC</span>
        <span className="rp-brand-sub">Audit Report</span>
      </button>
      <nav className="rp-tabs" role="tablist">
        {TABS.map(t=><button key={t} role="tab" aria-selected={tab===t} className={`rp-tab ${tab===t?'rp-tab-active':''}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </nav>
      <div className="rp-topbar-right">
        <button className="secondary-btn" onClick={onNotes} style={{fontSize:13}}>Notes</button>
        <button className="secondary-btn" onClick={onMock} style={{fontSize:13}}>Mock Test</button>
        <CurtainThemeButton theme={theme} onThemeChange={toggleTheme}/>
      </div>
    </header>

    <main id="main-content" className="rp-main">
      {/* ── Animated hero metrics ───────────────────────────────────── */}
      <section className="rp-hero">
        <div className="rp-hero-eyebrow">Question Bank Quality Report — V153 · May 2026</div>
        <h1 className="rp-hero-title">A <em>complete audit</em> of the IPPC<br/>question bank.</h1>
        <p className="rp-hero-sub">Every question reviewed, explained, CLO-aligned, and tracked through the full editorial timeline.</p>
        <div className="rp-metrics-row">
          {metrics.map((m,i)=><RpMetricCard key={m.label} m={m} i={i}/>)}
        </div>
      </section>

      {/* ── Tab: Overview ────────────────────────────────────────────── */}
      {tab==='overview'&&<TabFade tabKey="overview">
        <PullQuote attribution="Editorial brief, V153">
          The examination paper must reflect the proportions the candidate will actually face — twelve from the financial system, thirty-six from regulations and conduct, thirty-two from debt and structured products.
        </PullQuote>
        {/* CLO bar chart */}
        <section id="rp-sec-clo" className="rp-section rp-section-anchor">
          <div className="rp-section-head">
            <h2>CLO Distribution</h2>
            <p className="rp-drop-cap">How the 80-question examination paper is balanced across the three Core Learning Outcomes — twelve, thirty-six, and thirty-two questions respectively.</p>
          </div>
          <div className="rp-clo-chart">
            {cloData.map((d,i)=><RpCloRow key={d.clo} d={d} i={i}/>)}
          </div>
        </section>

        {/* Style donut chart */}
        <section id="rp-sec-style" className="rp-section rp-section-anchor">
          <div className="rp-section-head">
            <h2>Question Style Distribution</h2>
            <p className="rp-drop-cap">Distribution by cognitive engagement type across the full 2,000-question bank — recall, scenario, statement-combination, and calculation.</p>
          </div>
          <div className="rp-style-layout">
            <DonutChart size={190} thickness={30} label="2,000" sublabel="questions" data={styleData}/>
            <div className="rp-style-legend">
              {styleData.map((s,i)=><RpStyleLegRow key={s.label} s={s} i={i}/>)}
            </div>
          </div>
        </section>
      </TabFade>}

      {/* ── Tab: Quality ─────────────────────────────────────────────── */}
      {tab==='quality'&&<TabFade tabKey="quality">
        <PullQuote attribution="V134 audit sign-off">
          Every numerical question carries a verified working calculation. Every distractor is rooted in a real misconception, not assembled at random.
        </PullQuote>
        {/* Difficulty */}
        <section id="rp-sec-diff" className="rp-section rp-section-anchor">
          <div className="rp-section-head">
            <h2>Difficulty Breakdown</h2>
            <p className="rp-drop-cap">Distribution across Easy, Medium, and Hard tiers across the full 2,000-question bank — calibrated so that any topic-balanced mock paper covers all three difficulty levels.</p>
          </div>
          <div className="rp-diff-grid">
            {diffData.map((d,i)=><RpDiffCard key={d.label} d={d} i={i}/>)}
          </div>
        </section>

        {/* Quality criteria */}
        <section id="rp-sec-criteria" className="rp-section rp-section-anchor">
          <div className="rp-section-head">
            <h2>Quality Criteria</h2>
            <p className="rp-drop-cap">Audit standards applied during the V134 editorial review — scores reflect post-audit state, with all answer keys, distractors, and explanations independently verified.</p>
          </div>
          <div className="rp-quality-grid">
            {qualityCriteria.map((c,i)=><RpQcCard key={c.title} c={c} i={i}/>)}
          </div>
        </section>
      </TabFade>}

      {/* ── Tab: Timeline ─────────────────────────────────────────────── */}
      {tab==='timeline'&&<TabFade tabKey="timeline">
        <PullQuote attribution="V153 deployment note">
          One hundred and fifty-three editions of patient revision, sign-off, and re-binding — each version a verifiable step in the audit trail.
        </PullQuote>
      <section id="rp-sec-timeline" className="rp-section rp-section-anchor">
        <div className="rp-section-head">
          <h2>Editorial Timeline</h2>
          <p className="rp-drop-cap">The full progression from V1 to V153 — click any milestone to see detail.</p>
        </div>
        <div className="rp-timeline">
          {timeline.map((t,i)=>(
            <div key={t.v} className={`rp-tl-item ${expandedTl===i?'rp-tl-expanded':''}`} onClick={()=>setExpandedTl(expandedTl===i?null:i)} style={{animationDelay:`${i*0.1}s`}}>
              <div className="rp-tl-spine" aria-hidden="true">
                <div className="rp-tl-dot" style={{background:i===timeline.length-1?'var(--gold)':'var(--book-amber, #d6a84d)'}}/>
                {i<timeline.length-1&&<div className="rp-tl-line"/>}
              </div>
              <div className="rp-tl-content">
                <div className="rp-tl-header">
                  <span className="rp-tl-version">{t.v}</span>
                  <span className="rp-tl-date">{t.date}</span>
                  {i===timeline.length-1&&<span className="rp-tl-badge">Current</span>}
                </div>
                <div className="rp-tl-title">{t.title}</div>
                <div className="rp-tl-desc" style={{maxHeight:expandedTl===i?200:0,overflow:'hidden',transition:'max-height .4s cubic-bezier(.4,0,.2,1)'}}>{t.desc}</div>
                <div className="rp-tl-hint">{expandedTl===i?'▲ Collapse':'▼ Click to expand'}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      </TabFade>}

      {/* ── PDF viewer toggle (all tabs) ────────────────────────────── */}
      <section id="rp-sec-pdf" className="rp-section rp-pdf-section rp-section-anchor">
        <div className="rp-section-head">
          <h2>Full Audit Report PDF</h2>
          <p>The complete V134 audit document — methodology, sample review logs, and quality sign-off.</p>
          <button className="book-btn book-btn-secondary rp-pdf-toggle" onClick={()=>setPdfOpen(v=>!v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {pdfOpen?'Hide':'Open'} PDF report
          </button>
        </div>
        {pdfOpen&&<iframe className="rp-pdf-frame" title="IPPC Audit Report PDF" src="/IPPC_Question_Bank_Audit_Report_V134.pdf#toolbar=0&navpanes=0&scrollbar=1"/>}
      </section>
    </main>
  </div>
}

function PrintableNotesPdfPortal({onBack,onMock,onNotes,theme,toggleTheme}){
  const [settingsOpen,setSettingsOpen]=useState(false);
  // Force body background to match book theme while this portal is mounted
  useEffect(()=>{
    document.body.classList.add('body-book-themed');
    document.documentElement.classList.add('body-book-themed');
    return()=>{
      document.body.classList.remove('body-book-themed');
      document.documentElement.classList.remove('body-book-themed');
    };
  },[]);
  return <div className={`notes-portal-shell book-themed-portal theme-${theme} theme-book-${theme==='dark'?'dark':'light'}`}>
    <header className="portal-topbar">
      <button className="brand-btn" onClick={onBack}>
        <span className="brand-mark">IPPC</span>
        <span className="brand-sub">Printable Study Notes</span>
      </button>
      <div className="portal-topbar-actions">
        <button className="secondary-btn portal-short" onClick={onBack}><span className="wide-label">Study Suite Menu</span><span className="short-label">Menu</span></button>
        <button className="secondary-btn portal-short" onClick={onNotes}><span className="wide-label">Notes Page</span><span className="short-label">Notes</span></button>
        <button className="secondary-btn portal-short" onClick={onMock}><span className="wide-label">Mock Test Page</span><span className="short-label">Test</span></button>
        <a className="primary-btn portal-short portal-download-link" href={PRINTABLE_NOTES_PDF_PATH} download="IPPC_Printable_Study_Notes.pdf"><span className="wide-label">Download PDF</span><span className="short-label">Download</span></a>
        <CurtainThemeButton theme={theme} onThemeChange={toggleTheme} />
      </div>
    </header>
    {settingsOpen&&<div className="settings-overlay notes-settings-shell">
      <button className="settings-backdrop" onClick={()=>setSettingsOpen(false)} aria-label="Close settings"/>
      <aside className="settings-drawer">
        <div className="settings-head">
          <div><span className="eyebrow muted">Settings</span><h3>Printable notes display</h3></div>
          <button className="drawer-close-btn" onClick={()=>setSettingsOpen(false)} aria-label="Close settings">×</button>
        </div>
        <div className="settings-body">
          <div className="settings-row settings-theme-row"><span>Theme</span><CurtainThemeButton theme={theme} onThemeChange={toggleTheme} label /></div>
          <a className="settings-row settings-row-link" href={PRINTABLE_NOTES_PDF_PATH} download="IPPC_Printable_Study_Notes.pdf"><span>Download printable notes</span><strong>PDF</strong></a>
          <button className="settings-row" onClick={()=>setSettingsOpen(false)}><span>Close settings</span><strong>Done</strong></button>
        </div>
      </aside>
    </div>}
    <main className="printable-notes-mobile-viewer" aria-label="Printable Study Notes pages">
      <section className="printable-viewer-intro">
        <div>
          <span className="eyebrow muted">Mobile-friendly viewer</span>
          <h1>Printable Study Notes</h1>
          <p>The notes are rendered as page images below so they open reliably on mobile browsers that do not support embedded PDF viewing.</p>
        </div>
        <a className="secondary-btn printable-open-pdf" href={PRINTABLE_NOTES_PDF_PATH} target="_blank" rel="noreferrer">Open PDF</a>
      </section>
      <section className="printable-page-stack">
        {Array.from({length:PRINTABLE_NOTES_PAGE_COUNT},(_,i)=>{
          const pageNo=i+1;
          const src=`/printable-notes-pages/page-${String(pageNo).padStart(2,'0')}.webp`;
          return <figure className="printable-page-card" key={pageNo}>
            <img src={src} alt={`IPPC Printable Study Notes page ${pageNo}`} loading={pageNo<=2?'eager':'lazy'} />
            <figcaption>Page {pageNo}</figcaption>
          </figure>;
        })}
      </section>
    </main>
  </div>
}

function prepareBookNotesHtml(rawHtml){
  if(typeof window==='undefined' || !rawHtml) return '';
  try{
    const parser=new DOMParser();
    const doc=parser.parseFromString(rawHtml,'text/html');
    const main=doc.querySelector('.layout .main') || doc.querySelector('main.main') || doc.querySelector('main') || doc.body;
    if(!main) return '';

    // Keep the full legacy notes content, but remove executable/UI chrome that clashes
    // with the new book-bound reader. Earlier versions clipped the imported document
    // because tables and grid cards were placed directly into a hidden-overflow shell.
    main.querySelectorAll('script,style,.app-footer,.footer-link-btn,.floating-nav,.mobile-bottom-nav,.mobile-nav-drawer,.notes-toolbar,.top-nav,.tools-panel').forEach(el=>el.remove());
    main.querySelectorAll('[onclick]').forEach(el=>el.removeAttribute('onclick'));
    main.querySelectorAll('button').forEach(btn=>{
      if(btn.classList.contains('footer-link-btn')) btn.remove();
      else btn.setAttribute('type','button');
    });
    main.querySelectorAll('a').forEach(a=>{
      const href=a.getAttribute('href')||'';
      if(href==='#'||href.startsWith('javascript:')) a.removeAttribute('href');
      else if(href.startsWith('#')) a.setAttribute('href', href);
    });
    main.querySelectorAll('table').forEach((table,idx)=>{
      if(table.closest('.book-table-scroll')) return;
      const wrap=doc.createElement('div');
      wrap.className='book-table-scroll';
      wrap.setAttribute('role','region');
      wrap.setAttribute('aria-label',`Scrollable notes table ${idx+1}`);
      table.parentNode.insertBefore(wrap,table);
      wrap.appendChild(table);
    });
    main.querySelectorAll('img,svg,canvas,video,iframe').forEach(el=>{
      el.setAttribute('loading','lazy');
      el.style.maxWidth='100%';
    });
    main.querySelectorAll('.chapter-card,.chapter-body,.section,.section-content,.mini-card,.info-box,.exam-tip,.exam-trap,.formula-box,.trap-box,.key-def').forEach(el=>{
      el.classList.add('book-readable-block');
    });
    return main.innerHTML;
  }catch(err){
    console.warn('Unable to merge notes HTML into book UI',err);
    return '';
  }
}

function NotesPortal({onBack,onMock,theme,toggleTheme}){
  const [notesHtml,setNotesHtml]=useState('');
  const [searchQuery,setSearchQuery]=useState('');
  const [searchStatus,setSearchStatus]=useState('');
  useEffect(()=>{
    let alive=true;
    fetch('/notes/index.html')
      .then(r=>r.text())
      .then(html=>{if(alive) setNotesHtml(prepareBookNotesHtml(html));})
      .catch(()=>{if(alive) setNotesHtml('');});
    return ()=>{alive=false};
  },[]);
  const openNotesFull=()=>window.open('/notes/index.html','_blank');
  const scrollToNoteSection=(id)=>{
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const runSearch=(e)=>{
    e?.preventDefault?.();
    const q=searchQuery.trim().toLowerCase();
    if(!q){setSearchStatus('Type a term to search the notes.');return;}
    const root=document.querySelector('.book-notes-integrated');
    if(!root){setSearchStatus('Notes are still loading.');return;}
    const blocks=[...root.querySelectorAll('.section,.chapter-card,.key-def,.info-box,.exam-tip,.exam-trap,.formula-box,.mini-card')];
    const found=blocks.find(el=>(el.textContent||'').toLowerCase().includes(q));
    if(found){found.scrollIntoView({behavior:'smooth',block:'start'});setSearchStatus(`Found “${searchQuery.trim()}”.`);}
    else setSearchStatus(`No match found for “${searchQuery.trim()}”.`);
  };
  const navGroups=[
    ['Ch 1 · Malaysian Financial System',[['s1-1','1.1 Financial Markets Structure'],['s1-2','1.2 Islamic Banking'],['s1-3','1.3 Market Structure'],['s1-4','1.4 Market Participants'],['s1-5','1.5 Regulatory Authorities']]],
    ['Ch 2 · Regulations & Guidelines',[['s2-1','2.1 Licensed Organisation'],['s2-2','2.2 Licensed Person Duties'],['s2-3','2.3 Investor Categories'],['s2-4','2.4 Deposit Insurance (PIDM)'],['s2-5','2.5 AML/CFT/CPF & TFS']]],
    ['Ch 3 · Debt Securities & Structured Products',[['s3-1','3.1 Debt Securities Overview'],['s3-2','3.2 Bond Types & Features'],['s3-3','3.3 Yield Measures'],['s3-4','3.4 Bond Risks'],['s3-5','3.5 Structured Products'],['s3-6','3.6 Derivatives']]],
  ];
  return <div className={`app-shell book-landing book-module book-notes-page theme-${theme}`}>
    <BookTopbar current="notes" onLanding={onBack} onNotes={()=>{}} onMock={onMock} onFlashcards={()=>{window.location.hash='flashcards'}} onReport={()=>{window.location.hash='report'}} theme={theme} toggleTheme={toggleTheme} folio="Fol. 002" />
    <main className="book-page">
      <BookPageHead eyebrow="Reading room · Vol. V153 · Edition III" title="The" em="reading room" lede="Audited chapter notes — now merged into the book-bound reading interface, with the full legacy content restored and fitted to the new reader." stats={[["14","Chapters"],["38","Printable pages"],["~8h","Reading time"],["V153","Baseline"]]} />
      <div className="notes-shell book-notes-shell book-notes-merged-shell">
        <aside className="reader-side notes-reader-sidebar book-notes-toc">
          <div className="kicker">Reader mode</div>
          <h4>Study Notes</h4>
          <p>Use the contents list to jump through the actual notes. The full legacy notes content is merged below. Tables and long cards now scroll or wrap instead of being clipped.</p>
          <div className="mini-stat"><span className="v">3</span><span className="l">Core chapters</span></div>
          <div className="mini-stat"><span className="v">V153</span><span className="l">Merged UI</span></div>
          <div className="mini-stat"><span className="v">2,000</span><span className="l">Question links</span></div>
          <button className="full-btn" onClick={openNotesFull}>Open legacy full page</button>
          <button className="full-btn ghost" onClick={()=>{window.location.hash='printable'}}>Printable notes</button>
          <div className="book-notes-mini-nav">
            {navGroups.map(([group,items],idx)=><div className="book-note-nav-group" key={group}>
              <button type="button" className="book-note-nav-title" onClick={()=>scrollToNoteSection(idx===0?'ch1':idx===1?'ch2':'ch3')}>{group}</button>
              {items.map(([id,label])=><button type="button" key={id} className="book-note-nav-link" onClick={()=>scrollToNoteSection(id)}>{label}</button>)}
            </div>)}
            <div className="book-note-nav-group quick">
              <button type="button" className="book-note-nav-link" onClick={()=>scrollToNoteSection('formulas')}>📐 Key formulas</button>
              <button type="button" className="book-note-nav-link" onClick={()=>scrollToNoteSection('keyconcepts')}>⭐ Exam key concepts</button>
              <button type="button" className="book-note-nav-link" onClick={()=>scrollToNoteSection('keydates')}>📅 Dates & penalties</button>
            </div>
          </div>
        </aside>
        <section className="notes-main notes-reader-frame-wrap book-notes-document">
          <div className="notes-frame-bar"><span>Merged notes document</span><span>Full notes content, restored to old-version completeness inside the V153 book UI</span></div>
          <div className="notes-hero">
            <div className="breadcrumbs"><span>AICB</span><span>·</span><span>FMAM</span><span>·</span><span>V2025</span><span>·</span><span>3rd Edition</span><span>·</span><span>Audited</span></div>
            <h2>IPPC Study Notes —<br/><span className="em">Comprehensive Reference</span></h2>
            <p className="descrip">Investor Protection Professional Certification — complete notes covering all three chapters with key definitions, exam tips, structured summaries, formulas, penalties, and exam traps.</p>
            <p className="footnote">→ Revision aid aligned to IPPC Study Text, 3rd Edition (V2025). Always rely on the latest official AICB / FMAM materials for exam purposes.</p>
            <div className="pills"><span className="pill ch1"><span className="dot"/>3 Chapters</span><span className="pill ch2"><span className="dot"/>Malaysian Financial System</span><span className="pill"><span className="dot"/>Regulations & Guidelines</span><span className="pill ch3"><span className="dot"/>Debt Securities & Structured Products</span></div>
          </div>
          <div className="study-dash">
            <div className="kicker">Study dashboard</div>
            <h3>Start fast, <span className="em">revise surgically.</span></h3>
            <p>Search the merged notes or jump to high-yield sections without leaving the new UI.</p>
            <form className="book-notes-search" onSubmit={runSearch}>
              <span aria-hidden="true">⌕</span>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search notes: PIDM, Section 92, YTM, PHS, CDD…" />
              <button type="submit">Search</button>
            </form>
            <div className="qbar"><button className="qbtn" onClick={()=>scrollToNoteSection('keyconcepts')}><span className="ic">★</span> Exam traps</button><button className="qbtn" onClick={()=>scrollToNoteSection('keydates')}><span className="ic">☰</span> Dates & fines</button><button className="qbtn" onClick={()=>scrollToNoteSection('formulas')}><span className="ic">∑</span> Formulas</button><button className="qbtn" onClick={()=>scrollToNoteSection('s2-4')}><span className="ic">◉</span> PIDM</button><button className="qbtn active" onClick={openNotesFull}>Legacy page</button></div>
            {searchStatus&&<div className="book-notes-search-status">{searchStatus}</div>}
          </div>
          {notesHtml?<article className="book-notes-integrated" dangerouslySetInnerHTML={{__html:notesHtml}} />:<div className="book-notes-loading"><h3>Opening the reading room…</h3><p>Loading the full audited notes into the V153 reader.</p></div>}
        </section>
      </div>
    </main>
  </div>
}

function FlashcardQuizGame({onBack,onMock,onNotes,onReport,onPrintable,theme,toggleTheme}){
  const [category,setCategory]=useState('All');
  const [mode,setMode]=useState('learn');
  const [deck,setDeck]=useState(()=>shuffle(FLASHCARD_DATA));
  const [idx,setIdx]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [selected,setSelected]=useState(null);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [stats,setStats]=useState(()=>{try{return JSON.parse(localStorage.getItem(FLASHCARD_STORAGE_KEY)||'{}')}catch{return {}}});
  const filtered=useMemo(()=>FLASHCARD_DATA.filter(c=>category==='All'||c.category===category),[category]);
  const knownCount=filtered.filter(c=>stats[c.id]?.known).length;
  const dueCount=filtered.filter(c=>!stats[c.id]?.known).length;
  const current=deck[idx%Math.max(deck.length,1)];
  const progress=deck.length?Math.round(((idx+1)/deck.length)*100):0;
  useEffect(()=>{
    const next=shuffle(FLASHCARD_DATA.filter(c=>category==='All'||c.category===category));
    setDeck(next);setIdx(0);setRevealed(false);setSelected(null);
  },[category]);
  useEffect(()=>{try{localStorage.setItem(FLASHCARD_STORAGE_KEY,JSON.stringify(stats))}catch{}},[stats]);
  const choices=useMemo(()=>{
    if(!current) return [];
    const same=FLASHCARD_DATA.filter(c=>c.id!==current.id&&c.category===current.category).map(c=>c.answer);
    const other=FLASHCARD_DATA.filter(c=>c.id!==current.id).map(c=>c.answer);
    const pool=[...new Set([...same,...other])].filter(x=>x&&x!==current.answer);
    return shuffle([current.answer,...shuffle(pool).slice(0,3)]);
  },[current?.id,mode]);
  function resetDeck(useDue=false){
    const base=FLASHCARD_DATA.filter(c=>(category==='All'||c.category===category)&&(!useDue||!stats[c.id]?.known));
    setDeck(shuffle(base.length?base:filtered));setIdx(0);setRevealed(false);setSelected(null);
  }
  function nextCard(){setIdx(i=>Math.min(i+1,Math.max(deck.length-1,0)));setRevealed(false);setSelected(null)}
  function prevCard(){setIdx(i=>Math.max(i-1,0));setRevealed(false);setSelected(null)}
  function mark(result){
    if(!current)return;
    setStats(s=>({...s,[current.id]:{...(s[current.id]||{}),seen:(s[current.id]?.seen||0)+1,known:result==='known',last:Date.now()}}));
    if(idx>=deck.length-1){setRevealed(true);setSelected(null)}else nextCard();
  }
  function answer(choice){
    if(!current||selected!=null)return;
    setSelected(choice);
    const ok=choice===current.answer;
    setStats(s=>({...s,[current.id]:{...(s[current.id]||{}),seen:(s[current.id]?.seen||0)+1,known:ok,last:Date.now()}}));
  }
  const grouped=useMemo(()=>{
    const out={};FLASHCARD_DATA.forEach(c=>{(out[c.category] ||= []).push(c)});return out;
  },[]);
  return <div className={`app-shell book-landing book-module book-flashcard-page theme-${theme} flashcard-shell`}>
    <BookTopbar current="flashcards" onLanding={onBack} onNotes={onNotes} onMock={onMock} onFlashcards={()=>{}} onReport={onReport} theme={theme} toggleTheme={toggleTheme} folio="Fol. 005" extra={<button className="book-nav-small-btn" onClick={()=>setSettingsOpen(true)}>Settings</button>} />
    {settingsOpen&&<div className="settings-overlay notes-settings-shell">
      <button className="settings-backdrop" onClick={()=>setSettingsOpen(false)} aria-label="Close settings"/>
      <aside className="settings-drawer">
        <div className="settings-head"><div><span className="eyebrow muted">Settings</span><h3>Flashcard controls</h3></div><button className="drawer-close-btn" onClick={()=>setSettingsOpen(false)} aria-label="Close settings">×</button></div>
        <div className="settings-body">
          <div className="settings-row settings-theme-row"><span>Theme</span><CurtainThemeButton theme={theme} onThemeChange={toggleTheme} label /></div>
          <button className="settings-row" onClick={()=>{setStats({});setSettingsOpen(false)}}><span>Reset flashcard progress</span><strong>Clear</strong></button>
          <button className="settings-row" onClick={()=>setSettingsOpen(false)}><span>Close settings</span><strong>Done</strong></button>
        </div>
      </aside>
    </div>}
    <main className="flashcard-page book-page">
      <BookPageHead eyebrow="Recall corridor · 9 decks · 397 cards" title="The" em="recall corridor" lede="Direct recall for sections, penalties, PIDM limits, AML and STR rules, and investor categories." stats={[[String(FLASHCARD_DATA.length),"Total cards"],[String(FLASHCARD_CATEGORIES.length-1),"Decks"],[`${knownCount}`,"Mastered"],["SR","Spaced"]]} />
      <section className="surface flashcard-hero">
        <div>
          <span className="eyebrow">Acts · Rules · Penalties</span>
          <h1>Flashcards</h1>
          <p>Short recall drills for sections, penalties, dates, PHS rules, AML/STR rules, PIDM limits, investor categories and regulatory responsibilities.</p>
          <div className="flashcard-actions"><button className="primary-btn" onClick={()=>resetDeck(false)}>Shuffle deck</button><button className="secondary-btn" onClick={()=>resetDeck(true)}>Review unmastered</button></div>
        </div>
        <div className="flashcard-score-grid">
          <div><strong>{FLASHCARD_DATA.length}</strong><span>Total flashcards</span></div>
          <div><strong>{knownCount}</strong><span>Mastered in this filter</span></div>
          <div><strong>{dueCount}</strong><span>Still to review</span></div>
        </div>
      </section>
      <section className="flashcard-layout">
        <aside className="surface flashcard-sidebar">
          <div className="section-head compact"><div><h2>Decks</h2><p>Pick one deck, then work through the cards one at a time.</p></div></div>
          <div className="flashcard-filter-list">
            {FLASHCARD_CATEGORIES.map(c=><button key={c} className={category===c?'flash-filter active':'flash-filter'} onClick={()=>setCategory(c)}><span>{c}</span><strong>{c==='All'?FLASHCARD_DATA.length:(grouped[c]?.length||0)}</strong></button>)}
          </div>
          <div className="flashcard-mode-card">
            <span className="eyebrow muted">Mode</span>
            <div className="flashcard-mode-buttons"><button className={mode==='learn'?'chip chip-on':'chip'} onClick={()=>{setMode('learn');setSelected(null);setRevealed(false)}}>Flip cards</button><button className={mode==='quiz'?'chip chip-on':'chip'} onClick={()=>{setMode('quiz');setSelected(null);setRevealed(false)}}>Quiz game</button></div>
          </div>
        </aside>
        <section className="surface flashcard-main-card">
          {!current?<div className="empty-card"><h3>No cards in this deck.</h3><p>Choose another category or reset progress.</p></div>:<>
            <div className="flashcard-card-head">
              <div><span className="eyebrow muted">{current.category}</span><h2>{current.tag}</h2></div>
              <div className="flashcard-counter"><strong>{Math.min(idx+1,deck.length)}</strong><span>/ {deck.length}</span></div>
            </div>
            <div className="progress-track flash-progress"><div className="progress-fill" style={{width:`${progress}%`}}/></div>
            <div className="flashcard-question-box"><span className="flashcard-card-label">Prompt</span><p>{current.front}</p></div>
            {mode==='learn'?<div className={revealed?'flashcard-answer-box revealed':'flashcard-answer-box'}>
              {revealed?<><span className="eyebrow muted">Answer</span><h3>{current.answer}</h3><p>{current.detail}</p></>:<button className="primary-btn" onClick={()=>setRevealed(true)}>Reveal answer</button>}
            </div>:<div className="flashcard-quiz-options">
              {choices.map(choice=>{const isCorrect=choice===current.answer;const chosen=selected===choice;const klass=selected==null?'flash-choice':chosen&&isCorrect?'flash-choice correct':chosen&&!isCorrect?'flash-choice wrong':selected!=null&&isCorrect?'flash-choice correct':'flash-choice';return <button key={choice} className={klass} onClick={()=>answer(choice)}>{choice}</button>})}
              {selected!=null&&<div className="flashcard-answer-box revealed"><span className="eyebrow muted">Explanation</span><h3>{selected===current.answer?'Correct':'Correct answer'}</h3><p><strong>{current.answer}</strong></p><p>{current.detail}</p></div>}
            </div>}
            <div className="flashcard-card-actions">
              <button className="secondary-btn" onClick={prevCard} disabled={idx===0}>← Previous</button>
              {mode==='learn'&&revealed&&<><button className="secondary-btn" onClick={()=>mark('again')}>Review again</button><button className="primary-btn" onClick={()=>mark('known')}>I know this</button></>}
              <button className="secondary-btn" onClick={nextCard} disabled={idx>=deck.length-1}>Next →</button>
            </div>
          </>}
        </section>
      </section>
    </main>
  </div>
}

/* ── Room Doorway transition overlay ──────────────────────────────── */
const ROOM_LABELS={
  landing:'Frontispiece',
  notes:'The Reading Room',
  mock:'The Examination Hall',
  flashcards:'The Recall Corridor',
  report:'The Audit Folio',
  printable:'Printable Notes',
  colophon:'The Colophon',
};
function RoomDoorway({phase,target}){
  return(
    <div className={`room-doorway phase-${phase}`} aria-hidden="true">
      <div className="dw-panel dw-panel-left">
        <span className="dw-hinge dw-hinge-top"/>
        <span className="dw-hinge dw-hinge-mid"/>
        <span className="dw-hinge dw-hinge-bottom"/>
        <span className="dw-handle"/>
      </div>
      <div className="dw-panel dw-panel-right">
        <span className="dw-hinge dw-hinge-top"/>
        <span className="dw-hinge dw-hinge-mid"/>
        <span className="dw-hinge dw-hinge-bottom"/>
        <span className="dw-handle"/>
      </div>
      <div className="dw-glow"/>
      <div className="dw-label-wrap">
        {target&&<div className="dw-label">{ROOM_LABELS[target]||target}</div>}
      </div>
    </div>
  );
}

function CombinedApp(){
  const [view,setView]=useState(()=>window.location.hash.replace('#','')||'landing');
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem(THEME_KEY)||'light'}catch{return 'light'}});
  const toggleTheme=(next)=>setTheme(t=>next==='dark'||next==='light'?next:(t==='dark'?'light':'dark'));
  useEffect(()=>{applyGlobalTheme(theme);try{localStorage.setItem(THEME_KEY,theme)}catch{}},[theme]);

  // Room transition state machine: idle → closing → opening → idle
  const [transition,setTransition]=useState({phase:'idle',target:null});
  const viewRef=useRef(view);
  useEffect(()=>{viewRef.current=view;},[view]);
  const busyRef=useRef(false);

  const animateNavTo=useCallback((next)=>{
    if(busyRef.current)return;
    // 'colophon' is an external static page — navigate the tab after the doors close
    if(next==='colophon'){
      const reduced=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(reduced){window.location.href=AUDIT_SITE_PATH;return;}
      busyRef.current=true;
      setTransition({phase:'closing',target:'colophon'});
      window.setTimeout(()=>{window.location.href=AUDIT_SITE_PATH;},520);
      return;
    }
    if(viewRef.current===next)return;
    const reduced=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced){
      setView(next);
      if(window.location.hash.replace('#','')!==(next==='landing'?'':next)){
        window.location.hash=next==='landing'?'':next;
      }
      return;
    }
    busyRef.current=true;
    // Phase 1: doors swing in (500ms)
    setTransition({phase:'closing',target:next});
    window.setTimeout(()=>{
      // Swap underlying view while doors are closed
      setView(next);
      if(window.location.hash.replace('#','')!==(next==='landing'?'':next)){
        window.location.hash=next==='landing'?'':next;
      }
      window.scrollTo({top:0,behavior:'auto'});
      // Phase 2: doors hold closed briefly so the label can settle (250ms)
      setTransition({phase:'closed',target:next});
      window.setTimeout(()=>{
        // Phase 3: doors swing open (600ms)
        setTransition({phase:'opening',target:next});
        window.setTimeout(()=>{
          setTransition({phase:'idle',target:null});
          busyRef.current=false;
        },620);
      },240);
    },520);
  },[]);

  useEffect(()=>{
    const onMsg=(event)=>{if(event?.data?.type==='ippc-theme'&&(event.data.theme==='dark'||event.data.theme==='light')) setTheme(event.data.theme)};
    window.addEventListener('message',onMsg);
    return()=>window.removeEventListener('message',onMsg);
  },[]);
  useEffect(()=>{
    const onHash=()=>{
      const next=window.location.hash.replace('#','')||'landing';
      if(next!==viewRef.current)animateNavTo(next);
    };
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[animateNavTo]);

  const go=animateNavTo;

  let page;
  if(view==='mock') page=<MockApp onBack={()=>go('landing')} onNotes={()=>go('notes')} theme={theme} toggleTheme={toggleTheme}/>;
  else if(view==='notes') page=<NotesPortal onBack={()=>go('landing')} onMock={()=>go('mock')} theme={theme} toggleTheme={toggleTheme}/>;
  else if(view==='report') page=<ReportPortal onBack={()=>go('landing')} onMock={()=>go('mock')} onNotes={()=>go('notes')} theme={theme} toggleTheme={toggleTheme}/>;
  else if(view==='printable') page=<PrintableNotesPdfPortal onBack={()=>go('landing')} onMock={()=>go('mock')} onNotes={()=>go('notes')} theme={theme} toggleTheme={toggleTheme}/>;
  else if(view==='flashcards') page=<FlashcardQuizGame onBack={()=>go('landing')} onMock={()=>go('mock')} onNotes={()=>go('notes')} onReport={()=>go('report')} onPrintable={()=>go('printable')} theme={theme} toggleTheme={toggleTheme}/>;
  else page=<CombinedLanding onEnter={go} theme={theme} toggleTheme={toggleTheme}/>;

  return <>
    {/* Global UI — always mounted regardless of view, so shortcuts work on every page */}
    <SkipLink/>
    <KeyboardHelp onNav={animateNavTo}/>
    <MobileTabBar current={view||'landing'} onNav={animateNavTo}/>
    <BackToTop/>
    <DisplayToggle/>
    <ShortcutHintButton/>
    {page}
    <RoomDoorway phase={transition.phase} target={transition.target}/>
  </>;
}

createRoot(document.getElementById('root')).render(<CombinedApp/>);
