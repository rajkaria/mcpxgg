import Link from 'next/link';
import { blogSource } from '@/lib/source';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Announcements and engineering notes from the MCPX team.',
};

export default function BlogIndex() {
  const dateOf = (d: unknown) =>
    new Date((d as { date?: string }).date ?? 0).getTime();
  const posts = [...blogSource.getPages()].sort(
    (a, b) => dateOf(b.data) - dateOf(a.data),
  );

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Blog</h1>
      <p className="mb-10 text-fd-muted-foreground">
        Announcements and engineering notes from the MCPX team.
      </p>
      <ul className="flex flex-col gap-8">
        {posts.map((post) => {
          const meta = post.data as {
            title: string;
            description?: string;
            date?: string;
          };
          return (
            <li key={post.url}>
              <Link href={post.url} className="group block">
                <h2 className="text-xl font-semibold group-hover:text-fd-primary">
                  {meta.title}
                </h2>
                {meta.date ? (
                  <time className="text-sm text-fd-muted-foreground">
                    {new Date(meta.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                ) : null}
                {meta.description ? (
                  <p className="mt-2 text-fd-muted-foreground">
                    {meta.description}
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
