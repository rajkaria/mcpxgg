import { docs, blog } from '@/.source/server';
import { loader } from 'fumadocs-core/source';

// The docs content tree. URL-rooted at /docs.
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

// The blog collection. URL-rooted at /blog.
export const blogSource = loader({
  baseUrl: '/blog',
  source: blog.toFumadocsSource(),
});
