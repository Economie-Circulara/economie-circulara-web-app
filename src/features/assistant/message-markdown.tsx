import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Randeaza raspunsul modelului. NU `rehype-raw` - output-ul LLM nu trebuie sa poata
 * randa HTML brut. Fara imagini - n-au ce cauta intr-un chat de actiuni.
 */
const components: Components = {
  p: ({ children }) => <p className="mt-2 leading-relaxed first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 ml-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Fara heading nativ - ar arata stricat intr-o bula de 85% latime. Daca modelul
  // scoate totusi un "#", il degradam la un paragraf bold in loc sa arate rupt.
  h1: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,
  h4: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,

  code: ({ children }) => (
    <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-md bg-black/10 p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell className="align-top">{children}</TableCell>,

  // Fara imagini in chat.
  img: () => null,

  a: ({ href, children }) => {
    if (!href) return <>{children}</>;
    if (href.startsWith("/")) {
      return (
        <Link href={href} className="text-primary underline underline-offset-4">
          {children}
        </Link>
      );
    }
    if (/^(?:https?:|mailto:)/i.test(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {children}
        </a>
      );
    }
    // Orice altceva (relativ fara slash, javascript:, etc.) - text simplu, niciodata link.
    return <>{children}</>;
  },
};

export function MessageMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
