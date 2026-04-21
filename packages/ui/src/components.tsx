import * as React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

function joinClasses(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={joinClasses('rg-button', `rg-button--${variant}`, `rg-button--${size}`, className)}
      {...props}
    />
  );
}

export function IconButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={joinClasses('rg-icon-button', className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses('rg-card', className)} {...props} />;
}

export function Badge({ className, tone = 'neutral', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'success' | 'warning' }) {
  return <span className={joinClasses('rg-badge', `rg-badge--${tone}`, className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={joinClasses('rg-input', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={joinClasses('rg-textarea', className)} {...props} />;
}

export function Avatar({ className, name }: { className?: string; name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return <div className={joinClasses('rg-avatar', className)}>{initials || 'U'}</div>;
}

export function Divider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses('rg-divider', className)} {...props} />;
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="rg-section-title">
      {eyebrow ? <p className="rg-section-title__eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rg-empty-state">
      <div className="rg-empty-state__orb" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="rg-empty-state__action">{action}</div> : null}
    </div>
  );
}

export function MessageBubble({
  role,
  children,
  meta,
  className
}: {
  role: 'user' | 'assistant';
  children: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={joinClasses('rg-message', role === 'user' ? 'rg-message--user' : 'rg-message--assistant', className)}>
      <div className="rg-message__header">
        <span className="rg-message__role">{role === 'user' ? 'You' : 'Assistant'}</span>
        {meta ? <span className="rg-message__meta">{meta}</span> : null}
      </div>
      <div className="rg-message__body">{children}</div>
    </article>
  );
}

export function ConversationListItem({
  active,
  title,
  subtitle,
  onClick
}: {
  active?: boolean;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={joinClasses('rg-conversation-item', active && 'rg-conversation-item--active')} onClick={onClick}>
      <span className="rg-conversation-item__title">{title}</span>
      {subtitle ? <span className="rg-conversation-item__subtitle">{subtitle}</span> : null}
    </button>
  );
}

export function SourceCard({ title, excerpt, meta }: { title: string; excerpt: string; meta?: string }) {
  return (
    <div className="rg-source-card">
      <div className="rg-source-card__head">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
      <p>{excerpt}</p>
    </div>
  );
}
