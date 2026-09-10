// Declarations for dependencies that ship no types of their own.

declare module "namecase" {
  /** Capitalizes a personal name, handling Mc/Mac/O'/van-style prefixes. */
  const namecase: (name: string) => string;
  export default namecase;
}
