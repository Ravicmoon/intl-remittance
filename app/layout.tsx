export const metadata = { title: "LightVision Remittance" };

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
