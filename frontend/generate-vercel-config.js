import fs from "node:fs";

const backendUrl = (
  process.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const config = {
  rewrites: [
    {
      source: "/api/:path*",
      destination: `${backendUrl}/api/:path*`,
    },
    {
      source: "/(.*)",
      destination: "/index.html",
    },
  ],
};

fs.writeFileSync("vercel.json", `${JSON.stringify(config, null, 2)}\n`);
console.log(`Generated vercel.json with backend URL: ${backendUrl}`);
