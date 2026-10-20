// Landing pages (/l/<slug>): no site header or footer by default, each page chooses its own frame.
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
