import type { Metadata } from "next";
import { ToastContainer } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carteira de Apps — Construtora",
  description: "Protótipo navegável para apresentação de aplicativos e controle de obras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#0B0C0E] text-[#F3F4F6] font-sans selection:bg-[#F59E0B] selection:text-[#0B0C0E]">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
