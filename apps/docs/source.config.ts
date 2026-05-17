import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

// Docs section — the main content tree (Home, Quickstart, Core concepts,
// SDK reference, x402 spec, Move reference, Recipes).
export const docs = defineDocs({
  dir: 'content/docs',
});

// Blog section — announcement posts (S8-T12: "MCPX is mainnet on Sui").
// Modelled as a docs collection so it exposes `.toFumadocsSource()`.
// `date` / `author` frontmatter is read defensively in the blog pages.
export const blog = defineDocs({
  dir: 'content/blog',
});

export default defineConfig({
  mdxOptions: {
    // Default rehype/remark plugins from fumadocs are sufficient.
  },
});
