/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

// pdfmake / html-to-pdfmake ship no TypeScript declarations. We use them
// only through narrow call-sites (DocumentArtifact) so a loose `any`
// module shim keeps the build green without pulling @types packages.
declare module 'html-to-pdfmake';
declare module 'pdfmake/build/pdfmake';
declare module 'pdfmake/build/vfs_fonts';
