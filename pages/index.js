import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Home() {
  const sections = [
    "Score Entry",
    "Running Total",
    "Chart",
    "Game History",
    "Player Insights",
    "Stats",
    "Advanced Stats",
    "Head-to-Head",
  ];

  const [activeTab, setActiveTab] = useState("Score Entry");

  const renderSection = () => {
    return (
      <iframe
        src={`/${activeTab.toLowerCase().replace(/ /g, "-")}`}
        className="w-full h-full"
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <nav className="bg-gray-800 p-4 flex flex-wrap justify-center">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveTab(section)}
            className={`mx-2 px-3 py-1 rounded ${
              activeTab === section
                ? "bg-blue-600 font-bold"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {section}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-hidden">
        <div className="h-full">{renderSection()}</div>
      </main>
    </div>
  );
}
