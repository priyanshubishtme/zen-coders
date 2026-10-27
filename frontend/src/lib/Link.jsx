import { navigate } from '@/lib/path.js';

/** In-app link that still works with open-in-new-tab. */
export function Link({ href, children, className, ...props }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        if (new URL(href, window.location.origin).origin !== window.location.origin) return;
        e.preventDefault();
        navigate(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
