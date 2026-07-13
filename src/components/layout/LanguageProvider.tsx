"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { themeConfig } from "@/app/theme";
import { type AppLocale, translateText } from "@/lib/i18n";

type LanguageContextValue = { locale: AppLocale; setLocale: (locale: AppLocale) => void };
const LanguageContext = createContext<LanguageContextValue>({ locale: "zh", setLocale: () => undefined });

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("zh");
  const textOriginals = useRef(new WeakMap<Text, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    const saved = requested === "en" || requested === "zh" ? requested : window.localStorage.getItem("mes-locale");
    if (saved === "en" || saved === "zh") {
      window.localStorage.setItem("mes-locale", saved);
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    const translateNode = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let node: Node | null = root;
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node as Text;
          const parent = text.parentElement;
          if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
            if (!textOriginals.current.has(text)) textOriginals.current.set(text, text.nodeValue ?? "");
            const original = textOriginals.current.get(text) ?? "";
            text.nodeValue = locale === "en" ? translateText(original) : original;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          for (const attribute of ["placeholder", "title", "aria-label"]) {
            const current = element.getAttribute(attribute);
            if (!current) continue;
            let originals = attributeOriginals.current.get(element);
            if (!originals) { originals = new Map(); attributeOriginals.current.set(element, originals); }
            if (!originals.has(attribute)) originals.set(attribute, current);
            const original = originals.get(attribute) ?? current;
            element.setAttribute(attribute, locale === "en" ? translateText(original) : original);
          }
        }
        node = walker.nextNode();
      }
    };

    translateNode(document.body);
    const observer = new MutationObserver((mutations) => {
      if (locale !== "en") return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) translateNode(node);
        if (mutation.type === "characterData") translateNode(mutation.target);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale: (next: AppLocale) => {
      window.localStorage.setItem("mes-locale", next);
      window.location.reload();
    },
  }), [locale]);

  return <LanguageContext.Provider value={value}><ConfigProvider theme={themeConfig} locale={locale === "en" ? enUS : zhCN}>{children}</ConfigProvider></LanguageContext.Provider>;
}
