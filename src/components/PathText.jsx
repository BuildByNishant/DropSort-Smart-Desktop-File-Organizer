// Paths are truncated safely; the full path is always available as a tooltip and by selecting the text.
export default function PathText({ path, className = '' }) {
  return (
    <span title={path} className={`block truncate select-text font-mono text-xs ${className}`}>
      {path}
    </span>
  );
}
