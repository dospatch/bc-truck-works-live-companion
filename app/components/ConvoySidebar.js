"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups = [
  { label: "DRIVER TOOLS", links: [
    { href: "/", icon: "▦", label: "Dashboard" },
    { href: "/convoy", icon: "🚛", label: "Live convoy" },
    { href: "/connect-my-game", icon: "⌁", label: "Connect my game" },
  ]},
  { label: "COMPANION", links: [
    { href: "/#voice", icon: "♫", label: "Voice commands" },
    { href: "/#alerts", icon: "♧", label: "Alerts & settings" },
  ]},
];
export default function ConvoySidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <>
    <button className="mobile-nav-toggle" type="button" aria-expanded={open} aria-controls="convoy-sidebar" onClick={() => setOpen(v => !v)}>{open ? "✕ Close menu" : "☰ Menu"}</button>
    {open && <button className="sidebar-scrim" aria-label="Close navigation menu" onClick={() => setOpen(false)} />}
    <aside id="convoy-sidebar" className={`convoy-sidebar ${open ? "is-open" : ""}`}>
      <Link className="convoy-brand" href="/" onClick={() => setOpen(false)}>
        <span className="convoy-brand-mark">BC</span>
        <strong>BC TRUCK WORKS</strong>
        <small>LIVE COMPANION</small>
      </Link>
      {groups.map(group => <nav className="convoy-nav-group" aria-label={group.label} key={group.label}>
        <p>{group.label}</p>
        {group.links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={`convoy-nav-link ${pathname === link.href ? "active" : ""}`}><span aria-hidden="true">{link.icon}</span>{link.label}</Link>)}
      </nav>)}
      <div className="convoy-sidebar-footer"><span className="sidebar-online-dot" /> <span><b>Companion ready</b><small>ATS • ETS2 • Convoy</small></span></div>
    </aside>
  </>;
}
