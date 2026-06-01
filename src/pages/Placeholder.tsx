export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <>
      <div className="page-h">
        <div><h1>{title}</h1></div>
      </div>
      <div className="card">
        <div className="scaffold">{note}</div>
      </div>
    </>
  );
}
