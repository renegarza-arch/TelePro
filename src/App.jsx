import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Cloud,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  Info,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  PenSquare,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  User,
  Wifi,
  Wrench,
  X,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const STORAGE_KEY = 'nwisd-field-app-v3'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SUPABASE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'survey-photos'
const supabase = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null

const DISPOSITIONS = [
  { code: 'R', label: 'Reuse', tone: 'bg-emerald-600 text-white border-emerald-600' },
  { code: 'X', label: 'Replace', tone: 'bg-orange-600 text-white border-orange-600' },
  { code: 'D', label: 'Demo', tone: 'bg-rose-700 text-white border-rose-700' },
  { code: 'T', label: 'TBD', tone: 'bg-amber-500 text-white border-amber-500' },
]
const FUNCTIONAL = ['Pass', 'Fail', 'N/A']
const CONDITION = ['Good', 'Fair', 'Poor', 'N/A']
const MEASUREMENT_TYPES = ['SPL A-Weighted', 'SPL C-Weighted', 'STI / Intelligibility', 'Background Noise', 'Octave Band Snapshot']

const CATEGORIES = [
  'AV Rack Frame & Infrastructure',
  'UPS / Power Conditioning',
  'Main Amplification',
  'Press Box Amplification',
  'DSP / Signal Processing',
  'Console (Yamaha TF1)',
  'Wall Plates / Input Panels',
  'Wireless Microphone Systems',
  'Main PA Loudspeakers',
  'Scoreboard Sound Cabinet',
  'Scoreboard Structural Support',
  'Fiber Backbone',
  'Fiber Terminations',
  'Press Box Loudspeakers',
  'Press Box Monitoring / Talkback',
  'Intercom System',
  'RF Antenna Distribution',
]

const SURVEY_SECTIONS = [
  { id: 'rack', title: 'Rack & Power', icon: Wrench, items: ['Equipment rack frame(s)', 'Rack power distribution / PDU', 'UPS / surge protection', 'Rack ventilation / cooling', 'Grounding / bonding bar', 'Cable management / labeling', 'Daktronics rack (existing)'] },
  { id: 'amps', title: 'Amplifiers', icon: Wifi, items: ['Main Amp #1', 'Main Amp #2', 'Main Amp #3', 'Press Box Amp', 'Additional amp A', 'Additional amp B'] },
  { id: 'dsp', title: 'DSP & Control', icon: ListChecks, items: ['DSP processor unit', 'Audio network switch', 'Control processor', 'Stored configuration file'] },
  { id: 'console', title: 'Console (TF1)', icon: ClipboardList, items: ['Yamaha TF1 console', 'Console scene memory / patch', 'I/O rack / stagebox', 'Console power & network'] },
  { id: 'inputs', title: 'Inputs & Interfaces', icon: Info, items: ['Wall plates (see schedule)', 'Wireless mic — main', 'Wireless mic — coach / sideline', 'Playback: CD / media player', 'Playback: computer / streaming', 'Video input — scoreboard feed'] },
  { id: 'mainpa', title: 'Main PA', icon: Home, items: ['Home — main cluster / array', 'Home — delay / fill', 'Visitor — main cluster / array', 'Visitor — delay / fill', 'End zone — north', 'End zone — south', 'Concourse / secondary'] },
  { id: 'scoreboard', title: 'Scoreboard', icon: ShieldCheck, items: ['Sound cabinet enclosure', 'Cabinet drivers', 'Mounting hardware / rigging', 'Scoreboard structural framing', 'Cable entry / weatherproofing'] },
  { id: 'fiber', title: 'Fiber', icon: ShieldCheck, items: ['Fiber backbone — AV to field / press box', 'Fiber strands to scoreboard', 'Term box — AV room', 'Term box — field side', 'Term box — scoreboard', 'Media converters'] },
  { id: 'pressbox', title: 'Press Box', icon: MapPin, items: ['Press box loudspeakers', 'Announcer position monitor', 'Talkback / coordination stations', 'Booth-to-PA routing'] },
  { id: 'intercom', title: 'Intercom & RF', icon: User, items: ['Intercom main station / base', 'Intercom beltpacks / stations', 'Intercom antenna distribution', 'RF frequency coordination file'] },
]

const OWNER_SUMMARY_BUCKETS = ['Critical findings', 'Reuse items needing verification', 'Replace scope drivers', 'Demo coordination notes', 'Open questions / TBD']

const SQL_SETUP = `create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_name text not null,
  site text,
  survey_date date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop policy if exists "Users can read own projects" on public.projects;
create policy "Users can read own projects"
on public.projects for select
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects"
on public.projects for insert
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
on public.projects for update
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
on public.projects for delete
using (auth.uid() is not null and auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('survey-photos', 'survey-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users can view own photos" on storage.objects;
create policy "Users can view own photos"
on storage.objects for select
using (bucket_id = 'survey-photos' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own photos" on storage.objects;
create policy "Users can upload own photos"
on storage.objects for insert
with check (bucket_id = 'survey-photos' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own photos" on storage.objects;
create policy "Users can update own photos"
on storage.objects for update
using (bucket_id = 'survey-photos' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own photos" on storage.objects;
create policy "Users can delete own photos"
on storage.objects for delete
using (bucket_id = 'survey-photos' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);`

const uid = () => Math.random().toString(36).slice(2, 10)
const cx = (...parts) => parts.filter(Boolean).join(' ')

function buildItem(name) {
  return { id: uid(), name, disposition: '', functional: '', condition: '', notes: '', location: '', tag: '', photos: [], verified: false }
}

function buildInitialState() {
  return {
    cloud: { projectId: '', lastSyncedAt: '', syncStatus: 'Local only' },
    project: {
      projectName: 'NWISD Stadium AV System Refresh',
      projectNumber: '',
      site: '',
      surveyDate: new Date().toISOString().slice(0, 10),
      surveyor: '',
      ownerRep: '',
      company: 'TelePro Communications, Inc.',
      weather: '',
      systemStatus: '',
    },
    categories: Object.fromEntries(CATEGORIES.map((n) => [n, { disposition: '', rationale: '' }])),
    sections: Object.fromEntries(SURVEY_SECTIONS.map((s) => [s.id, { title: s.title, items: s.items.map(buildItem) }])),
    measurements: {
      positions: [{ id: uid(), label: 'Home Bleachers - Mid', area: 'Home Side', type: 'SPL A-Weighted', source: 'Main PA', value: '', unit: 'dBA', passFail: '', notes: '' }],
      octaveBands: [{ id: uid(), label: 'Press Box Ref', hz63: '', hz125: '', hz250: '', hz500: '', hz1k: '', hz2k: '', hz4k: '', hz8k: '', notes: '' }],
      subjective: [''],
    },
    findings: Object.fromEntries(OWNER_SUMMARY_BUCKETS.map((b) => [b, ['']])),
    signoff: { siteReady: false, commissioningComplete: false, ownerReviewComplete: false, internalNotes: '', ownerName: '', ownerTitle: '', ownerSignature: '', teleproName: '', teleproTitle: '', teleproSignature: '', signedDate: '' },
    meta: { version: 3, lastSavedAt: '' },
  }
}

function usePersistentState() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : buildInitialState()
    } catch {
      return buildInitialState()
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, meta: { ...state.meta, lastSavedAt: new Date().toISOString() } }))
  }, [state])

  return [state, setState]
}

function SectionCard({ title, subtitle, children, actions }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
    </label>
  )
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
    </label>
  )
}

function Segmented({ options, value, onChange }) {
  return <div className="flex flex-wrap gap-2">{options.map((o) => <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)} className={cx('rounded-full border px-4 py-2 text-sm font-medium transition', value === o ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700')}>{o}</button>)}</div>
}

function DispositionPicker({ value, onChange }) {
  return <div className="grid grid-cols-4 gap-2">{DISPOSITIONS.map((it) => <button key={it.code} type="button" onClick={() => onChange(value === it.code ? '' : it.code)} className={cx('rounded-2xl border px-3 py-3 text-center text-sm font-bold transition', value === it.code ? it.tone : 'border-slate-200 bg-white text-slate-700')}><div>{it.code}</div><div className="mt-1 text-[11px] font-medium opacity-90">{it.label}</div></button>)}</div>
}

function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height)
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
      }
      img.src = value
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height)
    }
  }, [value])

  const point = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = event.touches?.[0]
    const clientX = touch ? touch.clientX : event.clientX
    const clientY = touch ? touch.clientY : event.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const begin = (event) => {
    event.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDrawing(true)
  }
  const move = (event) => {
    if (!drawing) return
    event.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = point(event)
    ctx.lineTo(x, y)
    ctx.stroke()
    onChange(canvas.toDataURL('image/png'))
  }
  const end = () => setDrawing(false)
  const clear = () => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, rect.width, rect.height)
    onChange('')
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <button type="button" onClick={clear} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">Clear</button>
      </div>
      <canvas ref={canvasRef} className="h-40 w-full rounded-2xl border border-dashed border-slate-300 bg-white touch-none" onMouseDown={begin} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={begin} onTouchMove={move} onTouchEnd={end} />
    </div>
  )
}

function AppHeader({ onMenu, state, completion, user, cloudReady }) {
  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={onMenu} className="rounded-2xl border border-slate-200 p-2 text-slate-700 shadow-sm sm:hidden" type="button"><Menu size={18} /></button>
          <div>
            <div className="text-sm font-semibold text-slate-900">NWISD Stadium Survey</div>
            <div className="text-xs text-slate-500">Field checklist, photos, measurements, report, sign-off</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:block">Saved {state.meta.lastSavedAt ? new Date(state.meta.lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'locally'}</div>
          <div className={cx('hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:block', cloudReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{cloudReady ? (user ? 'Cloud connected' : 'Cloud ready') : 'Supabase not configured'}</div>
          <div className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">{completion}% complete</div>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ open, setOpen, currentTab, setCurrentTab, state }) {
  const nav = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'survey', label: 'Survey', icon: ClipboardList },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'measurements', label: 'Measurements', icon: Info },
    { id: 'report', label: 'Report', icon: FileText },
    { id: 'sync', label: 'Cloud / Sync', icon: Cloud },
    { id: 'signoff', label: 'Sign-off', icon: PenSquare },
  ]

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-0 sm:py-0">
        <div className="sm:hidden"><div className="text-sm font-semibold text-slate-900">Sections</div><div className="text-xs text-slate-500">Jump where you need to go</div></div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 sm:hidden"><X size={18} /></button>
      </div>
      <div className="space-y-2 p-4 sm:p-0">{nav.map((item) => { const Icon = item.icon; const active = currentTab === item.id; return <button key={item.id} type="button" onClick={() => { setCurrentTab(item.id); setOpen(false) }} className={cx('flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition', active ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50')}><div className="flex items-center gap-3"><Icon size={18} /><span className="text-sm font-medium">{item.label}</span></div><ChevronRight size={16} /></button> })}</div>
      <div className="mt-auto border-t border-slate-200 p-4 sm:px-0"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</div><div className="mt-1 text-sm font-semibold text-slate-900">{state.project.projectName || 'Untitled project'}</div><div className="mt-1 text-xs text-slate-500">{state.project.site || 'Site not entered yet'}</div></div></div>
    </div>
  )

  return (
    <>
      <div className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-6 sm:block">{content}</div>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 sm:hidden" />
            <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-sm border-r border-slate-200 bg-white shadow-2xl sm:hidden">{content}</motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function AuthCard({ email, setEmail, onMagicLink, onSignOut, user, authLoading, cloudReady }) {
  return (
    <SectionCard title="Authentication" subtitle={cloudReady ? 'Magic-link auth for per-user access and row-level security.' : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable cloud auth.'}>
      {!cloudReady ? <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800">Cloud is disabled until the Vite Supabase env vars are added.</div> : user ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-sm font-semibold text-slate-900">Signed in</div><div className="text-sm text-slate-600">{user.email}</div></div>
          <button type="button" onClick={onSignOut} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><LogOut size={16} /> Sign out</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Input label="Email" value={email} onChange={setEmail} placeholder="name@company.com" />
          <div className="flex items-end"><button type="button" disabled={authLoading || !email} onClick={onMagicLink} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><LogIn size={16} /> {authLoading ? 'Sending...' : 'Send magic link'}</button></div>
        </div>
      )}
    </SectionCard>
  )
}

function OverviewTab({ state, setState, completion }) {
  const p = state.project
  const updateProject = (k, v) => setState((prev) => ({ ...prev, project: { ...prev.project, [k]: v } }))
  const updateCategory = (n, k, v) => setState((prev) => ({ ...prev, categories: { ...prev.categories, [n]: { ...prev.categories[n], [k]: v } } }))
  const counts = useMemo(() => {
    const items = Object.values(state.sections).flatMap((s) => s.items)
    return { total: items.length, photos: items.reduce((a, i) => a + i.photos.length, 0), verified: items.filter((i) => i.verified).length, replace: items.filter((i) => i.disposition === 'X').length }
  }, [state.sections])
  return (
    <div className="space-y-6">
      <SectionCard title="Project setup" subtitle="These values feed the cloud record and PDF report."><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"><Input label="Project name" value={p.projectName} onChange={(v) => updateProject('projectName', v)} /><Input label="Project number" value={p.projectNumber} onChange={(v) => updateProject('projectNumber', v)} /><Input label="Survey date" type="date" value={p.surveyDate} onChange={(v) => updateProject('surveyDate', v)} /><Input label="Site" value={p.site} onChange={(v) => updateProject('site', v)} placeholder="Campus / address" /><Input label="Lead surveyor" value={p.surveyor} onChange={(v) => updateProject('surveyor', v)} /><Input label="Owner rep" value={p.ownerRep} onChange={(v) => updateProject('ownerRep', v)} /><Input label="Company" value={p.company} onChange={(v) => updateProject('company', v)} /><Input label="Weather / conditions" value={p.weather} onChange={(v) => updateProject('weather', v)} /><Input label="System status" value={p.systemStatus} onChange={(v) => updateProject('systemStatus', v)} /></div></SectionCard>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[{ label: 'Completion', value: `${completion}%`, icon: CheckCircle2 }, { label: 'Checklist items', value: counts.total, icon: ClipboardList }, { label: 'Photos attached', value: counts.photos, icon: Camera }, { label: 'Replace items', value: counts.replace, icon: Wrench }].map((s) => { const I = s.icon; return <div key={s.label} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</span><I size={16} className="text-slate-400" /></div><div className="mt-4 text-2xl font-semibold text-slate-900">{s.value}</div></div> })}</div>
      <SectionCard title="Category disposition summary" subtitle="Set top-level system intent before item-by-item verification."><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{CATEGORIES.map((c) => <div key={c} className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">{c}</div><div className="mt-3"><DispositionPicker value={state.categories?.[c]?.disposition || ''} onChange={(v) => updateCategory(c, 'disposition', v)} /></div><div className="mt-3"><Textarea label="Rationale" value={state.categories?.[c]?.rationale || ''} onChange={(v) => updateCategory(c, 'rationale', v)} rows={2} /></div></div>)}</div></SectionCard>
    </div>
  )
}

async function uploadPhotoToSupabase(userId, projectId, itemId, file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const path = `${userId}/${projectId}/${itemId}/${crypto.randomUUID ? crypto.randomUUID() : uid()}.${ext}`
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
  if (error) throw error
  const { data: signed } = await supabase.storage.from(SUPABASE_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
  return { id: uid(), name: file.name, storagePath: path, signedUrl: signed?.signedUrl || '', createdAt: new Date().toISOString() }
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function SurveyTab({ state, setState, user }) {
  const [active, setActive] = useState(SURVEY_SECTIONS[0].id)
  const [uploadingFor, setUploadingFor] = useState('')
  const sec = SURVEY_SECTIONS.find((s) => s.id === active)
  const data = state.sections[active]
  const updateItem = (id, fn) => setState((prev) => ({ ...prev, sections: { ...prev.sections, [active]: { ...prev.sections[active], items: prev.sections[active].items.map((it) => it.id === id ? fn(it) : it) } } }))

  const addPhotos = async (id, files) => {
    if (user && state.cloud.projectId && supabase) {
      setUploadingFor(id)
      try {
        const uploaded = await Promise.all(Array.from(files).map((f) => uploadPhotoToSupabase(user.id, state.cloud.projectId, id, f)))
        updateItem(id, (it) => ({ ...it, photos: [...it.photos, ...uploaded] }))
      } finally {
        setUploadingFor('')
      }
    } else {
      const fallback = await Promise.all(Array.from(files).map(async (f) => ({ id: uid(), name: f.name, dataUrl: await fileToDataUrl(f), createdAt: new Date().toISOString() })))
      updateItem(id, (it) => ({ ...it, photos: [...it.photos, ...fallback] }))
    }
  }

  const removePhoto = (id, pid) => updateItem(id, (it) => ({ ...it, photos: it.photos.filter((p) => p.id !== pid) }))

  return (
    <div className="space-y-6">
      <SectionCard title="Checklist survey" subtitle="Tap-friendly cards for field use."><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{SURVEY_SECTIONS.map((s) => { const I = s.icon; return <button key={s.id} onClick={() => setActive(s.id)} className={cx('flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm', s.id === active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700')}><I size={16} />{s.title}</button> })}</div></SectionCard>
      <SectionCard title={sec.title} subtitle="Disposition → function/condition → notes/photos" actions={<div className="text-xs text-slate-500">{data.items.length} items</div>}>
        <div className="space-y-4">{data.items.map((item) => <motion.div key={item.id} layout className="rounded-[28px] border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between"><div><div className="text-sm font-semibold text-slate-900">{item.name}</div><div className="text-xs text-slate-500">{item.photos.length} photos</div></div><button onClick={() => updateItem(item.id, (p) => ({ ...p, verified: !p.verified }))} className={cx('rounded-full border px-3 py-1.5 text-xs', item.verified ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>{item.verified ? 'Verified' : 'Mark verified'}</button></div><div className="mt-3"><DispositionPicker value={item.disposition} onChange={(v) => updateItem(item.id, (p) => ({ ...p, disposition: v }))} /></div><div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2"><Segmented options={FUNCTIONAL} value={item.functional} onChange={(v) => updateItem(item.id, (p) => ({ ...p, functional: v }))} /><Segmented options={CONDITION} value={item.condition} onChange={(v) => updateItem(item.id, (p) => ({ ...p, condition: v }))} /></div><div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3"><Input label="Location" value={item.location} onChange={(v) => updateItem(item.id, (p) => ({ ...p, location: v }))} /><Input label="Photo tag" value={item.tag} onChange={(v) => updateItem(item.id, (p) => ({ ...p, tag: v }))} /><label className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm">{uploadingFor === item.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {uploadingFor === item.id ? 'Uploading...' : 'Add images'}<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { const f = e.target.files; if (f?.length) addPhotos(item.id, f); e.target.value = '' }} /></label></div><div className="mt-3"><Textarea label="Notes" value={item.notes} onChange={(v) => updateItem(item.id, (p) => ({ ...p, notes: v }))} /></div>{item.photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{item.photos.map((p) => <div key={p.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><img src={p.signedUrl || p.dataUrl} className="h-28 w-full object-cover" /><div className="p-3"><button onClick={() => removePhoto(item.id, p.id)} className="w-full rounded-full border px-3 py-1.5 text-xs">Remove</button></div></div>)}</div>}</motion.div>)}</div>
      </SectionCard>
    </div>
  )
}

function PhotosTab({ state }) {
  const photos = Object.values(state.sections).flatMap((s) => s.items.flatMap((i) => i.photos.map((p) => ({ ...p, itemName: i.name, sectionTitle: s.title, location: i.location }))))
  return <div className="space-y-6"><SectionCard title="Photo log" subtitle="All photos tied to items">{photos.length === 0 ? <div className="rounded-3xl border border-dashed p-10 text-center"><ImageIcon className="mx-auto text-slate-400" size={28} /><div className="mt-2 text-sm">No photos yet</div></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{photos.map((p) => <div key={p.id} className="rounded-[28px] border bg-white"><img src={p.signedUrl || p.dataUrl} className="h-56 w-full object-cover" /><div className="p-4 text-sm"><div className="font-semibold">{p.itemName}</div><div className="text-xs text-slate-500">{p.sectionTitle}</div>{p.location && <div className="text-xs">{p.location}</div>}</div></div>)}</div>}</SectionCard></div>
}

function MeasurementsTab({ state, setState }) {
  const m = state.measurements
  const up = (id, k, v) => setState((prev) => ({ ...prev, measurements: { ...prev.measurements, positions: prev.measurements.positions.map((r) => r.id === id ? { ...r, [k]: v } : r) } }))
  const add = () => setState((prev) => ({ ...prev, measurements: { ...prev.measurements, positions: [...prev.measurements.positions, { id: uid(), label: '', area: '', type: 'SPL A-Weighted', source: '', value: '', unit: 'dBA', passFail: '', notes: '' }] } }))
  const upOct = (id, k, v) => setState((prev) => ({ ...prev, measurements: { ...prev.measurements, octaveBands: prev.measurements.octaveBands.map((r) => r.id === id ? { ...r, [k]: v } : r) } }))
  const addOct = () => setState((prev) => ({ ...prev, measurements: { ...prev.measurements, octaveBands: [...prev.measurements.octaveBands, { id: uid(), label: '', hz63: '', hz125: '', hz250: '', hz500: '', hz1k: '', hz2k: '', hz4k: '', hz8k: '', notes: '' }] } }))
  const upSub = (i, v) => setState((prev) => ({ ...prev, measurements: { ...prev.measurements, subjective: prev.measurements.subjective.map((e, ix) => ix === i ? v : e) } }))
  const addSub = () => setState((prev) => ({ ...prev, measurements: { ...prev.measurements, subjective: [...prev.measurements.subjective, ''] } }))
  return <div className="space-y-6"><SectionCard title="Field measurements" actions={<button onClick={add} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"><Plus size={16} /> Add</button>}><div className="space-y-4">{m.positions.map((r) => <div key={r.id} className="rounded-3xl border bg-slate-50 p-4"><div className="grid grid-cols-1 gap-3 xl:grid-cols-4"><Input label="Label" value={r.label} onChange={(v) => up(r.id, 'label', v)} /><Input label="Area" value={r.area} onChange={(v) => up(r.id, 'area', v)} /><label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span><select value={r.type} onChange={(e) => up(r.id, 'type', e.target.value)} className="w-full rounded-2xl border px-3 py-3 text-sm">{MEASUREMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label><Input label="Source" value={r.source} onChange={(v) => up(r.id, 'source', v)} /><Input label="Value" value={r.value} onChange={(v) => up(r.id, 'value', v)} /><Input label="Unit" value={r.unit} onChange={(v) => up(r.id, 'unit', v)} /><Input label="Pass/Fail" value={r.passFail} onChange={(v) => up(r.id, 'passFail', v)} /><div className="xl:col-span-4"><Textarea label="Notes" value={r.notes} onChange={(v) => up(r.id, 'notes', v)} rows={2} /></div></div></div>)}</div></SectionCard><SectionCard title="Octave bands" actions={<button onClick={addOct} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"><Plus size={16} /> Add</button>}><div className="space-y-4">{m.octaveBands.map((r) => <div key={r.id} className="rounded-3xl border bg-slate-50 p-4"><div className="grid grid-cols-2 gap-2 xl:grid-cols-9"><Input label="Label" value={r.label} onChange={(v) => upOct(r.id, 'label', v)} /><Input label="63" value={r.hz63} onChange={(v) => upOct(r.id, 'hz63', v)} /><Input label="125" value={r.hz125} onChange={(v) => upOct(r.id, 'hz125', v)} /><Input label="250" value={r.hz250} onChange={(v) => upOct(r.id, 'hz250', v)} /><Input label="500" value={r.hz500} onChange={(v) => upOct(r.id, 'hz500', v)} /><Input label="1k" value={r.hz1k} onChange={(v) => upOct(r.id, 'hz1k', v)} /><Input label="2k" value={r.hz2k} onChange={(v) => upOct(r.id, 'hz2k', v)} /><Input label="4k" value={r.hz4k} onChange={(v) => upOct(r.id, 'hz4k', v)} /><Input label="8k" value={r.hz8k} onChange={(v) => upOct(r.id, 'hz8k', v)} /></div><div className="mt-2"><Textarea label="Notes" value={r.notes} onChange={(v) => upOct(r.id, 'notes', v)} rows={2} /></div></div>)}</div></SectionCard><SectionCard title="Subjective notes" actions={<button onClick={addSub} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"><Plus size={16} /> Add</button>}><div className="space-y-2">{m.subjective.map((e, i) => <Textarea key={i} label={`Observation ${i + 1}`} value={e} onChange={(v) => upSub(i, v)} rows={2} />)}</div></SectionCard></div>
}

function ReportTab({ state, setState }) {
  const add = (b) => setState((p) => ({ ...p, findings: { ...p.findings, [b]: [...p.findings[b], ''] } }))
  const upd = (b, i, v) => setState((p) => ({ ...p, findings: { ...p.findings, [b]: p.findings[b].map((e, ix) => ix === i ? v : e) } }))
  const exportPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    let y = 40
    const m = 40
    doc.setFontSize(18)
    doc.text(state.project.projectName || 'Field Survey Report', m, y)
    y += 18
    doc.setFontSize(10)
    doc.setTextColor(90)
    doc.text(`Site: ${state.project.site || '—'}`, m, y)
    y += 14
    doc.text(`Date: ${state.project.surveyDate || '—'}  Surveyor: ${state.project.surveyor || '—'}`, m, y)
    y += 20
    autoTable(doc, { startY: y, head: [['Section', 'Item', 'Disp', 'Func', 'Cond', 'Notes']], body: Object.values(state.sections).flatMap((s) => s.items.map((i) => [s.title, i.name, i.disposition || '—', i.functional || '—', i.condition || '—', i.notes || '—'])), styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [15, 23, 42] }, columnStyles: { 5: { cellWidth: 180 } } })
    y = doc.lastAutoTable.finalY + 20
    if (y > 620) { doc.addPage(); y = 40 }
    doc.setFontSize(13)
    doc.text('Measurements', m, y)
    y += 10
    autoTable(doc, { startY: y, head: [['Label', 'Area', 'Type', 'Source', 'Value', 'Unit', 'P/F', 'Notes']], body: (state.measurements.positions || []).map((r) => [r.label || '—', r.area || '—', r.type || '—', r.source || '—', r.value || '—', r.unit || '—', r.passFail || '—', r.notes || '—']), styles: { fontSize: 7, cellPadding: 3 }, headStyles: { fillColor: [15, 23, 42] }, columnStyles: { 7: { cellWidth: 150 } } })
    y = doc.lastAutoTable.finalY + 20
    OWNER_SUMMARY_BUCKETS.forEach((b) => { if (y > 680) { doc.addPage(); y = 40 } doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.text(b, m, y); y += 12; doc.setFontSize(10); doc.setTextColor(70); const arr = state.findings[b].filter(Boolean); if (arr.length === 0) { doc.text('—', m, y + 4); y += 18 } else { arr.forEach((e) => { const lines = doc.splitTextToSize(`• ${e}`, 520); doc.text(lines, m, y + 4); y += lines.length * 12 + 4 }) } y += 12 })
    doc.save(`${(state.project.projectName || 'survey-report').replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }
  return <div className="space-y-6"><SectionCard title="Owner / GC report" subtitle="Cloud-backed field data exports cleanly to PDF." actions={<button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-white text-sm"><Download size={16} /> Export PDF</button>}><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{OWNER_SUMMARY_BUCKETS.map((b) => <div key={b} className="rounded-3xl border bg-slate-50 p-4"><div className="mb-2 flex justify-between"><div className="text-sm font-semibold">{b}</div><button onClick={() => add(b)} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"><Plus size={12} /> Add</button></div>{state.findings[b].map((e, i) => <Textarea key={`${b}-${i}`} label={`Entry ${i + 1}`} value={e} onChange={(v) => upd(b, i, v)} rows={2} />)}</div>)}</div></SectionCard></div>
}

function SyncTab({ state, setState, user, email, setEmail, authLoading, setAuthLoading, projects, setRefreshProjects, cloudReady }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const onMagicLink = async () => {
    if (!supabase || !email) return
    setAuthLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })
    setAuthLoading(false)
    setMessage(error ? error.message : 'Magic link sent. Check your email.')
  }

  const onSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(state.project.projectName || 'survey-data').replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setState((p) => ({ ...p, cloud: { ...p.cloud, lastSyncedAt: new Date().toISOString(), syncStatus: 'Exported package' } }))
  }

  const importJson = async (file) => {
    const text = await file.text()
    setState(JSON.parse(text))
  }

  const saveToCloud = async () => {
    if (!supabase || !user) return
    setBusy(true)
    setMessage('')
    const payload = { user_id: user.id, project_name: state.project.projectName || 'Untitled project', site: state.project.site || null, survey_date: state.project.surveyDate || null, data: state }
    const result = state.cloud.projectId
      ? await supabase.from('projects').update(payload).eq('id', state.cloud.projectId).select('id, project_name, site, survey_date, updated_at').single()
      : await supabase.from('projects').insert(payload).select('id, project_name, site, survey_date, updated_at').single()
    setBusy(false)
    if (result.error) { setMessage(result.error.message); return }
    setState((p) => ({ ...p, cloud: { projectId: result.data.id, lastSyncedAt: new Date().toISOString(), syncStatus: 'Synced to Supabase' } }))
    setRefreshProjects((v) => v + 1)
    setMessage('Cloud save complete.')
  }

  const loadProject = async (id) => {
    if (!supabase) return
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.from('projects').select('id, data').eq('id', id).single()
    setBusy(false)
    if (error) { setMessage(error.message); return }
    setState({ ...data.data, cloud: { ...(data.data.cloud || {}), projectId: data.id, lastSyncedAt: new Date().toISOString(), syncStatus: 'Loaded from Supabase' } })
    setMessage('Project loaded.')
  }

  return (
    <div className="space-y-6">
      <AuthCard email={email} setEmail={setEmail} onMagicLink={onMagicLink} onSignOut={onSignOut} user={user} authLoading={authLoading} cloudReady={cloudReady} />
      {message ? <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</div> : null}
      <SectionCard title="Supabase sync" subtitle="Save the whole survey state as a cloud project record. Photos go to Storage after the project has a cloud id." actions={user ? <button onClick={saveToCloud} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {state.cloud.projectId ? 'Update cloud record' : 'Create cloud record'}</button> : null}><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-3xl border bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">Current cloud state</div><div className="mt-3 space-y-2 text-sm text-slate-600"><div><span className="font-semibold text-slate-900">Project ID:</span> {state.cloud.projectId || 'Not created yet'}</div><div><span className="font-semibold text-slate-900">Status:</span> {state.cloud.syncStatus}</div><div><span className="font-semibold text-slate-900">Last sync:</span> {state.cloud.lastSyncedAt ? new Date(state.cloud.lastSyncedAt).toLocaleString() : 'Never'}</div></div></div><div className="rounded-3xl border bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Your cloud projects</div><button onClick={() => setRefreshProjects((v) => v + 1)} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"><RefreshCw size={12} /> Refresh</button></div>{!user ? <div className="text-sm text-slate-500">Sign in to list cloud projects.</div> : projects.length === 0 ? <div className="text-sm text-slate-500">No cloud projects yet.</div> : <div className="space-y-2">{projects.map((p) => <button key={p.id} onClick={() => loadProject(p.id)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm"><div><div className="font-semibold text-slate-900">{p.project_name}</div><div className="text-xs text-slate-500">{p.site || 'No site'} · {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ''}</div></div><ChevronRight size={14} /></button>)}</div>}</div></div></SectionCard>
      <SectionCard title="Local export / import" subtitle="Good for backups or handoff."><div className="flex flex-col gap-4 sm:flex-row"><button onClick={exportJson} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><Download size={16} /> Export JSON</button><label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><Upload size={16} /> Import JSON<input type="file" accept="application/json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) importJson(file); e.target.value = '' }} /></label></div></SectionCard>
      <SectionCard title="Supabase setup SQL" subtitle="Paste this into the SQL Editor once per project."><textarea readOnly value={SQL_SETUP} rows={18} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800" /></SectionCard>
    </div>
  )
}

function SignoffTab({ state, setState }) {
  const s = state.signoff
  const up = (k, v) => setState((p) => ({ ...p, signoff: { ...p.signoff, [k]: v } }))
  const ready = s.siteReady && s.commissioningComplete && s.ownerReviewComplete
  return <div className="space-y-6"><SectionCard title="Completion"><div className="grid gap-3 sm:grid-cols-3">{[['siteReady', 'Site walk complete'], ['commissioningComplete', 'Commissioning complete'], ['ownerReviewComplete', 'Owner review']].map(([k, l]) => <button key={k} onClick={() => up(k, !s[k])} className={cx('rounded-3xl border px-4 py-4 text-left', s[k] ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white')}>{l}</button>)}</div></SectionCard><SectionCard title="Signatures"><div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><Input label="Owner name" value={s.ownerName} onChange={(v) => up('ownerName', v)} /><Input label="Owner title" value={s.ownerTitle} onChange={(v) => up('ownerTitle', v)} /><Input label="TelePro rep" value={s.teleproName} onChange={(v) => up('teleproName', v)} /><Input label="TelePro title" value={s.teleproTitle} onChange={(v) => up('teleproTitle', v)} /><Input label="Signed date" type="date" value={s.signedDate} onChange={(v) => up('signedDate', v)} /></div><div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2"><SignaturePad label="Owner signature" value={s.ownerSignature} onChange={(v) => up('ownerSignature', v)} /><SignaturePad label="TelePro signature" value={s.teleproSignature} onChange={(v) => up('teleproSignature', v)} /></div></SectionCard><SectionCard title="Closeout notes"><Textarea label="Notes" value={s.internalNotes} onChange={(v) => up('internalNotes', v)} rows={4} /><div className={cx('mt-4 rounded-3xl p-4 text-sm', ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>{ready ? 'Ready for handoff' : 'Complete confirmations above'}</div></SectionCard></div>
}

export default function App() {
  const [state, setState] = usePersistentState()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('overview')
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [projects, setProjects] = useState([])
  const [refreshProjects, setRefreshProjects] = useState(0)
  const cloudReady = Boolean(supabase)

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !user) { setProjects([]); return }
    supabase.from('projects').select('id, project_name, site, updated_at').order('updated_at', { ascending: false }).then(({ data }) => setProjects(data || []))
  }, [user, refreshProjects])

  const completion = useMemo(() => {
    const items = Object.values(state.sections).flatMap((s) => s.items)
    const total = items.length * 4 + 9
    let done = 0
    items.forEach((i) => { if (i.disposition) done += 1; if (i.functional) done += 1; if (i.condition) done += 1; if (i.notes || i.photos.length) done += 1 })
    if (state.project.site) done += 1
    if (state.project.surveyor) done += 1
    if (state.project.ownerRep) done += 1
    if (state.findings['Critical findings'].some(Boolean)) done += 1
    if (state.findings['Replace scope drivers'].some(Boolean)) done += 1
    if (state.signoff.siteReady) done += 1
    if (state.signoff.commissioningComplete) done += 1
    if (state.signoff.ownerReviewComplete) done += 1
    if (state.signoff.ownerSignature || state.signoff.teleproSignature) done += 1
    return Math.min(100, Math.round((done / total) * 100))
  }, [state])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <AppHeader onMenu={() => setOpen(true)} state={state} completion={completion} user={user} cloudReady={cloudReady} />
      <div className="mx-auto flex max-w-6xl">
        <Sidebar open={open} setOpen={setOpen} currentTab={tab} setCurrentTab={setTab} state={state} />
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {tab === 'overview' && <OverviewTab state={state} setState={setState} completion={completion} />}
          {tab === 'survey' && <SurveyTab state={state} setState={setState} user={user} />}
          {tab === 'photos' && <PhotosTab state={state} />}
          {tab === 'measurements' && <MeasurementsTab state={state} setState={setState} />}
          {tab === 'report' && <ReportTab state={state} setState={setState} />}
          {tab === 'sync' && <SyncTab state={state} setState={setState} user={user} email={email} setEmail={setEmail} authLoading={authLoading} setAuthLoading={setAuthLoading} projects={projects} setRefreshProjects={setRefreshProjects} cloudReady={cloudReady} />}
          {tab === 'signoff' && <SignoffTab state={state} setState={setState} />}
        </main>
      </div>
    </div>
  )
}
