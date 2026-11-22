"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Eye, EyeOff, KeyRound, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { analyzePasswordCandidate, findPwnedPasswordCount, generateSecurePassword } from "@/lib/personal-workspace-security-core";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";
import { SecurityVault } from "@/components/workspace/SecurityVault";

const hygieneItems = [
  "Use a different password for every important account.",
  "Prefer a long, memorable passphrase over predictable substitutions.",
  "Use a password manager you trust; this page is not one.",
  "Enable multi-factor authentication where available.",
  "Review recovery methods and sign out sessions you no longer recognise.",
];

export function WorkspaceSecurity() {
  const [candidate, setCandidate] = useState("");
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [generated, setGenerated] = useState("");
  const [length, setLength] = useState(20);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [breachState, setBreachState] = useState<"idle" | "checking" | "clear" | "found" | "error">("idle");
  const [breachCount, setBreachCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const analysis = useMemo(() => analyzePasswordCandidate(candidate), [candidate]);
  const hygieneScore = Math.round((checked.length / hygieneItems.length) * 100);

  async function checkExposure() {
    if (!candidate || breachState === "checking") return;
    setBreachState("checking");
    setBreachCount(0);
    try {
      const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(candidate));
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
      const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
        headers: { "Add-Padding": "true" }, cache: "no-store",
      });
      if (!response.ok) throw new Error("Range lookup unavailable");
      const count = findPwnedPasswordCount(await response.text(), hash.slice(5));
      setBreachCount(count);
      setBreachState(count > 0 ? "found" : "clear");
    } catch {
      setBreachState("error");
    }
  }

  function makePassword() {
    try {
      setGenerated(generateSecurePassword({ length, symbols: includeSymbols }));
      setCopied(false);
    } catch {
      setGenerated("");
    }
  }

  async function copyGenerated() {
    if (!generated) return;
    try { await navigator.clipboard.writeText(generated); setCopied(true); }
    catch { setCopied(false); }
  }

  return <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-20 pt-7 text-white sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#D9A441]">Personal Intelligence Workspace · Private by design</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Security analyser</h1><p className="mt-2 max-w-2xl text-sm text-white/60">A local password-strength heuristic and practical account-security checklist.</p></div><div className="rounded-full border border-emerald-200/15 bg-emerald-200/[.06] px-3 py-2 text-xs text-emerald-100"><ShieldCheck className="mr-2 inline" size={15}/>Local-only analysis</div></header>
    <WorkspaceSectionNav active="security" />
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <LiquidLensSurface radius={26} className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-[#F2CF86]">Password strength</p><h2 className="mt-2 text-xl font-semibold">Check a new candidate</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">{analysis.rating}</span></div>
        <p className="mt-3 text-sm leading-6 text-amber-100/80">Never enter a password you currently use for a critical account unless you choose the optional breach lookup below. The candidate and full hash remain in this browser; the lookup sends only the first five SHA-1 hash characters.</p>
        <label className="mt-5 block text-sm text-white/75" htmlFor="security-candidate">Candidate for local analysis or optional breach lookup</label>
        <div className="mt-2 flex gap-2"><input id="security-candidate" type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} value={candidate} onChange={(event) => { setCandidate(event.target.value); setBreachState("idle"); setBreachCount(0); }} aria-describedby="candidate-privacy" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none transition placeholder:text-white/30 focus:border-[#D9A441]/60 focus:ring-2 focus:ring-[#D9A441]/20" placeholder="Enter a new candidate only"/><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide candidate" : "Show candidate"} className="rounded-2xl border border-white/10 px-3 text-white/70 hover:bg-white/10">{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button><button type="button" onClick={() => { setCandidate(""); setVisible(false); setBreachState("idle"); setBreachCount(0); }} aria-label="Clear candidate" className="rounded-2xl border border-white/10 px-3 text-white/70 hover:bg-white/10"><Trash2 size={18}/></button></div>
        <p id="candidate-privacy" className="mt-2 text-xs text-white/45">Analysis runs in this browser component. The value is not submitted, saved, logged, or added to a URL.</p>
        <div className="mt-6"><div className="flex items-center justify-between text-sm"><span className="text-white/70">Heuristic score</span><span className="font-semibold tabular-nums">{analysis.score}/100</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#D9A441] to-emerald-200 transition-[width] duration-300" style={{ width: `${analysis.score}%` }}/></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/50 sm:grid-cols-3"><span>Length: {analysis.length}</span><span>Character groups: {analysis.characterGroups}/4</span><span>Distinctness: {Math.round(analysis.uniqueCharacterRatio * 100)}%</span></div></div>
        {analysis.recommendations.length > 0 && <ul className="mt-5 grid gap-2">{analysis.recommendations.map((tip) => <li key={tip} className="flex gap-2 text-sm leading-5 text-white/70"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D9A441]"/>{tip}</li>)}</ul>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void checkExposure()} disabled={!candidate || breachState === "checking"} className="min-h-10 rounded-full border border-white/15 px-4 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50">{breachState === "checking" ? "Checking range…" : "Check breach exposure"}</button>
          {breachState === "found" && <span role="status" className="text-sm text-rose-200">Found {breachCount.toLocaleString()} time{breachCount === 1 ? "" : "s"} in the HIBP corpus. Avoid this password.</span>}
          {breachState === "clear" && <span role="status" className="text-sm text-emerald-200">No match found in the current HIBP corpus. This is not a guarantee of safety.</span>}
          {breachState === "error" && <span role="status" className="text-sm text-amber-200">Lookup unavailable. Try again later.</span>}
        </div>
        <p className="mt-2 text-xs leading-5 text-white/45">SHA-1 is used only to follow Have I Been Pwned’s range lookup protocol. The site receives only the 5-character prefix; matching is local. No breach result is saved.</p>
      </LiquidLensSurface>
      <LiquidLensSurface radius={26} className="p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[.16em] text-[#F2CF86]">Security hygiene</p><h2 className="mt-2 text-xl font-semibold">Small steps, stronger accounts</h2></div><span className="text-2xl font-semibold tabular-nums">{hygieneScore}<span className="text-sm text-white/45">%</span></span></div><p className="mt-2 text-sm text-white/55">Self-assessment only; this score does not inspect your accounts or current MFA state.</p><div className="mt-5 grid gap-3">{hygieneItems.map((item) => <label key={item} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/8 bg-black/10 p-3 text-sm leading-5 text-white/70"><input type="checkbox" checked={checked.includes(item)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} className="mt-1 accent-[#D9A441]"/><span>{checked.includes(item) && <CheckCircle2 className="mr-1 inline text-emerald-200" size={14} />}{item}</span></label>)}</div><div className="mt-5 rounded-2xl border border-white/8 bg-white/[.03] p-4 text-xs leading-5 text-white/50">A privacy-preserving analyser cannot confirm whether a candidate has appeared in a breach. Do not interpret this heuristic as a security guarantee.</div></LiquidLensSurface>
    </div>
    <section aria-labelledby="generator-heading" className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <LiquidLensSurface radius={26} className="p-5 sm:p-7">
        <div className="flex items-center gap-3"><KeyRound className="text-[#F2CF86]"/><div><p className="text-xs uppercase tracking-[.16em] text-[#F2CF86]">Secure generator</p><h2 id="generator-heading" className="mt-1 text-xl font-semibold">Create a new password</h2></div></div>
        <p className="mt-3 text-sm text-white/55">Generated with the browser’s cryptographically secure random source. Nothing is saved to an account or vault.</p>
        <label htmlFor="password-length" className="mt-5 block text-sm text-white/70">Length: {length}</label>
        <input id="password-length" type="range" min="12" max="64" value={length} onChange={(event) => setLength(Number(event.target.value))} className="mt-2 w-full accent-[#D9A441]" />
        <label className="mt-3 flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={includeSymbols} onChange={(event) => setIncludeSymbols(event.target.checked)} className="accent-[#D9A441]"/>Include symbols</label>
        <div aria-live="polite" className="mt-4 min-h-12 break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-sm text-white/85">{generated || "Select Generate to create a password"}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={makePassword} className="min-h-10 rounded-full bg-[#D9A441] px-4 text-sm font-semibold text-[#17130b]">Generate</button><button type="button" onClick={() => void copyGenerated()} disabled={!generated} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white/75 disabled:opacity-40"><Copy size={15}/>{copied ? "Copied" : "Copy"}</button></div>
        <p className="mt-3 text-xs text-white/45">Clipboard contents may remain available to other apps until replaced. Clear it after use.</p>
      </LiquidLensSurface>
      <LiquidLensSurface radius={26} className="p-5 sm:p-7">
        <p className="text-xs uppercase tracking-[.16em] text-[#F2CF86]">Account protection</p><h2 className="mt-2 text-xl font-semibold">Manage real security settings</h2>
        <p className="mt-2 text-sm leading-6 text-white/55">These links open existing account controls. Their status is not inferred or scored on this page.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/dashboard/security/sessions" className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-white/80 hover:bg-white/[.08]"><Smartphone size={18} className="text-[#F2CF86]"/>Review sessions &amp; passkeys</Link>
          <Link href="/mfa/enroll" className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-white/80 hover:bg-white/[.08]"><ShieldCheck size={18} className="text-[#F2CF86]"/>Set up authenticator MFA</Link>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-100/[.04] p-4 text-sm leading-6 text-amber-100/75">This Security Centre does not store credentials. A zero-knowledge vault, recovery flow, encrypted notes, import/export and account inventory are not available yet; never paste existing account passwords into the candidate analyser.</div>
      </LiquidLensSurface>
    </section>
    <SecurityVault />
  </main>;
}
