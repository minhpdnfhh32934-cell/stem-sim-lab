/** Why the 2D picture shows instead of the 3D view (the notice of `useNo3dNotice`). */
export function No3dNotice({ text }: { text: string }) {
  return <span className="chem-chip chem-chip--qual">{text}</span>;
}
