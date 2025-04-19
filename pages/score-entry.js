import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

export default function ScoreEntry() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") {
      router.replace("/login");
    } else {
      setIsAdmin(true);
    }
  }, []);

  if (isAdmin === null) return null; // Wait until check finishes

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>
      {/* ⬇️ Add score form component here when ready */}
    </Layout>
  );
}
