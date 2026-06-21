import type { ReactNode } from 'react';

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ id, title, subtitle, right, children, className = '' }: Props) {
  return (
    <section className={`panel ${className}`}>
      <span className="corner-tl" />
      <span className="corner-br" />
      <header className="panel-head">
        <div className="flex items-center gap-2">
          <span className="text-white">{title}</span>
          {subtitle && <span className="text-white/30 normal-case tracking-normal">{subtitle}</span>}
        </div>
        {right}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
