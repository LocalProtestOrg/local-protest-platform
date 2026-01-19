import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/email-your-congressperson", label: "Email Your Congressperson" },
  { href: "/create", label: "Create" },
  { href: "/login", label: "Login" },
];

export default function MainNav() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-900">
          Local Assembly
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-neutral-700 hover:text-neutral-900">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
