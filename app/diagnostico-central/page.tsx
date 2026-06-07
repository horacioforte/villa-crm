"use client";

import { useEffect, useState } from "react";

const LANDING_HTML_PATH = "/central-concreto.html";
const INJECTED_ATTR = "data-diagnostico-central";

function clearInjectedAssets() {
  document
    .querySelectorAll(`[${INJECTED_ATTR}="true"]`)
    .forEach((element) => element.remove());
}

function injectHeadAssets(documentHtml: Document) {
  clearInjectedAssets();

  documentHtml.head
    .querySelectorAll("style, link[rel='stylesheet'], link[rel='preconnect']")
    .forEach((asset) => {
      const clone = asset.cloneNode(true) as HTMLElement;
      clone.setAttribute(INJECTED_ATTR, "true");
      document.head.appendChild(clone);
    });
}

function injectScripts(scripts: HTMLScriptElement[]) {
  scripts.forEach((script) => {
    const nextScript = document.createElement("script");
    nextScript.setAttribute(INJECTED_ATTR, "true");

    Array.from(script.attributes).forEach((attribute) => {
      nextScript.setAttribute(attribute.name, attribute.value);
    });

    nextScript.textContent = script.textContent;
    document.body.appendChild(nextScript);
  });
}

export default function DiagnosticoCentralPage() {
  const [html, setHtml] = useState("");
  const [scripts, setScripts] = useState<HTMLScriptElement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLanding() {
      try {
        const response = await fetch(LANDING_HTML_PATH);

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar o diagnostico.");
        }

        const source = await response.text();
        const parsed = new DOMParser().parseFromString(source, "text/html");

        if (cancelled) {
          return;
        }

        document.title = parsed.title || "Diagnóstico Central de Concreto";
        const description = parsed.querySelector("meta[name='description']");
        const currentDescription = document.querySelector("meta[name='description']");

        if (description?.getAttribute("content")) {
          if (currentDescription) {
            currentDescription.setAttribute("content", description.getAttribute("content") ?? "");
          } else {
            const meta = document.createElement("meta");
            meta.name = "description";
            meta.content = description.getAttribute("content") ?? "";
            meta.setAttribute(INJECTED_ATTR, "true");
            document.head.appendChild(meta);
          }
        }

        injectHeadAssets(parsed);
        const parsedScripts = Array.from(parsed.body.querySelectorAll("script"));
        parsedScripts.forEach((script) => script.remove());
        setScripts(parsedScripts);
        setHtml(parsed.body.innerHTML);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Erro ao carregar diagnostico.",
          );
        }
      }
    }

    void loadLanding();

    return () => {
      cancelled = true;
      clearInjectedAssets();
    };
  }, []);

  useEffect(() => {
    if (!html || scripts.length === 0) {
      return;
    }

    injectScripts(scripts);

    return () => {
      clearInjectedAssets();
    };
  }, [html, scripts]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Diagnóstico indisponível</h1>
          <p className="mt-2">{error}</p>
        </div>
      </main>
    );
  }

  if (!html) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-700">
        Carregando diagnóstico...
      </main>
    );
  }

  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
