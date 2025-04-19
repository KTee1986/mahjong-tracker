import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const isAdmin = sessionStorage.getItem("admin") === "true";
    if (isAdmin) router.replace("/score-entry");
  }, []);

  const handleLogin = () => {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      sessionStorage.setItem("admin", "true");
      router.replace("/score-entry");
    } else {
      setError("Incorrect password.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
      <input
        type="password"
        placeholder="Enter admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="p-2 rounded bg-gray-800 text-white w-full max-w-xs"
      />
      {error && <p className="text-red-400 mt-2">{error}</p>}
      <button
        onClick={handleLogin}
        className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
      >
        Log In
      </button>
    </div>
  );
}
