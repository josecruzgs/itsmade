import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "itsMade — Servicios profesionales de limpieza",
  description:
    "Plataforma de gestión y feedback automatizado por WhatsApp para servicios profesionales de limpieza itsMade.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

// Inline pre-hydration script para aplicar el tema sin parpadeo (FOUC).
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (t === 'dark' || (!t && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
