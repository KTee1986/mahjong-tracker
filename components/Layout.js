import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Score Entry", path: "/score-entry" },
  { label: "Running Total", path: "/running-total" },
  { label: "Chart", path: "/chart" },
  { label: "(GOOD) Game History", path: "/game-history" },
  { label: "Player Insights", path: "/player-insights" },
  { label: "Stats", path: "/stats" },
  { label: "Advanced Stats", path: "/advanced-stats" },
  { label: "Head-to-Head", path: "/head-to-head" },
  { label: "Player List", path: "/player-list" },
];

export default function Layout({ children }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("admin") === "true");
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <nav className="bg-gray-800 px-4 py-3 flex flex-wrap items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`px-3 py-1 rounded ${
                router.pathname === item.path
                  ? "bg-blue-600 font-bold"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {isAdmin && (
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
          >
            Logout
          </button>
        )}
      </nav>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
