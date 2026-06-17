// Generic placeholder rendered by every stage route while the real surfaces
// are built out. Shows the stage name and a "coming soon" subtitle.

export default function StagePage({ title }: { title: string }) {
  return (
    <div style={{ padding: '36px 44px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>{title}</h1>
          <p style={{ color: '#525870', fontSize: 13.5, marginTop: 3, fontWeight: 400 }}>
            Coming soon — scaffold
          </p>
        </div>
      </div>
      <div style={{
        border: '1.5px dashed #e0e3ed',
        borderRadius: 10,
        padding: 32,
        color: '#525870',
        fontSize: 14,
        background: '#fff',
        textAlign: 'center',
      }}>
        This stage is reserved and will be built in a future pass.
      </div>
    </div>
  );
}