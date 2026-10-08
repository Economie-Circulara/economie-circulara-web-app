import { cn } from "@/lib/utils";
import { parseRichNote, type RichNoteLine } from "@/lib/text/rich-note";

function Line({ line }: { line: RichNoteLine }) {
  return (
    <>
      {line.map((segment, index) =>
        segment.bold ? (
          <strong key={index}>{segment.text}</strong>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Nota libera afisata cu formatarea minima din `parseRichNote` (paragrafe, liste,
 * ingrosat). Textul nu e interpretat ca HTML - React il escapeaza ca pe orice text.
 */
export function RichNote({ text, className }: { text: string | null; className?: string }) {
  const blocks = parseRichNote(text);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {blocks.map((block, blockIndex) =>
        block.type === "paragraph" ? (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <Line line={line} />
              </span>
            ))}
          </p>
        ) : (
          <ul key={blockIndex} className="list-disc space-y-0.5 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Line line={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
