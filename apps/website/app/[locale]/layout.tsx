import "../globals.css";
import { notFound } from "next/navigation";
import { Inter_Tight, Noto_Sans_SC } from "next/font/google";
import { locales, type Locale } from "@/lib/messages";

const latin = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--font-latin" });
// CJK glyphs come from the font's unicode-range slices; only the ones a page uses are downloaded.
const han = Noto_Sans_SC({ weight: ["500", "600", "700"], preload: false, display: "swap", variable: "--font-han" });

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <html lang={locale} className={`${latin.variable} ${han.variable}`}><body>{children}</body></html>;
}
