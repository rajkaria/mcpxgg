import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// Shared chrome for the docs + blog layouts.
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: 'MCPX',
  },
  links: [
    {
      text: 'Docs',
      url: '/docs',
      active: 'nested-url',
    },
    {
      text: 'Blog',
      url: '/blog',
      active: 'nested-url',
    },
    {
      text: 'mcpx.gg',
      url: 'https://mcpx.gg',
      external: true,
    },
    {
      text: 'GitHub',
      url: 'https://github.com/rajkaria/mcpxgg',
      external: true,
    },
  ],
};
