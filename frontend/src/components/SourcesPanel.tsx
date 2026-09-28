import { ChatMessage } from "../types";
import { IconClose } from "./Icons";

interface Props {
  message: ChatMessage | null;
  onClose: () => void;
}

export default function SourcesPanel({ message, onClose }: Props) {
  return (
    <aside className="sources-panel">
      <div className="sources-panel-header">
        <span>Sources</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close sources">
          <IconClose />
        </button>
      </div>

      {!message || !message.sources || message.sources.length === 0 ? (
        <div className="sources-empty">
          No cited chunks for this answer yet. Ask a question and open the book icon on the reply.
        </div>
      ) : (
        <ul className="sources-list">
          {message.sources.map((src) => (
            <li key={src} className="sources-item">
              <span className="sources-item-dot" />
              {src}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
