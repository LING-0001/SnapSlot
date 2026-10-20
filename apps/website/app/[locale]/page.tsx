import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, messages, type Locale } from "@/lib/messages";
import { Home } from "@/components/home";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  const m = messages[locale as Locale];
  return {
    title: m.title, description: m.description,
    icons: { icon: "/icon.svg" },
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}/`])) },
    openGraph: { title: m.title, description: m.description, locale, type: "website" },
  };
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <Home locale={locale as Locale} m={messages[locale as Locale]} />;
}
