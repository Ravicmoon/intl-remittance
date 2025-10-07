export const metadata = { title: "LightVision Remittance", description: "UZ ↔ KR corridor quote demo" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
