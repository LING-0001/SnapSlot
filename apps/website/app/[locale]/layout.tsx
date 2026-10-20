import "../globals.css";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/lib/messages";

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <html lang={locale}><body>{children}</body></html>;
}
