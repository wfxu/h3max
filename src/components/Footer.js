import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-divider/40 bg-bg-page py-6 text-xs text-secondary-text mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          &copy; {new Date().getFullYear()} h3max.info · Independent community project, not affiliated with MiniMax or fal.ai.
        </div>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-primary-text transition-colors">Home</Link>
          <Link href="/studio" className="hover:text-primary-text transition-colors">Studio</Link>
          <Link href="/pricing" className="hover:text-primary-text transition-colors">Credits</Link>
          <Link href="/legal/terms" className="hover:text-primary-text transition-colors">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-primary-text transition-colors">Privacy</Link>
          <Link href="/legal/refunds" className="hover:text-primary-text transition-colors">Refunds</Link>
          <Link href="/contact" className="hover:text-primary-text transition-colors">Contact</Link>
          <a href="https://github.com/wfxu/h3max" target="_blank" rel="noopener noreferrer" className="hover:text-primary-text transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
