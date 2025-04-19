import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function Chart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then(res => res.json())
      .then(({ data }) => {
        const entries = data.slice(1).map(row => ({
          timestamp: row[1],
          East: Number(row[3] || 0),
          South: Number(row[5] || 0),
          West: Number(row[7] || 0),
          North: Number(row[9] || 0),
        }));
        setData(entries);
      });
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Chart</h1>
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="East" stroke="#8884d8" />
            <Line type="monotone" dataKey="South" stroke="#82ca9d" />
            <Line type="monotone" dataKey="West" stroke="#ffc658" />
            <Line type="monotone" dataKey="North" stroke="#ff7300" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Layout>
  );
}
