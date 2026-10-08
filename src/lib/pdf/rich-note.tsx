import { Text, View } from "@react-pdf/renderer";
import { parseRichNote, type RichNoteLine } from "@/lib/text/rich-note";

function Line({ line }: { line: RichNoteLine }) {
  return (
    <>
      {line.map((segment, index) => (
        <Text key={index} style={segment.bold ? { fontWeight: 700 } : undefined}>
          {segment.text}
        </Text>
      ))}
    </>
  );
}

/**
 * Nota libera (nota de comanda, observatiile livrarii) randata in PDF cu formatarea
 * minima din `parseRichNote`: paragrafe, liste cu buline, ingrosat. Acelasi parser ca
 * pe ecran (`components/rich-note.tsx`), deci avizul arata ce a vazut utilizatorul.
 */
export function PdfRichNote({ text, fontSize = 9.5 }: { text: string | null; fontSize?: number }) {
  const blocks = parseRichNote(text);
  const style = { fontSize };
  return (
    <View style={{ flex: 1 }}>
      {blocks.map((block, blockIndex) =>
        block.type === "paragraph" ? (
          <View key={blockIndex} style={{ marginBottom: 3 }}>
            {block.lines.map((line, lineIndex) => (
              <Text key={lineIndex} style={style}>
                <Line line={line} />
              </Text>
            ))}
          </View>
        ) : (
          <View key={blockIndex} style={{ marginBottom: 3 }}>
            {block.items.map((item, itemIndex) => (
              <View key={itemIndex} style={{ flexDirection: "row" }}>
                <Text style={{ fontSize, width: 10 }}>•</Text>
                <Text style={{ fontSize, flex: 1 }}>
                  <Line line={item} />
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
