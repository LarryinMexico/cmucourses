/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  /** Workspace package shipped as TypeScript source */
  transpilePackages: ["@cmucourses/profile"],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default config;
