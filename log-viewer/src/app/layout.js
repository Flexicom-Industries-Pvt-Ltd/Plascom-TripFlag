import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from 'next/link';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "TripFlag Log Center",
  description: "Enterprise Logs & Telemetry",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <div className="layout">
          {/* Global Top Navbar */}
          <nav className="top-nav">
            <div className="nav-brand">
              <div className="logo-box">tf</div>
              <h2>TripFlag Log Center</h2>
              
              <div className="nav-links">
                <Link href="/">API Traffic</Link>
                <Link href="/ai">AI Usage</Link>
              </div>
            </div>
            <div className="nav-actions">
              <span>Enterprise Edition</span>
              <div className="avatar">A</div>
            </div>
          </nav>
          
          {children}
        </div>
      </body>
    </html>
  );
}
