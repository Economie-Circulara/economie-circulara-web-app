import Link from "next/link";
import type * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { manualImageSrc, manualLinkHref } from "./links";
import { remarkHeadingId } from "./remark-heading-id";

/** Nod hast minimal - avem nevoie doar de textul lui (vezi `blockquote`). */
interface HastNode {
  type?: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
}

function hastText(node?: HastNode): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(hastText).join("");
}

/** Paragraf care contine doar o imagine (restul fiind spatii). */
function isOnlyImage(node?: HastNode): boolean {
  const children = (node?.children ?? []).filter(
    (child) => child.type !== "text" || (child.value ?? "").trim() !== "",
  );
  return children.length === 1 && children[0].tagName === "img";
}

/** Titlurile au `id` de la `rehype-slug`; `scroll-mt-24` le tine sub antet la ancorare. */
function heading(level: 1 | 2 | 3 | 4, className: string) {
  const Tag = `h${level}` as const;
  return function Heading({ id, children }: React.ComponentPropsWithoutRef<"h2">) {
    return (
      <Tag id={id} className={cn("scroll-mt-24 font-semibold tracking-tight", className)}>
        {children}
      </Tag>
    );
  };
}

const components: Components = {
  h1: heading(1, "mt-2 text-2xl"),
  h2: heading(2, "mt-10 border-b pb-2 text-xl"),
  h3: heading(3, "mt-8 text-lg"),
  h4: heading(4, "mt-6 text-base"),

  // O captura singura pe rand ajunge, in markdown, intr-un paragraf - iar `<figure>`
  // nu are voie in `<p>`. Cand paragraful contine doar imaginea, il sarim.
  p: ({ node, children }) => {
    if (isOnlyImage(node as HastNode)) return <>{children}</>;
    return <p className="mt-4 leading-relaxed">{children}</p>;
  },
  ul: ({ children }) => <ul className="mt-4 ml-5 list-disc space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 ml-5 list-decimal space-y-1.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="my-10" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,

  code: ({ children }) => (
    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-lg border bg-secondary/60 p-4 text-sm [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),

  // Capturile inca neadaugate sunt marcate in markdown cu "> 📷 **[Captură de adăugat: ...]**".
  // Le randam ca nota discreta, nu ca citat proeminent.
  blockquote: ({ node, children }) => {
    const pending = hastText(node as HastNode)
      .trimStart()
      .startsWith("📷");
    return (
      <blockquote
        className={cn(
          "mt-4 rounded-lg border-l-4 px-4 py-3",
          pending
            ? "border-border bg-secondary/40 text-sm text-muted-foreground"
            : "border-primary bg-secondary/60",
        )}
      >
        {children}
      </blockquote>
    );
  },

  table: ({ children }) => (
    <div className="mt-6">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell className="align-top">{children}</TableCell>,

  // Capturile stau in `docs/manual/img/` (in afara `public/`) si sunt servite, doar
  // autentificat, de `/ajutor/img/[...path]`. `next/image` NU merge pe o ruta pazita:
  // optimizatorul face fetch server-side, fara cookie-urile userului.
  img: ({ src, alt }) => {
    const resolved = manualImageSrc(typeof src === "string" ? src : undefined);
    if (!resolved) return null;
    return (
      <figure className="mt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          className="w-full rounded-lg border"
        />
        {alt ? <figcaption className="mt-2 text-xs text-muted-foreground">{alt}</figcaption> : null}
      </figure>
    );
  },

  a: ({ href, children }) => {
    const link = manualLinkHref(href);
    switch (link.kind) {
      case "internal":
        return (
          <Link href={link.href} className="text-primary underline underline-offset-4">
            {children}
          </Link>
        );
      case "anchor":
        return (
          <a href={link.href} className="text-primary underline underline-offset-4">
            {children}
          </a>
        );
      case "external":
        return (
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            {children}
          </a>
        );
      // Documente de repo (`../handoff.md`) - nu exista in aplicatie, deci doar text.
      default:
        return <span className="text-muted-foreground">{children}</span>;
    }
  },
};

/** Randeaza un document din `docs/manual/` cu stilurile design system-ului. */
export function ManualContent({ markdown }: { markdown: string }) {
  return (
    <div className="text-sm text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHeadingId]}
        rehypePlugins={[rehypeSlug]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
