import type { Metadata } from "next";
import { ToastContainer } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
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
      data-theme="light"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[var(--theme-bg)] text-[var(--theme-ink)] font-sans selection:bg-[#F59E0B] selection:text-[#0B0C0E]">
        <ThemeProvider>
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
