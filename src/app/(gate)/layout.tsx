export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-background" aria-hidden />
      {children}
    </>
  );
}
