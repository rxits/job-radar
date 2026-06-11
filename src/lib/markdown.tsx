import React from "react";

export function Markdown({ md }: { md: string }) {
  const blocks = md.replace(/\r/g, "").split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
    );
  return (
    <>
      {blocks.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t.startsWith("### ")) return <h3 key={i}>{inline(t.slice(4))}</h3>;
        if (t.startsWith("## ")) return <h2 key={i}>{inline(t.slice(3))}</h2>;
        if (t.startsWith("# ")) return <h1 key={i}>{inline(t.slice(2))}</h1>;
        if (/^[-*] /m.test(t))
          return (
            <ul key={i}>
              {t.split("\n").filter((l) => /^[-*] /.test(l.trim())).map((l, j) => <li key={j}>{inline(l.trim().slice(2))}</li>)}
            </ul>
          );
        if (/^---+$/.test(t)) return <hr key={i} />;
        return <p key={i}>{t.split("\n").map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(l)}</React.Fragment>)}</p>;
      })}
    </>
  );
}
