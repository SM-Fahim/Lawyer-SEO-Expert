// Vite's ?raw imports, used by a test that reads a script's source.
declare module '*?raw' {
  const content: string;
  export default content;
}
