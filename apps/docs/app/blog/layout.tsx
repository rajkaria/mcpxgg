import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import { baseOptions } from '../layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions}>
      <div className="mx-auto w-full max-w-3xl px-6 py-12">{children}</div>
    </HomeLayout>
  );
}
