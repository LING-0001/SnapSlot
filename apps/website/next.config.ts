import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages:['@linglinglab/web-ui'],output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
