const VARIANTS = {
  primary: 'bg-accent text-accentink hover:opacity-90',
  secondary: 'bg-surface2 text-ink hover:bg-line',
  danger: 'bg-bad text-white hover:opacity-90',
  ghost: 'text-ink hover:bg-surface2',
};
const SIZES = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-1.5 text-sm', lg: 'px-5 py-2.5 text-sm' };

export default function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`no-drag inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
