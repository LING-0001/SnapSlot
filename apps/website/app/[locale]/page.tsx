import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/lib/locales";
import { homeCopy } from "@/lib/home-copy";
import { Home } from "@/components/home";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  const copy = homeCopy[locale as Locale];
  const title = `SnapSlot${copy.name ? ` ${copy.name}` : ""} — ${copy.headline}`;
  return {
    title, description: copy.sub,
    icons: { icon: "/icon.svg" },
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}/`])) },
    openGraph: { title, description: copy.sub, locale, type: "website" },
  };
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <Home locale={locale as Locale} />;
}
