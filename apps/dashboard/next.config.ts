import type { NextConfig } from "next";
const nextConfig: NextConfig = { transpilePackages: ["@lg/events"], output: "standalone" };
export default nextConfig;
