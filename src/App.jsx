import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ClipboardCheck, ListChecks, Settings, LogOut, ShieldCheck, Users,
  CalendarDays, Search, CheckCircle2, AlertCircle, Clock3, Download, Upload,
  ChevronDown, Plus, X, Check, Save, BookOpen, LockKeyhole, Shirt, LoaderCircle,
  RefreshCw, FileSpreadsheet, Eye, AlertTriangle, Menu, ArrowLeft,
} from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot, where } from 'firebase/firestore';
import { auth, configured, db } from './services/firebase';
import { getFamilyDocuments, inspectionQuery, saveInspection, updateFamily, updateRound,
  updateTeacher, upsertStudents, watchCollection } from './services/data';
import { ISSUE_TYPES, STATUS_META, prettyError, summarize, normalizeStudent, validateStudent } from './utils/domain';
import { parseCSV, saveText, toCSV } from './utils/csv';

const cn = (...names) => names.filter(Boolean).join(' ');
const primaryButton = 'btn btn-primary';
const baseInput = 'field';
const roundLabel = (round) => round ? (round.name || round.id) : 'ยังไม่ได้สร้างรอบตรวจ';

function AppIcon({ icon: Icon, className = 'size-5' }) { return <Icon className={className} strokeWidth={1.9} />; }
function Badge({ kind = 'neutral', children }) { return <span className={cn('badge', `badge-${kind}`)}>{children}</span>; }
function ErrorText({ children }) { return children ? <p role="alert" className="error-text"><AlertCircle className="size-4 shrink-0" />{children}</p> : null; }
function Empty({ title, detail, icon: Icon = BookOpen }) {
  return <div className="empty"><Icon className="size-9 text-slate-400" strokeWidth={1.3}/><h3>{title}</h3><p>{detail}</p></div>;
}
function Spinner({ message = 'กำลังโหลดข้อมูล...' }) { return <div className="load"><LoaderCircle className="animate-spin size-6" />{message}</div>; }
function StatCard({ title, value, sub, icon: Icon, type = 'navy' }) {
  return <div className="stat"><div><p className="stat-title">{title}</p><p className="stat-value">{value.toLocaleString('th-TH')}</p><span className="stat-sub">{sub}</span></div><div className={cn('stat-icon',`stat-icon-${type}`)}><Icon className="size-6" /></div></div>;
}
function Toast({ text, clear }) {
  useEffect(() => { if (!text) return; const t = setTimeout(clear, 4400); return () => clearTimeout(t); }, [text, clear]);
  if (!text) return null;
  return <div className={cn('toast', text.type === 'error' ? 'toast-error' : 'toast-success')} role="status">
    {text.type === 'error' ? <AlertCircle className="size-4"/> : <CheckCircle2 className="size-4"/>}<span>{text.message}</span>
    <button className="icon-button" aria-label="ปิดข้อความ" onClick={clear}><X className="size-4"/></button>
  </div>;
}
function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [pending,setPending] = useState(false); const [error,setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setError(''); setPending(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (err) { setError(prettyError(err)); }
    finally { setPending(false); }
  }
  return <div className="login-background">
    <div className="login-brand"><div className="brand-logo"><Shirt className="size-7" /></div><strong>KP SMART</strong><span>STUDENT AFFAIRS</span></div>
    <div className="login-panel"><div className="login-symbol"><ShieldCheck className="size-7"/></div>
      <p className="eyebrow">โรงเรียนคีรีราษฎร์พัฒนา</p><h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">เข้าสู่ระบบ</h1>
      <p className="text-slate-500 mb-7">ระบบตรวจเครื่องแต่งกายนักเรียนตาม KP Family</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="form-label">อีเมลของครู</span><input className={baseInput} type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="teacher@school.ac.th" /></label>
        <label className="block"><span className="form-label">รหัสผ่านส่วนบุคคล</span><input className={baseInput} type="password" autoComplete="current-password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
        <ErrorText>{error}</ErrorText>
        <button disabled={pending} className={cn(primaryButton,'w-full justify-center h-12')}>{pending ? <LoaderCircle className="animate-spin size-4"/> : <LockKeyhole className="size-4"/>} เข้าสู่ระบบ</button>
      </form>
      <p className="text-xs text-slate-500 mt-6 leading-relaxed text-center">เฉพาะครูที่ได้รับบัญชีจากผู้ดูแลระบบเท่านั้น หากลืมรหัสผ่าน โปรดติดต่อผู้ดูแลระบบ</p>
    </div>
    <div className="login-footer">KP Smart Uniform Inspection · Version 0.1</div>
  </div>;
}
function MissingProfile({ email }) {
  return <main className="min-h-screen grid place-items-center bg-slate-50 p-5"><div className="card max-w-lg text-center p-9">
    <div className="mx-auto w-fit bg-amber-100 rounded-2xl p-4 text-amber-600 mb-4"><ShieldCheck className="size-8" /></div>
    <h2 className="text-xl font-bold">บัญชีนี้ยังไม่ได้รับสิทธิ์</h2><p className="text-slate-500 mt-2 mb-4">{email}</p>
    <p className="text-slate-600 mb-6">ผู้ดูแลระบบต้องสร้างเอกสาร users/UID ใน Firestore และกำหนด role, active และ familyIds ก่อนใช้งาน</p>
    <button className="btn btn-outline" onClick={()=>signOut(auth)}>ออกจากระบบ</button></div></main>;
}

function IssueDialog({ student, record, onClose, onSave, pending }) {
  const [types,setTypes] = useState(record?.status === 'issue' ? record.issueTypes : []);
  const [note,setNote] = useState(record?.status === 'issue' ? record.note : '');
  const [error,setError] = useState('');
  function toggle(id) { setTypes(v=>v.includes(id) ? v.filter(x=>x !== id) : [...v, id]); setError(''); }
  function submit(e) { e.preventDefault(); if (!types.length) return setError('กรุณาระบุข้อบกพร่องอย่างน้อย 1 รายการ');
    onSave({ status: 'issue', issueTypes: types, note, resolution: 'pending' });
  }
  return <div className="overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget) onClose();}}>
    <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-label="รายละเอียดเครื่องแต่งกาย">
      <div className="flex justify-between items-start gap-3 mb-5"><div><p className="eyebrow">บันทึกข้อบกพร่อง</p><h2 className="text-xl font-bold">{student.name}</h2><p className="text-sm text-slate-500">{student.room} · {student.familyId}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="ปิด"><X className="size-5"/></button></div>
      <p className="form-label mb-2">รายการที่ต้องปรับปรุง (เลือกได้หลายข้อ)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">{ISSUE_TYPES.map(it=><label key={it.id} className={cn('check-tile',types.includes(it.id) && 'check-tile-active')}><input type="checkbox" checked={types.includes(it.id)} onChange={()=>toggle(it.id)} className="accent-blue-800 size-4" /> {it.label}</label>)}</div>
      <label className="block mb-4"><span className="form-label">หมายเหตุเพิ่มเติม (ไม่บังคับ)</span><textarea value={note} maxLength={500} rows={3} onChange={e=>setNote(e.target.value)} className={baseInput} placeholder="รายละเอียดที่ครูต้องการให้แก้ไข..."/></label>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn btn-outline" onClick={onClose}>ยกเลิก</button><button className={primaryButton} disabled={pending}>{pending ? <LoaderCircle className="animate-spin size-4"/> : <Save className="size-4"/>} บันทึกผลตรวจ</button></div>
    </form>
  </div>;
}

function AppShell() {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [tab,setTab] = useState('overview');
  const [families,setFamilies] = useState([]); const [rounds,setRounds] = useState([]);
  const [students,setStudents] = useState([]); const [inspections,setInspections] = useState([]);
  const [teachers,setTeachers] = useState([]);
  const [selectedFamily,setSelectedFamily] = useState(''); const [selectedRound,setSelectedRound] = useState('');
  const [search,setSearch] = useState(''); const [statusFilter,setStatusFilter] = useState('all');
  const [savingId,setSavingId] = useState(null); const [issueStudent,setIssueStudent] = useState(null);
  const [toast,setToast] = useState(null); const [loading,setLoading] = useState(true);
  const [menuOpen,setMenuOpen] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const showToast = (message,type = 'success') => setToast({ message,type });
  useEffect(()=>{ if (!configured || !auth) { setFirebaseUser(null); return; } return onAuthStateChanged(auth, user=>setFirebaseUser(user)); }, []);
  useEffect(()=>{
    if (!firebaseUser) { setProfile(undefined); return; }
    return onSnapshot(doc(db,'users',firebaseUser.uid), snap=>setProfile(snap.exists()? snap.data() : null),()=>setProfile(null));
  },[firebaseUser]);
  useEffect(()=>{
    if (!profile?.active) return;
    setLoading(true);
    const unsubRounds = watchCollection('inspection_rounds',[],setRounds,err=>showToast(prettyError(err),'error'));
    let unsubFamilies = ()=>{};
    if (isAdmin) unsubFamilies = watchCollection('families',[],setFamilies,err=>showToast(prettyError(err),'error'));
    else getFamilyDocuments(profile.familyIds || []).then(setFamilies).catch(err=>showToast(prettyError(err),'error'));
    return ()=>{unsubRounds();unsubFamilies();};
  },[profile?.active,profile?.role,JSON.stringify(profile?.familyIds || [])]);
  useEffect(()=>{
    if (!profile?.active || !families.length) return;
    if (!isAdmin && !families.some(f=>f.id===selectedFamily)) setSelectedFamily(families[0].id);
    if (isAdmin && selectedFamily && !families.some(f=>f.id===selectedFamily)) setSelectedFamily('');
  },[profile?.role,families,selectedFamily]);
  useEffect(()=>{
    if (!rounds.length) { setSelectedRound(''); return; }
    if (!rounds.some(r=>r.id===selectedRound)) {
      const open = rounds.filter(r=>r.status==='open').sort((a,b)=>b.date.localeCompare(a.date));
      setSelectedRound((open[0] || [...rounds].sort((a,b)=>b.date.localeCompare(a.date))[0]).id);
    }
  },[rounds,selectedRound]);
  useEffect(()=>{
    if (!profile?.active || (!isAdmin && !selectedFamily)) {setStudents([]);setLoading(false);return;}
    const constraints = isAdmin ? [] : [where('familyId','==',selectedFamily)];
    setLoading(true);
    return watchCollection('students',constraints,items=>{setStudents(items);setLoading(false);},err=>{showToast(prettyError(err),'error');setLoading(false);});
  },[profile?.active,profile?.role,selectedFamily,isAdmin]);
  useEffect(()=>{
    if (!profile?.active || !selectedRound || (!isAdmin && !selectedFamily)) {setInspections([]);return;}
    return watchCollection('inspections',inspectionQuery(profile,selectedRound,selectedFamily),setInspections,err=>showToast(prettyError(err),'error'));
  },[profile?.active,profile?.role,selectedRound,selectedFamily,isAdmin]);
  useEffect(()=>{
    if (!isAdmin) {setTeachers([]);return;}
    return watchCollection('users',[],setTeachers,err=>showToast(prettyError(err),'error'));
  },[isAdmin]);
  useEffect(()=>{setStatusFilter('all');setSearch('');},[selectedFamily,selectedRound,tab]);

  const familyMap = useMemo(()=>Object.fromEntries(families.map(f=>[f.id,f.name])),[families]);
  const displayedStudents = useMemo(()=>students.filter(s=>!selectedFamily || s.familyId===selectedFamily).sort((a,b)=>a.room.localeCompare(b.room,'th',{numeric:true}) || a.studentId.localeCompare(b.studentId,'th',{numeric:true})),[students,selectedFamily]);
  const displayedInspections = useMemo(()=>inspections.filter(i=>!selectedFamily || i.familyId===selectedFamily),[inspections,selectedFamily]);
  const records = useMemo(()=>Object.fromEntries(displayedInspections.map(i=>[i.studentId,i])),[displayedInspections]);
  const stats = useMemo(()=>summarize(displayedStudents,displayedInspections),[displayedStudents,displayedInspections]);
  const chosenRound = rounds.find(r=>r.id===selectedRound);
  const currentFamily = families.find(f=>f.id===selectedFamily);
  const roundOpen = chosenRound?.status === 'open';

  async function write(student, changes) {
    if (!selectedRound) return showToast('กรุณาเลือกรอบตรวจก่อน','error');
    setSavingId(student.studentId);
    try {
      await saveInspection({user:firebaseUser,roundId:selectedRound,student,old:records[student.studentId],...changes});
      setIssueStudent(null); showToast(`บันทึกผลตรวจ ${student.name} เรียบร้อย`);
    } catch(err) { showToast(prettyError(err),'error'); }
    finally {setSavingId(null);}
  }
  function exportReport() {
    const headers = ['roundId','studentId','name','room','familyId','familyName','status','issueTypes','resolution','note'];
    const rows = displayedStudents.map(s=>{const r=records[s.studentId];return {
      roundId:selectedRound,studentId:s.studentId,name:s.name,room:s.room,familyId:s.familyId,
      familyName:familyMap[s.familyId]||s.familyId,status:r?.status||'not_inspected',
      issueTypes:(r?.issueTypes||[]).map(id=>ISSUE_TYPES.find(t=>t.id===id)?.label||id).join(' / '),
      resolution:r?.resolution||'',note:r?.note||'',
    };});
    saveText(`KP-Uniform-${selectedRound}-${selectedFamily||'ALL'}.csv`,toCSV(headers,rows));
  }
  if (!configured) return <main className="min-h-screen grid place-items-center p-6 bg-slate-50"><div className="card p-8 max-w-xl"><h1 className="text-xl font-bold mb-3">ตั้งค่า Firebase ก่อนใช้งาน</h1><p>คัดลอก <code>.env.example</code> เป็น <code>.env</code> แล้วกรอกค่า VITE_FIREBASE_* จาก Firebase Console ตาม README.md</p></div></main>;
  if (firebaseUser === undefined || (firebaseUser && profile === undefined)) return <Spinner/>;
  if (!firebaseUser) return <Login/>;
  if (!profile?.active) return <MissingProfile email={firebaseUser.email}/>;
  const nav = [
    {id:'overview',label:'ภาพรวม',icon:LayoutDashboard},
    {id:'inspection',label:'ตรวจเครื่องแต่งกาย',icon:ClipboardCheck},
    {id:'followup',label:'ติดตามการแก้ไข',icon:ListChecks},
    ...(isAdmin ? [{id:'admin',label:'ตั้งค่าระบบ',icon:Settings}] : []),
  ];
  return <div className="app-shell">
    <aside className={cn('sidebar',menuOpen && 'sidebar-open')}>
      <div className="sidebar-brand"><div className="brand-logo"><Shirt className="size-6"/></div><div><b>KP SMART</b><small>UNIFORM INSPECTION</small></div></div>
      <p className="sidebar-caption">เมนูหลัก</p>
      <nav className="nav-list" aria-label="เมนูหลัก">{nav.map(n=><button key={n.id} className={cn('nav-item',tab===n.id && 'nav-item-active')} onClick={()=>{setTab(n.id);setMenuOpen(false);}}><n.icon className="size-5"/><span>{n.label}</span>{tab===n.id && <span className="nav-active-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user-identity"><div className="user-avatar">{profile.name?.slice(0,1)||'ค'}</div><div className="min-w-0"><b className="truncate block">{profile.name}</b><small>{isAdmin ? 'ผู้ดูแลระบบ (Admin)' : 'ครูผู้ตรวจ'}</small></div></div>
        <button className="nav-item logout" onClick={()=>signOut(auth)}><LogOut className="size-5"/>ออกจากระบบ</button></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" onClick={()=>setMenuOpen(false)} aria-label="ปิดเมนู"/>}
    <div className="content-area"><header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="เปิดเมนู"><Menu className="size-5"/></button><div className="topbar-school"><div className="school-mark"><ShieldCheck className="size-5"/></div><div><strong>โรงเรียนคีรีราษฎร์พัฒนา</strong><span>ระบบงานกิจการนักเรียน · KP Family</span></div></div>
      <div className="topbar-user"><span className="status-dot"/> <span className="hidden sm:inline">{profile.name}</span><Badge kind={isAdmin?'navy':'neutral'}>{isAdmin?'ADMIN':'TEACHER'}</Badge></div></header>
      <main className="main-content">
        <div className="page-heading"><div><p className="eyebrow">KP SMART UNIFORM INSPECTION</p><h1>{nav.find(n=>n.id===tab)?.label}</h1><p className="page-desc">{tab==='overview'?'สรุปผลการตรวจและติดตามความเรียบร้อยของนักเรียน':tab==='inspection'?'ตรวจเครื่องแต่งกายนักเรียนตามระบบครอบครัว':tab==='followup'?'ดูแลนักเรียนและติดตามการแก้ไขข้อบกพร่อง':'จัดการข้อมูลครอบครัว รอบตรวจ ครู และนักเรียน'}</p></div>
          {tab!=='admin' && <button className="btn btn-outline print-button" onClick={exportReport} disabled={!selectedRound}><Download className="size-4"/> ส่งออก CSV</button>}
        </div>
        {tab!=='admin' && <div className="filter-panel"><div className="filter-cell"><label>รอบตรวจ</label><div className="select-wrap"><CalendarDays className="size-4"/><select className="field" value={selectedRound} onChange={e=>setSelectedRound(e.target.value)}><option value="">เลือกรอบตรวจ</option>{[...rounds].sort((a,b)=>b.date.localeCompare(a.date)).map(r=><option value={r.id} key={r.id}>{r.name} · {r.status==='open'?'เปิด':'ปิด'}</option>)}</select><ChevronDown className="select-chevron"/></div></div>
            <div className="filter-cell"><label>KP Family</label><div className="select-wrap"><Users className="size-4"/><select className="field" value={selectedFamily} onChange={e=>setSelectedFamily(e.target.value)}>{isAdmin && <option value="">ทุกครอบครัว</option>}{[...families].sort((a,b)=>a.id.localeCompare(b.id)).map(f=><option key={f.id} value={f.id}>{f.id} — {f.name}</option>)}</select><ChevronDown className="select-chevron"/></div></div>
            <div className="filter-round-status"><Badge kind={roundOpen?'pass':'neutral'}>{chosenRound ? (roundOpen?'เปิดให้ตรวจ':'ปิดรอบตรวจ'):'ยังไม่มีรอบตรวจ'}</Badge></div>
          </div>}
        {loading && tab!=='admin'?<Spinner/> : tab==='overview'?<Overview stats={stats} students={displayedStudents} inspections={displayedInspections} familyMap={familyMap} currentFamily={currentFamily} chosenRound={chosenRound} onInspect={()=>setTab('inspection')} />
          :tab==='inspection'?<Inspection students={displayedStudents} records={records} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} pendingId={savingId} roundOpen={roundOpen} onQuick={write} onIssue={setIssueStudent} familyMap={familyMap} selectedFamily={selectedFamily} />
          :tab==='followup'?<Followup students={displayedStudents} records={records} savingId={savingId} write={write} roundOpen={roundOpen} />
          :<Admin families={families} rounds={rounds} teachers={teachers} students={students} notify={showToast} />}
        <footer className="app-footer">KP Smart Uniform Inspection · โรงเรียนคีรีราษฎร์พัฒนา · ข้อมูลนักเรียนใช้ภายในสถานศึกษาเท่านั้น</footer>
      </main></div>
      {issueStudent && <IssueDialog student={issueStudent} record={records[issueStudent.studentId]} pending={savingId===issueStudent.studentId} onClose={()=>setIssueStudent(null)} onSave={changes=>write(issueStudent,changes)}/>}
      <Toast text={toast} clear={()=>setToast(null)}/>
    </div>;
}

function Overview({stats,students,inspections,familyMap,currentFamily,chosenRound,onInspect}) {
  const issues = useMemo(()=>ISSUE_TYPES.map(t=>({...t,count:inspections.filter(i=>i.status==='issue' && (i.issueTypes||[]).includes(t.id)).length})).filter(t=>t.count).sort((a,b)=>b.count-a.count),[inspections]);
  const percentage = stats.total ? Math.round(stats.inspected/stats.total*100):0;
  const familyCounts = useMemo(()=>Object.entries(students.reduce((m,s)=>{m[s.familyId]=(m[s.familyId]||0)+1;return m;},{})).map(([id,total])=>({id,name:familyMap[id]||id,total,passed:inspections.filter(i=>i.familyId===id&&i.status==='pass').length,issues:inspections.filter(i=>i.familyId===id&&i.status==='issue').length})).sort((a,b)=>a.id.localeCompare(b.id)),[students,inspections,familyMap]);
  return <>
    <div className="section-heading"><div><h2>สรุปผลการตรวจ</h2><p>{chosenRound?`${chosenRound.name} · ${currentFamily?.name || 'ทุกครอบครัว'}`:'โปรดสร้างรอบตรวจในหน้าตั้งค่าระบบ'}</p></div><button className="btn btn-primary" onClick={onInspect}><ClipboardCheck className="size-4"/> เริ่มตรวจ</button></div>
    <div className="stats-grid"><StatCard title="นักเรียนทั้งหมด" value={stats.total} sub="รายชื่อในขอบเขตที่เลือก" icon={Users}/><StatCard title="ตรวจแล้ว" value={stats.inspected} sub={`${percentage}% ของนักเรียนทั้งหมด`} icon={ClipboardCheck} type="blue"/><StatCard title="ผ่านเกณฑ์" value={stats.pass} sub="เครื่องแต่งกายเรียบร้อย" icon={CheckCircle2} type="green"/><StatCard title="รอแก้ไข" value={stats.pending} sub={`พบข้อบกพร่อง ${stats.issue} คน`} icon={AlertCircle} type="orange"/></div>
    <div className="dashboard-grid"><section className="card card-pad"><div className="card-title"><h3>ความคืบหน้าการตรวจ</h3><Badge kind="navy">{percentage}%</Badge></div><div className="flex items-baseline gap-2 mb-3"><span className="text-4xl font-extrabold tracking-tight text-slate-800">{stats.inspected}</span><span className="text-slate-500">/ {stats.total} คน</span></div><div className="progress"><div style={{width:`${percentage}%`}}/></div><div className="progress-legend"><div><span className="legend-dot bg-blue-700"/>ตรวจแล้ว <b>{stats.inspected}</b></div><div><span className="legend-dot bg-slate-300"/>ยังไม่ตรวจ <b>{stats.notInspected}</b></div></div>
      <div className="note-line"><Clock3 className="size-4"/> สถานะ “ไม่ได้ตรวจ” ไม่ถือเป็นการขาดเรียน</div></section>
      <section className="card card-pad"><div className="card-title"><h3>ข้อบกพร่องที่พบบ่อย</h3><span className="text-xs text-slate-400">จำนวนรายการ</span></div>{issues.length?<div className="space-y-4 mt-5">{issues.map(i=><div key={i.id}><div className="flex justify-between text-sm mb-1.5"><span>{i.label}</span><b>{i.count} ครั้ง</b></div><div className="small-bar"><div style={{width:`${100*i.count/(issues[0]?.count||1)}%`}}/></div></div>)}</div>:<Empty title="ยังไม่พบข้อบกพร่อง" detail="รายการจะปรากฏเมื่อมีผลตรวจที่ต้องแก้ไข" icon={CheckCircle2}/>}</section></div>
    <section className="card mt-5"><div className="card-title px-6 pt-5 pb-4"><div><h3>ผลตรวจตาม KP Family</h3><p className="text-xs text-slate-500 mt-1">สรุปตามครอบครัวในขอบเขตที่ได้รับสิทธิ์</p></div></div><div className="table-scroll"><table><thead><tr><th>KP Family</th><th>นักเรียน</th><th>ผ่าน</th><th>ต้องแก้ไข</th><th>ยังไม่ตรวจ</th></tr></thead><tbody>{familyCounts.map(f=><tr key={f.id}><td className="font-semibold">{f.id} · {f.name}</td><td>{f.total}</td><td><Badge kind="pass">{f.passed}</Badge></td><td><Badge kind={f.issues?'issue':'neutral'}>{f.issues}</Badge></td><td>{f.total-f.passed-f.issues}</td></tr>)}{!familyCounts.length && <tr><td colSpan={5} className="text-center py-10 text-slate-400">ยังไม่มีข้อมูลนักเรียน</td></tr>}</tbody></table></div></section>
  </>;
}

function Inspection({students,records,search,setSearch,statusFilter,setStatusFilter,pendingId,roundOpen,onQuick,onIssue,familyMap,selectedFamily}) {
  const filtered = students.filter(s=>{
    const r=records[s.studentId]; const state=r?.status || 'uninspected';
    if (statusFilter==='pending' && !(state==='issue'&&r.resolution==='pending')) return false;
    if (statusFilter==='pass' && state!=='pass') return false;
    if (statusFilter==='uninspected' && !['uninspected','not_checked'].includes(state)) return false;
    return `${s.studentId} ${s.name} ${s.room} ${familyMap[s.familyId]||''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  });
  if(!selectedFamily) return <Empty title="กรุณาเลือก KP Family" detail="เลือกครอบครัวที่ต้องการตรวจจากด้านบน เพื่อป้องกันการสับสนระหว่างครอบครัว" icon={Users}/>;
  return <section className="card"><div className="list-tools"><div><h2 className="text-lg font-bold">รายชื่อนักเรียน</h2><p className="text-sm text-slate-500">{familyMap[selectedFamily]||selectedFamily} · แสดง {filtered.length} จาก {students.length} คน</p></div><div className="search-wrap"><Search className="size-4"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ เลขประจำตัว หรือห้อง..." aria-label="ค้นหานักเรียน"/></div></div>
    {!roundOpen && <div className="warning-banner"><AlertTriangle className="size-4 shrink-0"/>รอบตรวจนี้ปิดอยู่ หรือยังไม่ได้สร้างรอบตรวจ ครูไม่สามารถบันทึกผลใหม่ได้</div>}
    <div className="seg-tabs">{[{id:'all',label:'ทั้งหมด'},{id:'uninspected',label:'ยังไม่ตรวจ'},{id:'pending',label:'รอแก้ไข'},{id:'pass',label:'ผ่าน'}].map(t=><button className={cn(statusFilter===t.id&&'seg-active')} key={t.id} onClick={()=>setStatusFilter(t.id)}>{t.label}</button>)}</div>
    {filtered.length?<div className="student-list">{filtered.map(s=>{const r=records[s.studentId], status=r?.status, busy=pendingId===s.studentId;
      return <article key={s.studentId} className="student-row"><div className="student-avatar">{s.name?.slice(0,1)}</div><div className="student-primary"><div className="flex items-center gap-2 flex-wrap"><b>{s.name}</b><Badge kind={status?STATUS_META[status].badge:'neutral'}>{status?STATUS_META[status].label:'ยังไม่ตรวจ'}</Badge>{r?.resolution==='resolved'&&<Badge kind="pass">แก้ไขแล้ว</Badge>}</div><p>เลขประจำตัว {s.studentId} · {s.room} · {s.familyId}</p>{status==='issue'&&<p className="issue-detail">{(r.issueTypes||[]).map(id=>ISSUE_TYPES.find(t=>t.id===id)?.label).join(' · ')}</p>}</div>
        <div className="student-actions"><button disabled={!roundOpen||busy||status==='issue'} title={status==='issue'?'กรณีพบข้อบกพร่องแล้ว ให้ติดตามแก้ไขที่หน้า ติดตามการแก้ไข':'บันทึกผ่าน'} className={cn('action-button action-pass',status==='pass'&&'action-selected')} onClick={()=>onQuick(s,{status:'pass',resolution:'none'})}>{busy?<LoaderCircle className="animate-spin size-4"/>:<Check className="size-4"/>} <span>ผ่าน</span></button>
        <button disabled={!roundOpen||busy} className={cn('action-button action-issue',status==='issue'&&'action-selected')} onClick={()=>onIssue(s)}><AlertCircle className="size-4"/><span>ต้องแก้ไข</span></button>
        <button disabled={!roundOpen||busy||status==='issue'} className="action-button action-skip" onClick={()=>onQuick(s,{status:'not_checked',resolution:'none'})} title="ไม่ได้ตรวจ (ไม่ใช่ขาดเรียน)"><Clock3 className="size-4"/><span>ไม่ได้ตรวจ</span></button></div></article>;
    })}</div>:<Empty title="ไม่พบรายชื่อตามเงื่อนไข" detail="ลองเปลี่ยนคำค้นหาหรือสถานะตัวกรอง" icon={Search}/>}</section>;
}

function Followup({students,records,savingId,write,roundOpen}) {
  const allIssues = students.map(s=>({student:s,record:records[s.studentId]})).filter(v=>v.record?.status==='issue');
  const pending = allIssues.filter(v=>v.record.resolution==='pending');
  const resolved = allIssues.filter(v=>v.record.resolution==='resolved');
  const [showResolved,setShowResolved] = useState(false);
  const shown = showResolved ? resolved : pending;
  return <><div className="stats-grid followup-stats"><StatCard title="พบข้อบกพร่อง" value={allIssues.length} sub="นักเรียนรายบุคคล" icon={AlertCircle} type="orange"/><StatCard title="รอติดตาม" value={pending.length} sub="ยังไม่ยืนยันการแก้ไข" icon={Clock3} type="orange"/><StatCard title="แก้ไขแล้ว" value={resolved.length} sub="ตรวจซ้ำและยืนยันแล้ว" icon={CheckCircle2} type="green"/></div>
    <section className="card"><div className="list-tools"><div><h2 className="text-lg font-bold">รายการติดตาม</h2><p className="text-sm text-slate-500">ครูตรวจซ้ำแล้วกด “แก้ไขแล้ว” เพื่อปิดรายการ</p></div><div className="seg-tabs compact"><button className={!showResolved?'seg-active':''} onClick={()=>setShowResolved(false)}>รอแก้ไข ({pending.length})</button><button className={showResolved?'seg-active':''} onClick={()=>setShowResolved(true)}>แก้ไขแล้ว ({resolved.length})</button></div></div>
      {shown.length?<div className="student-list">{shown.map(({student:s,record:r})=><article className="student-row" key={s.studentId}><div className="student-avatar avatar-orange">{s.name?.slice(0,1)}</div><div className="student-primary"><b>{s.name}</b><p>{s.room} · {s.familyId} · {s.studentId}</p><p className="issue-detail">{r.issueTypes.map(id=>ISSUE_TYPES.find(t=>t.id===id)?.label).join(' · ')}</p>{r.note&&<p className="text-xs text-slate-500 mt-1">หมายเหตุ: {r.note}</p>}</div>
      <button disabled={!roundOpen||savingId===s.studentId} className={cn('btn',showResolved?'btn-outline':'btn-primary')} onClick={()=>write(s,{status:'issue',issueTypes:r.issueTypes,note:r.note,resolution:showResolved?'pending':'resolved'})}>{savingId===s.studentId?<LoaderCircle className="animate-spin size-4"/>:showResolved?<RefreshCw className="size-4"/>:<CheckCircle2 className="size-4"/>}{showResolved?'เปิดติดตามอีกครั้ง':'แก้ไขแล้ว'}</button></article>)}</div>:<Empty title={showResolved?'ยังไม่มีรายการที่แก้ไขแล้ว':'ไม่มีรายการรอแก้ไข'} detail="รายการจะปรากฏจากผลตรวจที่บันทึกว่าเครื่องแต่งกายต้องแก้ไข" icon={CheckCircle2}/>}</section>
  </>;
}

function Admin({families,rounds,teachers,students,notify}) {
  const [section,setSection] = useState('families');
  const tabs = [{id:'families',label:'KP Family',icon:Users},{id:'rounds',label:'รอบตรวจ',icon:CalendarDays},{id:'teachers',label:'สิทธิ์ครู',icon:ShieldCheck},{id:'students',label:'นำเข้านักเรียน',icon:Upload}];
  return <><div className="admin-tabs">{tabs.map(t=><button key={t.id} className={cn(section===t.id&&'admin-tab-active')} onClick={()=>setSection(t.id)}><t.icon className="size-4"/>{t.label}</button>)}</div>
    {section==='families'?<FamiliesAdmin families={families} notify={notify}/>:section==='rounds'?<RoundsAdmin rounds={rounds} notify={notify}/>:section==='teachers'?<TeachersAdmin teachers={teachers} families={families} notify={notify}/>:<StudentsAdmin students={students} families={families} notify={notify}/>}</>;
}
function FamiliesAdmin({families,notify}) {
  const [id,setId] = useState(''); const [name,setName] = useState(''); const [busy,setBusy] = useState(false);
  async function save(e) {e.preventDefault();setBusy(true);try {const key=id.trim().toUpperCase();if(!/^[A-Z0-9_-]{1,30}$/.test(key)) throw Error('รหัสครอบครัวควรเป็น F01, F02 ...');await updateFamily(key,name);setId('');setName('');notify('บันทึกครอบครัวเรียบร้อย');}catch(err){notify(prettyError(err),'error');}finally{setBusy(false);}}
  async function seed() {setBusy(true);try {for(let i=1;i<=21;i++){const key=`F${String(i).padStart(2,'0')}`;if(!families.find(f=>f.id===key)) await updateFamily(key,i===13?'วิชาดี':`ครอบครัว ${key}`);}notify('เพิ่มครอบครัว F01–F21 แล้ว (แก้ไขชื่อให้ตรงกับข้อมูลจริง)');}catch(err){notify(prettyError(err),'error');}finally{setBusy(false);}}
  return <section className="card card-pad"><div className="card-title"><div><h2>จัดการ KP Family</h2><p className="text-sm text-slate-500 mt-1">สร้าง 21 ครอบครัว แล้วตั้งชื่อจริงตามบัญชีปัจจุบัน</p></div><button className="btn btn-outline" onClick={seed} disabled={busy}><Plus className="size-4"/> สร้าง F01–F21</button></div>
    <form onSubmit={save} className="form-grid mt-5"><label><span className="form-label">รหัสครอบครัว</span><input className="field" placeholder="F01" required value={id} onChange={e=>setId(e.target.value)} maxLength={30}/></label><label><span className="form-label">ชื่อครอบครัว</span><input className="field" placeholder="ชื่อครอบครัว" required value={name} onChange={e=>setName(e.target.value)}/></label><button className="btn btn-primary self-end" disabled={busy}><Save className="size-4"/> บันทึก</button></form>
    <div className="table-scroll mt-5"><table><thead><tr><th>รหัส</th><th>ชื่อครอบครัว</th><th>สถานะ</th><th></th></tr></thead><tbody>{[...families].sort((a,b)=>a.id.localeCompare(b.id)).map(f=><tr key={f.id}><td className="font-semibold">{f.id}</td><td>{f.name}</td><td><Badge kind={f.active?'pass':'neutral'}>{f.active?'ใช้งาน':'ปิด'}</Badge></td><td><button className="text-button" onClick={()=>{setId(f.id);setName(f.name);}}>แก้ไข</button></td></tr>)}</tbody></table></div>
  </section>;
}
function RoundsAdmin({rounds,notify}) {
  const [id,setId] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
  const [date,setDate] = useState(''); const [name,setName] = useState('');const [status,setStatus] = useState('open');const [busy,setBusy] = useState(false);
  async function submit(e){e.preventDefault();setBusy(true);try{if(!/^\d{4}-\d{2}$/.test(id))throw Error('รหัสรอบตรวจต้องเป็น YYYY-MM');if(!date)throw Error('กรุณาเลือกวันตรวจ');await updateRound(id,name,date,status);notify('บันทึกรอบตรวจเรียบร้อย');}catch(err){notify(prettyError(err),'error');}finally{setBusy(false);}}
  return <section className="card card-pad"><div className="card-title"><div><h2>กำหนดรอบตรวจ</h2><p className="text-sm text-slate-500 mt-1">รองรับการตรวจประจำเดือน และปิดรอบเมื่อสิ้นสุดการติดตาม</p></div></div><form onSubmit={submit} className="form-grid mt-5"><label><span className="form-label">รหัสรอบตรวจ (YYYY-MM)</span><input type="month" className="field" required value={id} onChange={e=>setId(e.target.value)}/></label><label><span className="form-label">ชื่อรอบตรวจ</span><input className="field" placeholder="ตรวจเดือนพฤศจิกายน 2569" required value={name} onChange={e=>setName(e.target.value)}/></label><label><span className="form-label">วันที่ตรวจ</span><input className="field" type="date" value={date} required onChange={e=>setDate(e.target.value)}/></label><label><span className="form-label">สถานะ</span><select className="field" value={status} onChange={e=>setStatus(e.target.value)}><option value="open">เปิดให้ตรวจ</option><option value="closed">ปิดรอบตรวจ</option></select></label><button disabled={busy} className="btn btn-primary self-end"><Save className="size-4"/> บันทึกรอบตรวจ</button></form>
    <div className="table-scroll mt-5"><table><thead><tr><th>รหัส</th><th>ชื่อรอบ</th><th>วันที่</th><th>สถานะ</th><th></th></tr></thead><tbody>{[...rounds].sort((a,b)=>b.date.localeCompare(a.date)).map(r=><tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.date}</td><td><Badge kind={r.status==='open'?'pass':'neutral'}>{r.status==='open'?'เปิด':'ปิด'}</Badge></td><td><button className="text-button" onClick={()=>{setId(r.id);setName(r.name);setDate(r.date);setStatus(r.status);}}>แก้ไข</button></td></tr>)}</tbody></table></div></section>;
}
function TeachersAdmin({teachers,families,notify}) {
  const [uid,setUid] = useState('');const [name,setName]=useState('');const [email,setEmail]=useState('');
  const [familyIds,setFamilyIds] = useState([]);const [active,setActive] = useState(true);const [busy,setBusy]=useState(false);
  function load(t){setUid(t.id);setName(t.name);setEmail(t.email);setFamilyIds(t.familyIds||[]);setActive(t.active);}
  async function submit(e){e.preventDefault();setBusy(true);try{if(!uid.trim())throw Error('กรุณาคัดลอก UID จาก Firebase Authentication');if(!familyIds.length)throw Error('ต้องกำหนดครอบครัวที่ครูรับผิดชอบอย่างน้อย 1 ครอบครัว');await updateTeacher(uid,{name,email,familyIds,active});notify('บันทึกสิทธิ์ครูเรียบร้อย');setUid('');setName('');setEmail('');setFamilyIds([]);}catch(err){notify(prettyError(err),'error');}finally{setBusy(false);}}
  return <section className="card card-pad"><div className="card-title"><div><h2>กำหนดสิทธิ์ครูผู้ตรวจ</h2><p className="text-sm text-slate-500 mt-1">สร้าง Email/Password ใน Firebase Authentication ก่อน แล้วนำ UID มากำหนดสิทธิ์</p></div></div><div className="note-line mt-4"><LockKeyhole className="size-4 shrink-0"/> ไม่เก็บรหัสผ่านใน Firestore และไม่อนุญาตให้ครูสร้างบัญชีด้วยตนเองผ่านหน้าเว็บ</div>
    <form onSubmit={submit} className="mt-5 space-y-4"><div className="form-grid"><label><span className="form-label">Authentication UID</span><input className="field" value={uid} onChange={e=>setUid(e.target.value)} placeholder="คัดลอก UID จาก Firebase Console" required/></label><label><span className="form-label">ชื่อครู</span><input className="field" value={name} onChange={e=>setName(e.target.value)} required placeholder="ชื่อ-นามสกุล"/></label><label><span className="form-label">อีเมลบัญชี</span><input className="field" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="email@example.com"/></label><label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> เปิดสิทธิ์ใช้งาน</label></div>
    <div><span className="form-label">KP Family ที่รับผิดชอบ</span><div className="family-checks">{[...families].sort((a,b)=>a.id.localeCompare(b.id)).map(f=><label key={f.id} className="check-tile"><input type="checkbox" checked={familyIds.includes(f.id)} onChange={()=>setFamilyIds(v=>v.includes(f.id)?v.filter(x=>x!==f.id):[...v,f.id])}/>{f.id} · {f.name}</label>)}</div></div><button disabled={busy} className="btn btn-primary"><Save className="size-4"/> บันทึกสิทธิ์ครู</button></form>
    <div className="table-scroll mt-7"><table><thead><tr><th>ชื่อครู</th><th>อีเมล</th><th>ครอบครัว</th><th>สถานะ</th><th></th></tr></thead><tbody>{teachers.map(t=><tr key={t.id}><td className="font-semibold">{t.name}</td><td>{t.email||'-'}</td><td>{t.role==='admin'?'ทั้งหมด':(t.familyIds||[]).join(', ')}</td><td><Badge kind={t.active?'pass':'neutral'}>{t.active?'ใช้งาน':'ปิด'}</Badge></td><td>{t.role==='teacher'&&<button className="text-button" onClick={()=>load(t)}>แก้ไข</button>}</td></tr>)}</tbody></table></div></section>;
}
function StudentsAdmin({students,families,notify}) {
  const [preview,setPreview] = useState([]); const [errors,setErrors] = useState([]); const [busy,setBusy] = useState(false);
  const [progress,setProgress] = useState('');
  async function readFile(e) {const file=e.target.files?.[0];if(!file)return;try{if(file.size > 2_000_000) throw Error('ไฟล์มีขนาดเกิน 2 MB'); if(!families.length) throw Error('กรุณาสร้าง KP Family ก่อนนำเข้ารายชื่อ'); const list=parseCSV(await file.text()).map(normalizeStudent);const seen=new Set(), issues=[];
    list.forEach((s,i)=>{const err=validateStudent(s,families.map(f=>f.id));if(err)issues.push(`แถว ${i+2}: ${err}`);if(seen.has(s.studentId))issues.push(`แถว ${i+2}: รหัส ${s.studentId} ซ้ำในไฟล์`);seen.add(s.studentId);});
    setErrors(issues);setPreview(list);if(issues.length)notify(`พบข้อมูลที่ต้องแก้ไข ${issues.length} รายการ`,'error');else notify(`อ่านไฟล์สำเร็จ ${list.length} รายการ`);
  }catch(err){setPreview([]);setErrors([err.message]);notify(err.message,'error');}}
  async function importRows(){if(!preview.length||errors.length)return;setBusy(true);try{await upsertStudents(preview,(done,total)=>setProgress(`นำเข้า ${done} / ${total} คน`));notify(`นำเข้าหรืออัปเดตนักเรียน ${preview.length} คนเรียบร้อย`);setPreview([]);setProgress('');}catch(err){notify(prettyError(err),'error');}finally{setBusy(false);}}
  function sample(){saveText('kp-uniform-students-template.csv',toCSV(['studentId','name','room','familyId'],[{studentId:'ST001',name:'นักเรียนตัวอย่าง',room:'ม.3/1',familyId:'F01'}]));}
  return <section className="card card-pad"><div className="card-title"><div><h2>ข้อมูลนักเรียน</h2><p className="text-sm text-slate-500 mt-1">ปัจจุบันมี {students.length} คนในฐานข้อมูล · นำเข้าหรืออัปเดตผ่าน CSV UTF-8</p></div><button className="btn btn-outline" onClick={sample}><Download className="size-4"/> ดาวน์โหลดไฟล์ตัวอย่าง</button></div>
    <div className="import-zone mt-5"><Upload className="size-9 text-blue-800 mx-auto mb-3"/><h3 className="font-bold">เลือกไฟล์รายชื่อนักเรียน (.csv)</h3><p className="text-sm text-slate-500 my-2">คอลัมน์ต้องเป็น studentId, name, room, familyId ตามลำดับใดก็ได้</p><label className="btn btn-primary mt-3 cursor-pointer"><FileSpreadsheet className="size-4"/> เลือกไฟล์ CSV <input type="file" accept=".csv,text/csv" className="hidden" onChange={readFile}/></label></div>
    <div className="note-line mt-4"><AlertTriangle className="size-4 shrink-0"/> ตรวจสอบรหัสนักเรียนก่อนนำเข้า เพราะการนำเข้าจะอัปเดตข้อมูลเดิมที่มีรหัสตรงกัน และไม่ลบนักเรียนที่ไม่อยู่ในไฟล์</div>
    {errors.length>0&&<div className="warning-banner mt-4"><div><b>พบข้อผิดพลาด {errors.length} รายการ</b><ul className="list-disc ml-5 mt-2">{errors.slice(0,12).map((v,i)=><li key={i}>{v}</li>)}</ul>{errors.length>12&&<p>และรายการอื่นอีก {errors.length-12} รายการ</p>}</div></div>}
    {preview.length>0&&<div className="mt-5"><div className="flex justify-between items-center gap-3"><h3 className="font-bold">ตัวอย่างข้อมูล {preview.length} คน (แสดง 8 คนแรก)</h3><button className="btn btn-primary" onClick={importRows} disabled={busy||errors.length>0}>{busy?<LoaderCircle className="animate-spin size-4"/>:<Upload className="size-4"/>}{progress||'ยืนยันนำเข้า'}</button></div><div className="table-scroll mt-3"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ห้อง</th><th>KP Family</th></tr></thead><tbody>{preview.slice(0,8).map((s,i)=><tr key={i}><td>{s.studentId}</td><td>{s.name}</td><td>{s.room}</td><td>{s.familyId}</td></tr>)}</tbody></table></div></div>}
    <div className="mt-5"><h3 className="font-bold mb-2">ข้อควรระวังเรื่องข้อมูลส่วนบุคคล</h3><p className="text-sm text-slate-600 leading-relaxed">นำเข้าเฉพาะข้อมูลที่จำเป็น ได้แก่ รหัส ชื่อ ห้อง และ KP Family ไม่ต้องนำเข้าที่อยู่ เลขบัตรประชาชน ข้อมูลสุขภาพ หรือเบอร์โทรศัพท์ และอย่า Commit ไฟล์รายชื่อนักเรียนจริงลง GitHub</p></div>
  </section>;
}

export default function App(){return <AppShell/>;}