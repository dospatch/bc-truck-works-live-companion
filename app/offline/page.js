import Link from "next/link";
export default function OfflinePage(){return <main className="convoy-page"><section className="pair-panel"><h1>You're offline</h1><p>The live convoy needs an internet connection. You can still open this saved page, then reconnect to see fresh driver telemetry.</p><Link className="convoy-link" href="/convoy">Try convoy again</Link></section></main>;}
