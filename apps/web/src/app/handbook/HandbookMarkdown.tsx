import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function HandbookMarkdown({ content }: { content: string }) {
  return (
    <div className="handbook-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
