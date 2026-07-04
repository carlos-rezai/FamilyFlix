import type { SVGProps, ReactNode } from 'react';

export type IconProps = {
  size?: number;
  title?: string;
  children?: ReactNode;
} & SVGProps<SVGSVGElement>;

/**
 * The shared 24×24 SVG frame every icon renders through. Icons color with
 * `currentColor` so they inherit the surrounding text color with no variants.
 * Pass `title` for a meaningful icon (renders `role="img"` + `<title>`);
 * decorative icons stay `aria-hidden`.
 */
export function IconBase({ size = 20, title, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
