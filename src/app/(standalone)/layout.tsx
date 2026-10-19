// Pages without the site header and footer: form pages.
export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
