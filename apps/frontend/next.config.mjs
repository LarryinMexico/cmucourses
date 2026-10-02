/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  /** Workspace package shipped as TypeScript source */
  transpilePackages: ["@cmucourses/profile"],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  /** The dev-mode "N" badge sits over the footer text (and shows up in demo recordings). */
  devIndicators: false,
};

export default config;
